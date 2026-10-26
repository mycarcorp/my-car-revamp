import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BUSINESS,
  DEALER_ID,
  SITE_ORIGIN,
  absoluteUrl,
  buildBlogPostingJsonLd,
  buildBreadcrumbJsonLd,
  buildDealerJsonLd,
  dealerReference,
  jsonLdScript,
  jsonLdString,
} from "./seo";

const read = (path: string) => readFileSync(path, "utf8");

/* -------------------------------------------------------------------------- */
/* robots.txt, evaluated the way Google does: one matching group, longest rule */
/* -------------------------------------------------------------------------- */

type Rule = { allow: boolean; pattern: string };

function parseRobots(text: string) {
  const groups: Array<{ agents: string[]; rules: Rule[] }> = [];
  const sitemaps: string[] = [];
  let current: { agents: string[]; rules: Rule[] } | null = null;
  let lastWasAgent = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (key === "sitemap") sitemaps.push(value);
    else if (current && (key === "allow" || key === "disallow")) current.rules.push({ allow: key === "allow", pattern: value });
  }
  return { groups, sitemaps };
}

function matches(pattern: string, path: string): boolean {
  if (!pattern) return false;
  const anchored = pattern.endsWith("$");
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const regex = new RegExp(`^${body.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}${anchored ? "$" : ""}`);
  return regex.test(path);
}

function isAllowed(robots: ReturnType<typeof parseRobots>, agent: string, path: string): boolean {
  const name = agent.toLowerCase();
  const group =
    robots.groups.find((g) => g.agents.some((a) => a !== "*" && name.includes(a))) ?? robots.groups.find((g) => g.agents.includes("*"));
  if (!group) return true;
  let best: Rule | null = null;
  for (const rule of group.rules) {
    if (!matches(rule.pattern, path)) continue;
    if (!best || rule.pattern.length > best.pattern.length || (rule.pattern.length === best.pattern.length && rule.allow)) best = rule;
  }
  return best ? best.allow : true;
}

describe("robots.txt", () => {
  const robots = parseRobots(read("public/robots.txt"));
  const BOTS = ["Googlebot", "Bingbot", "Twitterbot", "facebookexternalhit", "SomeOtherBot"];

  it("uses a single group, so no named crawler can skip the private-area rules", () => {
    expect(robots.groups).toHaveLength(1);
    expect(robots.groups[0]?.agents).toEqual(["*"]);
  });

  it("keeps every private area away from every crawler", () => {
    const privatePaths = [
      "/admin",
      "/admin/customers",
      "/staff",
      "/staff/dms",
      "/my",
      "/my/purchases",
      "/my/purchases/123",
      "/account",
      "/auth",
      "/auth/callback",
      "/reset-password",
      "/lease-to-own/apply",
      "/lease-to-own/portal",
    ];
    for (const bot of BOTS) for (const path of privatePaths) expect(isAllowed(robots, bot, path), `${bot} ${path}`).toBe(false);
  });

  it("keeps every public page, asset and the sitemap crawlable", () => {
    const publicPaths = [
      "/",
      "/search",
      "/inventory/2020-honda-civic",
      "/blog",
      "/blog/how-to-buy-a-used-car",
      "/contact",
      "/sell",
      "/schedule",
      "/finance",
      "/lease-to-own",
      "/locations",
      "/locations/stafford",
      "/terms",
      "/privacy",
      "/sitemap.xml",
      "/assets/app.css",
      "/api/public/vehicle-photos/some-photo.jpg",
      // Paths that merely begin with the same letters as a private area stay public.
      "/my-story",
      "/accounting-tips",
      "/authors",
    ];
    for (const bot of BOTS) for (const path of publicPaths) expect(isAllowed(robots, bot, path), `${bot} ${path}`).toBe(true);
  });

  it("does not block the whole site and declares the sitemap", () => {
    expect(read("public/robots.txt")).not.toMatch(/^\s*Disallow:\s*\/\s*$/m);
    expect(robots.sitemaps).toEqual([`${SITE_ORIGIN}/sitemap.xml`]);
  });
});

/* -------------------------------------------------------------------------- */
/* Public versus private route indexing                                        */
/* -------------------------------------------------------------------------- */

describe("route indexing rules", () => {
  // Layout or leaf routes that own the robots meta for their whole area (child routes inherit it).
  const NOINDEX_ROUTES = [
    "admin.tsx",
    "my.tsx",
    "account.tsx",
    "auth.tsx",
    "auth.callback.tsx",
    "reset-password.tsx",
    "staff.dms.tsx",
    "lease-to-own.apply.tsx",
    "lease-to-own.portal.tsx",
  ];

  it.each(NOINDEX_ROUTES)("%s is noindex", (file) => {
    expect(read(`src/routes/${file}`)).toMatch(/name:\s*"robots",\s*content:\s*"noindex/);
  });

  it("private area children sit under a noindex layout", () => {
    const files = readdirSync("src/routes");
    for (const file of files.filter((f) => f.startsWith("admin.") && f !== "admin.tsx")) expect(files).toContain("admin.tsx");
    for (const file of files.filter((f) => f.startsWith("my.") && f !== "my.tsx")) expect(files).toContain("my.tsx");
  });

  const CANONICAL_PUBLIC: Array<[string, string]> = [
    ["index.tsx", "https://mycarcorp.com/"],
    ["search.tsx", "https://mycarcorp.com/search"],
    ["contact.tsx", "https://mycarcorp.com/contact"],
    ["sell.tsx", "https://mycarcorp.com/sell"],
    ["schedule.tsx", "https://mycarcorp.com/schedule"],
    ["finance.tsx", "https://mycarcorp.com/finance"],
    ["lease-to-own.index.tsx", "https://mycarcorp.com/lease-to-own"],
    ["terms.tsx", "https://mycarcorp.com/terms"],
    ["locations.index.tsx", "https://mycarcorp.com/locations"],
  ];

  it.each(CANONICAL_PUBLIC)("%s declares its own canonical URL", (file, url) => {
    const source = read(`src/routes/${file}`);
    expect(source).toContain('rel: "canonical"');
    expect(source).toContain(`"${url}"`);
  });

  it("dynamic public pages build their canonical from the page's own address", () => {
    expect(read("src/routes/locations.$slug.tsx")).toContain("rel: \"canonical\", href: `https://mycarcorp.com/locations/${a.slug}`");
    expect(read("src/routes/inventory.$slug.tsx")).toContain("rel: \"canonical\"");
    expect(read("src/routes/blog.$slug.tsx")).toContain("rel: \"canonical\"");
  });

  it("every hard-coded canonical is absolute on the real domain with no query, fragment or trailing slash", () => {
    for (const file of readdirSync("src/routes").filter((f) => f.endsWith(".tsx"))) {
      const source = read(`src/routes/${file}`);
      for (const match of source.matchAll(/rel:\s*"canonical",\s*href:\s*"([^"]+)"/g)) {
        const url = match[1]!;
        expect(url, `${file}: ${url}`).toMatch(/^https:\/\/mycarcorp\.com(\/[^?#]*)?$/);
        if (url !== "https://mycarcorp.com/") expect(url.endsWith("/"), `${file}: ${url}`).toBe(false);
      }
    }
  });

  it("the sign-in and private routes are never listed in the sitemap", () => {
    const sitemap = read("src/lib/sitemap-cache.server.ts");
    const paths = [...sitemap.matchAll(/\{ path: "([^"]+)"/g)].map((m) => m[1]!);
    expect(paths.length).toBeGreaterThan(5);
    for (const path of paths) expect(path).not.toMatch(/^\/(admin|staff|my|account|auth|reset-password)(\/|$)|lease-to-own\/(apply|portal)/);
    for (const path of ["/", "/search", "/blog", "/sell", "/schedule", "/contact"]) expect(paths).toContain(path);
  });
});

/* -------------------------------------------------------------------------- */
/* Structured data                                                             */
/* -------------------------------------------------------------------------- */

describe("dealership structured data", () => {
  const dealer = buildDealerJsonLd("/assets/mycar-logo-abc123.png");

  it("is valid JSON-LD for an AutoDealer with the verified business facts", () => {
    const parsed = JSON.parse(jsonLdString(dealer)) as Record<string, unknown>;
    expect(parsed["@context"]).toBe("https://schema.org");
    expect(parsed["@type"]).toBe("AutoDealer");
    expect(parsed["@id"]).toBe(DEALER_ID);
    expect(parsed["name"]).toBe("My Car");
    expect(parsed["legalName"]).toBe("My Car Business Services LLC");
    expect(parsed["url"]).toBe("https://mycarcorp.com/");
    expect(parsed["telephone"]).toBe("+1-540-426-3322");
    expect(parsed["logo"]).toBe("https://mycarcorp.com/assets/mycar-logo-abc123.png");
    expect(parsed["address"]).toEqual({
      "@type": "PostalAddress",
      streetAddress: "4720 Harrison Rd",
      addressLocality: "Fredericksburg",
      addressRegion: "VA",
      postalCode: "22408",
      addressCountry: "US",
    });
  });

  it("never includes unverified or invented data", () => {
    const text = JSON.stringify(dealer);
    for (const forbidden of ["aggregateRating", "review", "openingHours", "openingHoursSpecification", "geo", "priceRange", "offers", "makesOffer", "hasCredential", "paymentAccepted", "email"]) {
      expect(text, forbidden).not.toContain(`"${forbidden}"`);
    }
  });

  it("lists only the https profiles the site footer already links, without tracking parameters", () => {
    expect(BUSINESS.sameAs.length).toBeGreaterThan(0);
    for (const url of BUSINESS.sameAs) {
      expect(url).toMatch(/^https:\/\//);
      expect(url).not.toMatch(/[?&]utm_|sender_device|is_from_webapp/);
    }
    const footer = read("src/components/SiteFooter.tsx");
    for (const url of BUSINESS.sameAs) {
      const profile = url.replace(/\/$/, "").replace(/^https:\/\/(www\.)?/, "");
      expect(footer.toLowerCase(), profile).toContain(profile.toLowerCase());
    }
  });

  it("matches the address and phone shown elsewhere on the site", () => {
    const address = "4720 Harrison Rd, Fredericksburg, VA 22408";
    expect(read("src/components/SiteFooter.tsx")).toContain(address);
    expect(read("src/components/home/DealershipMap.tsx")).toContain(address);
    const a = BUSINESS.address;
    expect(`${a.streetAddress}, ${a.addressLocality}, ${a.addressRegion} ${a.postalCode}`).toBe(address);
    expect(BUSINESS.telephone.replace(/\D/g, "").slice(-10)).toBe("5404263322");
    expect(read("src/routes/contact.tsx")).toContain("(540) 426-3322");
  });

  it("is defined exactly once: the site root defines it, everything else refers to it", () => {
    expect(read("src/routes/__root.tsx")).toContain("buildDealerJsonLd(logoUrl)");
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = `${dir}/${entry.name}`;
        if (entry.isDirectory()) walk(full);
        else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.|routeTree\.gen|[\\/]seo\.ts$/.test(full)) {
          if (/"@type":\s*"AutoDealer"/.test(read(full))) offenders.push(full);
        }
      }
    };
    walk("src");
    expect(offenders).toEqual([]);
  });

  it("vehicle pages refer to the one dealer entity instead of redefining it", () => {
    const vdp = read("src/routes/inventory.$slug.tsx");
    expect(vdp).toContain("seller: dealerReference()");
    expect(dealerReference()).toMatchObject({ "@id": DEALER_ID, name: "My Car" });
  });
});

describe("breadcrumb structured data", () => {
  it("starts at Home, numbers items from 1 and uses absolute URLs", () => {
    const crumbs = buildBreadcrumbJsonLd([
      { name: "Blog", path: "/blog" },
      { name: "A post", path: "/blog/a-post" },
    ]) as { itemListElement: Array<{ position: number; name: string; item: string }> };
    expect(crumbs.itemListElement.map((i) => [i.position, i.name, i.item])).toEqual([
      [1, "Home", "https://mycarcorp.com/"],
      [2, "Blog", "https://mycarcorp.com/blog"],
      [3, "A post", "https://mycarcorp.com/blog/a-post"],
    ]);
  });

  it("drops empty items rather than emitting an invalid list, and keeps absolute URLs unchanged", () => {
    const crumbs = buildBreadcrumbJsonLd([
      { name: "  ", path: "/x" },
      { name: "Vehicle", path: "https://mycarcorp.com/inventory/abc" },
    ]) as { itemListElement: Array<{ name: string; item: string }> };
    expect(crumbs.itemListElement.map((i) => i.name)).toEqual(["Home", "Vehicle"]);
    expect(crumbs.itemListElement[1]?.item).toBe("https://mycarcorp.com/inventory/abc");
  });

  it("vehicle breadcrumb mirrors the visible one: Shop Inventory, then the vehicle", () => {
    const vdp = read("src/routes/inventory.$slug.tsx");
    expect(vdp).toContain('{ name: "Shop Inventory", path: "/search" }');
    expect(vdp).toContain("{ name: vehicleTitle(v), path: canonicalUrl }");
  });
});

describe("blog article structured data", () => {
  const base = { url: "https://mycarcorp.com/blog/a-post", headline: "A post" };

  it("builds a BlogPosting with publisher logo, ISO dates and a page reference", () => {
    const post = buildBlogPostingJsonLd(
      { ...base, description: "Short summary", image: "https://cdn.example.com/hero.jpg", datePublished: "2026-03-01", dateModified: "2026-03-05T10:00:00Z" },
      "/assets/logo.png",
    ) as Record<string, any>;
    expect(post["@type"]).toBe("BlogPosting");
    expect(post.mainEntityOfPage).toEqual({ "@type": "WebPage", "@id": base.url });
    expect(post.datePublished).toBe("2026-03-01T00:00:00.000Z");
    expect(post.dateModified).toBe("2026-03-05T10:00:00.000Z");
    expect(post.image).toEqual(["https://cdn.example.com/hero.jpg"]);
    expect(post.publisher.logo.url).toBe("https://mycarcorp.com/assets/logo.png");
    expect(post.author).toEqual({ "@type": "Organization", name: "My Car", url: "https://mycarcorp.com/" });
  });

  it("uses a named author only when the article has one", () => {
    const post = buildBlogPostingJsonLd({ ...base, authorName: "  Pat Writer " }) as Record<string, any>;
    expect(post.author).toEqual({ "@type": "Person", name: "Pat Writer" });
  });

  it("omits missing or unreadable dates and non-https images instead of guessing", () => {
    const post = buildBlogPostingJsonLd({ ...base, datePublished: "not a date", dateModified: null, image: "http://insecure.example.com/x.jpg" }) as Record<string, any>;
    expect(post).not.toHaveProperty("datePublished");
    expect(post).not.toHaveProperty("dateModified");
    expect(post).not.toHaveProperty("image");
  });

  it("falls back to the publish date when there is no modified date", () => {
    const post = buildBlogPostingJsonLd({ ...base, datePublished: "2026-03-01T08:00:00Z" }) as Record<string, any>;
    expect(post.dateModified).toBe(post.datePublished);
  });

  it("covers both AutoSEO and legacy articles, and keeps the visible-FAQ-only FAQ schema", () => {
    const blog = read("src/routes/blog.$slug.tsx");
    expect((blog.match(/buildBlogPostingJsonLd\(/g) ?? []).length).toBe(2);
    expect((blog.match(/buildBreadcrumbJsonLd\(/g) ?? []).length).toBe(2);
    expect(blog).toContain("const faqs = faqList(a);");
    expect(blog).toMatch(/if \(faqs\.length > 0\)/);
  });
});

describe("JSON-LD output safety", () => {
  it("escapes < so page content can never close the script element", () => {
    const text = jsonLdString({ name: "</script><script>alert(1)</script>" });
    expect(text).not.toContain("<");
    expect(JSON.parse(text)).toEqual({ name: "</script><script>alert(1)</script>" });
  });

  it("produces head script entries of the shape the router expects", () => {
    expect(jsonLdScript({ "@type": "Thing" })).toEqual({ type: "application/ld+json", children: '{"@type":"Thing"}' });
  });

  it("absoluteUrl only prefixes site-relative paths", () => {
    expect(absoluteUrl("/blog")).toBe("https://mycarcorp.com/blog");
    expect(absoluteUrl("blog")).toBe("https://mycarcorp.com/blog");
    expect(absoluteUrl("https://example.com/x")).toBe("https://example.com/x");
  });
});

describe("protected behaviour is untouched", () => {
  it("does not touch form submission, tracking, GHL, finance or purchase code", () => {
    const seoSource = read("src/lib/seo.ts");
    expect(seoSource).not.toMatch(/supabase|fetch\(|sendLeadToGhl|analytics|attribution|consent/i);
  });
});
