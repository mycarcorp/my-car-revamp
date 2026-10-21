import { describe, expect, it, vi } from "vitest";
import {
  createAnalyticsController,
  getLeadFormType,
  isAnalyticsRoutePublic,
  publicCatalogItemId,
  recordFormStart,
  recordLeadSubmission,
  sanitizeEvent,
  sanitizePageLocation,
} from "./analytics";

function mockAdapter() {
  return {
    load: vi.fn(),
    updateConsent: vi.fn(),
    send: vi.fn(),
  };
}

describe("central GA4 analytics gate", () => {
  it("does not load or send before explicit analytics consent", () => {
    const adapter = mockAdapter();
    const analytics = createAnalyticsController(adapter);
    analytics.configure({ measurementId: "G-CFXQ8JPE21", consent: "unknown", isPublicRoute: true });
    expect(analytics.pageView("/", "https://mycarcorp.com")).toBe(false);
    expect(analytics.track({ name: "form_start", params: { form_type: "contact" } })).toBe(false);
    expect(adapter.load).not.toHaveBeenCalled();
    expect(adapter.send).not.toHaveBeenCalled();
  });

  it("does not load on admin routes even after consent", () => {
    const adapter = mockAdapter();
    const analytics = createAnalyticsController(adapter);
    analytics.configure({ measurementId: "G-CFXQ8JPE21", consent: "granted", isPublicRoute: false });
    expect(analytics.pageView("/admin/marketing", "https://mycarcorp.com")).toBe(false);
    expect(adapter.load).not.toHaveBeenCalled();
    expect(isAnalyticsRoutePublic("/admin/marketing")).toBe(false);
    expect(isAnalyticsRoutePublic("/api/public/vehicles")).toBe(false);
    expect(isAnalyticsRoutePublic("/my/purchases/123")).toBe(false);
    expect(isAnalyticsRoutePublic("/auth/callback")).toBe(false);
    expect(isAnalyticsRoutePublic("/reset-password")).toBe(false);
    expect(isAnalyticsRoutePublic("/search")).toBe(true);
    expect(isAnalyticsRoutePublic("/administrator")).toBe(true);
  });

  it("sends one page_view per sanitized route location", () => {
    const adapter = mockAdapter();
    const analytics = createAnalyticsController(adapter);
    analytics.configure({ measurementId: "G-CFXQ8JPE21", consent: "granted", isPublicRoute: true });
    expect(analytics.pageView("/schedule?vin=1HGCM82633A004352#form", "https://mycarcorp.com")).toBe(true);
    expect(analytics.pageView("/schedule?email=private@example.com", "https://mycarcorp.com")).toBe(false);
    expect(analytics.pageView("/search?make=Honda", "https://mycarcorp.com")).toBe(true);
    expect(adapter.load).toHaveBeenCalledTimes(1);
    expect(adapter.send).toHaveBeenCalledTimes(2);
    expect(adapter.send).toHaveBeenNthCalledWith(1, {
      name: "page_view",
      params: { page_path: "/schedule", page_location: "https://mycarcorp.com/schedule" },
    });
    expect(sanitizePageLocation("/inventory/car?vin=1HGCM82633A004352#detail", "https://mycarcorp.com"))
      .toBe("https://mycarcorp.com/inventory/car");
    expect(sanitizePageLocation("/inventory/1HGCM82633A004352", "https://mycarcorp.com"))
      .toBe("https://mycarcorp.com/inventory/redacted");
    expect(sanitizePageLocation("/", "http://mycarcorp.com")).toBe("");
  });

  it("requires a valid configured measurement ID", () => {
    const adapter = mockAdapter();
    const analytics = createAnalyticsController(adapter);
    analytics.configure({ measurementId: "", consent: "granted", isPublicRoute: true });
    expect(analytics.getStatus()).toMatchObject({ configured: false, active: false });
    expect(analytics.pageView("/", "https://mycarcorp.com")).toBe(false);
    expect(adapter.load).not.toHaveBeenCalled();
  });

  it("loads only after explicit grant and sends denied on consent revocation", () => {
    const adapter = mockAdapter();
    const analytics = createAnalyticsController(adapter);
    analytics.configure({ measurementId: "G-CFXQ8JPE21", consent: "unknown", isPublicRoute: true });
    expect(adapter.load).not.toHaveBeenCalled();
    analytics.configure({ measurementId: "G-CFXQ8JPE21", consent: "granted", isPublicRoute: true });
    expect(adapter.load).toHaveBeenCalledTimes(1);
    expect(adapter.updateConsent).toHaveBeenCalledWith("granted");
    analytics.configure({ measurementId: "G-CFXQ8JPE21", consent: "denied", isPublicRoute: true });
    expect(adapter.updateConsent).toHaveBeenLastCalledWith("denied");
  });
});

describe("GA4 event allowlists", () => {
  it("keeps only whitelisted form fields and strips caller-supplied identifiers", () => {
    expect(sanitizeEvent({
      name: "generate_lead",
      params: {
        form_type: "sell",
        lead_intent: "trade",
        email: "private@example.com",
        phone: "5405550100",
        vin: "1HGCM82633A004352",
        full_name: "Private Customer",
      },
    } as never)).toEqual({ name: "generate_lead", params: { form_type: "sell", lead_intent: "trade" } });
  });

  it("rejects unsafe item identifiers, PII-like names, and arbitrary list labels", () => {
    expect(sanitizeEvent({
      name: "view_item_list",
      params: {
        item_list_name: "search=VIN123",
        items: [{ item_id: "550e8400-e29b-41d4-a716-446655440000", item_name: "Jane Doe" }],
      },
    })).toBeNull();
    expect(sanitizeEvent({
      name: "view_item",
      params: { item_id: "public-car-slug", item_name: "Jane Doe 5405550100" },
    })).toBeNull();
    expect(sanitizeEvent({
      name: "view_item",
      params: { item_id: "vehicle-slug", item_name: "2019 Honda Civic", item_category: "Sedan", price: 15000, currency: "USD" },
    })).toEqual({
      name: "view_item",
      params: { item_id: "vehicle-slug", item_name: "2019 Honda Civic", item_category: "Sedan", price: 15000, currency: "USD" },
    });
    expect(sanitizeEvent({
      name: "view_item",
      params: { item_id: "1hgcm82633a004352", item_name: "2019 Honda Civic", item_category: "Sedan" },
    })).toBeNull();
    expect(publicCatalogItemId(2019, "Honda", "Civic")).toBe("2019-honda-civic");
    expect(publicCatalogItemId(2019, "1HGCM82633A004352", "Civic")).toBe("");
  });

  it("allows only fixed form categories and first-party sell/trade intent", () => {
    expect(getLeadFormType("trade", { intent: "sell" })).toBe("sell");
    expect(getLeadFormType("contact", { request_type: "car_finder" })).toBe("car_finder");
    const send = vi.fn(() => true);
    expect(recordFormStart("finance", send)).toBe(true);
    expect(recordFormStart("arbitrary-user-value", send)).toBe(false);
    expect(recordLeadSubmission(true, "trade", { intent: "trade" }, send)).toBe(true);
    expect(send).toHaveBeenLastCalledWith({ name: "generate_lead", params: { form_type: "trade", lead_intent: "trade" } });
  });

  it("does not record failed lead submissions", () => {
    const send = vi.fn(() => true);
    expect(recordLeadSubmission(false, "finance", {}, send)).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });
});