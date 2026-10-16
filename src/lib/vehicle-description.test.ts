import { describe, expect, it } from "vitest";
import { descriptionToPlainText, descriptionToSafeHtml, extractDescriptionFaqs } from "./vehicle-description";

describe("vehicle descriptions", () => {
  it("keeps legacy plain-text descriptions as paragraphs", () => {
    expect(descriptionToSafeHtml("Clean car.\n\nOne owner")).toBe("<p>Clean car.</p><p>One owner</p>");
  });

  it("strips scripts and event handlers from formatted descriptions", () => {
    const html = descriptionToSafeHtml('<h2>Overview</h2><p onclick="x()">Hi</p><script>alert(1)</script>');
    expect(html).toBe("<h2>Overview</h2><p>Hi</p>");
  });

  it("renders escaped HTML descriptions as formatted content and drops empty paragraphs", () => {
    expect(descriptionToSafeHtml("&lt;p&gt;&lt;strong&gt;V6&lt;/strong&gt;&lt;/p&gt;<p></p>")).toBe("<p><strong>V6</strong></p>");
  });

  it("produces plain text for meta and schema", () => {
    expect(descriptionToPlainText("<h2>Overview</h2><p>Leather &amp; Stow</p>")).toBe("Overview Leather & Stow");
  });

  it("only extracts FAQs from a real FAQ section", () => {
    const html = "<h2>Frequently Asked Questions</h2><h3>Does it seat 7?</h3><p>Yes.</p><h2>Specs</h2><h3>Engine?</h3><p>V6</p>";
    expect(extractDescriptionFaqs(html)).toEqual([{ question: "Does it seat 7?", answer: "Yes." }]);
  });
});
