// Shared (browser + server) helpers for the blog editor: block <-> HTML
// serialisation, HTML sanitising, slug and read-time helpers.

export type BlockType = "h1" | "h2" | "h3" | "h4" | "p" | "table";

export type Block = {
  id: string;
  type: BlockType;
  html: string;
  style?: Partial<HeadingStyle>;
};

export type HeadingStyle = {
  fontSize: string;
  fontWeight: number;
  lineHeight: number;
  textAlign: "left" | "center" | "right";
  color: string;
  backgroundColor?: string;
  marginTop?: string;
  marginBottom?: string;
  paddingLeft?: string;
};

export type HeadingStyles = {
  h1: HeadingStyle;
  h2: HeadingStyle;
  h3: HeadingStyle;
  h4: HeadingStyle;
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
  h4: { fontSize: "22px", fontWeight: 600, lineHeight: 1.4, textAlign: "left", color: "#111111" },
};

export const DEFAULT_CTA: PrimaryCta = { enabled: false, headline: "", button_text: "", url: "" };

export function normalizeHeadingStyles(value: unknown): HeadingStyles {
  const src = (value ?? {}) as Record<string, Partial<HeadingStyle>>;
  const one = (k: keyof HeadingStyles): HeadingStyle => ({
    ...DEFAULT_HEADING_STYLES[k],
    ...(src?.[k] ?? {}),
  });
  return { h1: one("h1"), h2: one("h2"), h3: one("h3"), h4: one("h4") };
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

const BLOCK_TAGS = new Set([
  "h1",
  "h2",
  "h3",
  "h4",
  "p",
  "ul",
  "ol",
  "li",
  "blockquote",
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "td",
  "th",
  "caption",
]);
const INLINE_TAGS = new Set(["strong", "b", "em", "i", "u", "br", "a", "span"]);
const ALLOWED = new Set([...BLOCK_TAGS, ...INLINE_TAGS]);

const SAFE_STYLE_PROPERTIES = new Set([
  "background-color",
  "border",
  "border-collapse",
  "color",
  "font-size",
  "font-style",
  "font-weight",
  "line-height",
  "margin-bottom",
  "margin-top",
  "padding",
  "padding-left",
  "padding-right",
  "text-align",
  "text-decoration",
  "vertical-align",
  "width",
]);

function safeStyle(raw: string): string {
  return raw
    .split(";")
    .map((declaration) => {
      const separator = declaration.indexOf(":");
      if (separator < 0) return "";
      const property = declaration.slice(0, separator).trim().toLowerCase();
      const value = declaration.slice(separator + 1).trim();
      if (!SAFE_STYLE_PROPERTIES.has(property) || !value || /[<>]/.test(value)) return "";
      return `${property}:${value}`;
    })
    .filter(Boolean)
    .join(";");
}

function styleObject(raw: string): Partial<HeadingStyle> {
  const result: Partial<HeadingStyle> = {};
  raw.split(";").forEach((declaration) => {
    const separator = declaration.indexOf(":");
    if (separator < 0) return;
    const key = declaration.slice(0, separator).trim().toLowerCase();
    const value = declaration.slice(separator + 1).trim();
    if (key === "font-size") result.fontSize = value;
    if (key === "font-weight") result.fontWeight = Number(value) || 400;
    if (key === "line-height") result.lineHeight = Number.parseFloat(value) || 1.5;
    if (key === "text-align" && ["left", "center", "right"].includes(value)) {
      result.textAlign = value as HeadingStyle["textAlign"];
    }
    if (key === "color") result.color = value;
    if (key === "background-color") result.backgroundColor = value;
    if (key === "margin-top") result.marginTop = value;
    if (key === "margin-bottom") result.marginBottom = value;
    if (key === "padding-left") result.paddingLeft = value;
  });
  return result;
}

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

    const attrs = String(rawAttrs ?? "");
    const allowedAttrs = new Set(["align", "colspan", "rowspan", "scope", "valign"]);
    const safeAttributes: string[] = [];

    for (const attributeMatch of attrs.matchAll(/([a-zA-Z:-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
      const attrName = attributeMatch[1].toLowerCase();
      const attrValue = attributeMatch[3] ?? attributeMatch[4] ?? attributeMatch[5] ?? "";
      if (!attrValue) continue;

      if (attrName === "style") {
        const style = safeStyle(attrValue);
        if (style) safeAttributes.push(`style="${escapeHtml(style)}"`);
        continue;
      }

      if (allowedAttrs.has(attrName)) {
        safeAttributes.push(`${attrName}="${escapeHtml(attrValue)}"`);
      }
    }

    return safeAttributes.length > 0 ? `<${tag} ${safeAttributes.join(" ")}>` : `<${tag}>`;
  });
}

/** Sanitises inline content used inside a single block. */
export function sanitizeInline(input: string): string {
  return sanitizeHtml(input).replace(/<\/?(h1|h2|h3|h4|p|ul|ol|li|blockquote)>/g, " ").replace(/\s+/g, " ").trim();
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
      const sanitized = sanitizeHtml(b.html).trim();
      if (!sanitized) return "";
      if (/^<table\b/i.test(sanitized)) return sanitized;

      const inner = sanitizeInline(b.html);
      if (!inner) return "";
      const style = b.style
        ? safeStyle(
            Object.entries(b.style)
              .map(([key, value]) => `${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}:${value}`)
              .join(";"),
          )
        : "";
      if (/^(<(ul|ol|blockquote)\b)/i.test(sanitized)) return sanitized;
      const content = inner;
      return style ? `<${b.type} style="${escapeHtml(style)}">${content}</${b.type}>` : `<${b.type}>${content}</${b.type}>`;
    })
    .filter(Boolean)
    .join("\n\n");
}

/** Parses stored body HTML (or legacy plain text) back into editable blocks. */
export function htmlToBlocks(body: string | null | undefined): Block[] {
  const raw = String(body ?? "").trim();
  if (!raw) return [makeBlock("p")];

  const hasBlocks = /<(h1|h2|h3|h4|p|ul|ol|blockquote|table)[\s>]/i.test(raw);
  if (hasBlocks) {
    const blocks: Block[] = [];
    const re = /<(h1|h2|h3|h4|p|ul|ol|blockquote|table)([^>]*)>([\s\S]*?)<\/\1\s*>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw))) {
      const styleMatch = m[2]?.match(/style\s*=\s*("([^"]*)"|'([^']*)')/i);
      const style = safeStyle(styleMatch?.[2] ?? styleMatch?.[3] ?? "");
      const tag = m[1]!.toLowerCase();
      const rawHtml = tag === "table" ? sanitizeHtml(m[0] ?? "") : sanitizeInline(m[3] ?? "");
      const blockType =
        tag === "h1" || tag === "h2" || tag === "h3" || tag === "h4"
          ? tag
          : tag === "table"
            ? "table"
            : "p";
      blocks.push({
        ...makeBlock(blockType, rawHtml),
        ...(style ? { style: styleObject(style) } : {}),
      });
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
