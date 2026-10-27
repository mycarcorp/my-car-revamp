import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { allFormFields, deliverLeadToGhl } from "./ghl-webhook.functions";
import { deliverStoredLeadToGhl, withInventoryVehicle, type InventoryVehicle } from "./ghl-delivery.server";
import { resetGhlForwardingStateForTests } from "./ghl-webhook.functions";
import { resetGhlWebhookUrlWarningForTests } from "./ghl-webhook.server";

// Synthetic values only.
const SSN = "000-00-1234";
const DOB = "1990-01-02";
const ID_NUMBER = "T0000000";

const formDetails = {
  first_name: "Pat",
  last_name: "Example",
  buyer_email: "pat@example.test",
  cell_phone: "(540) 555-0100",
  ssn: SSN,
  date_of_birth: DOB,
  id_type: "Driver license",
  id_state: "VA",
  id_number: ID_NUMBER,
  current_address: JSON.stringify({ street: "1 Test St", city: "Testville" }),
  current_employer_1: JSON.stringify({ name: "Test Co" }),
  references: JSON.stringify([{ name: "Ref One" }]),
  other_income_amount: "500",
  cash_down: "1000",
  down_payment: "1000",
  loan_term: "60",
  apr: "9.9",
  estimated_payment: "350",
  sms_consent: true,
  vehicle_vin: "VINTEST00000001",
  vehicle_make: "Honda",
  lead_source: "Google Organic",
  channel: "organic_search",
  ghl_delivery_state: "sending",
  ghl_delivery_http: "200",
  empty_field: "",
  nested_object: { a: 1 },
};

describe("every financing form field is sent", () => {
  it("includes all saved fields, including identity and income details, as text", () => {
    const out = allFormFields(formDetails);
    for (const key of ["first_name", "buyer_email", "cell_phone", "ssn", "date_of_birth", "id_number", "id_state", "current_address", "current_employer_1", "references", "other_income_amount", "cash_down", "estimated_payment", "sms_consent"]) {
      expect(out, key).toHaveProperty(key);
    }
    expect(out["ssn"]).toBe(SSN);
    expect(out["sms_consent"]).toBe("true");
    expect(out["current_address"]).toContain("1 Test St");
  });

  it("leaves out only internal delivery state, empty values and non-text objects", () => {
    const out = allFormFields(formDetails);
    expect(Object.keys(out).filter((k) => k.startsWith("ghl_delivery_"))).toEqual([]);
    expect(out).not.toHaveProperty("empty_field");
    expect(out).not.toHaveProperty("nested_object");
  });

  it("a form field can never replace a key the website sets itself", () => {
    const out = allFormFields({ event_type: "hacked", source: "x", email: "evil@example.test", full_name: "Evil", website_lead_id: "nope", message: "m" });
    expect(out).toEqual({});
  });

  describe("in the delivered payload", () => {
    let calls: Array<Record<string, unknown>> = [];
    beforeEach(() => {
      calls = [];
      resetGhlForwardingStateForTests();
      resetGhlWebhookUrlWarningForTests();
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      vi.spyOn(console, "warn").mockImplementation(() => undefined);
      vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => { calls.push(JSON.parse(String(init?.body))); return new Response("{}", { status: 200 }); }));
    });
    afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

    const input = (details: Record<string, unknown>) => ({ leadType: "finance", fullName: "Pat Example", email: "pat@example.test", phone: "5405550100", message: "", vehicleUrl: "", vehicle: null, details });

    it("a financing submission carries every form field plus the fixed keys", async () => {
      await deliverLeadToGhl(input(formDetails));
      const body = calls[0]!;
      expect(body["event_type"]).toBe("financing");
      expect(body["source"]).toBe("MyCar Website");
      expect(body["ssn"]).toBe(SSN);
      expect(body["date_of_birth"]).toBe(DOB);
      expect(body["id_number"]).toBe(ID_NUMBER);
      expect(body["current_employer_1"]).toContain("Test Co");
      expect(body["apr"]).toBe("9.9");
      expect(body["full_name"]).toBe("Pat Example");
      expect(body).not.toHaveProperty("ghl_delivery_state");
    });

    it("every form type sends all of its saved fields", async () => {
      for (const leadType of ["contact", "trade", "appointment", "availability", "finance"]) {
        await deliverLeadToGhl({ ...input({ ...formDetails, lead_event_id: undefined }), leadType });
      }
      expect(calls).toHaveLength(5);
      for (const body of calls) expect(body).toMatchObject({ ssn: SSN, id_number: ID_NUMBER, current_employer_1: formDetails.current_employer_1 });
    });

    it("fields that hold JSON (addresses, employers, references) also arrive as separate flat fields", async () => {
      await deliverLeadToGhl(input(formDetails));
      expect(calls[0]).toMatchObject({
        current_address: formDetails.current_address,
        current_address_street: "1 Test St",
        current_address_city: "Testville",
        current_employer_1_name: "Test Co",
        references_1_name: "Ref One",
      });
    });
  });
});

/* -------------------------------------------------------------------------- */
/* Vehicle details come from the inventory, not from the form                  */
/* -------------------------------------------------------------------------- */

const car: InventoryVehicle = { id: "veh-1", vin: "1HGBH41JXMN109186", stock_number: "A1001", year: 2019, make: "Honda", model: "Civic", trim: "EX", mileage: 48210, price_cents: 1899500, slug: "2019-honda-civic-12" };

describe("vehicle details from the inventory", () => {
  it("replaces form-supplied car fields with the real inventory record and adds the car's own page", async () => {
    const out = await withInventoryVehicle({ vehicle_id: null }, { vehicle_id: "veh-1", vehicle_vin: "FAKE", vehicle_make: "Fake", vehicle_price_source: "inventory", vehicle_price: "1" }, async () => car);
    expect(out).toMatchObject({
      vehicle_id: "veh-1",
      vehicle_vin: "1HGBH41JXMN109186",
      vehicle_stock_number: "A1001",
      vehicle_year: "2019",
      vehicle_make: "Honda",
      vehicle_model: "Civic",
      vehicle_trim: "EX",
      vehicle_title: "2019 Honda Civic EX",
      vehicle_of_interest: "2019 Honda Civic EX",
      vehicle_mileage: "48210",
      vehicle_inventory_price: "18995",
      vehicle_price: "18995",
      vehicle_url: "https://mycarcorp.com/inventory/2019-honda-civic-12",
    });
  });

  it("keeps a price the customer typed themselves, and still reports the inventory price", async () => {
    const out = await withInventoryVehicle({ vehicle_id: null }, { vehicle_id: "veh-1", vehicle_price_source: "manual", vehicle_price: "15000" }, async () => car);
    expect(out["vehicle_price"]).toBe("15000");
    expect(out["vehicle_inventory_price"]).toBe("18995");
  });

  it("uses the lead's own vehicle reference when the form did not store one", async () => {
    const lookup = vi.fn(async () => car);
    await withInventoryVehicle({ vehicle_id: "veh-1" }, {}, lookup);
    expect(lookup).toHaveBeenCalledWith("veh-1");
  });

  it("does nothing, and makes no lookup, when no car was chosen", async () => {
    const lookup = vi.fn(async () => car);
    const details = { first_name: "Pat" };
    expect(await withInventoryVehicle({ vehicle_id: null }, details, lookup)).toBe(details);
    expect(lookup).not.toHaveBeenCalled();
  });

  it("sends the saved details unchanged if the car is not found or the lookup fails, without logging details", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const saved = { vehicle_id: "gone", vehicle_vin: "SAVED", ssn: SSN };
    expect(await withInventoryVehicle({ vehicle_id: null }, saved, async () => null)).toBe(saved);
    expect(await withInventoryVehicle({ vehicle_id: null }, saved, async () => { throw new Error(`boom ${SSN}`); })).toBe(saved);
    expect(JSON.stringify(spy.mock.calls)).not.toMatch(new RegExp(`${SSN}|gone|SAVED`));
    spy.mockRestore();
  });
});

/* -------------------------------------------------------------------------- */
/* End to end through the stored-lead delivery                                 */
/* -------------------------------------------------------------------------- */

describe("stored financing lead delivery", () => {
  const LEAD_ID = "11111111-1111-4111-8111-111111111111";
  let webhook: Array<Record<string, unknown>> = [];
  let patches: Array<Record<string, unknown>> = [];
  let logs = "";

  beforeEach(() => {
    webhook = []; patches = []; logs = "";
    resetGhlForwardingStateForTests();
    resetGhlWebhookUrlWarningForTests();
    process.env["LEGACY_SUPABASE_URL"] = "https://example.test";
    process.env["LEGACY_SUPABASE_SERVICE_ROLE_KEY"] = "synthetic-key";
    let row = { id: LEAD_ID, lead_type: "finance", full_name: "Pat Example", email: "pat@example.test", phone: "5405550100", message: null, vehicle_id: null, details: { ...formDetails, ghl_delivery_state: undefined, ghl_delivery_http: undefined, vehicle_id: "veh-1", vehicle_vin: "FAKE", vehicle_price_source: "inventory", vehicle_price: "1" } as Record<string, unknown>, created_at: new Date().toISOString(), updated_at: "2026-01-01T00:00:00.000001+00:00" };
    vi.spyOn(console, "error").mockImplementation((...a) => { logs += JSON.stringify(a); });
    vi.spyOn(console, "warn").mockImplementation((...a) => { logs += JSON.stringify(a); });
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes("leadconnectorhq.com")) { webhook.push(JSON.parse(String(init?.body))); return new Response("{}", { status: 200 }); }
      if ((init?.method ?? "GET") === "PATCH") {
        const body = JSON.parse(String(init?.body)) as { details: Record<string, unknown> };
        patches.push(body.details);
        row = { ...row, details: body.details };
        return new Response(JSON.stringify([row]), { status: 200 });
      }
      return new Response(JSON.stringify([row]), { status: 200 });
    }));
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); delete process.env["LEGACY_SUPABASE_URL"]; delete process.env["LEGACY_SUPABASE_SERVICE_ROLE_KEY"]; });

  it("forwards every form field and the real car details, once", async () => {
    const result = await deliverStoredLeadToGhl(LEAD_ID, () => new Date(), async () => car);
    expect(result).toMatchObject({ delivered: true, state: "delivered" });
    expect(webhook).toHaveLength(1);
    expect(webhook[0]).toMatchObject({
      event_type: "financing",
      ssn: SSN,
      date_of_birth: DOB,
      id_number: ID_NUMBER,
      vehicle_vin: "1HGBH41JXMN109186",
      vehicle_of_interest: "2019 Honda Civic EX",
      vehicle_url: "https://mycarcorp.com/inventory/2019-honda-civic-12",
      vehicle_price: "18995",
    });
  });

  it("does not write the looked-up car data or any webhook body back to the lead", async () => {
    await deliverStoredLeadToGhl(LEAD_ID, () => new Date(), async () => car);
    for (const written of patches) {
      expect(written["vehicle_vin"]).toBe("FAKE");
      for (const key of ["vehicle_of_interest", "vehicle_inventory_price", "vehicle_mileage", "vehicle_title"]) expect(written).not.toHaveProperty(key);
      expect(written["ssn"]).toBe(SSN);
    }
    expect(patches.length).toBeGreaterThan(0);
  });

  it("still delivers with the saved details when the inventory lookup fails", async () => {
    const result = await deliverStoredLeadToGhl(LEAD_ID, () => new Date(), async () => { throw new Error("down"); });
    expect(result.delivered).toBe(true);
    expect(webhook[0]).toMatchObject({ vehicle_vin: "FAKE", ssn: SSN });
  });

  it("never logs identity details", async () => {
    await deliverStoredLeadToGhl(LEAD_ID, () => new Date(), async () => { throw new Error(`failed for ${SSN}`); });
    expect(logs).not.toMatch(new RegExp(`${SSN}|${ID_NUMBER}|${DOB}|pat@example`));
  });

  it("a repeat call does not send again", async () => {
    await deliverStoredLeadToGhl(LEAD_ID, () => new Date(), async () => car);
    await deliverStoredLeadToGhl(LEAD_ID, () => new Date(), async () => car);
    expect(webhook).toHaveLength(1);
  });
});
