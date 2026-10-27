import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DESCRIPTION_MAX,
  TITLE_MAX,
  availabilityFor,
  buildVehicleJsonLd,
  getPriceCurrency,
  getVehicleDescription,
  getVehicleImages,
  getVehicleUrl,
  knownMileage,
  knownPriceCents,
  searchResultsRobots,
  toAbsoluteUrl,
  vehiclePhotoAlt,
  vehicleSeoDescription,
  vehicleSeoTitle,
  type VehicleSeoInput,
} from "./vehicle-seo";

const read = (path: string) => readFileSync(path, "utf8");

function car(overrides: Partial<VehicleSeoInput> = {}): VehicleSeoInput {
  return {
    year: 2019,
    make: "Honda",
    model: "Civic",
    trim: "EX",
    vin: "2HGFC2F59KH500001",
    stock_number: "A1001",
    mileage: 48210,
    price_cents: 1899500,
    status: "available",
    body_style: "Sedan",
    exterior_color: "Blue",
    fuel_type: "Gas",
    transmission: "Automatic",
    description: null,
    vehicle_photos: [
      { url: "/api/public/vehicle-photos/2hgfc2f59kh500001/photo-2.jpg", position: 2, alt: "2019 Honda Civic" },
      { url: "/api/public/vehicle-photos/2hgfc2f59kh500001/photo-1.jpg", position: 1, alt: "2019 Honda Civic" },
      { url: "/api/public/vehicle-photos/2hgfc2f59kh500001/video-1.mp4", position: 3, alt: null },
    ],
    ...overrides,
  };
}

describe("vehicle search title and description", () => {
  it("builds a unique title from year, make, model and trim", () => {
    const title = vehicleSeoTitle(car());
    expect(title).toBe("2019 Honda Civic EX for sale in Fredericksburg, VA — MyCar");
    expect(title.length).toBeLessThanOrEqual(TITLE_MAX);
    expect(vehicleSeoTitle(car({ year: 2020 }))).not.toBe(title);
    expect(vehicleSeoTitle(car({ trim: null }))).toBe("2019 Honda Civic for sale in Fredericksburg, VA — MyCar");
  });

  it("drops the brand suffix, never the vehicle name, when a long name would be cut off", () => {
    const long = car({ make: "Mercedes-Benz", model: "GLC 300", trim: "4MATIC Sport Utility" });
    const title = vehicleSeoTitle(long);
    expect(title.startsWith("2019 Mercedes-Benz GLC 300 4MATIC Sport Utility for sale")).toBe(true);
    expect(title).not.toContain("— MyCar");
  });

  it("describes only verified facts and fits the length limit", () => {
    const description = vehicleSeoDescription(car());
    expect(description).toBe("2019 Honda Civic EX for sale at MyCar in Fredericksburg, VA. 48,210 mi. $18,995. VIN 2HGFC2F59KH500001. Stock #A1001.");
    expect(description.length).toBeLessThanOrEqual(DESCRIPTION_MAX);
  });

  it("never publishes a missing mileage or price as zero", () => {
    for (const missing of [{ mileage: 0 }, { mileage: null }, { mileage: undefined }]) {
      expect(vehicleSeoDescription(car(missing))).not.toMatch(/\b0 mi\b/);
    }
    for (const missing of [{ price_cents: 0 }, { price_cents: null }, { price_cents: undefined }]) {
      expect(vehicleSeoDescription(car(missing))).not.toMatch(/\$0\b|Call for price/);
    }
    expect(vehicleSeoDescription(car({ mileage: 0, price_cents: 0 }))).toBe(
      "2019 Honda Civic EX for sale at MyCar in Fredericksburg, VA. VIN 2HGFC2F59KH500001. Stock #A1001.",
    );
  });

  it("keeps the description within the limit for long vehicle names, dropping the least useful facts first", () => {
    const description = vehicleSeoDescription(car({ make: "Mercedes-Benz", model: "GLC 300", trim: "4MATIC Sport Utility AMG Line Premium" }));
    expect(description.length).toBeLessThanOrEqual(DESCRIPTION_MAX);
    expect(description).toContain("for sale at MyCar in Fredericksburg, VA.");
  });

  it("treats zero and missing readings as unknown", () => {
    expect(knownMileage({ mileage: 0 })).toBeNull();
    expect(knownMileage({ mileage: null })).toBeNull();
    expect(knownMileage({ mileage: "n/a" })).toBeNull();
    expect(knownMileage({ mileage: 48210 })).toBe(48210);
    expect(knownPriceCents({ price_cents: 0 })).toBeNull();
    expect(knownPriceCents({ price_cents: null })).toBeNull();
    expect(knownPriceCents({ price_cents: "1899500" })).toBe(1899500);
  });

  it("uses the inventory description, or a factual fallback without invented details", () => {
    expect(getVehicleDescription(car({ description: "<p>One owner.</p>" }))).toContain("One owner.");
    expect(getVehicleDescription(car())).toBe("Used 2019 Honda Civic EX with 48,210 mi available at MyCar in Fredericksburg, VA.");
    expect(getVehicleDescription(car({ mileage: 0 }))).toBe("Used 2019 Honda Civic EX available at MyCar in Fredericksburg, VA.");
  });
});

describe("canonical URLs and images", () => {
  it("builds one absolute, encoded canonical per slug with no trailing slash or query", () => {
    expect(getVehicleUrl("2019-honda-civic-12")).toBe("https://mycarcorp.com/inventory/2019-honda-civic-12");
    expect(getVehicleUrl("a b/c")).toBe("https://mycarcorp.com/inventory/a%20b%2Fc");
    expect(getVehicleUrl("x")).not.toMatch(/[?#]|\/$/);
  });

  it("makes image URLs absolute, in gallery order, without videos or duplicates", () => {
    const images = getVehicleImages(
      car({
        vehicle_photos: [
          { url: "/api/public/vehicle-photos/v/photo-2.jpg", position: 2 },
          { url: "/api/public/vehicle-photos/v/photo-1.jpg", position: 1 },
          { url: "/api/public/vehicle-photos/v/photo-1.jpg", position: 3 },
          { url: "https://cdn.example.com/x.webm", position: 4 },
          { url: "  ", position: 5 },
        ],
      }),
    );
    expect(images).toEqual([
      "https://mycarcorp.com/api/public/vehicle-photos/v/photo-1.jpg",
      "https://mycarcorp.com/api/public/vehicle-photos/v/photo-2.jpg",
    ]);
    expect(getVehicleImages({ vehicle_photos: null })).toEqual([]);
    expect(toAbsoluteUrl("//cdn.example.com/a.jpg")).toBe("https://cdn.example.com/a.jpg");
    expect(toAbsoluteUrl("uploads/a.jpg")).toBe("https://mycarcorp.com/uploads/a.jpg");
  });
});

describe("vehicle structured data", () => {
  const ld = buildVehicleJsonLd(car(), "2019-honda-civic-12") as Record<string, any>;

  it("describes the vehicle with verified fields", () => {
    expect(ld["@context"]).toBe("https://schema.org");
    expect(ld["@type"]).toEqual(["Product", "Vehicle"]);
    expect(ld["@id"]).toBe("https://mycarcorp.com/inventory/2019-honda-civic-12#vehicle");
    expect(ld.url).toBe("https://mycarcorp.com/inventory/2019-honda-civic-12");
    expect(ld.name).toBe("2019 Honda Civic EX");
    expect(ld.brand).toEqual({ "@type": "Brand", name: "Honda" });
    expect(ld.model).toBe("Civic");
    expect(ld.vehicleModelDate).toBe("2019");
    expect(ld.vehicleIdentificationNumber).toBe("2HGFC2F59KH500001");
    expect(ld.sku).toBe("A1001");
    expect(ld.bodyType).toBe("Sedan");
    expect(ld.color).toBe("Blue");
    expect(ld.fuelType).toBe("Gas");
    expect(ld.vehicleTransmission).toBe("Automatic");
    expect(ld.mileageFromOdometer).toEqual({ "@type": "QuantitativeValue", value: 48210, unitCode: "SMI" });
    expect(ld.image).toEqual([
      "https://mycarcorp.com/api/public/vehicle-photos/2hgfc2f59kh500001/photo-1.jpg",
      "https://mycarcorp.com/api/public/vehicle-photos/2hgfc2f59kh500001/photo-2.jpg",
    ]);
  });

  it("offers the real price in USD as a used vehicle sold by the shared dealership entity", () => {
    expect(ld.offers).toEqual({
      "@type": "Offer",
      url: "https://mycarcorp.com/inventory/2019-honda-civic-12",
      price: "18995.00",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      itemCondition: "https://schema.org/UsedCondition",
      seller: { "@type": "AutoDealer", "@id": "https://mycarcorp.com/#dealer", name: "My Car", url: "https://mycarcorp.com/" },
    });
  });

  it("maps availability from the actual inventory status", () => {
    expect(availabilityFor("available")).toBe("https://schema.org/InStock");
    expect(availabilityFor("pending")).toBe("https://schema.org/LimitedAvailability");
    expect(availabilityFor("sold")).toBe("https://schema.org/SoldOut");
    expect(availabilityFor("draft")).toBeUndefined();
    expect(availabilityFor(null)).toBeUndefined();
    const pending = buildVehicleJsonLd(car({ status: "pending" }), "s") as Record<string, any>;
    expect(pending.offers.availability).toBe("https://schema.org/LimitedAvailability");
    const unknown = buildVehicleJsonLd(car({ status: "mystery" }), "s") as Record<string, any>;
    expect(unknown.offers).not.toHaveProperty("availability");
  });

  it("does not invent missing data: no mileage, offer or empty fields", () => {
    const sparse = buildVehicleJsonLd(
      car({ mileage: 0, price_cents: 0, body_style: null, exterior_color: null, fuel_type: null, transmission: null, vehicle_photos: [] }),
      "s",
    ) as Record<string, any>;
    for (const absent of ["mileageFromOdometer", "offers", "bodyType", "color", "fuelType", "vehicleTransmission", "image"]) {
      expect(sparse, absent).not.toHaveProperty(absent);
    }
    expect(sparse.name).toBe("2019 Honda Civic EX");
    const text = JSON.stringify(sparse);
    expect(text).not.toMatch(/"price":"0|undefined|null/);
  });

  it("never claims ratings, reviews, shipping or return policies", () => {
    const text = JSON.stringify(ld);
    for (const forbidden of ["aggregateRating", "review", "shippingDetails", "hasMerchantReturnPolicy", "warranty"]) {
      expect(text, forbidden).not.toContain(forbidden);
    }
  });

  it("falls back to USD for a missing or malformed currency", () => {
    expect(getPriceCurrency({ currency: undefined })).toBe("USD");
    expect(getPriceCurrency({ currency: "usd" })).toBe("USD");
    expect(getPriceCurrency({ currency: "dollars" })).toBe("USD");
    expect(getPriceCurrency({ currency: "cad" })).toBe("CAD");
  });

  it("serialises to valid JSON", () => {
    expect(() => JSON.parse(JSON.stringify(ld))).not.toThrow();
  });
});

describe("vehicle photo alt text", () => {
  const v = { year: 2019, make: "Honda", model: "Civic", trim: "EX" };

  it("gives every photo a distinct description when the stored alt is only the vehicle name", () => {
    expect(vehiclePhotoAlt(v, "2019 Honda Civic", 0)).toBe("2019 Honda Civic EX — photo 1");
    expect(vehiclePhotoAlt(v, "2019 Honda Civic EX", 4)).toBe("2019 Honda Civic EX — photo 5");
    expect(vehiclePhotoAlt(v, null, 1)).toBe("2019 Honda Civic EX — photo 2");
    expect(vehiclePhotoAlt(v, "  ", 2)).toBe("2019 Honda Civic EX — photo 3");
    expect(vehiclePhotoAlt(v, "Photo 3", 2)).toBe("2019 Honda Civic EX — photo 3");
  });

  it("keeps a real custom caption", () => {
    expect(vehiclePhotoAlt(v, "Front three-quarter view", 0)).toBe("Front three-quarter view");
  });
});

describe("faceted /search indexing", () => {
  it("keeps the plain inventory page indexable", () => {
    expect(searchResultsRobots({})).toBeNull();
    expect(searchResultsRobots(undefined)).toBeNull();
    expect(searchResultsRobots({ page: 1 })).toBeNull();
    expect(searchResultsRobots({ make: undefined, q: "", newOnly: false })).toBeNull();
  });

  it("keeps filtered, sorted, searched and paged variants out of the index", () => {
    for (const variant of [{ make: "Honda" }, { body: "SUV" }, { priceMax: 20000 }, { sort: "price-asc" }, { q: "civic" }, { page: 2 }, { make: "Honda", page: 3 }, { newOnly: true }, { yearMin: 0 }]) {
      expect(searchResultsRobots(variant), JSON.stringify(variant)).toBe("noindex,follow");
    }
  });
});

describe("route wiring", () => {
  const vdp = read("src/routes/inventory.$slug.tsx");
  const search = read("src/routes/search.tsx");

  it("vehicle pages take title, description and schema from the shared builders", () => {
    expect(vdp).toContain("const title = vehicleSeoTitle(v);");
    expect(vdp).toContain("const description = vehicleSeoDescription(v);");
    expect(vdp).toContain("const jsonLd = buildVehicleJsonLd(v, slug);");
    expect((vdp.match(/"@type":\s*\["Product"/g) ?? []).length).toBe(0);
    expect(vdp).toContain('rel: "canonical"');
    expect(vdp).toContain("href: canonicalUrl");
  });

  it("each vehicle page declares one canonical, robots meta and a seller reference to the shared dealer", () => {
    expect(vdp).toMatch(/content:\s*"index,follow,max-image-preview:large/);
    expect(read("src/lib/vehicle-seo.ts")).toContain("seller: dealerReference()");
  });

  it("missing, removed and sold vehicles are a real 404 with noindex, never a thin indexable page", () => {
    expect(vdp).toMatch(/if \(!vehicle\) \{\s*throw notFound\(\);/);
    expect(vdp).toMatch(/if \(!loaderData\) \{[\s\S]*?name: "robots",\s*content: "noindex"/);
  });

  it("only available and pending vehicles are public, so sold and hidden ones never reach a page or the sitemap", () => {
    const inventory = read("src/lib/legacy-inventory.server.ts");
    expect(inventory).toContain('rows = rows.filter((row) => row.status === "available" || row.status === "pending");');
    expect(inventory).toContain('value === "hidden" || value === "draft" ? "draft" : value === "sold" ? "sold" : "available"');
    expect(read("src/lib/sitemap-cache.server.ts")).toContain("listPublicLegacyInventory");
  });

  it("the search page drops the canonical and sets noindex,follow for variants only", () => {
    expect(search).toContain("searchResultsRobots(match.search as Record<string, unknown>)");
    expect(search).toContain('links: robots ? [] : [{ rel: "canonical", href: "https://mycarcorp.com/search" }]');
    expect(search).toContain('...(robots ? [{ name: "robots", content: robots }] : [])');
  });

  it("listing cards link to vehicle pages with real anchors", () => {
    expect(search).toContain('to="/inventory/$slug"');
  });

  it("photo alt text uses the shared helper in the gallery, thumbnails, cards and search results", () => {
    expect((vdp.match(/vehiclePhotoAlt\(/g) ?? []).length).toBeGreaterThanOrEqual(4);
    expect(search).toContain("vehiclePhotoAlt(vehicle, photo.alt, index)");
    expect(read("src/components/VehicleCard.tsx")).toContain("vehiclePhotoAlt(vehicle, active.alt, currentIndex)");
  });

  it("the new internal links go to real public routes and add no form or tracking code", () => {
    expect(vdp).toContain('to="/sell"');
    expect(vdp).toContain('to="/schedule"');
    const lib = read("src/lib/vehicle-seo.ts");
    expect(lib).not.toMatch(/fetch\(|supabase|analytics|attribution|consent|sendLeadToGhl/i);
  });
});

describe("inventory sitemap", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("./legacy-inventory.server");
    vi.doUnmock("./autoseo-blog.server");
    vi.doUnmock("./legacy-blog.server");
  });

  type Row = Record<string, unknown> & { slug: string; vehicle_photos?: Array<{ url: string; position: number; alt?: string | null }> };

  async function buildSitemap(vehicles: Row[]) {
    vi.resetModules();
    vi.doMock("./legacy-inventory.server", () => ({ listPublicLegacyInventory: async () => ({ vehicles, count: vehicles.length }) }));
    vi.doMock("./autoseo-blog.server", () => ({ sitemapUrls: async () => [{ slug: "a-post", lastmod: "2026-03-01T00:00:00Z" }] }));
    vi.doMock("./legacy-blog.server", () => ({ listPublishedPosts: async () => [] }));
    const { getSitemapXml } = await import("./sitemap-cache.server");
    return (await getSitemapXml()).xml;
  }

  const urls = (xml: string) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!);

  it("lists one canonical URL per public vehicle, skipping blank slugs and duplicates", async () => {
    const xml = await buildSitemap([
      { slug: "2019-honda-civic-12", vehicle_photos: [] },
      { slug: "2019-honda-civic-12", vehicle_photos: [] },
      { slug: "  ", vehicle_photos: [] },
      { slug: "2021-ford-f-150-9", vehicle_photos: [] },
    ]);
    const vehicleUrls = urls(xml).filter((u) => u.includes("/inventory/"));
    expect(vehicleUrls).toEqual(["https://mycarcorp.com/inventory/2019-honda-civic-12", "https://mycarcorp.com/inventory/2021-ford-f-150-9"]);
    for (const url of vehicleUrls) expect(url).toBe(getVehicleUrl(url.split("/inventory/")[1]!));
  });

  it("still lists the static pages and blog posts, and never private routes", async () => {
    const xml = await buildSitemap([]);
    const all = urls(xml);
    expect(all).toContain("https://mycarcorp.com/search");
    expect(all).toContain("https://mycarcorp.com/blog/a-post");
    expect(all.some((u) => /\/(admin|staff|my|account|auth)(\/|$)/.test(u))).toBe(false);
  });

  it("adds image entries with absolute https URLs, capped, without videos, and escapes special characters", async () => {
    const photos = Array.from({ length: 14 }, (_, i) => ({ url: `/api/public/vehicle-photos/v/photo-${i + 1}.jpg`, position: i + 1 }));
    photos.push({ url: "/api/public/vehicle-photos/v/video-1.mp4", position: 99 });
    photos.push({ url: "http://insecure.example.com/a.jpg", position: -1 });
    photos.push({ url: "https://cdn.example.com/a.jpg?x=1&y=2", position: 0 });
    const xml = await buildSitemap([{ slug: "v-1", vehicle_photos: photos }]);
    const images = [...xml.matchAll(/<image:loc>([^<]+)<\/image:loc>/g)].map((m) => m[1]!);
    expect(images).toHaveLength(10);
    expect(images[0]).toBe("https://cdn.example.com/a.jpg?x=1&amp;y=2");
    for (const image of images) {
      expect(image).toMatch(/^https:\/\//);
      expect(image).not.toMatch(/video|insecure/);
    }
    expect(xml).toContain('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"');
  });

  it("writes a lastmod only from a real modification time, never the received or created date", async () => {
    const xml = await buildSitemap([
      { slug: "received-only", date_received: "2025-01-02", created_at: "2025-01-01T00:00:00Z", vehicle_photos: [] },
      { slug: "has-updated", updated_at: "2026-04-05T10:20:30Z", date_received: "2025-01-02", vehicle_photos: [] },
      { slug: "bad-date", updated_at: "not a date", vehicle_photos: [] },
    ]);
    const entry = (slug: string) => xml.match(new RegExp(`<url><loc>[^<]*/inventory/${slug}</loc>.*?</url>`))![0];
    expect(entry("received-only")).not.toContain("<lastmod>");
    expect(entry("bad-date")).not.toContain("<lastmod>");
    expect(entry("has-updated")).toContain("<lastmod>2026-04-05T10:20:30.000Z</lastmod>");
  });

  it("produces well-formed XML", async () => {
    const xml = await buildSitemap([{ slug: "v-1", vehicle_photos: [{ url: "https://cdn.example.com/a&b.jpg", position: 1 }] }]);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect((xml.match(/<url>/g) ?? []).length).toBe((xml.match(/<\/url>/g) ?? []).length);
    expect((xml.match(/<image:image>/g) ?? []).length).toBe((xml.match(/<\/image:image>/g) ?? []).length);
    expect(xml).not.toMatch(/&(?!amp;|lt;|gt;|quot;)/);
  });
});
