import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { urlEntry, wrap } from "./sitemap-cache.server";

const read = (path: string) => readFileSync(path, "utf8");
const robotsTxt = read("public/robots.txt");

/* -------------------------------------------------------------------------- */
/* The Marketing Hub's own site checks must keep reading the new output        */
/* -------------------------------------------------------------------------- */

describe("Marketing Hub site-health checks still read robots.txt and the sitemap correctly", () => {
  const hub = read("src/lib/marketing.server.ts");
  // Copied from websiteReport(); the source assertions below fail if the Hub's checks change.
  const locRegex = /<loc>\s*([^<]+)\s*<\/loc>/g;
  const blocksAll = /User-agent:\s*\*[\s\S]*?Disallow:\s*\/(?:\s|$)/i;

  it("the Hub still uses the checks these tests mirror", () => {
    expect(hub).toContain("/<loc>\\s*([^<]+)\\s*<\\/loc>/g");
    expect(hub).toContain("/User-agent:\\s*\\*[\\s\\S]*?Disallow:\\s*\\/(?:\\s|$)/i");
    expect(hub).toContain("txt.includes(`${ORIGIN}/sitemap.xml`)");
  });

  it("image entries are not counted as pages: the Hub's URL count equals the number of <url> entries", () => {
    const xml = wrap([
      urlEntry("/", null, "daily", "1.0"),
      urlEntry("/inventory/a", null, "daily", "0.8", ["https://mycarcorp.com/api/public/vehicle-photos/a/photo-1.jpg", "https://mycarcorp.com/api/public/vehicle-photos/a/photo-2.jpg"]),
      urlEntry("/inventory/b", "2026-01-02T00:00:00.000Z", "daily", "0.8", ["https://mycarcorp.com/api/public/vehicle-photos/b/photo-1.jpg"]),
    ]);
    const counted = [...xml.matchAll(locRegex)].map((m) => m[1]!);
    expect(counted).toHaveLength(3);
    expect(counted.every((u) => u.startsWith("https://mycarcorp.com/"))).toBe(true);
    expect(counted.some((u) => /photo-/.test(u))).toBe(false);
  });

  it("the new robots.txt is not read as blocking the whole site, and still declares the sitemap", () => {
    expect(blocksAll.test(robotsTxt)).toBe(false);
    expect(robotsTxt.includes("https://mycarcorp.com/sitemap.xml")).toBe(true);
    expect(blocksAll.test("User-agent: *\nDisallow: /\n")).toBe(true);
  });

  it("the home page keeps the title, description and Google verification tag the Hub checks for", () => {
    const home = read("src/routes/index.tsx");
    expect(home).toContain('name: "google-site-verification"');
    expect(home).toMatch(/\{ title: "[^"]+" \}/);
    expect(home).toContain('name: "description"');
  });
});

/* -------------------------------------------------------------------------- */
/* Canonicals, robots rules and the sitemap agree                              */
/* -------------------------------------------------------------------------- */

function robotsDisallows(path: string): boolean {
  const rules = robotsTxt.split(/\r?\n/).map((l) => l.replace(/#.*$/, "").trim()).filter((l) => /^(dis)?allow:/i.test(l));
  let best: { allow: boolean; len: number } | null = null;
  for (const line of rules) {
    const allow = /^allow:/i.test(line);
    const pattern = line.replace(/^(dis)?allow:\s*/i, "");
    if (!pattern) continue;
    const anchored = pattern.endsWith("$");
    const body = anchored ? pattern.slice(0, -1) : pattern;
    const hit = anchored ? path === body : path.startsWith(body);
    if (hit && (!best || pattern.length > best.len || (pattern.length === best.len && allow))) best = { allow, len: pattern.length };
  }
  return best ? !best.allow : false;
}

describe("canonical, robots and sitemap agree for every listed page", () => {
  const sitemap = read("src/lib/sitemap-cache.server.ts");
  const paths = [...sitemap.matchAll(/\{ path: "([^"]+)"/g)].map((m) => m[1]!);
  const routeFile: Record<string, string> = {
    "/": "index.tsx",
    "/search": "search.tsx",
    "/blog": "blog.index.tsx",
    "/finance": "finance.tsx",
    "/sell": "sell.tsx",
    "/lease-to-own": "lease-to-own.index.tsx",
    "/schedule": "schedule.tsx",
    "/contact": "contact.tsx",
  };

  it("lists the pages this check covers", () => {
    expect(paths.sort()).toEqual(Object.keys(routeFile).sort());
    for (const path of paths) expect(path).not.toMatch(/[?#]/);
  });

  it.each(Object.entries(routeFile))("%s: has a matching canonical, is not noindex and is not blocked by robots.txt", (path, file) => {
    const source = read(`src/routes/${file}`);
    const url = `https://mycarcorp.com${path === "/" ? "/" : path}`;
    expect(source).toContain('rel: "canonical"');
    expect(source).toContain(`"${url}"`);
    expect(source).not.toMatch(/name:\s*"robots",\s*content:\s*"noindex/);
    expect(robotsDisallows(path)).toBe(false);
  });

  it("filtered /search URLs are not in the sitemap and are noindex, while the plain page stays indexable", () => {
    const search = read("src/routes/search.tsx");
    expect(search).toContain('links: robots ? [] : [{ rel: "canonical", href: "https://mycarcorp.com/search" }]');
    expect(paths.filter((p) => p.startsWith("/search"))).toEqual(["/search"]);
  });
});

describe("private areas are protected in two independent layers", () => {
  const PRIVATE: Array<[string, string[]]> = [
    ["/admin", ["admin.tsx"]],
    ["/staff", ["staff.dms.tsx"]],
    ["/my", ["my.tsx"]],
    ["/account", ["account.tsx"]],
    ["/auth", ["auth.tsx", "auth.callback.tsx"]],
    ["/reset-password", ["reset-password.tsx"]],
    ["/lease-to-own/apply", ["lease-to-own.apply.tsx"]],
    ["/lease-to-own/portal", ["lease-to-own.portal.tsx"]],
  ];

  it.each(PRIVATE)("%s is disallowed in robots.txt and noindex in the page itself", (path, files) => {
    expect(robotsDisallows(path)).toBe(true);
    expect(robotsDisallows(`${path}/x`)).toBe(true);
    for (const file of files) expect(read(`src/routes/${file}`)).toMatch(/name:\s*"robots",\s*content:\s*"noindex/);
  });

  it("public pages with similar names stay crawlable", () => {
    for (const path of ["/my-story", "/accounting", "/authors", "/administrators", "/lease-to-own", "/api/public/vehicle-photos/v/photo-1.jpg"]) {
      expect(robotsDisallows(path), path).toBe(false);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* SEO code stays separate from tracking, consent, attribution and lead flows  */
/* -------------------------------------------------------------------------- */

describe("SEO changes cannot interfere with tracking, consent or forms", () => {
  it("the SEO modules do not reference tracking, consent, attribution or lead code", () => {
    for (const file of ["src/lib/seo.ts", "src/lib/vehicle-seo.ts", "src/lib/blog-seo.ts"]) {
      expect(read(file), file).not.toMatch(/analytics|attribution|consent|fbq|gtag|sendLeadToGhl|LeadForm|supabase|fetch\(/i);
    }
  });

  it("only route, sitemap and card files import the SEO modules; tracking and lead code never does", () => {
    const importers: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = `${dir}/${entry.name}`;
        if (entry.isDirectory()) walk(full);
        else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\./.test(entry.name) && !/routeTree\.gen/.test(entry.name)) {
          if (/from "(?:@\/lib|\.)\/(?:seo|vehicle-seo|blog-seo)"/.test(read(full))) importers.push(full.replace(/\\/g, "/"));
        }
      }
    };
    walk("src");
    for (const file of importers) {
      expect(file, file).toMatch(/^src\/(routes\/|components\/VehicleCard\.tsx|lib\/(vehicle-seo|sitemap-cache\.server|seo-content-agent)\.ts)/);
      expect(file).not.toMatch(/analytics|attribution|consent|ghl|lead|LeadForm|chat-widget/i);
    }
    expect(importers.length).toBeGreaterThan(3);
  });

  it("the lead form, GHL forwarding, analytics and attribution code have no dependency on the SEO modules", () => {
    for (const file of ["src/components/LeadForm.tsx", "src/lib/analytics.ts", "src/lib/attribution.ts", "src/lib/ghl-webhook.functions.ts", "src/lib/ghl-delivery.server.ts", "src/lib/chat-widget.ts"]) {
      expect(read(file), file).not.toMatch(/from "(?:@\/lib|\.)\/(?:seo|vehicle-seo|blog-seo)"/);
    }
  });

  it("the new links and breadcrumbs added to public pages do not wrap or replace any tracked control", () => {
    const touched = ["src/routes/contact.tsx", "src/routes/inventory.$slug.tsx", "src/routes/blog.$slug.tsx", "src/routes/blog.index.tsx", "src/components/SiteFooter.tsx"];
    for (const file of touched) {
      const added = read(file).match(/<Link to="\/(?:search|sell|schedule|contact|locations|blog)"[^>]*>/g) ?? [];
      for (const link of added) expect(link, `${file}: ${link}`).not.toMatch(/onClick|trackEvent|trackContactClick/);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Reporting keeps Search Console, GA4 and lead records distinct               */
/* -------------------------------------------------------------------------- */

describe("Marketing Hub labels keep data sources distinct", () => {
  const hub = read("src/routes/admin.marketing.tsx");

  it("search clicks, impressions and position are labelled as Search Console data", () => {
    expect(hub).toContain('label="Organic clicks"');
    expect(hub).toContain("Search Console · no saved report");
    expect(hub).toContain('label="Average position"');
    expect(hub).toContain("Search Console period average");
    expect(hub).toContain("average position is not a guaranteed rank");
  });

  it("GA4 visits and lead attribution are separate, named sections", () => {
    expect(hub).toContain('detail="Organic search visits"');
    expect(hub).toContain('title="Lead attribution"');
    expect(hub).toContain("Search Console may omit low-volume queries.");
  });

  it("the Search Console report reads only the existing authorized connector and never auto-retries", () => {
    const server = read("src/lib/marketing.server.ts");
    expect(server).toContain("connector-gateway.lovable.dev");
    expect(server).toContain("Stop the batch on an access or quota error; never auto-retry.");
    expect(server).not.toMatch(/sitemaps\/[^`"']*\?(?:.*)(?:submit|ping)|\/urlNotifications|indexing\.googleapis/i);
  });
});
