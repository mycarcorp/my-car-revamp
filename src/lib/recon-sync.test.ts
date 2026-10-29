import { describe, expect, it } from "vitest";
import { mapDrive, mapFuel, mapReconVehicle } from "./recon-sync";

const base = { vin: "1FMCU0GX5GUB62905", year: "2016", make: "Ford", model: "Escape", trim: "SE", body: "Sport Utility Vehicle (SUV)/Multi-Purpose Vehicle (MPV)", miles: "88,120", price: "$12,990" };

describe("mapReconVehicle", () => {
  it("maps a decoded recon car to a website row", () => {
    const r = mapReconVehicle(base);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.row.price_cents).toBe(1299000);
    expect(r.row.mileage).toBe(88120);
    expect(r.row.body_style).toBe("SUV");
    expect(r.row.slug).toBe("2016-ford-escape-se-1fmcu0gx5gub62905");
    expect(r.row.status).toBe("available");
  });
  it("rejects a car with no price or a bad VIN", () => {
    const r = mapReconVehicle({ ...base, vin: "123", price: "" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.join(" ")).toMatch(/VIN/);
    expect(r.errors.join(" ")).toMatch(/price/);
  });
});

describe("NHTSA value mapping", () => {
  it("maps fuel and drive names", () => {
    expect(mapFuel("Gasoline")).toBe("Gas");
    expect(mapFuel("Flexible Fuel Vehicle (FFV)")).toBe("Gas");
    expect(mapDrive("4WD/4-Wheel Drive/4x4")).toBe("AWD/4WD");
    expect(mapDrive("FWD/Front-Wheel Drive")).toBe("FWD");
    expect(mapDrive("RWD/ Rear-Wheel Drive")).toBe("RWD");
  });
});
