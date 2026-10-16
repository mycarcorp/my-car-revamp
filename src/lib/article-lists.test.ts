import { describe, expect, it } from "vitest";
import { normalizeArticleLists } from "./article-lists";

describe("pasted article lists", () => {
  it("wraps orphan items while retaining their text and nested lists", () => {
    const html = normalizeArticleLists('<div><li>Finance<ul><li>Loan</li></ul></li><li>Trade</li></div>');
    expect(html).toBe('<div><ul><li>Finance<ul><li>Loan</li></ul></li><li>Trade</li></ul></div>');
  });
  it("places non-list children inside items rather than deleting content", () => {
    expect(normalizeArticleLists('<ul><p>Budget</p><li>Vehicle</li></ul>')).toBe('<ul><li><p>Budget</p></li><li>Vehicle</li></ul>');
  });
  it("leaves correct numbered lists intact", () => {
    expect(normalizeArticleLists('<ol start="2"><li>Apply</li><li>Review</li></ol>')).toBe('<ol start="2"><li>Apply</li><li>Review</li></ol>');
  });
});