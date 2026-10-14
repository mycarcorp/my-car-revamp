import { describe, expect, it } from "bun:test";
import { addEvent, emptyProfile, prune, summarize, type VisitorEvent } from "./visitor-personalization";

const now = Date.now();
const ev = (e: Partial<VisitorEvent> & Pick<VisitorEvent, "type" | "category">): VisitorEvent => ({
  path: "/x",
  ts: now,
  ...e,
});
const car = { id: "1", slug: "2017-chrysler-pacifica", make: "Chrysler", body: "minivan" };

describe("visitor personalization", () => {
  it("ignores a refresh of the same page within 30 minutes", () => {
    let p = emptyProfile();
    p = addEvent(p, ev({ type: "finance", category: "financing", path: "/finance" }));
    p = addEvent(p, ev({ type: "finance", category: "financing", path: "/finance", ts: now + 60000 }));
    expect(p.events).toHaveLength(1);
  });

  it("drops events older than 90 days", () => {
    const p = { ...emptyProfile(), events: [ev({ type: "sell", category: "selling", ts: now - 91 * 86400000 })] };
    expect(prune(p, now).events).toHaveLength(0);
  });

  it("financing visit makes financing the top interest", () => {
    const p = { ...emptyProfile(), events: [ev({ type: "finance", category: "financing" })] };
    expect(summarize(p, now).ranked[0]).toBe("financing");
  });

  it("trade intent (4) outranks a sell page visit (3)", () => {
    const p = {
      ...emptyProfile(),
      events: [ev({ type: "sell", category: "selling" }), ev({ type: "trade_intent", category: "trade" })],
    };
    expect(summarize(p, now).ranked[0]).toBe("trade");
  });

  it("a vehicle viewed twice becomes the top vehicle; once does not", () => {
    const once = { ...emptyProfile(), events: [ev({ type: "vehicle_view", category: "vehicle", vehicle: car })] };
    expect(summarize(once, now).topVehicle).toBeNull();
    const twice = {
      ...once,
      events: [...once.events, ev({ type: "vehicle_view", category: "vehicle", vehicle: car, ts: now - 1 })],
    };
    expect(summarize(twice, now).topVehicle?.slug).toBe("2017-chrysler-pacifica");
  });

  it("recent activity outweighs older activity of the same weight", () => {
    const p = {
      ...emptyProfile(),
      events: [
        ev({ type: "finance", category: "financing", ts: now - 60 * 86400000 }),
        ev({ type: "sell", category: "selling" }),
      ],
    };
    expect(summarize(p, now).ranked[0]).toBe("selling");
  });
});
