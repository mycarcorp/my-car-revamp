import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { Camera, CarFront, Check, Plus, Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LeadForm } from "@/components/LeadForm";
import { supabase } from "@/integrations/supabase/app-client";
import { formatMiles, formatUsd, vehicleTitle } from "@/lib/format";
import type { VehicleWithPhotos } from "@/lib/queries";

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

const fieldClass =
  "h-8 rounded-sm border-slate-300 bg-white px-2 text-xs focus-visible:ring-1 focus-visible:ring-cyan-700";
const selectClass = "h-8 rounded-sm border-slate-300 bg-white px-2 text-xs focus:ring-1 focus:ring-cyan-700";

function SellPage() {
  const [vin, setVin] = useState("");
  const [plate, setPlate] = useState("");
  const [ymm, setYmm] = useState("");
  const [mileage, setMileage] = useState("");
  const [zip, setZip] = useState("");
  const [condition, setCondition] = useState("good");
  const [title, setTitle] = useState("clean");
  const [intent, setIntent] = useState("trade");
  const [wishList, setWishList] = useState<WishListState>(emptyWishList);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTab, setPickerTab] = useState<PickerTab>("matching");
  const [inventorySearch, setInventorySearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const { data: inventory = [], isLoading: inventoryLoading } = useQuery({
    queryKey: ["sell", "available-inventory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("*, vehicle_photos(id, vehicle_id, url, alt, position, created_at)")
        .eq("status", "available")
        .order("year", { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as VehicleWithPhotos[];
    },
  });

  const matchingVehicles = useMemo(
    () => inventory.filter((vehicle) => matchesWishList(vehicle, wishList)),
    [inventory, wishList],
  );

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

  return (
    <div className="min-h-screen bg-[#f4f7f7] px-3 py-5 sm:px-5">
      <div className="mx-auto w-full max-w-[1180px]">
        <div className="mb-4">
          <h1 className="text-xl font-semibold text-slate-800">Sell or Trade Your Car</h1>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">
            Tell us about your current vehicle and, if you are trading, select the vehicles you are interested in from
            our available inventory.
          </p>
        </div>

        <div className="border border-slate-300 bg-white p-2 shadow-sm sm:p-3 [&_button]:rounded-sm [&_input]:h-8 [&_input]:rounded-sm [&_label]:text-[10px] [&_textarea]:rounded-sm [&_textarea]:border-slate-300 [&_textarea]:text-xs">
          <LeadForm
            leadType="trade"
            submitLabel="Request My Offer"
            successTitle="Appraisal request received"
            successBody="Our buyer will review your vehicle and respond with a number, usually within one business day."
            messageLabel="Damage, service history, or anything else we should know"
            collectDetails={() => ({
              vin,
              plate,
              year_make_model: ymm,
              mileage,
              zip,
              condition,
              title_status: title,
              intent,
              customer_wish_list: JSON.stringify(wishList),
              selected_vehicle_ids: selectedIds.join(","),
              selected_vehicles: JSON.stringify(
                selectedVehicles.map((vehicle) => ({
                  id: vehicle.id,
                  title: vehicleTitle(vehicle),
                  stock_number: vehicle.stock_number,
                  vin: vehicle.vin,
                  price_cents: vehicle.price_cents,
                })),
              ),
            })}
          >
            <div className="space-y-3">
              <Panel
                title="Customer Wish List"
                description="Optional preferences help us identify the best vehicles for your trade."
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
                    <label key={feature} className="flex cursor-pointer items-center gap-2 text-[11px] text-slate-700">
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
                title={`Vehicles Selected for Sale (${selectedVehicles.length})`}
                description="Vehicles from our inventory that you want to consider for your purchase or trade."
                action={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 rounded-sm px-3 text-[10px]"
                    onClick={() => openPicker("all")}
                  >
                    <Plus className="size-3" />
                    Pick Vehicle(s) to Sell
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

              <Panel title="Your Trade-In Vehicle" description="Tell us about the vehicle you want to sell or trade.">
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
                  <div className="sm:col-span-2 lg:col-span-4">
                    <TradeSelect
                      label="What Are You Looking to Do?"
                      value={intent}
                      onChange={setIntent}
                      options={[
                        ["trade", "Trade toward a vehicle from our lot"],
                        ["sell", "Sell outright for cash"],
                        ["undecided", "Not sure yet"],
                      ]}
                    />
                  </div>
                </div>
              </Panel>
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
    </div>
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
          <DialogDescription className="text-[11px] text-slate-500">
            Select one or more available vehicles to include with this request.
          </DialogDescription>
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
          {options.map(([optionValue, optionLabel]) => (
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

function VehicleImage({ vehicle, url, className }: { vehicle: VehicleWithPhotos; url?: string; className: string }) {
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

function includesText(value: string | null | undefined, expected: string) {
  return (value ?? "").toLowerCase().includes(expected.trim().toLowerCase());
}

function numericValue(value: string) {
  const numeric = Number(value.replace(/[^\d.]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

function matchesWishList(vehicle: VehicleWithPhotos, wish: WishListState) {
  if (wish.makeModel && !includesText(`${vehicle.make} ${vehicle.model} ${vehicle.trim ?? ""}`, wish.makeModel))
    return false;
  if (wish.bodyType !== "all") {
    const selectedBody = wish.bodyType === "Pickup" ? "Truck" : wish.bodyType.replace("_", " ");
    if (!includesText(vehicle.body_style, selectedBody)) return false;
  }
  if (wish.vehicleType !== "all" && wish.vehicleType !== "auto") {
    const body = vehicle.body_style.toLowerCase();
    const matchesType =
      wish.vehicleType === "car"
        ? ["sedan", "coupe", "hatchback", "convertible", "wagon"].includes(body)
        : wish.vehicleType === "van"
          ? ["van", "minivan"].includes(body)
          : body === wish.vehicleType;
    if (!matchesType) return false;
  }
  if (wish.minYear && vehicle.year < Number(wish.minYear)) return false;
  if (wish.maxPrice && Number(vehicle.price_cents) / 100 > numericValue(wish.maxPrice)) return false;
  if (wish.maxMileage && wish.maxMileage !== "Any Mileage" && vehicle.mileage > numericValue(wish.maxMileage))
    return false;
  if (wish.transmission !== "all" && !includesText(vehicle.transmission, wish.transmission)) return false;
  if (wish.drivetrain !== "all" && !includesText(vehicle.drivetrain, wish.drivetrain)) return false;
  if (wish.fuelType !== "all" && !includesText(vehicle.fuel_type, wish.fuelType)) return false;
  if (wish.exteriorColor && !includesText(vehicle.exterior_color, wish.exteriorColor)) return false;
  if (wish.interiorColor && !includesText(vehicle.interior_color, wish.interiorColor)) return false;
  const features = (vehicle.features ?? []).map((feature) => feature.toLowerCase());
  if (wish.features.some((feature) => !features.some((item) => item.includes(feature.toLowerCase())))) return false;
  return true;
}
