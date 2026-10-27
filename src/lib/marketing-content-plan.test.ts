import { readFileSync } from "node:fs";
import * as React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start", () => ({
  useServerFn: (fn: unknown) => fn,
  createServerFn: () => ({ inputValidator: () => ({ handler: () => undefined }) }),
}));

import { ContentAgentPanel } from "../components/admin/MarketingContentPlan";
import {
  FACT_CHECKLIST,
  STAGES,
  TOPIC_BACKLOG,
  auditEntry,
  briefToMarkdown,
  buildBrief,
  canTransition,
  precheckDraft,
  type WorkItem,
} from "./seo-content-agent";

const read = (path: string) => readFileSync(path, "utf8");

/* -------------------------------------------------------------------------- */

const item = (o: Partial<WorkItem> = {}): WorkItem => ({ topicId: "t1", stage: "suggested", author: "Writer", reviewer: null, authorizedBy: null, checked: [], openFindings: 0, duplicateOf: null, ...o });

describe("SEO content agent workflow", () => {
  it("builds a brief of headings and questions with no invented facts", () => {
    for (const topic of TOPIC_BACKLOG) {
      const brief = buildBrief(topic);
      expect(brief.h1).toBe(topic.title);
      expect(brief.suggestedTitle.length).toBeLessThanOrEqual(topic.title.length + 9);
      expect(brief.outline.length).toBeGreaterThanOrEqual(4);
      expect(brief.internalLinks[0]!.to).toBe("/search");
      expect(JSON.stringify(brief.outline)).not.toMatch(/\$\d|%|guarantee|approved|review/i);
      expect(brief.factChecklist).toEqual(FACT_CHECKLIST);
    }
  });

  it("the backlog has unique titles and keyword themes (no cannibalization)", () => {
    expect(new Set(TOPIC_BACKLOG.map((t) => t.title)).size).toBe(TOPIC_BACKLOG.length);
    expect(new Set(TOPIC_BACKLOG.map((t) => t.keywordTheme)).size).toBe(TOPIC_BACKLOG.length);
  });

  it("flags risky claims in a draft for human review", () => {
    expect(precheckDraft("We offer guaranteed approval for everyone.").map((f) => f.reason)).toContain("Unconditional financing or approval claim");
    expect(precheckDraft("Rates from 3.9% APR!").length).toBeGreaterThan(0);
    expect(precheckDraft("Test drives are easy to schedule.")).toEqual([]);
  });

  it("moves one step at a time and needs a signed-in person", () => {
    expect(canTransition(item(), "approved", "Boss")).toMatchObject({ ok: false });
    expect(canTransition(item(), "brief", null)).toMatchObject({ ok: false });
    expect(canTransition(item(), "brief", "Boss")).toEqual({ ok: true });
    expect(canTransition(item({ stage: "monitoring" }), "published", "Boss")).toMatchObject({ ok: false });
  });

  it("approval needs a different reviewer, a full checklist, no findings and no duplicate", () => {
    const ready = item({ stage: "in_review", checked: [...FACT_CHECKLIST] });
    expect(canTransition(ready, "approved", "Writer")).toMatchObject({ ok: false, reason: expect.stringMatching(/own article/) });
    expect(canTransition(ready, "approved", "Editor")).toEqual({ ok: true });
    expect(canTransition({ ...ready, checked: FACT_CHECKLIST.slice(1) }, "approved", "Editor")).toMatchObject({ ok: false, reason: expect.stringMatching(/not ticked/) });
    expect(canTransition({ ...ready, openFindings: 1 }, "approved", "Editor")).toMatchObject({ ok: false });
    expect(canTransition({ ...ready, duplicateOf: "Existing article" }, "approved", "Editor")).toMatchObject({ ok: false, reason: expect.stringMatching(/overlaps/) });
    expect(canTransition({ ...ready, author: null }, "approved", "Editor")).toMatchObject({ ok: false });
  });

  it("publication needs a separate authorization and cannot be recorded without it", () => {
    const approved = item({ stage: "approved", reviewer: "Editor", checked: [...FACT_CHECKLIST] });
    expect(canTransition(approved, "publish_authorized", "Writer")).toMatchObject({ ok: false });
    expect(canTransition(approved, "publish_authorized", "Manager")).toEqual({ ok: true });
    expect(canTransition(item({ stage: "publish_authorized", authorizedBy: null }), "published", "Manager")).toMatchObject({ ok: false });
    expect(canTransition({ ...approved, reviewer: null }, "publish_authorized", "Manager")).toMatchObject({ ok: false });
  });

  it("an audit entry records who moved what and when", () => {
    const entry = auditEntry(item({ stage: "brief" }), "drafting", "Editor", Date.parse("2026-03-10T15:00:00Z"));
    expect(entry).toEqual({ at: "2026-03-10T15:00:00.000Z", topicId: "t1", from: "brief", to: "drafting", actor: "Editor", note: null });
    expect(STAGES).toHaveLength(8);
  });

  it("the Markdown brief carries the checklist and no claims", () => {
    const topic = TOPIC_BACKLOG[0]!;
    const md = briefToMarkdown(topic, buildBrief(topic));
    expect(md).toContain("## Fact-check checklist");
    expect(md).toContain("- [ ] ");
    expect(md.split("## Fact-check checklist")[0]).not.toMatch(/guarantee|\$\d/i);
  });

  it("the agent cannot publish: no write, no network, no scheduling, and the server check is staff-only and read-only", () => {
    const agent = read("src/lib/seo-content-agent.ts");
    expect(agent).not.toMatch(/fetch\(|upsert|\.insert\(|\.update\(|setInterval|setTimeout|cron|github/i);
    const server = read("src/lib/content-agent.functions.ts");
    expect(server).toContain("await requireStaff(data.accessToken);");
    expect(server).toContain("listAutoseoPostsPublic");
    expect(server).not.toMatch(/upsertAutoseoArticle|setAutoseoPublished|updateAutoseoAdminRow|\.insert\(|fetch\(/);
    expect(read("src/components/admin/MarketingContentPlan.tsx")).toContain("Nothing is saved, scheduled or published from this page");
  });

  it("renders the content plan with the draft-only notice", () => {
    const html = renderToString(React.createElement(ContentAgentPanel, { accessToken: "t", userLabel: "Editor" }));
    expect(html).toContain("Draft and review only");
    expect(html).toContain("Fact-check checklist");
    expect(html).toContain("Check against published articles");
  });
});

/* -------------------------------------------------------------------------- */
/* Google Ads budget                                                           */

describe("Marketing Hub content plan tab", () => {
  const hub = read("src/routes/admin.marketing.tsx");

  it("adds the Content Plan tab with a panel and keeps it separate from publishing code", () => {
    expect(hub).toContain('<TabsContent value="contentplan">');
    expect(hub).toMatch(/["contentplan", "[^"]+", [A-Za-z0-9]+]/);
    expect(read("src/components/admin/MarketingContentPlan.tsx")).not.toMatch(/upsertAutoseoArticle|setAutoseoPublished|updateAutoseoAdminRow|fetch\(/);
  });
});
