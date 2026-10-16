import { escapeHtml, sanitizeHtml } from "./blog-content";

/** True when a stored description already contains formatted HTML. */
export function isHtmlDescription(value: string | null | undefined): boolean {
  return /<(p|h2|h3|ul|ol|table|strong|em|br|a)\b/i.test(String(value ?? ""));
}

/**
 * Converts any stored description (legacy plain text or editor HTML) to safe HTML.
 * Plain text keeps its paragraphs and line breaks.
 */
export function descriptionToSafeHtml(value: string | null | undefined): string {
  let raw = String(value ?? "").trim();
  if (!raw) return "";
  // Recover descriptions saved as escaped HTML ("&lt;p&gt;…") — display only, data untouched.
  if (!isHtmlDescription(raw) && /&lt;\/?(p|h[1-4]|ul|ol|li|strong|em|br|table)\b/i.test(raw)) {
    raw = raw.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  }
  if (isHtmlDescription(raw)) {
    // Demote any h1 so the page keeps a single H1 (the vehicle title).
    return sanitizeHtml(raw)
      .replace(/<(\/?)h1>/g, "<$1h2>")
      .replace(/<(\/?)h4>/g, "<$1h3>")
      .replace(/<p>(\s|&nbsp;|<br\s*\/?>)*<\/p>/gi, "")
      .trim();
  }
  return raw
    .split(/\n{2,}/)
    .map((para) => para.trim())
    .filter(Boolean)
    .map((para) => `<p>${escapeHtml(para).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

const decodeEntities = (s: string) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

/** Plain-text version for meta descriptions and structured data. */
export function descriptionToPlainText(value: string | null | undefined): string {
  const raw = String(value ?? "");
  if (!isHtmlDescription(raw)) return raw.trim();
  return decodeEntities(
    raw
      .replace(/<\/(p|h2|h3|h4|li|tr)>/gi, " ")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/\s+/g, " ")
    .trim();
}

export type DescriptionFaq = { question: string; answer: string };

/**
 * Extracts real FAQ pairs: inside a section whose H2 mentions "question"/"FAQ",
 * each H3 ending in "?" followed by its answer text. Returns [] otherwise.
 */
export function extractDescriptionFaqs(safeHtml: string): DescriptionFaq[] {
  const sections = safeHtml.split(/<h2[^>]*>/i);
  const faqs: DescriptionFaq[] = [];
  for (const section of sections) {
    const headingEnd = section.indexOf("</h2>");
    if (headingEnd < 0) continue;
    const heading = section.slice(0, headingEnd);
    if (!/faq|question/i.test(heading)) continue;
    const parts = section.slice(headingEnd + 5).split(/<h3[^>]*>/i).slice(1);
    for (const part of parts) {
      const end = part.indexOf("</h3>");
      if (end < 0) continue;
      const question = descriptionToPlainText(part.slice(0, end) + "<p></p>");
      const answer = descriptionToPlainText(part.slice(end + 5) + "<p></p>");
      if (question.endsWith("?") && answer) faqs.push({ question, answer });
    }
  }
  return faqs;
}

/** Starter outline for a new description — headings only, no vehicle claims. */
export const DESCRIPTION_TEMPLATE = [
  "<h2>Vehicle Overview</h2><p></p>",
  "<h2>Key Features &amp; Factory Equipment</h2><ul><li><p></p></li></ul>",
  "<h2>Detailed Specifications</h2>",
  "<table><tbody><tr><th><p>Specification</p></th><th><p>Detail</p></th></tr><tr><td><p></p></td><td><p></p></td></tr></tbody></table>",
  "<h2>Frequently Asked Questions</h2><h3>Question?</h3><p></p>",
  "<h2>Regional Service Areas &amp; Delivery Information</h2><p></p>",
].join("");
