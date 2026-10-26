import { readFileSync, readdirSync } from "node:fs";
import * as React from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../components/ui/accordion";
import { ARTICLE_TITLE_MAX, articleBreadcrumb, articleSeoTitle, blogCtaLinks, uniqueArticleLinks } from "./blog-seo";
import { buildBlogPostingJsonLd, buildBreadcrumbJsonLd } from "./seo";

const read = (path: string) => readFileSync(path, "utf8");

/* -------------------------------------------------------------------------- */
/* Titles, links and schema helpers                                            */
/* -------------------------------------------------------------------------- */

describe("article titles", () => {
  it("adds the brand when the title fits in search results", () => {
    expect(articleSeoTitle("How to Prepare for a Used Car Test Drive")).toBe("How to Prepare for a Used Car Test Drive | MyCar");
  });

  it("drops the brand, never the article title, when it would be cut off", () => {
    const long = "A Complete Guide to Inspecting a Used SUV Before You Buy in Virginia";
    const title = articleSeoTitle(long);
    expect(title).toBe(long);
    expect(articleSeoTitle("Short title").length).toBeLessThanOrEqual(ARTICLE_TITLE_MAX);
  });
});

describe("topic-aware article links", () => {
  const targets = (input: Parameters<typeof blogCtaLinks>[0]) => blogCtaLinks(input).map((l) => l.to);

  it("always offers inventory first and contact last, and nothing unrelated in between", () => {
    const links = targets({ title: "Why Do Cars Lose Value Over Time?" });
    expect(links[0]).toBe("/search");
    expect(links[links.length - 1]).toBe("/contact");
    expect(links).toEqual(["/search", "/contact"]);
  });

  it("links trade-in and selling topics to the sell page", () => {
    expect(targets({ title: "How to Prepare Your Car for a Trade-In Appraisal" })).toContain("/sell");
    expect(targets({ title: "Selling a car to a dealership", keywords: "sell my car fredericksburg" })).toContain("/sell");
    expect(targets({ title: "Used SUV tips" })).not.toContain("/sell");
  });

  it("links buying, inspection and test-drive topics to scheduling", () => {
    for (const title of ["Used Car Test Drive Checklist", "What to Inspect Before Buying a Used Truck", "Used Car Shopping Tips"]) {
      expect(targets({ title }), title).toContain("/schedule");
    }
    expect(targets({ title: "Understanding tire tread" })).not.toContain("/schedule");
  });

  it("links financing topics to the finance page and uses keywords, tags and descriptions too", () => {
    expect(targets({ title: "Down payment basics" })).toContain("/finance");
    expect(targets({ title: "Plain title", tags: "auto loan, credit" })).toContain("/finance");
    expect(targets({ title: "Plain title", description: "How pre-approval works" })).toContain("/finance");
    expect(targets({ title: "Used SUV tips" })).not.toContain("/finance");
  });

  it("lists each target once, with descriptive and distinct anchor text", () => {
    const links = blogCtaLinks({ title: "Used car buying checklist: financing, trade-in and test drive" });
    const to = links.map((l) => l.to);
    expect(new Set(to).size).toBe(to.length);
    const labels = links.map((l) => l.label);
    expect(new Set(labels).size).toBe(labels.length);
    for (const label of labels) expect(label.split(" ").length).toBeGreaterThanOrEqual(3);
  });
});

describe("all-articles link list", () => {
  it("lists one link per article URL and keeps the hand-written post when a slug is shared", () => {
    const cards = [
      { key: "as-7", slug: "test-drive-tips", title: "AutoSEO version" },
      { key: "mc-3", slug: "test-drive-tips", title: "Hand-written version" },
      { key: "as-8", slug: "trade-in-appraisal", title: "Trade-in" },
      { key: "as-9", slug: "test-drive-tips", title: "Another duplicate" },
    ];
    const links = uniqueArticleLinks(cards);
    expect(links.map((l) => l.slug).sort()).toEqual(["test-drive-tips", "trade-in-appraisal"]);
    expect(links.find((l) => l.slug === "test-drive-tips")?.key).toBe("mc-3");
    expect(uniqueArticleLinks([])).toEqual([]);
  });
});

describe("article structured data", () => {
  const url = "https://mycarcorp.com/blog/test-drive-tips";

  it("never publishes a modified date earlier than the published date", () => {
    const post = buildBlogPostingJsonLd({ url, headline: "x", datePublished: "2026-05-10T00:00:00Z", dateModified: "2026-05-01T00:00:00Z" }) as Record<string, any>;
    expect(post.dateModified).toBe(post.datePublished);
    const later = buildBlogPostingJsonLd({ url, headline: "x", datePublished: "2026-05-10T00:00:00Z", dateModified: "2026-05-20T00:00:00Z" }) as Record<string, any>;
    expect(later.dateModified).toBe("2026-05-20T00:00:00.000Z");
  });

  it("does not invent a date, author person, image or rating", () => {
    const post = buildBlogPostingJsonLd({ url, headline: "x" }) as Record<string, any>;
    expect(post).not.toHaveProperty("datePublished");
    expect(post).not.toHaveProperty("dateModified");
    expect(post).not.toHaveProperty("image");
    expect(post.author["@type"]).toBe("Organization");
    expect(JSON.stringify(post)).not.toMatch(/aggregateRating|review|award/);
  });

  it("builds an absolute breadcrumb trail that matches the visible one", () => {
    const trail = buildBreadcrumbJsonLd(articleBreadcrumb("Test Drive Tips", "test-drive-tips")) as { itemListElement: Array<{ position: number; name: string; item: string }> };
    expect(trail.itemListElement.map((i) => [i.position, i.name, i.item])).toEqual([
      [1, "Home", "https://mycarcorp.com/"],
      [2, "Blog", "https://mycarcorp.com/blog"],
      [3, "Test Drive Tips", url],
    ]);
  });
});

/* -------------------------------------------------------------------------- */
/* Route wiring (source-level) for both article types                          */
/* -------------------------------------------------------------------------- */

describe("blog article route", () => {
  const route = read("src/routes/blog.$slug.tsx");

  it("emits exactly one BlogPosting and one BreadcrumbList per article type, from shared builders", () => {
    expect((route.match(/buildBlogPostingJsonLd\(/g) ?? []).length).toBe(2);
    expect((route.match(/buildBreadcrumbJsonLd\(articleBreadcrumb\(/g) ?? []).length).toBe(2);
    expect(route).not.toMatch(/"@type":\s*"Article"/);
  });

  it("builds canonical URLs on the real domain for AutoSEO and legacy articles", () => {
    expect(route).toContain("const canonicalUrl = `${ORIGIN}/blog/${a.slug}`;");
    expect(route).toContain("const url = `${ORIGIN}/blog/${params.slug}`;");
    expect((route.match(/rel:\s*"canonical"/g) ?? []).length).toBe(2);
  });

  it("missing, unpublished or deleted articles are a real 404 with noindex", () => {
    expect(route).toMatch(/if \(!article\) throw notFound\(\);/);
    expect(route).toMatch(/if \(!loaderData\) \{[\s\S]*?name:\s*"robots",\s*content:\s*"noindex"/);
  });

  it("overlapping AutoSEO intents 301 to the established URL instead of creating a second indexable page", () => {
    expect(route).toMatch(/throw redirect\(\{[\s\S]*?statusCode:\s*301/);
  });

  it("shows a breadcrumb and topic-aware next steps on both AutoSEO and legacy articles", () => {
    expect((route.match(/<ArticleBreadcrumb /g) ?? []).length).toBe(2);
    expect((route.match(/<ArticleNextSteps /g) ?? []).length).toBe(2);
  });

  it("keeps FAQ answers in the page HTML and FAQ schema only when the FAQ is shown", () => {
    expect(route).toContain("<AccordionContent forceMount");
    expect(route).toMatch(/if \(faqs\.length > 0\)/);
    expect(route).toMatch(/\{faqs\.length > 0 && \(/);
  });

  it("does not touch article bodies: no rewriting of stored content, only the existing display transforms", () => {
    expect(route).not.toMatch(/content_html\s*=\s|\.update\(|PATCH|upsert/);
  });

  it("uses the length-aware title for AutoSEO and legacy articles without a custom meta title", () => {
    expect(route).toContain("articleSeoTitle(a.title)");
    expect(route).toContain("(p.meta_title as string) || articleSeoTitle(p.title)");
  });
});

describe("FAQ answers in server-rendered HTML", () => {
  const faqs = [
    { question: "What should I bring to a test drive?", answer: "Bring a valid driver license." },
    { question: "How long does a test drive take?", answer: "Plan on about thirty minutes." },
    { question: "Can I take a vehicle to my mechanic?", answer: "Ask the dealership team in advance." },
  ];

  const render = (forceMount: boolean) =>
    renderToString(
      React.createElement(
        Accordion,
        { type: "single", collapsible: true, defaultValue: "faq-0" },
        faqs.map((f, i) =>
          React.createElement(
            AccordionItem,
            { key: f.question, value: `faq-${i}` },
            React.createElement(AccordionTrigger, null, f.question),
            React.createElement(AccordionContent, forceMount ? { forceMount: true as const } : {}, f.answer),
          ),
        ),
      ),
    );

  it("collapsed answers are missing from the HTML without forceMount (the gap that was fixed)", () => {
    const html = render(false);
    expect(html).toContain("Bring a valid driver license.");
    expect(html).not.toContain("Plan on about thirty minutes.");
  });

  it("every answer is in the HTML with forceMount, and closed ones carry the markers the page CSS hides", () => {
    const html = render(true);
    for (const f of faqs) expect(html).toContain(f.answer);
    // Radix adds no hidden attribute for force-mounted content: the closed region is identified by role and state.
    const closed = html.match(/<div data-state="closed"[^>]*role="region"[^>]*>/g) ?? [];
    expect(closed).toHaveLength(2);
    const route = read("src/routes/blog.$slug.tsx");
    expect(route).toContain('.faq-accordion [role="region"][data-state="closed"]{display:none}');
    expect(route).toContain('className="faq-accordion mt-4"');
  });
});

/* -------------------------------------------------------------------------- */
/* Blog index and crawlability                                                 */
/* -------------------------------------------------------------------------- */

describe("blog index crawlability", () => {
  const index = read("src/routes/blog.index.tsx");

  it("lists every article as a plain server-rendered link, not only the first page behind a button", () => {
    expect(index).toContain("Browse all {allLinks.length} articles");
    expect(index).toMatch(/\{allLinks\.map\(\(c\) => \(\s*<li key=\{c\.key\}[^>]*>\s*<Link to="\/blog\/\$slug" params=\{\{ slug: c\.slug \}\}/);
    expect(index).toContain("allLinks.length > PAGE + 1");
    expect(index).toContain("const allLinks = uniqueArticleLinks(cards);");
  });

  it("keeps the canonical, title and a single H1", () => {
    expect(index).toContain('href: "https://mycarcorp.com/blog"');
    expect((index.match(/<h1/g) ?? []).length).toBe(1);
  });

  it("the footer links the areas page that no other page linked to", () => {
    expect(read("src/components/SiteFooter.tsx")).toMatch(/<Link to="\/locations"[^>]*>\s*Areas we serve/);
  });
});

/* -------------------------------------------------------------------------- */
/* Published-only data access and the sitemap                                  */
/* -------------------------------------------------------------------------- */

describe("published-only article access", () => {
  const server = read("src/lib/autoseo-blog.server.ts");

  it("every public AutoSEO query is limited to published, approved articles that have a publish date", () => {
    const gate = "status=eq.published&quality_status=eq.approved&published_at=not.is.null";
    expect((server.match(new RegExp(gate.replace(/[.?]/g, "\\$&"), "g")) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it("hand-written articles are limited to published ones", () => {
    const legacy = read("src/lib/legacy-blog.server.ts");
    expect((legacy.match(/mc_blog\?select=\*&status=eq\.published/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });
});

describe("AutoSEO article sitemap and ingestion (simulated database)", () => {
  type Row = Record<string, unknown>;
  const calls: Array<{ url: string; method: string; body: unknown }> = [];
  let tableRows: Row[] = [];

  beforeEach(() => {
    calls.length = 0;
    process.env["LEGACY_SUPABASE_URL"] = "https://example.test";
    process.env["LEGACY_SUPABASE_SERVICE_ROLE_KEY"] = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";
        calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
        if (method === "GET" && url.includes("/blog_posts")) return new Response(JSON.stringify(tableRows), { status: 200 });
        if (method === "GET") return new Response("[]", { status: 200 });
        return new Response("", { status: 201 });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env["LEGACY_SUPABASE_URL"];
    delete process.env["LEGACY_SUPABASE_SERVICE_ROLE_KEY"];
    tableRows = [];
  });

  it("asks the database for published, approved articles only when building the sitemap", async () => {
    tableRows = [];
    const { sitemapUrls } = await import("./autoseo-blog.server");
    await sitemapUrls();
    const query = calls.find((c) => c.url.includes("/blog_posts"))!.url;
    expect(query).toContain("status=eq.published");
    expect(query).toContain("quality_status=eq.approved");
    expect(query).toContain("published_at=not.is.null");
  });

  it("lists one canonical URL per search intent and uses a real update time", async () => {
    tableRows = [
      { id: 1, title: "Used Car Test Drive Checklist", slug: "used-car-test-drive-checklist", meta_keywords: "test drive checklist", tags: "", updated_at: "2026-02-02T00:00:00Z", published_at: "2026-01-01T00:00:00Z", created_at: null },
      { id: 2, title: "Used Car Test Drive Checklist: What To Check", slug: "used-car-test-drive-checklist-2", meta_keywords: "test drive checklist", tags: "", updated_at: "2026-03-03T00:00:00Z", published_at: "2026-03-01T00:00:00Z", created_at: null },
      { id: 3, title: "Preparing a Trade-In Appraisal", slug: "trade-in-appraisal", meta_keywords: "trade in appraisal", tags: "", updated_at: null, published_at: "2026-02-10T00:00:00Z", created_at: null },
      { id: 4, title: "", slug: "no-title", updated_at: null, published_at: "2026-02-11T00:00:00Z", created_at: null },
    ];
    const { sitemapUrls } = await import("./autoseo-blog.server");
    const urls = await sitemapUrls();
    expect(urls.map((u) => u.slug)).toEqual(["used-car-test-drive-checklist", "trade-in-appraisal"]);
    expect(urls[0]?.lastmod).toBe("2026-02-02T00:00:00Z");
    expect(urls[1]?.lastmod).toBe("2026-02-10T00:00:00Z");
  });

  const clean = {
    id: 9001,
    title: "What to Bring to a Used Car Test Drive",
    slug: "what-to-bring-to-a-used-car-test-drive",
    content_html: "<h2>Before you go</h2><p>Bring your driver license and proof of insurance, and plan the route you want to drive.</p>",
    metaDescription: "A short checklist of what to bring to a used car test drive.",
    keywords: ["test drive checklist"],
    status: "published",
  };

  const stored = () => calls.find((c) => c.method === "POST" && c.url.includes("blog_posts?on_conflict=id"))?.body as Record<string, any> | undefined;

  it("stores a draft, never a public article, when AutoSEO sends a draft", async () => {
    const { upsertAutoseoArticle } = await import("./autoseo-blog.server");
    await upsertAutoseoArticle({ ...clean, status: "draft" } as never);
    expect(stored()?.["status"]).toBe("draft");
  });

  it("only publishes an article that passed the quality gate, and never marks held content indexable", async () => {
    const { upsertAutoseoArticle } = await import("./autoseo-blog.server");
    await upsertAutoseoArticle(clean as never);
    const row = stored()!;
    expect(row["status"] === "published").toBe(row["quality_status"] === "approved");
    if (row["status"] === "published") expect(row["published_at"]).toBeTruthy();
    if (row["quality_status"] !== "approved") expect(row["seo_indexable"]).toBe(false);
  });

  it("holds an article with an unconditional financing approval claim as a draft", async () => {
    const { upsertAutoseoArticle } = await import("./autoseo-blog.server");
    await upsertAutoseoArticle({
      ...clean,
      id: 9002,
      slug: "guaranteed-approval",
      title: "Guaranteed Financing Approval for Everyone",
      content_html: "<p>Everyone is approved. Guaranteed financing approval with no credit check and the lowest rates anywhere.</p>",
      keywords: ["guaranteed approval financing"],
    } as never);
    expect(stored()?.["status"]).toBe("draft");
  });

  it("rejects an incomplete payload without writing anything", async () => {
    const { upsertAutoseoArticle } = await import("./autoseo-blog.server");
    await expect(upsertAutoseoArticle({ id: 1, title: "No slug" } as never)).rejects.toThrow(/Missing id, title or slug/);
    expect(stored()).toBeUndefined();
  });

  it("keys the upsert on the article id, so a repeat delivery updates one row instead of adding another", async () => {
    const { upsertAutoseoArticle } = await import("./autoseo-blog.server");
    await upsertAutoseoArticle(clean as never);
    await upsertAutoseoArticle(clean as never);
    const writes = calls.filter((c) => c.method === "POST" && c.url.includes("blog_posts?on_conflict=id"));
    expect(writes).toHaveLength(2);
    expect(writes.every((w) => (w.body as Row)["id"] === 9001)).toBe(true);
  });
});

describe("AutoSEO webhook endpoint", () => {
  const route = read("src/routes/api/public/receive-article.tsx");

  it("requires the bearer token before reading anything, and checks the signature when one is sent", () => {
    const post = route.slice(route.indexOf("POST: async"));
    expect(post.indexOf("Unauthorized")).toBeLessThan(post.indexOf("await request.text()"));
    expect(route).toContain("hmacHex(secret, raw)");
    expect(route).toContain("Invalid signature");
  });

  it("rejects other methods and unsupported events", () => {
    for (const method of ["GET", "PUT", "PATCH", "DELETE"]) expect(route).toContain(`${method}: methodNotAllowed`);
    expect(route).toContain("Unsupported event");
  });

  it("never echoes the token, and only accepts published or updated article events", () => {
    expect(route).not.toMatch(/json\([^)]*secret/);
    expect(route).toContain('event !== "article.published" && event !== "article.updated"');
  });
});

/* -------------------------------------------------------------------------- */
/* Search and AI crawler access                                                */
/* -------------------------------------------------------------------------- */

describe("crawler access to public content", () => {
  const robots = read("public/robots.txt");
  const rules = robots.split(/\r?\n/).map((l) => l.replace(/#.*$/, "").trim()).filter(Boolean);
  const disallowed = rules.filter((l) => /^disallow:/i.test(l)).map((l) => l.replace(/^disallow:\s*/i, ""));

  it("blocks no public content area for any crawler", () => {
    for (const area of ["/blog", "/search", "/inventory", "/sell", "/schedule", "/contact", "/locations", "/sitemap.xml"]) {
      expect(disallowed.some((d) => d && area.startsWith(d.replace(/\$$/, "")) && !d.endsWith("$") && d.length <= area.length), area).toBe(false);
    }
  });

  it("uses no special directives for named AI crawlers: one shared group for every bot", () => {
    expect(rules.filter((l) => /^user-agent:/i.test(l))).toEqual(["User-agent: *"]);
    expect(robots).not.toMatch(/GPTBot|ClaudeBot|PerplexityBot|Google-Extended|CCBot|anthropic|openai/i);
  });

  it("advertises the sitemap", () => {
    expect(rules).toContain("Sitemap: https://mycarcorp.com/sitemap.xml");
  });
});

/* -------------------------------------------------------------------------- */
/* Internal link integrity                                                     */
/* -------------------------------------------------------------------------- */

describe("internal links point at real routes", () => {
  function routePatterns(): string[] {
    const patterns = ["/"];
    for (const file of readdirSync("src/routes")) {
      if (!file.endsWith(".tsx") || file === "__root.tsx" || file.includes("[")) continue;
      let name = file.replace(/\.tsx$/, "");
      if (name === "index") continue;
      name = name.replace(/\.index$/, "");
      patterns.push("/" + name.split(".").join("/"));
    }
    return patterns;
  }

  const patterns = routePatterns();
  const matches = (path: string) => patterns.some((p) => p === path);

  function files(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = `${dir}/${entry.name}`;
      if (entry.isDirectory()) return files(full);
      return /\.tsx$/.test(entry.name) && !/\.test\./.test(entry.name) && !/routeTree\.gen/.test(entry.name) ? [full] : [];
    });
  }

  it("every literal <Link to> targets an existing page", () => {
    const broken: string[] = [];
    for (const file of files("src")) {
      for (const match of read(file).matchAll(/<Link[^>]*?\sto="(\/[^"?#]*)"/g)) {
        const path = match[1]!.replace(/\/$/, "") || "/";
        if (!matches(path)) broken.push(`${file}: ${path}`);
      }
    }
    expect(broken).toEqual([]);
  });

  it("every literal internal <a href> targets an existing page or an API path", () => {
    const broken: string[] = [];
    for (const file of files("src")) {
      for (const match of read(file).matchAll(/<a[^>]*?\shref="(\/[^"?#]*)"/g)) {
        const path = match[1]!.replace(/\/$/, "") || "/";
        if (path.startsWith("/api/") || path === "/sitemap.xml" || path === "/robots.txt" || path === "/favicon.ico") continue;
        if (!matches(path)) broken.push(`${file}: ${path}`);
      }
    }
    expect(broken).toEqual([]);
  });

  it("the key pages are linked from the site header or footer, so none is an orphan", () => {
    const nav = read("src/components/SiteHeader.tsx") + read("src/components/SiteFooter.tsx");
    for (const path of ["/search", "/blog", "/sell", "/schedule", "/contact", "/locations", "/finance", "/lease-to-own", "/terms", "/privacy"]) {
      expect(nav, path).toContain(path);
    }
  });
});
