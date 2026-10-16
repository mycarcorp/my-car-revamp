import { describe, expect, it } from "vitest";
import { coversTarget, resolveProperty, mergeArticles, prospectSchema, emptySnapshot } from "./marketing";
describe("marketing data and permissions", () => {
  it("requires a choice when both verified properties cover My Car", () => { expect(resolveProperty([{ siteUrl: "https://mycarcorp.com/" }, { siteUrl: "sc-domain:mycarcorp.com" }]).selected).toBeNull(); });
  it("never accepts an unverified or unrelated property", () => { expect(() => resolveProperty([{ siteUrl: "https://mycarcorp.com/", permissionLevel: "siteUnverifiedUser" }], "https://mycarcorp.com/")).toThrow(); expect(coversTarget("sc-domain:notmycarcorp.com")).toBe(false); });
  it("revalidates the exact property before use", () => { expect(resolveProperty([{ siteUrl: "https://mycarcorp.com/" }], "https://mycarcorp.com/").selected).toBe("https://mycarcorp.com/"); expect(() => resolveProperty([], "https://mycarcorp.com/")).toThrow(); });
  it("deduplicates articles by slug without publishing", () => { const a = { slug: "car-loan", title: "Car loan", publishedAt: null, source: "AutoSEO" as const }; expect(mergeArticles([a, a], [{ ...a, source: "Manual" }])).toHaveLength(1); });
  it("does not invent connected states or scores", () => { const s = emptySnapshot(); expect(s.search.state).toBe("Not Connected"); expect(s.research.data).toBeNull(); expect(s.lighthouse.data).toBeNull(); });
  it("requires evidence for manually acquired backlinks", () => { expect(prospectSchema.safeParse({ domain: "example.com", status: "Acquired", relevance: "", notes: "", backlinkUrl: "" }).success).toBe(false); });
  it("rejects executable outreach URLs", () => { expect(prospectSchema.safeParse({ domain: "example.com", status: "Researching", relevance: "", notes: "", backlinkUrl: "javascript:alert(1)" }).success).toBe(false); });
});