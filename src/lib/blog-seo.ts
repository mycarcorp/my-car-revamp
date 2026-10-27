// Blog SEO helpers: article titles and topic-aware "next step" links.
//
// Pure functions. Links are chosen from the article's own title, keywords and tags, so a trade-in article points to
// the trade-in page and a financing article to financing; nothing is injected into article bodies.

export const ARTICLE_TITLE_MAX = 60;

/** "<article title> | MyCar", without the brand when the full title would be cut off in search results. */
export function articleSeoTitle(title: string): string {
  const clean = title.trim();
  const branded = `${clean} | MyCar`;
  return branded.length <= ARTICLE_TITLE_MAX ? branded : clean;
}

export type BlogCtaTarget = "/search" | "/sell" | "/schedule" | "/finance" | "/contact";

export type BlogCtaLink = { to: BlogCtaTarget; label: string };

type TopicInput = {
  title?: string | null;
  keywords?: string | null;
  tags?: string | null;
  description?: string | null;
};

const TOPICS: Array<{ to: BlogCtaTarget; label: string; pattern: RegExp }> = [
  {
    to: "/sell",
    label: "Sell or trade your car",
    pattern: /\b(trade[- ]?in|trading in|appraisal|appraise|vehicle value|car value|sell(?:ing)? (?:my|your|a|the) (?:car|vehicle|truck|suv)|sell (?:or|and) trade)\b/,
  },
  {
    to: "/schedule",
    label: "Schedule a test drive",
    pattern: /\b(test[- ]?drive|inspect(?:ion|ing)?|walk[- ]?around|checklist|what to check|what to look for|buy(?:ing)?|shopping|shop(?:ping)? for)\b/,
  },
  {
    to: "/finance",
    label: "Explore used car financing",
    pattern: /\b(financ(?:e|ing)|loan|credit|apr|down payment|monthly payment|pre[- ]?approv\w*|pre[- ]?qualif\w*)\b/,
  },
];

/**
 * Up to four links for the end of an article: browsing inventory always, then the pages the topic is actually about,
 * then contact. Order is stable, and each target appears once.
 */
export function blogCtaLinks(input: TopicInput): BlogCtaLink[] {
  const haystack = [input.title, input.keywords, input.tags, input.description].filter(Boolean).join(" ").toLowerCase();
  const links: BlogCtaLink[] = [{ to: "/search", label: "Browse used cars in Fredericksburg, VA" }];
  for (const topic of TOPICS) {
    if (topic.pattern.test(haystack)) links.push({ to: topic.to, label: topic.label });
  }
  links.push({ to: "/contact", label: "Ask our Fredericksburg team a question" });
  return links;
}

/** Breadcrumb trail for an article page (Home is added by the schema builder and shown by the page). */
export function articleBreadcrumb(title: string, slug: string): Array<{ name: string; path: string }> {
  return [
    { name: "Blog", path: "/blog" },
    { name: title.trim(), path: `/blog/${slug}` },
  ];
}

/**
 * One link per article URL for the "all articles" list. When a hand-written post and an AutoSEO article share a
 * slug, the page serves the hand-written post, so that one is kept.
 */
export function uniqueArticleLinks<T extends { key: string; slug: string }>(cards: T[]): T[] {
  const bySlug = new Map<string, T>();
  for (const card of cards) {
    const current = bySlug.get(card.slug);
    if (!current || (card.key.startsWith("mc-") && !current.key.startsWith("mc-"))) bySlug.set(card.slug, card);
  }
  return [...bySlug.values()];
}
