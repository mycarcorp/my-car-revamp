import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  deliverLeadToGhl,
  ghlEventTypeFor,
  isGhlForwardedLeadType,
  resetGhlForwardingStateForTests,
} from "./ghl-webhook.functions";
import { postToGhl } from "./ghl-webhook.server";

// Synthetic fixtures only.
const NAME = "Synthetic Person";
const EMAIL = "synthetic.person@example.test";
const SSN = "900-12-3456";
const EVENT_ID = "mc_00000000-0000-4000-8000-000000000001";

const attribution = {
  lead_source: "Google Organic",
  lead_medium: "organic",
  source_evidence: "inferred",
  utm_source: "google",
  utm_campaign: "spring",
  referrer: "https://www.google.com/",
  landing_page: "https://mycarcorp.com/",
  conversion_page: "https://mycarcorp.com/contact",
  first_touch_source: "Google Organic",
  last_touch_source: "Google Organic",
  gclid: "",
  fbclid: "abc",
};

const carFinderDetails = {
  request_type: "car_finder",
  preferred_make: "Honda",
  preferred_model: "Civic",
  preferred_year_min: "2018",
  preferred_year_max: "2022",
  preferred_body_style: "Sedan",
  maximum_budget: "15000",
  financing_needed: "yes",
  must_have_features: "Backup camera",
  ssn: SSN,
  date_of_birth: "1901-02-03",
  customer_email: EMAIL,
  lead_event_id: EVENT_ID,
  ...attribution,
};

function input(leadType: string, details: Record<string, unknown> = {}) {
  return { leadType, fullName: NAME, email: EMAIL, phone: "5555550100", message: "Hello", vehicleUrl: "", vehicle: null, details };
}

describe("website lead routing to GoHighLevel", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;
  const bodies = () => fetchMock.mock.calls.map(([, init]) => JSON.parse(String((init as RequestInit).body)) as Record<string, unknown>);

  beforeEach(() => {
    resetGhlForwardingStateForTests();
    fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe("event mapping", () => {
    it("maps every forwarded lead type to its event type", () => {
      expect(ghlEventTypeFor("contact", {})).toBe("website_contact");
      expect(ghlEventTypeFor("contact", { request_type: "car_finder" })).toBe("car_finder_request");
      expect(ghlEventTypeFor("trade", { intent: "sell" })).toBe("sell_or_trade");
      expect(ghlEventTypeFor("trade", { intent: "trade" })).toBe("sell_or_trade");
      expect(ghlEventTypeFor("appointment", {})).toBe("book_a_visit");
      expect(ghlEventTypeFor("availability", {})).toBe("check_availability");
      expect(ghlEventTypeFor("finance", {})).toBe("financing");
    });

    it("only treats an exact car_finder request type as Car Finder", () => {
      for (const value of ["Car_Finder", "car finder", "", undefined, null, 1, ["car_finder"]]) {
        expect(ghlEventTypeFor("contact", { request_type: value })).toBe("website_contact");
      }
      // The request type never changes other lead types.
      expect(ghlEventTypeFor("appointment", { request_type: "car_finder" })).toBe("book_a_visit");
    });

    it("does not forward unsupported, purchase, lease or prototype-named types", () => {
      for (const type of ["purchase", "purchase_request", "lease_to_own", "unknown", "constructor", "__proto__", "toString", ""]) {
        expect(isGhlForwardedLeadType(type), type).toBe(false);
        expect(ghlEventTypeFor(type, {})).toBeNull();
      }
    });
  });

  describe("Contact", () => {
    it("sends a website_contact event with contact fields and attribution only", async () => {
      const result = await deliverLeadToGhl(input("contact", { ...attribution, ssn: SSN, lead_event_id: EVENT_ID, vehicle_vin: "1HGCM82633A004352" }));
      expect(result).toEqual({ delivered: true, status: 200 });
      const [payload] = bodies();
      expect(payload).toMatchObject({
        event_type: "website_contact",
        source: "MyCar Website",
        full_name: NAME,
        first_name: "Synthetic",
        last_name: "Person",
        email: EMAIL,
        phone: "5555550100",
        message: "Hello",
        lead_source: "Google Organic",
        lead_medium: "organic",
        utm_source: "google",
        utm_campaign: "spring",
        landing_page: "https://mycarcorp.com/",
        conversion_page: "https://mycarcorp.com/contact",
        first_touch_source: "Google Organic",
        last_touch_source: "Google Organic",
        fbclid: "abc",
      });
      const serialized = JSON.stringify(payload);
      expect(serialized).not.toContain(SSN);
      expect(serialized).not.toContain("1HGCM82633A004352");
      expect(payload).not.toHaveProperty("source_evidence");
    });
  });

  describe("Car Finder", () => {
    it("sends a car_finder_request event with vehicle preferences and attribution", async () => {
      await deliverLeadToGhl(input("contact", carFinderDetails));
      const [payload] = bodies();
      expect(payload).toMatchObject({
        event_type: "car_finder_request",
        request_type: "car_finder",
        full_name: NAME,
        email: EMAIL,
        preferred_make: "Honda",
        preferred_model: "Civic",
        preferred_year_min: "2018",
        preferred_year_max: "2022",
        preferred_body_style: "Sedan",
        maximum_budget: "15000",
        financing_needed: "yes",
        must_have_features: "Backup camera",
        lead_source: "Google Organic",
        utm_source: "google",
      });
    });

    it("validates the budget and financing preference against the form schema", async () => {
      for (const financing of ["yes", "no", "unsure"]) {
        await deliverLeadToGhl(input("contact", { ...carFinderDetails, financing_needed: financing, lead_event_id: undefined }));
      }
      expect(bodies().map((body) => body["financing_needed"])).toEqual(["yes", "no", "unsure"]);
      fetchMock.mockClear();
      for (const [budget, financing] of [["25000", "yes"], ["25000.50", "no"], ["0", "unsure"]]) {
        await deliverLeadToGhl(input("contact", { ...carFinderDetails, maximum_budget: budget, financing_needed: financing, lead_event_id: undefined }));
      }
      expect(bodies().map((body) => body["maximum_budget"])).toEqual(["25000", "25000.50", "0"]);
      fetchMock.mockClear();
      const junk: Array<[unknown, unknown]> = [
        ["-5", "maybe"], ["12abc", "YES"], ["1e9", "true"], ["15,000", "1"], [`${SSN}`, SSN], ["call me at 5559990199", "approved"], ["1234567890", ""], [{ a: 1 }, { b: 2 }], [undefined, undefined],
      ];
      for (const [budget, financing] of junk) {
        await deliverLeadToGhl(input("contact", { ...carFinderDetails, maximum_budget: budget, financing_needed: financing, lead_event_id: undefined }));
      }
      for (const body of bodies()) {
        expect(body["maximum_budget"]).toBe("");
        expect(body["financing_needed"]).toBe("");
      }
      expect(JSON.stringify(bodies())).not.toContain(SSN);
      expect(JSON.stringify(bodies())).not.toContain("5559990199");
    });

    it("never forwards identity or financial fields found in the details", async () => {
      await deliverLeadToGhl(input("contact", { ...carFinderDetails, income_band: "50k", employment: "x", date_of_birth: "1901-02-03" }));
      const serialized = JSON.stringify(bodies()[0]);
      for (const secret of [SSN, "1901-02-03", "income_band", "employment", "date_of_birth", "ssn"]) expect(serialized).not.toContain(secret);
      // lead_event_id stays out of the payload until the Meta deduplication phase.
      expect(bodies()[0]).not.toHaveProperty("lead_event_id");
    });

    it("sends a different event type than a general contact from the same endpoint", async () => {
      await deliverLeadToGhl(input("contact", {}));
      await deliverLeadToGhl(input("contact", { request_type: "car_finder" }));
      expect(bodies().map((body) => body["event_type"])).toEqual(["website_contact", "car_finder_request"]);
    });
  });

  describe("existing flows are unchanged", () => {
    it("keeps the sell and trade payload", async () => {
      await deliverLeadToGhl(input("trade", { intent: "sell", year_make_model: "2015 Toyota Camry SE", vin: "VIN123", plate: "ABC123", mileage: "90000", zip: "22401", condition: "good", title_status: "clean", ...attribution }));
      const [payload] = bodies();
      expect(payload).toMatchObject({
        event_type: "sell_or_trade",
        vehicle_year: "2015",
        vehicle_make: "Toyota",
        vehicle_model: "Camry SE",
        vin: "VIN123",
        license_plate: "ABC123",
        mileage: "90000",
        zip: "22401",
        intent: "sell",
        lead_source: "Google Organic",
      });
    });

    it("keeps the appointment payload", async () => {
      await deliverLeadToGhl({ ...input("appointment", { preferred_date: "2026-11-01", preferred_time: "10:00", appointment_type: "test_drive", ...attribution }), vehicle: { id: "v1", year: 2019, make: "Honda", model: "Civic" } });
      expect(bodies()[0]).toMatchObject({
        event_type: "book_a_visit",
        preferred_date: "2026-11-01",
        preferred_time: "10:00",
        appointment_type: "test_drive",
        vehicle_id: "v1",
        make: "Honda",
        lead_source: "Google Organic",
      });
    });

    it("keeps the finance payload fields and forwards no identity data", async () => {
      await deliverLeadToGhl(input("finance", { employment: "employed", income_band: "50-75k", desired_payment: "400", down_payment: "1000", ssn: SSN, date_of_birth: "1901-02-03" }));
      const [payload] = bodies();
      expect(payload).toMatchObject({ event_type: "financing", employment: "employed", income_band: "50-75k", desired_payment: "400", down_payment: "1000" });
      expect(JSON.stringify(payload)).not.toContain(SSN);
      expect(JSON.stringify(payload)).not.toContain("1901-02-03");
    });

    it("keeps availability forwarding", async () => {
      await deliverLeadToGhl({ ...input("availability", {}), vehicle: { price: 15000 } });
      expect(bodies()[0]).toMatchObject({ event_type: "check_availability", vehicle_price: "15000" });
    });
  });

  describe("duplicate forwarding", () => {
    it("forwards one submission once even if the call is repeated", async () => {
      const details = { ...carFinderDetails };
      const [first, second, third] = await Promise.all([
        deliverLeadToGhl(input("contact", details)),
        deliverLeadToGhl(input("contact", details)),
        deliverLeadToGhl(input("contact", details)),
      ]);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect([first.delivered, second.delivered, third.delivered]).toEqual([true, true, true]);
    });

    it("treats a new submission as new and a malformed ID as unguarded", async () => {
      await deliverLeadToGhl(input("contact", { lead_event_id: EVENT_ID }));
      await deliverLeadToGhl(input("contact", { lead_event_id: "mc_00000000-0000-4000-8000-000000000002" }));
      expect(fetchMock).toHaveBeenCalledTimes(2);
      await deliverLeadToGhl(input("contact", { lead_event_id: "not-an-id" }));
      await deliverLeadToGhl(input("contact", { lead_event_id: "not-an-id" }));
      expect(fetchMock).toHaveBeenCalledTimes(4);
    });

    it("allows another attempt after a failed delivery, so a lead is never blocked by a failure", async () => {
      fetchMock.mockResolvedValueOnce(new Response("{}", { status: 503 }));
      expect(await deliverLeadToGhl(input("contact", { lead_event_id: EVENT_ID }))).toEqual({ delivered: false, status: 503 });
      expect(await deliverLeadToGhl(input("contact", { lead_event_id: EVENT_ID }))).toEqual({ delivered: true, status: 200 });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("also releases the ID when the request throws", async () => {
      fetchMock.mockRejectedValueOnce(new TypeError(`fetch failed for ${EMAIL}`));
      expect(await deliverLeadToGhl(input("contact", { lead_event_id: EVENT_ID }))).toEqual({ delivered: false, status: null });
      expect(await deliverLeadToGhl(input("contact", { lead_event_id: EVENT_ID }))).toEqual({ delivered: true, status: 200 });
    });
  });

  describe("error handling and safe logs", () => {
    it("logs only fixed metadata for failed and thrown deliveries", async () => {
      fetchMock.mockResolvedValueOnce(new Response(`rejected ${EMAIL} ${SSN}`, { status: 422 }));
      await deliverLeadToGhl(input("contact", carFinderDetails));
      fetchMock.mockRejectedValueOnce(new TypeError(`boom ${EMAIL} ${SSN}`));
      await deliverLeadToGhl(input("contact", { ...carFinderDetails, lead_event_id: "mc_00000000-0000-4000-8000-000000000003" }));
      const logged = JSON.stringify([...errorSpy.mock.calls, ...logSpy.mock.calls]);
      expect(logged).not.toContain(EMAIL);
      expect(logged).not.toContain(SSN);
      expect(logged).not.toContain(NAME);
      expect(logged).not.toMatch(/delivered/);
    });
  });

  describe("shared transport and CEO-owned flows are untouched", () => {
    it("postToGhl still posts the payload exactly as given", async () => {
      const payload = { event_type: "lease_to_own_application", full_name: NAME, nested: { a: 1 } };
      expect(await postToGhl(payload)).toBe(200);
      const [, init] = fetchMock.mock.calls[0] as [unknown, RequestInit];
      expect(init.method).toBe("POST");
      expect(JSON.parse(String(init.body))).toEqual(payload);
    });

    it("keeps the Lease to Own and purchase senders independent of the lead forwarder", () => {
      for (const file of ["src/lib/lease-to-own.functions.ts", "src/lib/purchases.functions.ts"]) {
        const source = readFileSync(file, "utf8");
        expect(source, file).not.toContain("ghl-webhook.functions");
        expect(source, file).toContain("ghl-webhook.server");
      }
    });
  });
});
