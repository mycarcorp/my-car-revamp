import { describe, expect, it } from "vitest";
import { TOKEN_RE, approvedTotal, cleanDecisions, cleanItems, newToken } from "./approvals";

const raw = [
  { id: "a1", title: "Front brake pads and rotors", priority: "safety", price: "$389.50" },
  { id: "a2", title: "Cabin air filter", priority: "later", price: 49 },
];

describe("approvals", () => {
  it("cleans items and converts dollars to cents", () => {
    const { items, errors } = cleanItems(raw);
    expect(errors).toEqual([]);
    expect(items[0]!.price_cents).toBe(38950);
    expect(items[1]!.priority).toBe("later");
  });
  it("rejects duplicates and missing prices", () => {
    const { items, errors } = cleanItems([...raw, { id: "a1", title: "dup", price: 1 }, { id: "a3", title: "No price" }]);
    expect(items).toHaveLength(2);
    expect(errors).toHaveLength(2);
  });
  it("requires a decision for every item and totals approved work", () => {
    const { items } = cleanItems(raw);
    expect(cleanDecisions(items, { a1: "approved" })).toBeNull();
    const d = cleanDecisions(items, { a1: "approved", a2: "declined" });
    expect(d).not.toBeNull();
    expect(approvedTotal(items, d!)).toBe(38950);
  });
  it("makes unguessable tokens", () => {
    const t = newToken();
    expect(TOKEN_RE.test(t)).toBe(true);
    expect(t).not.toBe(newToken());
  });
});
