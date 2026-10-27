// Internal SEO content agent: topic backlog, briefs, checklists and an approval workflow. DRAFT AND REVIEW ONLY.
//
// This module cannot publish. Publishing stays in the existing, gated blog workspace (quality gate, sanitization,
// sitemap invalidation). It writes no database, makes no network request and invents no dealership facts: a brief
// contains structure and questions for a person to answer, never claims, prices, rates, reviews or guarantees.
import { blogCtaLinks, articleSeoTitle } from "./blog-seo";

export type Topic = {
  id: string;
  title: string;
  keywordTheme: string;
  intent: "informational" | "comparison" | "local-informational";
  /** The page the article should lead the reader to. */
  targetPage: "/search" | "/sell" | "/schedule" | "/contact" | "/finance";
  cluster: string;
};

/** Starting backlog from the approved content plan. Titles are proposals for a human to accept or change. */
export const TOPIC_BACKLOG: Topic[] = [
  { id: "t1", title: "Used Car Shopping Checklist for Fredericksburg, VA Buyers", keywordTheme: "used car buying checklist", intent: "informational", targetPage: "/search", cluster: "Used car buying" },
  { id: "t2", title: "How a Dealership Test Drive Works and What to Bring", keywordTheme: "dealership test drive", intent: "informational", targetPage: "/schedule", cluster: "Used car buying" },
  { id: "t3", title: "Used Car Inspection Checklist: What to Check Before You Buy", keywordTheme: "used car inspection", intent: "informational", targetPage: "/schedule", cluster: "Used car buying" },
  { id: "t4", title: "How to Prepare Your Car for a Trade-In Appraisal", keywordTheme: "trade-in appraisal", intent: "informational", targetPage: "/sell", cluster: "Sell or trade" },
  { id: "t5", title: "Selling Your Car to a Dealership vs. Trading It In", keywordTheme: "sell vs trade", intent: "comparison", targetPage: "/sell", cluster: "Sell or trade" },
  { id: "t6", title: "How to Read a Vehicle History Report Before You Buy", keywordTheme: "vehicle history report", intent: "informational", targetPage: "/search", cluster: "Used car buying" },
  { id: "t7", title: "What to Check When Buying a Used SUV", keywordTheme: "used SUV buying", intent: "informational", targetPage: "/search", cluster: "Vehicle types" },
  { id: "t8", title: "Visiting a Used Car Dealership in Fredericksburg: What to Expect", keywordTheme: "visit used car dealership fredericksburg", intent: "local-informational", targetPage: "/contact", cluster: "Local" },
];

export type Brief = {
  topicId: string;
  h1: string;
  suggestedTitle: string;
  suggestedDescriptionPrompt: string;
  /** Headings only. The writer supplies verified content under each one. */
  outline: Array<{ level: "h2" | "h3"; text: string }>;
  internalLinks: Array<{ to: string; label: string }>;
  imageGuidance: string[];
  factChecklist: string[];
  notes: string[];
};

export const FACT_CHECKLIST: string[] = [
  "Every statement of fact has a named, reliable source, or is removed",
  "No dealership facts beyond the approved list (name, address, phone, financing subject to approval, trade appraisal requests, test drive scheduling)",
  "No financing rates, approval promises, prices, savings or guarantees",
  "No customer reviews, ratings, awards or testimonials unless real and permitted",
  "No claims about specific vehicles, inventory or availability",
  "Automotive advice is general, cautious and checked by a knowledgeable person",
  "Local references (places, roads, events) are real and checked",
  "Links go to existing public pages",
  "Title and meta description are accurate, unique and not keyword-stuffed",
  "Images have accurate alt text and the right to be used",
];

/** A structured brief for a topic. It states what to cover, not what is true. */
export function buildBrief(topic: Topic): Brief {
  const links = blogCtaLinks({ title: topic.title, keywords: topic.keywordTheme });
  const outline: Brief["outline"] = [
    { level: "h2", text: "The short answer" },
    { level: "h2", text: `What to know about ${topic.keywordTheme}` },
    { level: "h3", text: "Common mistakes to avoid" },
    { level: "h2", text: "Questions people ask" },
    { level: "h2", text: "Next steps" },
  ];
  if (topic.intent === "comparison") outline.splice(2, 0, { level: "h2", text: "Side-by-side comparison" });
  if (topic.intent === "local-informational") outline.splice(2, 0, { level: "h2", text: "Getting to the dealership" });
  return {
    topicId: topic.id,
    h1: topic.title,
    suggestedTitle: articleSeoTitle(topic.title),
    suggestedDescriptionPrompt: `One accurate sentence, up to 160 characters, saying what a reader will learn about ${topic.keywordTheme}. Do not promise results.`,
    outline,
    internalLinks: links,
    imageGuidance: [
      "Use real photos where possible; describe what the image shows in the alt text",
      "No stock images of vehicles that imply a specific car for sale",
      "Add an image credit if required",
    ],
    factChecklist: FACT_CHECKLIST,
    notes: [
      "A person writes or edits the draft. AI assistance may suggest wording but is not a source of fact.",
      "The finished article goes through the existing Blog workspace and its quality checks.",
    ],
  };
}

const RISKY_PHRASES: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /guaranteed? (approval|financing)|everyone (is )?approved|no credit check/i, reason: "Unconditional financing or approval claim" },
  { pattern: /lowest (price|rate|payment)s?|best (price|rate|deal)s? (in|around|guaranteed)/i, reason: "Unverifiable price or rate claim" },
  { pattern: /\b\d{1,2}(\.\d+)?\s?%\s?(apr|interest)/i, reason: "A specific rate that must be verified" },
  { pattern: /\b(5|five)[- ]star|rated #?1|award[- ]winning|voted best/i, reason: "Rating, ranking or award claim" },
  { pattern: /\b(100%|always|never) (safe|reliable|accident[- ]free)/i, reason: "Absolute vehicle condition claim" },
];

/** A cheap pre-check of draft text. It is a prompt for human review; the existing quality gate remains the real check. */
export function precheckDraft(text: string): Array<{ reason: string; excerpt: string }> {
  const out: Array<{ reason: string; excerpt: string }> = [];
  for (const { pattern, reason } of RISKY_PHRASES) {
    const match = pattern.exec(text);
    if (match) out.push({ reason, excerpt: text.slice(Math.max(0, match.index - 20), match.index + match[0].length + 20).trim() });
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Workflow                                                                    */
/* -------------------------------------------------------------------------- */

export type Stage =
  | "suggested"
  | "brief"
  | "drafting"
  | "in_review"
  | "approved"
  | "publish_authorized"
  | "published"
  | "monitoring";

export const STAGES: Stage[] = ["suggested", "brief", "drafting", "in_review", "approved", "publish_authorized", "published", "monitoring"];

export type WorkItem = {
  topicId: string;
  stage: Stage;
  author: string | null;
  reviewer: string | null;
  authorizedBy: string | null;
  /** Checklist items the reviewer ticked. */
  checked: string[];
  /** Pre-check findings the reviewer has not resolved. */
  openFindings: number;
  duplicateOf: string | null;
};

export type TransitionResult = { ok: true } | { ok: false; reason: string };

const NEXT: Record<Stage, Stage | null> = {
  suggested: "brief",
  brief: "drafting",
  drafting: "in_review",
  in_review: "approved",
  approved: "publish_authorized",
  publish_authorized: "published",
  published: "monitoring",
  monitoring: null,
};

/**
 * Whether an item may move to a stage. Moves go one step at a time. Approval needs a complete checklist, no open
 * findings, no unresolved duplicate and a reviewer who is not the author. Publishing needs a separate named
 * authorization, and "published" can be recorded only after it. Nothing here publishes: a person publishes in the
 * Blog workspace and then records it.
 */
export function canTransition(item: WorkItem, to: Stage, actor: string | null): TransitionResult {
  if (!actor) return { ok: false, reason: "A signed-in person must make every change." };
  if (NEXT[item.stage] !== to) return { ok: false, reason: `An article cannot move from ${item.stage} to ${to}.` };
  if (to === "in_review" && !item.author) return { ok: false, reason: "The draft needs a named author." };
  if (to === "approved") {
    if (!item.author) return { ok: false, reason: "The draft needs a named author." };
    if (actor === item.author) return { ok: false, reason: "The author cannot approve their own article." };
    if (item.duplicateOf) return { ok: false, reason: `This topic overlaps the published article "${item.duplicateOf}". Resolve that first.` };
    if (item.openFindings > 0) return { ok: false, reason: "Unresolved draft findings remain." };
    const missing = FACT_CHECKLIST.filter((c) => !item.checked.includes(c));
    if (missing.length) return { ok: false, reason: `${missing.length} fact-check item(s) are not ticked.` };
  }
  if (to === "publish_authorized") {
    if (item.reviewer == null) return { ok: false, reason: "Only an approved article with a named reviewer can be authorized." };
    if (actor === item.author) return { ok: false, reason: "The author cannot authorize publication." };
  }
  if (to === "published" && !item.authorizedBy) return { ok: false, reason: "Publication has not been authorized." };
  return { ok: true };
}

export type AuditEntry = { at: string; topicId: string; from: Stage; to: Stage; actor: string; note: string | null };

export function auditEntry(item: WorkItem, to: Stage, actor: string, now: number = Date.now(), note: string | null = null): AuditEntry {
  return { at: new Date(now).toISOString(), topicId: item.topicId, from: item.stage, to, actor, note };
}

/** A Markdown copy of a brief, to paste into the Blog workspace. */
export function briefToMarkdown(topic: Topic, brief: Brief): string {
  const lines = [
    `# ${brief.h1}`,
    "",
    `Keyword theme: ${topic.keywordTheme}  |  Intent: ${topic.intent}  |  Cluster: ${topic.cluster}  |  Lead the reader to: ${topic.targetPage}`,
    "",
    `Suggested title: ${brief.suggestedTitle}`,
    `Meta description: ${brief.suggestedDescriptionPrompt}`,
    "",
    "## Outline (headings only; the writer adds verified content)",
    ...brief.outline.map((h) => `${h.level === "h2" ? "##" : "###"} ${h.text}`),
    "",
    "## Internal links",
    ...brief.internalLinks.map((l) => `- ${l.label}: ${l.to}`),
    "",
    "## Images",
    ...brief.imageGuidance.map((g) => `- ${g}`),
    "",
    "## Fact-check checklist",
    ...brief.factChecklist.map((c) => `- [ ] ${c}`),
  ];
  return lines.join("\n");
}
