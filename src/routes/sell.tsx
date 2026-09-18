import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Camera, CarFront, Check, Copy, ImagePlus, Plus, Search, SlidersHorizontal, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LeadForm } from "@/components/LeadForm";
import { formatMiles, formatUsd, vehicleTitle } from "@/lib/format";
import { allVehiclesQuery, type VehicleWithPhotos } from "@/lib/queries";

export const Route = createFileRoute("/sell")({
  head: () => ({
    meta: [
      { title: "Sell or Trade Your Car in Fredericksburg, VA — MyCar" },
      {
        name: "description",
        content:
          "Send MyCar your VIN or plate, mileage and condition and our buyers respond with a real offer — usually the same business day. Trade it in or sell outright.",
      },
      { property: "og:title", content: "Sell or Trade Your Car — MyCar Fredericksburg" },
      {
        property: "og:description",
        content: "Send your VIN, mileage and condition; our buyers respond with a real offer.",
      },
    ],
  }),
  component: SellPage,
});

type PickerTab = "matching" | "all";

type WishListState = {
  newUsed: string;
  vehicleType: string;
  makeModel: string;
  bodyType: string;
  minYear: string;
  maxPrice: string;
  maxMileage: string;
  transmission: string;
  drivetrain: string;
  fuelType: string;
  exteriorColor: string;
  interiorColor: string;
  features: string[];
};

type TradeInRecord = {
  id: string;
  data: TradeInDraft;
  photoNames: string[];
};

const emptyTradeIn = {
  status: "Trade-In",
  customStatus: "",
  newUsed: "Used",
  vehicleType: "Auto",
  vin: "",
  vinAuto: "true",
  odometer: "",
  mileageType: "TMU",
  year: "",
  make: "",
  model: "",
  trim: "",
  engine: "",
  transmission: "",
  drivetrain: "",
  doors: "",
  cylinders: "",
  bodyType: "",
  fuelType: "",
  horsepower: "",
  exteriorColor: "",
  interiorColor: "",
  mpgCity: "",
  mpgHighway: "",
  vehicleWeight: "",
  gvw: "",
  stockNumber: "",
  appraisalDate: new Date().toISOString().slice(0, 10),
  location: "",
  condition: "",
  appraiserName: "",
  salesRep: "",
  targetSellingPrice: "",
  recondition: "",
  packs: "",
  additional: "",
  grossProfit: "",
  appraisalValue: "",
  source: "Trade-In",
  customer: "",
  lienholder: "",
  lienAccountNumber: "",
  payoffAmount: "",
  payoffDueDate: "",
  perDiem: "",
  memo: "",
  titleOwner: "",
  titleState: "",
  titleBrand: "",
  licenseNumber: "",
  licenseState: "",
  licenseExpiryDate: "",
  notes: "",
};

type TradeInDraft = typeof emptyTradeIn;

const emptyWishList: WishListState = {
  newUsed: "used",
  vehicleType: "all",
  makeModel: "",
  bodyType: "all",
  minYear: "",
  maxPrice: "",
  maxMileage: "",
  transmission: "all",
  drivetrain: "all",
  fuelType: "all",
  exteriorColor: "",
  interiorColor: "",
  features: [],
};

const VEHICLE_TYPES = ["Auto", "Motorcycle", "ATV", "Watercraft", "Snowmobile", "RV", "Classic", "Exotic", "Other"];
const BODY_TYPES = [
  "Sedan",
  "Coupe",
  "Wagon",
  "SUV",
  "Hatchback",
  "Convertible",
  "Van",
  "Pickup",
  "Cab_Chassis",
  "Cargo",
  "Cutaway",
  "Passenger",
];
const TRANSMISSIONS = ["Automatic", "Manual"];
const DRIVETRAINS = ["AWD", "4WD", "FWD", "RWD", "2WD"];
const FUEL_TYPES = ["Gasoline", "Diesel", "Hybrid", "Electric", "Flexible_Fuel", "Natural_Gas", "Hydrogen"];
const COLORS = [
  "Any Color",
  "Beige",
  "Black",
  "Blue",
  "Brown",
  "Burgundy",
  "Charcoal",
  "Gold",
  "Gray",
  "Green",
  "Off-White",
  "Orange",
  "Pink",
  "Purple",
  "Red",
  "Silver",
  "Tan",
  "Turquoise",
  "White",
  "Yellow",
];
const MAX_PRICES = [
  "$10,000",
  "$12,000",
  "$14,000",
  "$15,000",
  "$16,000",
  "$18,000",
  "$20,000",
  "$22,000",
  "$24,000",
  "$25,000",
  "$26,000",
  "$28,000",
  "$30,000",
  "$35,000",
  "$40,000",
  "$45,000",
  "$50,000",
];
const MAX_MILEAGES = ["Any Mileage", "15,000", "30,000", "45,000", "60,000", "75,000", "120,000", "200,000"];
const MAKE_MODELS = [
  "AODES Desert Cross 1000-3",
  "AODES Desert Cross 1000-3 HVA",
  "AODES Desert Cross 1000-6 HVA",
  "AODES E-Trail Cross Dump Bed",
  "AODES E-Trail Cross Golf",
  "AODES Jungle Cross 1000 LT-2",
  "AODES Jungle Cross 1000 LT-5",
  "AODES Jungle Cross 800 ST-2",
  "AODES Jungle Cross 800 ST-5",
  "AODES Path Cross 1000 L",
  "AODES Path Cross 1000 XL",
  "AODES Path Cross 1000 SX",
  "AODES Path Cross 1000 S",
  "AODES Path Cross 650 L",
  "AODES Path Cross 650 S",
  "AODES Trail Cross 250 Dump Bed",
  "AODES Trail Cross 250 Go",
  "AODES Trail Cross 400 Dump Bed",
  "AODES Trail Cross 400 Go",
  "AODES Work Cross 1000-3",
  "Arctic Cat Alterra",
  "Arctic Cat Prowler",
  "Arctic Cat Wildcat",
  "Bennche Big Horn",
  "Bennche Gray Wolf",
  "Bennche Spire",
  "Bombardier Outlander",
  "Bombardier Quest",
  "Bombardier Rally",
  "Bombardier Traxter",
  "CFMOTO CForce 1000",
  "Can-Am Commander",
  "Can-Am DS",
  "Can-Am Defender",
  "Kawasaki Brute Force",
  "Kawasaki KFX",
  "Kawasaki Mule",
  "Kawasaki Teryx",
  "Polaris General",
  "Polaris Ranger",
  "Polaris RZR",
  "Polaris Sportsman",
  "Suzuki KingQuad",
  "Suzuki QuadSport",
  "Yamaha Grizzly",
  "Yamaha Kodiak",
  "Yamaha Raptor",
  "Yamaha Viking",
  "Yamaha Wolverine",
  "Yamaha YFZ",
];
const WISH_FEATURES = [
  "Dual Power Seats",
  "Leather Seats",
  "Heated Seats",
  "3rd Row Seats",
  "Keyless Start",
  "Keyless Entry",
  "Backup Camera",
  "Navigation System",
];

const TRADE_COLORS = [
  "Barcelona Red",
  "Beige",
  "Black",
  "Blue",
  "Brown",
  "Burgundy",
  "Gold",
  "Gray",
  "Green",
  "Orange",
  "Pink",
  "Purple",
  "Red",
  "Silver",
  "White",
  "Yellow",
];
const TRADE_YEARS = Array.from({ length: 36 }, (_, index) => String(2027 - index));
const PURCHASE_SOURCES = [
  "Auction",
  "Consignment",
  "Private Party",
  "Referral",
  "Repeat",
  "Repo",
  "Trade-In",
  "Wholesale",
  "Other",
];

const fieldClass =
  "h-8 rounded-sm border-slate-300 bg-white px-2 text-xs focus-visible:ring-1 focus-visible:ring-cyan-700";
const selectClass = "h-8 rounded-sm border-slate-300 bg-white px-2 text-xs focus:ring-1 focus:ring-cyan-700";

function SellPage() {
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [vin, setVin] = useState("");
  const [plate, setPlate] = useState("");
  const [ymm, setYmm] = useState("");
  const [mileage, setMileage] = useState("");
  const [zip, setZip] = useState("");
  const [condition, setCondition] = useState("good");
  const [title, setTitle] = useState("clean");
  const [intent, setIntent] = useState("");
  const [wishList, setWishList] = useState<WishListState>(emptyWishList);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTab, setPickerTab] = useState<PickerTab>("matching");
  const [inventorySearch, setInventorySearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [tradeInOpen, setTradeInOpen] = useState(false);
  const [tradeInTab, setTradeInTab] = useState<"details" | "books" | "market">("details");
  const [tradeInDraft, setTradeInDraft] = useState<TradeInDraft>({ ...emptyTradeIn });
  const [tradeInPhotoNames, setTradeInPhotoNames] = useState<string[]>([]);
  const [tradeIns, setTradeIns] = useState<TradeInRecord[]>([]);
  const leadFormScopeRef = useRef<HTMLDivElement>(null);

  const { data: allVehicles = [], isLoading: inventoryLoading } = useQuery(allVehiclesQuery());

  const inventory = useMemo(
    () => allVehicles.filter((vehicle) => vehicle.status === "available" || vehicle.status === "pending"),
    [allVehicles],
  );

  const matchingVehicles = useMemo(() => {
    return inventory
      .map((vehicle) => ({
        vehicle,
        score: getWishListMatchScore(vehicle, wishList),
      }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || b.vehicle.year - a.vehicle.year)
      .map(({ vehicle }) => vehicle);
  }, [inventory, wishList]);

  const pickerVehicles = useMemo(() => {
    const source = pickerTab === "matching" ? matchingVehicles : inventory;
    const needle = inventorySearch.trim().toLowerCase();
    if (!needle) return source;

    return source.filter((vehicle) =>
      [vehicle.year, vehicle.make, vehicle.model, vehicle.trim, vehicle.vin, vehicle.stock_number]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [inventory, inventorySearch, matchingVehicles, pickerTab]);

  const selectedVehicles = useMemo(
    () =>
      selectedIds.map((id) => inventory.find((vehicle) => vehicle.id === id)).filter(Boolean) as VehicleWithPhotos[],
    [inventory, selectedIds],
  );

  useEffect(() => {
    const scope = leadFormScopeRef.current;
    if (!scope) return;

    const fields = [
      { label: "Full name", value: customerName },
      { label: "Email", value: customerEmail },
      { label: "Phone", value: formatPhone(customerPhone) },
    ];

    fields.forEach(({ label, value }) => {
      const labelElement = Array.from(scope.querySelectorAll("label"))
        .filter((element) => element.textContent?.trim().toLowerCase() === label.toLowerCase())
        .at(-1);

      if (!labelElement) return;

      const fieldId = labelElement.getAttribute("for");
      const field = fieldId
        ? scope.querySelector<HTMLInputElement | HTMLTextAreaElement>(`#${fieldId}`)
        : labelElement.parentElement?.querySelector<HTMLInputElement | HTMLTextAreaElement>("input, textarea");

      if (field && field.value !== value) {
        const prototype =
          field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
        setter?.call(field, value);
        field.dispatchEvent(new Event("input", { bubbles: true }));
        field.dispatchEvent(new Event("change", { bubbles: true }));
      }

      const wrapper = labelElement.parentElement;
      if (wrapper) wrapper.style.display = "none";
    });

    const submitButton = scope.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (submitButton) {
      submitButton.style.display = "flex";
      submitButton.style.marginLeft = "auto";
    }
  }, [customerEmail, customerName, customerPhone]);

  function updateWishList<K extends keyof WishListState>(field: K, value: WishListState[K]) {
    setWishList((current) => ({ ...current, [field]: value }));
  }

  function toggleFeature(feature: string) {
    setWishList((current) => ({
      ...current,
      features: current.features.includes(feature)
        ? current.features.filter((item) => item !== feature)
        : [...current.features, feature],
    }));
  }

  function toggleSelectedVehicle(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((vehicleId) => vehicleId !== id) : [...current, id],
    );
  }

  function openPicker(tab: PickerTab) {
    setPickerTab(tab);
    setInventorySearch("");
    setPickerOpen(true);
  }

  function openNewTradeIn() {
    setTradeInDraft({ ...emptyTradeIn, vin, odometer: mileage, condition });
    setTradeInPhotoNames([]);
    setTradeInTab("details");
    setTradeInOpen(true);
  }

  function saveTradeIn(closeAfterSave = true) {
    const record: TradeInRecord = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      data: { ...tradeInDraft },
      photoNames: [...tradeInPhotoNames],
    };
    setTradeIns((current) => [...current, record]);
    if (tradeInDraft.vin) setVin(tradeInDraft.vin);
    if (tradeInDraft.odometer) setMileage(digitsOnly(tradeInDraft.odometer));
    if ([tradeInDraft.year, tradeInDraft.make, tradeInDraft.model, tradeInDraft.trim].some(Boolean)) {
      setYmm([tradeInDraft.year, tradeInDraft.make, tradeInDraft.model, tradeInDraft.trim].filter(Boolean).join(" "));
    }
    if (closeAfterSave) setTradeInOpen(false);
    else {
      setTradeInDraft({ ...emptyTradeIn });
      setTradeInPhotoNames([]);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50/70">
      <div className="mx-auto w-full max-w-[1280px] px-4 py-8 sm:px-6 lg:py-10">
        <div
          ref={leadFormScopeRef}
          className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-5 [&_button]:rounded-lg [&_input]:h-9 [&_input]:rounded-lg [&_label]:text-xs [&_textarea]:rounded-lg [&_textarea]:border-slate-300 [&_textarea]:text-sm"
        >
          <LeadForm
            leadType="trade"
            submitLabel="Request My Offer"
            successTitle="Appraisal request received"
            successBody="Our buyer will review your vehicle and respond with a number, usually within one business day."
            messageLabel="Damage, service history, or anything else we should know"
            collectDetails={() => ({
              customer_name: customerName,
              customer_email: customerEmail,
              customer_phone: customerPhone,
              customer_address: customerAddress,
              vin,
              plate,
              year_make_model: ymm,
              mileage,
              zip,
              condition,
              title_status: title,
              intent,
              customer_wish_list: intent === "trade" ? JSON.stringify(wishList) : "",
              selected_vehicle_ids: intent === "trade" ? selectedIds.join(",") : "",
              selected_vehicles:
                intent === "trade"
                  ? JSON.stringify(
                      selectedVehicles.map((vehicle) => ({
                        id: vehicle.id,
                        title: vehicleTitle(vehicle),
                        stock_number: vehicle.stock_number,
                        vin: vehicle.vin,
                        price_cents: vehicle.price_cents,
                      })),
                    )
                  : "",
              vehicle_photo_names: tradeInPhotoNames.join(","),
              trade_in_records: JSON.stringify(tradeIns),
            })}
          >
            <div className="grid items-start gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
              <aside className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 lg:sticky lg:top-6">
                <div className="grid gap-4 [&_input]:!h-10 [&_label]:!text-xs">
                  <CompactField label="Full Name" htmlFor="customer-full-name">
                    <Input
                      id="customer-full-name"
                      value={customerName}
                      onChange={(event) => setCustomerName(event.target.value)}
                      placeholder="First and last name"
                      autoComplete="name"
                      className="rounded-lg border-slate-300 bg-white px-3 text-sm focus-visible:ring-1 focus-visible:ring-cyan-700"
                      required
                    />
                  </CompactField>

                  <CompactField label="Email" htmlFor="customer-email">
                    <Input
                      id="customer-email"
                      type="email"
                      value={customerEmail}
                      onChange={(event) => setCustomerEmail(event.target.value)}
                      placeholder="name@example.com"
                      autoComplete="email"
                      className="rounded-lg border-slate-300 bg-white px-3 text-sm focus-visible:ring-1 focus-visible:ring-cyan-700"
                      required
                    />
                  </CompactField>

                  <CompactField label="Phone" htmlFor="customer-phone">
                    <Input
                      id="customer-phone"
                      type="tel"
                      inputMode="numeric"
                      maxLength={14}
                      value={formatPhone(customerPhone)}
                      onChange={(event) => setCustomerPhone(digitsOnly(event.target.value, 10))}
                      placeholder="(000) 000-0000"
                      autoComplete="tel"
                      className="rounded-lg border-slate-300 bg-white px-3 text-sm focus-visible:ring-1 focus-visible:ring-cyan-700"
                      required
                    />
                  </CompactField>

                  <CompactField label="Address" htmlFor="customer-address">
                    <Input
                      id="customer-address"
                      value={customerAddress}
                      onChange={(event) => setCustomerAddress(event.target.value)}
                      placeholder="Street, city, state and ZIP"
                      autoComplete="street-address"
                      className="rounded-lg border-slate-300 bg-white px-3 text-sm focus-visible:ring-1 focus-visible:ring-cyan-700"
                    />
                  </CompactField>
                </div>
              </aside>

              <main className="min-w-0 space-y-5">
                <div
                  className="grid gap-1 rounded-xl bg-slate-100 p-1 sm:grid-cols-2"
                  role="radiogroup"
                  aria-label="Choose whether to sell or trade your vehicle"
                >
                  {[
                    ["sell", "Sell My Vehicle"],
                    ["trade", "Trade My Vehicle"],
                  ].map(([value = "", heading]) => (
                    <label
                      key={value}
                      className={`flex min-h-11 cursor-pointer items-center justify-center rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition-all ${
                        intent === value
                          ? "bg-white text-cyan-800 shadow-sm ring-1 ring-slate-200"
                          : "text-slate-600 hover:bg-white/70 hover:text-slate-900"
                      }`}
                    >
                      <input
                        type="radio"
                        name="customer-intent"
                        value={value}
                        checked={intent === value}
                        onChange={() => setIntent(value)}
                        required
                        className="sr-only"
                      />
                      {heading}
                    </label>
                  ))}
                </div>

                {intent === "trade" && (
                  <>
                    <Panel
                      title="What Are You Looking For?"
                      action={
                        <Button
                          type="button"
                          size="sm"
                          className="h-7 rounded-sm px-3 text-[10px]"
                          onClick={() => openPicker("matching")}
                        >
                          <Search className="size-3" />
                          Find Matching Vehicles
                        </Button>
                      }
                    >
                      <div className="grid gap-x-3 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
                        <CompactSelect label="New / Used">
                          <Select value={wishList.newUsed} onValueChange={(value) => updateWishList("newUsed", value)}>
                            <SelectTrigger className={selectClass}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="new">New</SelectItem>
                              <SelectItem value="used">Used</SelectItem>
                              <SelectItem value="manufacturer-search">Manufacturer Search</SelectItem>
                            </SelectContent>
                          </Select>
                        </CompactSelect>

                        <CompactSelect label="Vehicle Type">
                          <Select
                            value={wishList.vehicleType}
                            onValueChange={(value) => updateWishList("vehicleType", value)}
                          >
                            <SelectTrigger className={selectClass}>
                              <SelectValue placeholder="All types" />
                            </SelectTrigger>
                            <SelectContent>
                              {VEHICLE_TYPES.map((option) => (
                                <SelectItem key={option} value={option.toLowerCase()}>
                                  {option}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </CompactSelect>

                        <DatalistField
                          id="wish-make-model"
                          label="Make and Model"
                          value={wishList.makeModel}
                          options={MAKE_MODELS}
                          onChange={(value) => updateWishList("makeModel", value)}
                          placeholder="Type or select a make and model"
                        />

                        <OptionSelect
                          label="Body Type"
                          value={wishList.bodyType}
                          options={BODY_TYPES}
                          onChange={(value) => updateWishList("bodyType", value)}
                        />

                        <CompactField label="Min. Year" htmlFor="wish-min-year">
                          <Input
                            id="wish-min-year"
                            value={wishList.minYear}
                            onChange={(event) => updateWishList("minYear", digitsOnly(event.target.value, 4))}
                            inputMode="numeric"
                            placeholder="2018"
                            className={fieldClass}
                          />
                        </CompactField>

                        <DatalistField
                          id="wish-max-price"
                          label="Max Price"
                          value={wishList.maxPrice}
                          options={MAX_PRICES}
                          onChange={(value) => updateWishList("maxPrice", value)}
                          placeholder="Type or select a price"
                          inputMode="decimal"
                        />

                        <DatalistField
                          id="wish-max-mileage"
                          label="Max Mileage"
                          value={wishList.maxMileage}
                          options={MAX_MILEAGES}
                          onChange={(value) => updateWishList("maxMileage", value)}
                          placeholder="Any Mileage"
                          inputMode="numeric"
                        />

                        <DatalistField
                          id="wish-transmission"
                          label="Transmission"
                          value={wishList.transmission === "all" ? "" : wishList.transmission}
                          options={TRANSMISSIONS}
                          onChange={(value) => updateWishList("transmission", value || "all")}
                        />
                        <DatalistField
                          id="wish-drivetrain"
                          label="Drive Train"
                          value={wishList.drivetrain === "all" ? "" : wishList.drivetrain}
                          options={DRIVETRAINS}
                          onChange={(value) => updateWishList("drivetrain", value || "all")}
                        />
                        <DatalistField
                          id="wish-fuel-type"
                          label="Fuel Type"
                          value={wishList.fuelType === "all" ? "" : wishList.fuelType}
                          options={FUEL_TYPES}
                          onChange={(value) => updateWishList("fuelType", value || "all")}
                        />

                        <DatalistField
                          id="wish-exterior-color"
                          label="Exterior Color"
                          value={wishList.exteriorColor}
                          options={COLORS}
                          onChange={(value) => updateWishList("exteriorColor", value === "Any Color" ? "" : value)}
                          placeholder="Any Color"
                        />

                        <DatalistField
                          id="wish-interior-color"
                          label="Interior Color"
                          value={wishList.interiorColor}
                          options={COLORS}
                          onChange={(value) => updateWishList("interiorColor", value === "Any Color" ? "" : value)}
                          placeholder="Any Color"
                        />
                      </div>

                      <div className="mt-3 grid gap-2 border-t border-slate-200 pt-3 sm:grid-cols-2 lg:grid-cols-4">
                        {WISH_FEATURES.map((feature) => (
                          <label
                            key={feature}
                            className="flex cursor-pointer items-center gap-2 text-[11px] text-slate-700"
                          >
                            <input
                              type="checkbox"
                              checked={wishList.features.includes(feature)}
                              onChange={() => toggleFeature(feature)}
                              className="size-3.5 rounded-sm border-slate-300 accent-cyan-700"
                            />
                            {feature}
                          </label>
                        ))}
                      </div>
                    </Panel>

                    <Panel
                      title={`Vehicles You're Interested In (${selectedVehicles.length})`}
                      action={
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 rounded-sm px-3 text-[10px]"
                          onClick={() => openPicker("all")}
                        >
                          <Plus className="size-3" />
                          Choose From Our Inventory
                        </Button>
                      }
                    >
                      {selectedVehicles.length === 0 ? (
                        <button
                          type="button"
                          onClick={() => openPicker("all")}
                          className="flex w-full items-center justify-center gap-2 border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-xs text-slate-500 hover:border-cyan-600 hover:text-cyan-800"
                        >
                          <CarFront className="size-5" />
                          No vehicles selected. Click to browse available inventory.
                        </button>
                      ) : (
                        <div className="grid gap-3 lg:grid-cols-2">
                          {selectedVehicles.map((vehicle) => (
                            <SelectedVehicleCard
                              key={vehicle.id}
                              vehicle={vehicle}
                              onRemove={() => toggleSelectedVehicle(vehicle.id)}
                            />
                          ))}
                        </div>
                      )}
                    </Panel>
                  </>
                )}

                {intent && (
                  <Panel title="Your Vehicle">
                    <div className="grid gap-x-3 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
                      <CompactField label="VIN" htmlFor="vin">
                        <Input
                          id="vin"
                          value={vin}
                          onChange={(event) => setVin(event.target.value.toUpperCase().slice(0, 17))}
                          placeholder="17 characters"
                          maxLength={17}
                          className={fieldClass}
                        />
                      </CompactField>
                      <CompactField label="Or License Plate" htmlFor="plate">
                        <Input
                          id="plate"
                          value={plate}
                          onChange={(event) => setPlate(event.target.value.toUpperCase())}
                          placeholder="VA plate"
                          className={fieldClass}
                        />
                      </CompactField>
                      <div className="sm:col-span-2">
                        <CompactField label="Or Year, Make, Model and Trim" htmlFor="ymm">
                          <Input
                            id="ymm"
                            value={ymm}
                            onChange={(event) => setYmm(event.target.value)}
                            placeholder="2019 Toyota RAV4 XLE"
                            className={fieldClass}
                          />
                        </CompactField>
                      </div>
                      <CompactField label="Mileage" htmlFor="mileage">
                        <Input
                          id="mileage"
                          value={mileage}
                          onChange={(event) => setMileage(digitsOnly(event.target.value))}
                          inputMode="numeric"
                          required
                          className={fieldClass}
                        />
                      </CompactField>
                      <CompactField label="ZIP Code" htmlFor="zip">
                        <Input
                          id="zip"
                          value={zip}
                          onChange={(event) => setZip(digitsOnly(event.target.value, 5))}
                          inputMode="numeric"
                          maxLength={5}
                          required
                          className={fieldClass}
                        />
                      </CompactField>
                      <TradeSelect
                        label="Condition"
                        value={condition}
                        onChange={setCondition}
                        options={[
                          ["excellent", "Excellent"],
                          ["good", "Good"],
                          ["fair", "Fair"],
                          ["rough", "Rough / Not Running"],
                        ]}
                      />
                      <TradeSelect
                        label="Title Status"
                        value={title}
                        onChange={setTitle}
                        options={[
                          ["clean", "Clean, in Hand"],
                          ["lien", "Clean, Lien Payoff"],
                          ["salvage", "Salvage or Rebuilt"],
                          ["lost", "Lost Title"],
                        ]}
                      />
                    </div>

                    <div className="mt-3 border-t border-slate-200 pt-3">
                      <Label htmlFor="customer-vehicle-photos" className="text-[10px] font-medium text-slate-700">
                        Vehicle Photos
                      </Label>
                      <label
                        htmlFor="customer-vehicle-photos"
                        className="mt-1 flex cursor-pointer flex-col items-center justify-center border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center transition-colors hover:border-cyan-600 hover:bg-cyan-50/40"
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          event.preventDefault();
                          const images = Array.from(event.dataTransfer.files).filter((file) =>
                            ["image/jpeg", "image/png"].includes(file.type),
                          );
                          setTradeInPhotoNames(images.map((file) => file.name));
                        }}
                      >
                        <ImagePlus className="size-6 text-cyan-700" />
                        <span className="mt-2 text-xs font-semibold text-slate-700">
                          Drop your images here, or browse
                        </span>
                        <span className="mt-1 text-[10px] text-slate-500">Supports JPG, JPEG and PNG</span>
                        <Input
                          id="customer-vehicle-photos"
                          type="file"
                          accept="image/jpeg,image/png"
                          multiple
                          className="sr-only"
                          onChange={(event) =>
                            setTradeInPhotoNames(Array.from(event.target.files ?? []).map((file) => file.name))
                          }
                        />
                      </label>
                      {tradeInPhotoNames.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {tradeInPhotoNames.map((name) => (
                            <span
                              key={name}
                              className="border border-slate-200 bg-white px-2 py-1 text-[10px] text-slate-600"
                            >
                              {name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </Panel>
                )}
              </main>
            </div>
          </LeadForm>
        </div>
      </div>

      <VehiclePickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        tab={pickerTab}
        onTabChange={setPickerTab}
        search={inventorySearch}
        onSearchChange={setInventorySearch}
        vehicles={pickerVehicles}
        matchingCount={matchingVehicles.length}
        allCount={inventory.length}
        selectedIds={selectedIds}
        onToggle={toggleSelectedVehicle}
        loading={inventoryLoading}
      />

      <TradeInDialog
        open={tradeInOpen}
        onOpenChange={setTradeInOpen}
        tab={tradeInTab}
        onTabChange={setTradeInTab}
        value={tradeInDraft}
        onChange={setTradeInDraft}
        photoNames={tradeInPhotoNames}
        onPhotoNamesChange={setTradeInPhotoNames}
        onSave={() => saveTradeIn(true)}
        onSaveAndAddAnother={() => saveTradeIn(false)}
      />
    </div>
  );
}

function TradeInDialog({
  open,
  onOpenChange,
  tab,
  onTabChange,
  value,
  onChange,
  photoNames,
  onPhotoNamesChange,
  onSave,
  onSaveAndAddAnother,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tab: "details" | "books" | "market";
  onTabChange: (tab: "details" | "books" | "market") => void;
  value: TradeInDraft;
  onChange: (value: TradeInDraft) => void;
  photoNames: string[];
  onPhotoNamesChange: (names: string[]) => void;
  onSave: () => void;
  onSaveAndAddAnother: () => void;
}) {
  const set = (field: keyof TradeInDraft, nextValue: string) => onChange({ ...value, [field]: nextValue });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[94vh] max-h-[94vh] w-[96vw] max-w-[1500px] flex-col gap-0 overflow-hidden rounded-sm border-slate-300 p-0">
        <DialogHeader className="border-b border-slate-300 bg-white px-4 py-3 text-left">
          <div className="flex flex-wrap items-center justify-between gap-3 pr-8">
            <div>
              <DialogTitle className="text-sm font-semibold text-slate-900">Add New Trade-In</DialogTitle>
              <DialogDescription className="mt-0.5 text-[10px] text-slate-500">
                Add the trade-in vehicle and appraisal information. External valuation services are not connected.
              </DialogDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={onSaveAndAddAnother}>
                Save and Add Another
              </Button>
              <Button type="button" size="sm" className="h-8 text-xs" onClick={onSave}>
                Save and Close
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="overflow-y-auto border-b border-slate-300 bg-white lg:border-b-0 lg:border-r">
            <ModalSectionTitle title="Vehicle Info" />
            <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-1">
              <ModalCombo
                label="Status"
                value={value.status}
                options={["Trade-In", "Appraisal"]}
                onChange={(next) => set("status", next)}
              />
              <ModalCombo
                label="Custom Status"
                value={value.customStatus}
                options={["Clean Title", "Green", "Red", "Wholesale"]}
                onChange={(next) => set("customStatus", next)}
              />
              <ModalChoice
                label="New / Used"
                value={value.newUsed}
                options={["New", "Used", "Manufacturer Certified"]}
                onChange={(next) => set("newUsed", next)}
              />
              <ModalChoice
                label="Vehicle Type"
                value={value.vehicleType}
                options={VEHICLE_TYPES}
                onChange={(next) => set("vehicleType", next)}
              />
              <div className="space-y-1">
                <Label className="text-[10px] font-medium text-slate-700">VIN</Label>
                <div className="flex items-center gap-1">
                  <Input
                    value={value.vin}
                    maxLength={17}
                    onChange={(event) =>
                      set(
                        "vin",
                        event.target.value
                          .toUpperCase()
                          .replace(/[^A-HJ-NPR-Z0-9]/g, "")
                          .slice(0, 17),
                      )
                    }
                    className={`${fieldClass} min-w-0 flex-1`}
                  />
                  <button
                    type="button"
                    title="Copy VIN"
                    aria-label="Copy VIN"
                    className="flex size-8 shrink-0 items-center justify-center border border-slate-300 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                    onClick={() => void navigator.clipboard?.writeText(value.vin)}
                  >
                    <Copy className="size-3.5" />
                  </button>
                  <label className="flex h-8 shrink-0 cursor-pointer items-center gap-1 border border-slate-300 bg-white px-2 text-[10px] text-slate-700">
                    <input
                      type="checkbox"
                      checked={value.vinAuto === "true"}
                      onChange={(event) => set("vinAuto", String(event.target.checked))}
                      className="size-3 accent-cyan-700"
                    />
                    Auto
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-[1fr_95px] gap-2">
                <ModalInput
                  label="Odometer"
                  value={value.odometer}
                  inputMode="numeric"
                  onChange={(next) => set("odometer", digitsOnly(next))}
                />
                <ModalChoice
                  label="Mileage Type"
                  value={value.mileageType}
                  options={["TMU", "EML", "Exempt"]}
                  onChange={(next) => set("mileageType", next)}
                />
              </div>
              <ModalChoice
                label="Year"
                value={value.year}
                options={TRADE_YEARS}
                allowEmpty
                onChange={(next) => set("year", next === "none" ? "" : next)}
              />
              <ModalInput label="Make" value={value.make} onChange={(next) => set("make", next)} />
              <ModalInput label="Model" value={value.model} onChange={(next) => set("model", next)} />
              <ModalInput label="Trim" value={value.trim} onChange={(next) => set("trim", next)} />
              <ModalInput label="Engine" value={value.engine} onChange={(next) => set("engine", next)} />
              <ModalChoice
                label="Transmission"
                value={value.transmission}
                options={TRANSMISSIONS}
                allowEmpty
                onChange={(next) => set("transmission", next)}
              />
              <ModalChoice
                label="Drive Train"
                value={value.drivetrain}
                options={DRIVETRAINS}
                allowEmpty
                onChange={(next) => set("drivetrain", next)}
              />
              <div className="grid grid-cols-2 gap-2">
                <ModalInput
                  label="Door"
                  value={value.doors}
                  inputMode="numeric"
                  onChange={(next) => set("doors", digitsOnly(next, 2))}
                />
                <ModalInput
                  label="Cylinder"
                  value={value.cylinders}
                  inputMode="numeric"
                  onChange={(next) => set("cylinders", digitsOnly(next, 2))}
                />
              </div>
              <ModalChoice
                label="Body Type"
                value={value.bodyType}
                options={BODY_TYPES}
                allowEmpty
                onChange={(next) => set("bodyType", next)}
              />
              <ModalChoice
                label="Fuel Type"
                value={value.fuelType}
                options={FUEL_TYPES}
                allowEmpty
                onChange={(next) => set("fuelType", next)}
              />
              <ModalInput
                label="Horse Power"
                value={value.horsepower}
                inputMode="numeric"
                onChange={(next) => set("horsepower", digitsOnly(next))}
              />
              <div className="grid grid-cols-2 gap-2">
                <ModalCombo
                  label="Exterior Color"
                  value={value.exteriorColor}
                  options={TRADE_COLORS}
                  onChange={(next) => set("exteriorColor", next)}
                />
                <ModalCombo
                  label="Interior Color"
                  value={value.interiorColor}
                  options={TRADE_COLORS}
                  onChange={(next) => set("interiorColor", next)}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <ModalInput
                  label="MPG City"
                  value={value.mpgCity}
                  inputMode="numeric"
                  onChange={(next) => set("mpgCity", digitsOnly(next))}
                />
                <ModalInput
                  label="MPG HWY"
                  value={value.mpgHighway}
                  inputMode="numeric"
                  onChange={(next) => set("mpgHighway", digitsOnly(next))}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <ModalInput
                  label="Vehicle Weight"
                  value={value.vehicleWeight}
                  inputMode="numeric"
                  onChange={(next) => set("vehicleWeight", digitsOnly(next))}
                />
                <ModalInput
                  label="GVW"
                  value={value.gvw}
                  inputMode="numeric"
                  onChange={(next) => set("gvw", digitsOnly(next))}
                />
              </div>
            </div>
          </aside>

          <div className="flex min-h-0 flex-col bg-slate-100">
            <div className="flex border-b border-slate-300 bg-white px-2 pt-1">
              <TabButton active={tab === "details"} onClick={() => onTabChange("details")}>
                Details
              </TabButton>
              <TabButton active={tab === "books"} onClick={() => onTabChange("books")}>
                Books
              </TabButton>
              <TabButton active={tab === "market"} onClick={() => onTabChange("market")}>
                Market Data
              </TabButton>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {tab === "details" && (
                <div className="space-y-3">
                  <div className="grid gap-3 xl:grid-cols-[minmax(280px,0.8fr)_minmax(500px,1.6fr)]">
                    <ModalPanel title="General Info">
                      <p className="mb-2 text-[10px] text-red-500">
                        Stock Number will be generated automatically upon Save.
                      </p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <ModalInput
                          label="Stock No."
                          value={value.stockNumber}
                          placeholder="Auto-generated"
                          onChange={(next) => set("stockNumber", next)}
                        />
                        <ModalInput
                          label="Appraisal Date"
                          type="date"
                          value={value.appraisalDate}
                          onChange={(next) => set("appraisalDate", next)}
                        />
                        <ModalInput
                          label="Location"
                          value={value.location}
                          onChange={(next) => set("location", next)}
                        />
                        <ModalChoice
                          label="Condition"
                          value={value.condition}
                          options={["Excellent", "Good", "Fair", "Poor", "Not Running"]}
                          allowEmpty
                          onChange={(next) => set("condition", next)}
                        />
                        <ModalInput
                          label="Appraiser Name"
                          value={value.appraiserName}
                          onChange={(next) => set("appraiserName", next)}
                        />
                        <ModalInput
                          label="Sales Rep"
                          value={value.salesRep}
                          onChange={(next) => set("salesRep", next)}
                        />
                      </div>
                    </ModalPanel>

                    <ModalPanel title="Summary">
                      <div className="grid gap-3 lg:grid-cols-[1fr_1.1fr]">
                        <ValuationPlaceholders />
                        <div className="grid gap-2 sm:grid-cols-2">
                          <ModalMoney
                            label="Target Selling Price"
                            value={value.targetSellingPrice}
                            onChange={(next) => set("targetSellingPrice", next)}
                          />
                          <ModalMoney
                            label="Recondition"
                            value={value.recondition}
                            onChange={(next) => set("recondition", next)}
                          />
                          <ModalMoney label="Packs" value={value.packs} onChange={(next) => set("packs", next)} />
                          <ModalMoney
                            label="Additional"
                            value={value.additional}
                            onChange={(next) => set("additional", next)}
                          />
                          <ModalMoney
                            label="Gross Profit"
                            value={value.grossProfit}
                            onChange={(next) => set("grossProfit", next)}
                          />
                          <ModalMoney
                            label="Appraisal Value"
                            value={value.appraisalValue}
                            onChange={(next) => set("appraisalValue", next)}
                          />
                        </div>
                      </div>
                    </ModalPanel>
                  </div>

                  <div className="grid gap-3 xl:grid-cols-3">
                    <ModalPanel title="Purchase Info">
                      <div className="space-y-2">
                        <ModalCombo
                          label="Source"
                          value={value.source}
                          options={PURCHASE_SOURCES}
                          onChange={(next) => set("source", next)}
                        />
                        <ModalInput
                          label="Customer"
                          value={value.customer}
                          placeholder="Customer name"
                          onChange={(next) => set("customer", next)}
                        />
                      </div>
                    </ModalPanel>

                    <ModalPanel title="Lienholder">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <ModalInput
                            label="Lienholder"
                            value={value.lienholder}
                            onChange={(next) => set("lienholder", next)}
                          />
                        </div>
                        <ModalInput
                          label="Lien Account No."
                          value={value.lienAccountNumber}
                          onChange={(next) => set("lienAccountNumber", next)}
                        />
                        <ModalMoney
                          label="Payoff Amount"
                          value={value.payoffAmount}
                          onChange={(next) => set("payoffAmount", next)}
                        />
                        <ModalInput
                          label="Due Date"
                          type="date"
                          value={value.payoffDueDate}
                          onChange={(next) => set("payoffDueDate", next)}
                        />
                        <ModalMoney label="Per Diem" value={value.perDiem} onChange={(next) => set("perDiem", next)} />
                        <div className="sm:col-span-2">
                          <Label className="text-[10px] text-slate-700">Memo</Label>
                          <Textarea
                            value={value.memo}
                            maxLength={200}
                            onChange={(event) => set("memo", event.target.value)}
                            className="mt-1 min-h-16 rounded-sm border-slate-300 text-xs"
                          />
                          <p className="mt-0.5 text-right text-[9px] text-slate-400">
                            {200 - value.memo.length} characters remaining
                          </p>
                        </div>
                      </div>
                    </ModalPanel>

                    <ModalPanel title="Title Info">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <ModalInput
                          label="Title Owner"
                          value={value.titleOwner}
                          onChange={(next) => set("titleOwner", next)}
                        />
                        <ModalInput
                          label="Title State"
                          value={value.titleState}
                          onChange={(next) => set("titleState", next.toUpperCase().slice(0, 2))}
                        />
                        <ModalInput
                          label="Title Brand"
                          value={value.titleBrand}
                          onChange={(next) => set("titleBrand", next)}
                        />
                        <ModalInput
                          label="License No."
                          value={value.licenseNumber}
                          onChange={(next) => set("licenseNumber", next)}
                        />
                        <ModalInput
                          label="License State"
                          value={value.licenseState}
                          onChange={(next) => set("licenseState", next.toUpperCase().slice(0, 2))}
                        />
                        <ModalInput
                          label="License Expiry Date"
                          type="date"
                          value={value.licenseExpiryDate}
                          onChange={(next) => set("licenseExpiryDate", next)}
                        />
                      </div>
                    </ModalPanel>
                  </div>

                  <div className="grid gap-3 xl:grid-cols-[1.3fr_0.7fr]">
                    <ModalPanel title="Vehicle Photos">
                      <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center border border-dashed border-slate-300 bg-slate-50 p-4 text-center hover:border-cyan-600">
                        <ImagePlus className="size-7 text-cyan-700" />
                        <span className="mt-2 text-xs font-semibold text-slate-700">
                          Drop your image here, or browse
                        </span>
                        <span className="mt-1 text-[10px] text-slate-500">Supports: JPG, JPEG, PNG</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png"
                          multiple
                          className="sr-only"
                          onChange={(event) =>
                            onPhotoNamesChange(Array.from(event.target.files ?? []).map((file) => file.name))
                          }
                        />
                      </label>
                      {photoNames.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {photoNames.map((name) => (
                            <span
                              key={name}
                              className="border border-slate-200 bg-white px-2 py-1 text-[9px] text-slate-600"
                            >
                              {name}
                            </span>
                          ))}
                        </div>
                      )}
                    </ModalPanel>

                    <ModalPanel title="Similar Vehicle">
                      <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4 xl:grid-cols-2">
                        <Stat label="Unit" value="0" />
                        <Stat label="Avg. Days on Lot" value="0" />
                        <Stat label="Avg. Miles" value="0" />
                        <Stat label="Avg. Price" value="$0" />
                        <Stat label="Avg. Total Cost" value="$0" />
                      </div>
                    </ModalPanel>
                  </div>

                  <ModalPanel title="Notes">
                    <Textarea
                      value={value.notes}
                      onChange={(event) => set("notes", event.target.value)}
                      className="min-h-24 rounded-sm border-slate-300 text-xs"
                    />
                  </ModalPanel>
                </div>
              )}

              {tab === "books" && (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {[
                    ["KBB", "Trade Book Good"],
                    ["J.D. Power", "Trade Clean"],
                    ["Black Book", "Valuation"],
                    ["Manheim", "Adjusted"],
                    ["Carfax", "Vehicle History"],
                  ].map(([name, subtitle]) => (
                    <div key={name} className="border border-slate-300 bg-white p-4">
                      <h3 className="text-sm font-semibold text-slate-800">{name}</h3>
                      <p className="mt-1 text-[10px] text-slate-500">{subtitle}</p>
                      <p className="mt-4 border-t border-slate-200 pt-3 text-xs text-slate-500">
                        No API connected. Enter verified values manually in Details when available.
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {tab === "market" && (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <MarketCard title="Similar Units" value="0" />
                  <MarketCard title="Average Days on Lot" value="0" />
                  <MarketCard title="Average Miles" value="0" />
                  <MarketCard title="Average Price" value="$0" />
                  <div className="border border-slate-300 bg-white p-4 sm:col-span-2 xl:col-span-4">
                    <h3 className="text-xs font-semibold text-slate-800">Market Data</h3>
                    <p className="mt-2 text-xs text-slate-500">
                      No market-data API is connected. This tab is ready for a future provider integration.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function VehiclePickerDialog({
  open,
  onOpenChange,
  tab,
  onTabChange,
  search,
  onSearchChange,
  vehicles,
  matchingCount,
  allCount,
  selectedIds,
  onToggle,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tab: PickerTab;
  onTabChange: (tab: PickerTab) => void;
  search: string;
  onSearchChange: (value: string) => void;
  vehicles: VehicleWithPhotos[];
  matchingCount: number;
  allCount: number;
  selectedIds: string[];
  onToggle: (id: string) => void;
  loading: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] max-w-5xl flex-col gap-0 overflow-hidden rounded-sm border-slate-300 p-0">
        <DialogHeader className="border-b border-cyan-200 bg-[#e8f7f7] px-4 py-3 text-left">
          <DialogTitle className="text-sm font-semibold text-slate-800">Pick Vehicle(s) to Sell</DialogTitle>
        </DialogHeader>

        <div className="flex border-b border-slate-300 bg-white px-4 pt-2">
          <TabButton active={tab === "matching"} onClick={() => onTabChange("matching")}>
            Matching Vehicles ({matchingCount})
          </TabButton>
          <TabButton active={tab === "all"} onClick={() => onTabChange("all")}>
            All Vehicles ({allCount})
          </TabButton>
        </div>

        <div className="border-b border-slate-200 bg-slate-50 p-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search year, make, model, VIN, or stock number"
              className={`${fieldClass} pl-8`}
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {loading ? (
            <p className="py-12 text-center text-xs text-slate-500">Loading available inventory…</p>
          ) : vehicles.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center text-xs text-slate-500">
              <SlidersHorizontal className="size-6" />
              No vehicles match these preferences. Try the All Vehicles tab or adjust the wish list.
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {vehicles.map((vehicle) => (
                <PickerVehicleCard
                  key={vehicle.id}
                  vehicle={vehicle}
                  checked={selectedIds.includes(vehicle.id)}
                  onToggle={() => onToggle(vehicle.id)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-300 bg-slate-50 px-4 py-3">
          <span className="text-[11px] text-slate-500">
            {selectedIds.length} vehicle{selectedIds.length === 1 ? "" : "s"} selected
          </span>
          <Button type="button" size="sm" className="h-8 rounded-sm text-xs" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PickerVehicleCard({
  vehicle,
  checked,
  onToggle,
}: {
  vehicle: VehicleWithPhotos;
  checked: boolean;
  onToggle: () => void;
}) {
  const photo = primaryPhoto(vehicle);
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative grid grid-cols-[96px_1fr] gap-3 border p-2 text-left transition-colors ${checked ? "border-cyan-700 bg-cyan-50" : "border-slate-300 bg-white hover:border-cyan-500"}`}
    >
      <span
        className={`absolute right-2 top-2 flex size-4 items-center justify-center border ${checked ? "border-cyan-700 bg-cyan-700 text-white" : "border-slate-300 bg-white"}`}
      >
        {checked && <Check className="size-3" />}
      </span>
      <VehicleImage vehicle={vehicle} url={photo?.url} className="h-[72px] w-24" />
      <span className="min-w-0 pr-5">
        <span className="block truncate text-xs font-semibold text-slate-800">{vehicleTitle(vehicle)}</span>
        <span className="mt-0.5 block text-[9px] font-semibold uppercase tracking-wide text-emerald-700">
          In Inventory
        </span>
        <span className="mt-1 block text-sm font-bold text-cyan-800">{formatUsd(Number(vehicle.price_cents))}</span>
        <span className="mt-1 grid grid-cols-2 gap-x-2 text-[9px] text-slate-500">
          <span>VIN: {vehicle.vin}</span>
          <span>Stock: {vehicle.stock_number}</span>
          <span>Mileage: {formatMiles(vehicle.mileage)}</span>
          <span>{vehicle.body_style}</span>
        </span>
      </span>
    </button>
  );
}

function SelectedVehicleCard({ vehicle, onRemove }: { vehicle: VehicleWithPhotos; onRemove: () => void }) {
  const photo = primaryPhoto(vehicle);
  return (
    <article className="border border-slate-300 bg-white">
      <div className="flex items-start justify-between border-b border-slate-200 bg-slate-50 px-3 py-2">
        <div>
          <h3 className="text-xs font-semibold text-slate-800">{vehicleTitle(vehicle)}</h3>
          <p className="text-[9px] font-semibold uppercase tracking-wide text-emerald-700">In Inventory</p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${vehicleTitle(vehicle)}`}
          className="flex size-6 items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-600"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <div className="grid gap-3 p-3 sm:grid-cols-[150px_1fr]">
        <VehicleImage vehicle={vehicle} url={photo?.url} className="h-28 w-full" />
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[10px]">
          <VehicleDatum label="Price" value={formatUsd(Number(vehicle.price_cents))} strong />
          <VehicleDatum label="Stock #" value={vehicle.stock_number} />
          <VehicleDatum label="VIN" value={vehicle.vin} />
          <VehicleDatum label="Mileage" value={formatMiles(vehicle.mileage)} />
          <VehicleDatum label="Body Type" value={vehicle.body_style} />
          <VehicleDatum
            label="Ext. / Int. Color"
            value={`${vehicle.exterior_color ?? "—"} / ${vehicle.interior_color ?? "—"}`}
          />
          <VehicleDatum label="Transmission" value={vehicle.transmission ?? "—"} />
          <VehicleDatum label="Drive Train" value={vehicle.drivetrain ?? "—"} />
          <VehicleDatum label="Fuel Type" value={vehicle.fuel_type ?? "—"} />
          <VehicleDatum label="Engine" value={vehicle.engine ?? "—"} />
        </dl>
      </div>
    </article>
  );
}

function ModalSectionTitle({ title }: { title: string }) {
  return (
    <div className="border-b border-cyan-200 bg-[#e8f7f7] px-3 py-2 text-[11px] font-semibold text-slate-800">
      {title}
    </div>
  );
}

function ModalPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border border-slate-300 bg-white">
      <ModalSectionTitle title={title} />
      <div className="p-3">{children}</div>
    </section>
  );
}

function ModalInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  inputMode,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  inputMode?: "text" | "numeric" | "decimal";
  maxLength?: number;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] font-medium text-slate-700">{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        maxLength={maxLength}
        className={fieldClass}
      />
    </div>
  );
}

function ModalCombo({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  const listId = `trade-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-options`;
  return (
    <div className="space-y-1">
      <Label className="text-[10px] font-medium text-slate-700">{label}</Label>
      <Input
        list={listId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Type or select"
        autoComplete="off"
        className={fieldClass}
      />
      <datalist id={listId}>
        {options.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
    </div>
  );
}

function ModalChoice({
  label,
  value,
  options,
  onChange,
  allowEmpty = false,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  allowEmpty?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] font-medium text-slate-700">{label}</Label>
      <Select {...(value ? { value } : {})} onValueChange={onChange}>
        <SelectTrigger className={selectClass}>
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          {allowEmpty && <SelectItem value="none">Select</SelectItem>}
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ModalMoney({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] font-medium text-slate-700">{label}</Label>
      <div className="relative">
        <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">$</span>
        <Input
          value={value}
          inputMode="decimal"
          onChange={(event) => onChange(event.target.value.replace(/[^\d.]/g, ""))}
          className={`${fieldClass} pl-5 text-right`}
        />
      </div>
    </div>
  );
}

function ValuationPlaceholders() {
  return (
    <div className="space-y-2">
      {[
        ["KBB", "Trade Book Good"],
        ["J.D. Power", "Trade Clean"],
        ["Black Book", "Not connected"],
        ["Manheim", "Not connected"],
        ["Carfax", "Not connected"],
      ].map(([name, status]) => (
        <div key={name} className="grid grid-cols-[80px_1fr] gap-2 border-b border-slate-100 pb-2 text-[10px]">
          <span className="font-semibold text-slate-800">{name}</span>
          <span className="text-slate-500">{status}</span>
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-800">{value}</p>
    </div>
  );
}

function MarketCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="border border-slate-300 bg-white p-4">
      <p className="text-[10px] text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-800">{value}</p>
    </div>
  );
}

function Panel({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="border border-slate-300 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cyan-200 bg-[#e8f7f7] px-3 py-2">
        <div>
          <h2 className="text-xs font-semibold text-slate-800">{title}</h2>
          {description && <p className="mt-0.5 text-[10px] text-slate-500">{description}</p>}
        </div>
        {action}
      </div>
      <div className="p-3">{children}</div>
    </section>
  );
}

function CompactField({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={htmlFor} className="text-[10px] font-medium leading-none text-slate-700">
        {label}
      </Label>
      {children}
    </div>
  );
}

function CompactSelect({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] font-medium leading-none text-slate-700">{label}</Label>
      {children}
    </div>
  );
}

function DatalistField({
  id,
  label,
  value,
  options,
  onChange,
  placeholder = "Type or select",
  inputMode,
}: {
  id: string;
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  placeholder?: string;
  inputMode?: "text" | "numeric" | "decimal";
}) {
  const listId = `${id}-options`;
  return (
    <CompactField label={label} htmlFor={id}>
      <Input
        id={id}
        list={listId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        autoComplete="off"
        className={fieldClass}
      />
      <datalist id={listId}>
        {options.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
    </CompactField>
  );
}

function OptionSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <CompactSelect label={label}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className={selectClass}>
          <SelectValue placeholder={`All ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Any</SelectItem>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </CompactSelect>
  );
}

function TradeSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[][];
  onChange: (value: string) => void;
}) {
  return (
    <CompactSelect label={label}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className={selectClass}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(([optionValue = "", optionLabel]) => (
            <SelectItem key={optionValue} value={optionValue}>
              {optionLabel}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </CompactSelect>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border-b-2 px-3 py-2 text-[11px] font-medium ${active ? "border-cyan-700 text-cyan-800" : "border-transparent text-slate-500 hover:text-slate-800"}`}
    >
      {children}
    </button>
  );
}

function VehicleImage({
  vehicle,
  url,
  className,
}: {
  vehicle: VehicleWithPhotos;
  url?: string | undefined;
  className: string;
}) {
  return url ? (
    <img
      src={url}
      alt={vehicleTitle(vehicle)}
      className={`${className} border border-slate-200 bg-slate-100 object-cover`}
    />
  ) : (
    <span
      className={`${className} flex items-center justify-center border border-slate-200 bg-slate-100 text-slate-400`}
    >
      <Camera className="size-5" />
    </span>
  );
}

function VehicleDatum({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-slate-500">{label}</dt>
      <dd className={`truncate ${strong ? "text-sm font-bold text-cyan-800" : "font-medium text-slate-800"}`}>
        {value}
      </dd>
    </div>
  );
}

function primaryPhoto(vehicle: VehicleWithPhotos) {
  return [...(vehicle.vehicle_photos ?? [])].sort((a, b) => a.position - b.position)[0];
}

function digitsOnly(value: string, maxLength?: number) {
  const digits = value.replace(/\D/g, "");
  return typeof maxLength === "number" ? digits.slice(0, maxLength) : digits;
}

function formatPhone(value: string) {
  const digits = digitsOnly(value, 10);
  if (!digits) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function includesText(value: string | null | undefined, expected: string) {
  return (value ?? "").toLowerCase().includes(expected.trim().toLowerCase());
}

function numericValue(value: string) {
  const numeric = Number(value.replace(/[^\d.]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

function getWishListMatchScore(vehicle: VehicleWithPhotos, wish: WishListState) {
  let score = 0;
  let activePreferences = 0;

  const addMatch = (active: boolean, matches: boolean, weight = 1) => {
    if (!active) return;
    activePreferences += 1;
    if (matches) score += weight;
  };

  const vehicleName = `${vehicle.make} ${vehicle.model} ${vehicle.trim ?? ""}`;
  const body = (vehicle.body_style ?? "").toLowerCase();
  const selectedBody = wish.bodyType === "Pickup" ? "Truck" : wish.bodyType.replace("_", " ");
  const selectedType = wish.vehicleType.toLowerCase();
  const typeMatches =
    selectedType === "auto"
      ? true
      : selectedType === "car"
        ? ["sedan", "coupe", "hatchback", "convertible", "wagon"].some((type) => body.includes(type))
        : selectedType === "van"
          ? ["van", "minivan"].some((type) => body.includes(type))
          : body.includes(selectedType);

  addMatch(Boolean(wish.makeModel.trim()), includesText(vehicleName, wish.makeModel), 3);
  addMatch(wish.bodyType !== "all", includesText(vehicle.body_style, selectedBody), 2);
  addMatch(wish.vehicleType !== "all", typeMatches, 2);
  addMatch(Boolean(wish.minYear), vehicle.year >= numericValue(wish.minYear), 1);
  addMatch(Boolean(wish.maxPrice), Number(vehicle.price_cents) / 100 <= numericValue(wish.maxPrice), 1);
  addMatch(
    Boolean(wish.maxMileage) && wish.maxMileage !== "Any Mileage",
    vehicle.mileage <= numericValue(wish.maxMileage),
    1,
  );
  addMatch(wish.transmission !== "all", includesText(vehicle.transmission, wish.transmission), 2);
  addMatch(wish.drivetrain !== "all", includesText(vehicle.drivetrain, wish.drivetrain), 2);
  addMatch(wish.fuelType !== "all", includesText(vehicle.fuel_type, wish.fuelType.replace("_", " ")), 2);
  addMatch(Boolean(wish.exteriorColor), includesText(vehicle.exterior_color, wish.exteriorColor), 1);
  addMatch(Boolean(wish.interiorColor), includesText(vehicle.interior_color, wish.interiorColor), 1);

  const features = (vehicle.features ?? []).map((feature) => feature.toLowerCase());
  wish.features.forEach((feature) => {
    addMatch(
      true,
      features.some((item) => item.includes(feature.toLowerCase())),
      1,
    );
  });

  // With no specific preference entered, do not label every inventory unit as a match.
  return activePreferences === 0 ? 0 : score;
}
