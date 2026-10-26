// Shared SEO facts and structured-data builders.
//
// Every value below already appears on the website (footer, map, contact page, AutoSEO approved facts).
// Nothing here is invented: no hours, ratings, reviews, geo coordinates, prices or offers.

export const SITE_ORIGIN = "https://mycarcorp.com";

export const DEALER_ID = `${SITE_ORIGIN}/#dealer`;

export const BUSINESS = {
  name: "My Car",
  legalName: "My Car Business Services LLC",
  // The site writes the brand several ways (page titles, schema, footer). They are listed so search engines can
  // connect them to one entity; which spelling is canonical is a management decision.
  alternateName: ["MyCar", "My Car Corp", "MyCarCorp"],
  telephone: "+1-540-426-3322",
  address: {
    streetAddress: "4720 Harrison Rd",
    addressLocality: "Fredericksburg",
    addressRegion: "VA",
    postalCode: "22408",
    addressCountry: "US",
  },
  // Profiles linked from the site footer, without tracking parameters.
  sameAs: [
    "https://www.facebook.com/mycarcorporation",
    "https://www.instagram.com/mycarcorporation/",
    "https://www.youtube.com/@MyCarCorporation",
    "https://www.tiktok.com/@mycarcorporation",
    "https://www.linkedin.com/company/108650053/",
    "https://x.com/MyCarCorp1",
  ],
} as const;

/** An absolute URL on this site. Absolute URLs are returned unchanged. */
export function absoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${SITE_ORIGIN}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

/** The dealership entity. Defined once site-wide; other schema refers to it by @id. */
export function buildDealerJsonLd(logoUrl?: string): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "AutoDealer",
    "@id": DEALER_ID,
    name: BUSINESS.name,
    legalName: BUSINESS.legalName,
    alternateName: [...BUSINESS.alternateName],
    url: `${SITE_ORIGIN}/`,
    ...(logoUrl ? { logo: absoluteUrl(logoUrl) } : {}),
    telephone: BUSINESS.telephone,
    address: { "@type": "PostalAddress", ...BUSINESS.address },
    areaServed: { "@type": "City", name: BUSINESS.address.addressLocality, addressRegion: BUSINESS.address.addressRegion },
    sameAs: [...BUSINESS.sameAs],
  };
}

/** Reference to the site-wide dealer entity, for use as a seller or publisher. */
export function dealerReference(): Record<string, unknown> {
  return { "@type": "AutoDealer", "@id": DEALER_ID, name: BUSINESS.name, url: `${SITE_ORIGIN}/` };
}

export type BreadcrumbItem = { name: string; path: string };

/** A BreadcrumbList; the first item is always Home. Items need a visible name and a path. */
export function buildBreadcrumbJsonLd(items: BreadcrumbItem[]): Record<string, unknown> {
  const trail: BreadcrumbItem[] = [{ name: "Home", path: "/" }, ...items.filter((item) => item.name.trim() && item.path)];
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name.trim(),
      item: absoluteUrl(item.path),
    })),
  };
}

export type BlogPostingInput = {
  url: string;
  headline: string;
  description?: string | null;
  image?: string | null;
  datePublished?: string | null;
  dateModified?: string | null;
  authorName?: string | null;
};

function isoOrUndefined(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/**
 * BlogPosting for an article page. Publisher is the dealership. The author is the named author when the article has
 * one, otherwise the dealership. Dates that are missing or unreadable are omitted rather than guessed.
 */
export function buildBlogPostingJsonLd(input: BlogPostingInput, logoUrl?: string): Record<string, unknown> {
  const published = isoOrUndefined(input.datePublished);
  let modified = isoOrUndefined(input.dateModified) ?? published;
  // A modified date earlier than the published date is inconsistent data; fall back to the published date.
  if (modified && published && modified < published) modified = published;
  const authorName = input.authorName?.trim();
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": `${input.url}#article`,
    mainEntityOfPage: { "@type": "WebPage", "@id": input.url },
    url: input.url,
    headline: input.headline,
    ...(input.description ? { description: input.description } : {}),
    ...(input.image && /^https:\/\//i.test(input.image) ? { image: [input.image] } : {}),
    ...(published ? { datePublished: published } : {}),
    ...(modified ? { dateModified: modified } : {}),
    author: authorName ? { "@type": "Person", name: authorName } : { "@type": "Organization", name: BUSINESS.name, url: `${SITE_ORIGIN}/` },
    publisher: {
      "@type": "Organization",
      name: BUSINESS.name,
      url: `${SITE_ORIGIN}/`,
      ...(logoUrl ? { logo: { "@type": "ImageObject", url: absoluteUrl(logoUrl) } } : {}),
    },
  };
}

/** Serialises JSON-LD for a <script>; "<" is escaped so content can never close the script element. */
export function jsonLdString(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

/** A head `scripts` entry for TanStack Router. */
export function jsonLdScript(data: Record<string, unknown>): { type: string; children: string } {
  return { type: "application/ld+json", children: jsonLdString(data) };
}
