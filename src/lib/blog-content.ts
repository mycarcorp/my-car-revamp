// Shared (browser + server) helpers for the blog editor: block <-> HTML
// serialisation, HTML sanitising, slug and read-time helpers.

export type BlockType = "h1" | "h2" | "h3" | "p";

export type Block = {
  id: string;
  type: BlockType;
  html: string;
};

export type HeadingStyle = {
  fontSize: string;
  fontWeight: number;
  lineHeight: number;
  textAlign: "left" | "center" | "right";
  color: string;
  backgroundColor?: string;
};

export type HeadingStyles = {
  h1: HeadingStyle;
  h2: HeadingStyle;
  h3: HeadingStyle;
};

export type PrimaryCta = {
  enabled: boolean;
  headline: string;
  button_text: string;
  url: string;
};

export const DEFAULT_HEADING_STYLES: HeadingStyles = {
  h1: { fontSize: "48px", fontWeight: 700, lineHeight: 1.2, textAlign: "left", color: "#111111" },
  h2: { fontSize: "36px", fontWeight: 700, lineHeight: 1.3, textAlign: "left", color: "#111111" },
  h3: { fontSize: "28px", fontWeight: 600, lineHeight: 1.4, textAlign: "left", color: "#111111" },
};

export const DEFAULT_CTA: PrimaryCta = { enabled: false, headline: "", button_text: "", url: "" };

export function normalizeHeadingStyles(value: unknown): HeadingStyles {
  const src = (value ?? {}) as Record<string, Partial<HeadingStyle>>;
  const one = (k: keyof HeadingStyles): HeadingStyle => ({
    ...DEFAULT_HEADING_STYLES[k],
    ...(src?.[k] ?? {}),
  });
  return { h1: one("h1"), h2: one("h2"), h3: one("h3") };
}

export function normalizeCta(value: unknown): PrimaryCta {
  const src = (value ?? {}) as Partial<PrimaryCta>;
  return {
    enabled: Boolean(src?.enabled),
    headline: String(src?.headline ?? ""),
    button_text: String(src?.button_text ?? ""),
    url: String(src?.url ?? ""),
  };
}

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "")
    .slice(0, 200);

export const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/* -------------------------------------------------------------------------- */
/* Sanitising                                                                  */
/* -------------------------------------------------------------------------- */

const BLOCK_TAGS = new Set(["h1", "h2", "h3", "p", "ul", "ol", "li", "blockquote"]);
const INLINE_TAGS = new Set(["strong", "b", "em", "i", "u", "br", "a", "span"]);
const ALLOWED = new Set([...BLOCK_TAGS, ...INLINE_TAGS]);

function safeHref(raw: string): string | null {
  const href = raw.trim();
  if (!href) return null;
  if (/^(https?:|mailto:|tel:)/i.test(href)) return href;
  if (href.startsWith("/") || href.startsWith("#")) return href;
  return null;
}

/** Allowlist sanitiser that keeps safe tags/links and drops everything else. */
export function sanitizeHtml(input: string): string {
  let html = String(input ?? "");
  // Drop whole dangerous elements including their content.
  html = html.replace(/<(script|style|iframe|object|embed|svg|math)[\s\S]*?<\/\1\s*>/gi, "");
  html = html.replace(/<!--[\s\S]*?-->/g, "");

  return html.replace(/<\/?([a-zA-Z0-9-]+)((?:[^>"']|"[^"]*"|'[^']*')*)>/g, (match, rawTag, rawAttrs) => {
    const tag = String(rawTag).toLowerCase();
    if (!ALLOWED.has(tag)) return "";
    if (match.startsWith("</")) return `</${tag}>`;

    if (tag === "a") {
      const attrs = String(rawAttrs ?? "");
      const hrefMatch = attrs.match(/href\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const href = safeHref(hrefMatch?.[2] ?? hrefMatch?.[3] ?? hrefMatch?.[4] ?? "");
      if (!href) return "";
      const external = /^https?:/i.test(href);
      return external
        ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">`
        : `<a href="${escapeHtml(href)}">`;
    }
    if (tag === "br") return "<br>";
    return `<${tag}>`;
  });
}

/** Sanitises inline content used inside a single block. */
export function sanitizeInline(input: string): string {
  return sanitizeHtml(input).replace(/<\/?(h1|h2|h3|p|ul|ol|li|blockquote)>/g, " ").replace(/\s+/g, " ").trim();
}

/* -------------------------------------------------------------------------- */
/* Blocks <-> HTML                                                             */
/* -------------------------------------------------------------------------- */

let counter = 0;
export const newBlockId = () => `b${Date.now().toString(36)}${(counter++).toString(36)}`;

export const makeBlock = (type: BlockType, html = ""): Block => ({ id: newBlockId(), type, html });

export function blocksToHtml(blocks: Block[]): string {
  return blocks
    .map((b) => {
      const inner = sanitizeInline(b.html);
      if (!inner) return "";
      return `<${b.type}>${inner}</${b.type}>`;
    })
    .filter(Boolean)
    .join("\n\n");
}

/** Parses stored body HTML (or legacy plain text) back into editable blocks. */
export function htmlToBlocks(body: string | null | undefined): Block[] {
  const raw = String(body ?? "").trim();
  if (!raw) return [makeBlock("p")];

  const hasBlocks = /<(h1|h2|h3|p)[\s>]/i.test(raw);
  if (hasBlocks) {
    const blocks: Block[] = [];
    const re = /<(h1|h2|h3|p)[^>]*>([\s\S]*?)<\/\1\s*>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw))) {
      blocks.push(makeBlock(m[1]!.toLowerCase() as BlockType, sanitizeInline(m[2] ?? "")));
    }
    if (blocks.length) return blocks;
  }

  // Legacy plain-text article: keep every paragraph.
  const paragraphs = raw
    .replace(/<[^>]+>/g, "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (!paragraphs.length) return [makeBlock("p")];
  return paragraphs.map((p) => makeBlock("p", escapeHtml(p).replace(/\n/g, "<br>")));
}

export function readTimeFromHtml(html: string): number {
  const words = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export function headingStyleAttr(style: HeadingStyle): Record<string, string> {
  return {
    fontSize: style.fontSize,
    fontWeight: String(style.fontWeight),
    lineHeight: String(style.lineHeight),
    textAlign: style.textAlign,
    color: style.color,
    backgroundColor: style.backgroundColor ?? "transparent",
  };
}
