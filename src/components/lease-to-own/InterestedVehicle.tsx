import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CarFront, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { vehicleTitle } from "@/lib/format";
import {
  usd,
  type PackageEstimate,
  type TradeIn,
  type TradeInErrors,
  type VehiclePreferences,
} from "@/lib/lease-to-own";
import type { LeaseVehicleSnapshot } from "@/lib/lease-to-own.functions";
import { allVehiclesQuery, type VehicleWithPhotos } from "@/lib/queries";
import { FormField, FormSection, TextField } from "./FormFields";

const MAX_RESULTS = 8;

/**
 * Interested Vehicle for the whole application (one vehicle, shared by Buyer
 * and Co-Buyer). Search uses the same live inventory as /inventory and
 * /finance; choosing a vehicle fills its details from inventory and they can't
 * be edited. Price and down payment always follow the package selector, and
 * the server re-reads the vehicle from inventory on submit.
 */
export function InterestedVehicle({
  vehicle,
  vehicleLoading,
  estimate,
  onSelectVehicle,
  preferences,
  onPreferencesChange,
  preferenceErrors,
  tradeInEnabled,
  onTradeInEnabledChange,
  tradeIn,
  onTradeInChange,
  tradeInErrors,
}: {
  vehicle: LeaseVehicleSnapshot | null;
  vehicleLoading: boolean;
  estimate: PackageEstimate;
  onSelectVehicle: (slug: string | null) => void;
  preferences: VehiclePreferences;
  onPreferencesChange: (patch: Partial<VehiclePreferences>) => void;
  preferenceErrors: Partial<Record<keyof VehiclePreferences, string>>;
  tradeInEnabled: boolean;
  onTradeInEnabledChange: (enabled: boolean) => void;
  tradeIn: TradeIn;
  onTradeInChange: (patch: Partial<TradeIn>) => void;
  tradeInErrors: TradeInErrors;
}) {
  const [keyword, setKeyword] = useState("");
  const [searching, setSearching] = useState(false);
  // Load inventory only once the applicant starts searching.
  const inventory = useQuery({ ...allVehiclesQuery(), enabled: searching });
  const results = useMemo(() => {
    const needle = keyword.trim().toLowerCase();
    if (!needle) return [];
    return (inventory.data ?? [])
      .filter((item) =>
        [item.year, item.make, item.model, item.trim, item.vin, item.stock_number]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(needle),
      )
      .slice(0, MAX_RESULTS);
  }, [inventory.data, keyword]);

  function choose(item: VehicleWithPhotos) {
    onSelectVehicle(item.slug);
    setKeyword("");
  }

  const readOnly = (id: string, label: string, value: string | number | null | undefined) => (
    <FormField id={id} label={label}>
      <Input
        id={id}
        value={value == null || value === "" ? "—" : String(value)}
        readOnly
        disabled
      />
    </FormField>
  );
  const pref = (field: keyof VehiclePreferences) => ({
    id: `lto-vehicle-${field}`,
    value: preferences[field],
    onChange: (next: string) => onPreferencesChange({ [field]: next }),
    error: preferenceErrors[field],
    autoComplete: "off",
  });
  const trade = (field: keyof TradeIn) => ({
    id: `lto-trade-${field}`,
    value: tradeIn[field],
    onChange: (next: string) => onTradeInChange({ [field]: next }),
    error: tradeInErrors[field],
    autoComplete: "off",
  });

  return (
    <FormSection
      title="Interested Vehicle"
      description="Search our current inventory, or describe what you're looking for. Price and down payment follow the package you selected."
    >
      <div className="relative">
        <Label htmlFor="lto-vehicle-search">Vehicle keyword search</Label>
        <div className="relative mt-1.5">
          <Search
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="lto-vehicle-search"
            type="search"
            value={keyword}
            onFocus={() => setSearching(true)}
            onChange={(e) => {
              setSearching(true);
              setKeyword(e.target.value);
            }}
            placeholder="Year, make, model, VIN or stock number"
            className="pl-9"
            autoComplete="off"
            aria-controls="lto-vehicle-results"
            aria-expanded={Boolean(keyword.trim())}
          />
        </div>
        {keyword.trim() && (
          <div
            id="lto-vehicle-results"
            role="listbox"
            aria-label="Matching vehicles"
            className="absolute z-30 mt-1 max-h-80 w-full overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-lg"
          >
            {inventory.isLoading ? (
              <p className="px-3 py-2 text-sm text-muted-foreground" role="status">
                Loading inventory…
              </p>
            ) : inventory.error ? (
              <p className="px-3 py-2 text-sm text-muted-foreground" role="status">
                Inventory isn't available right now. Describe the vehicle below instead.
              </p>
            ) : results.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground" role="status">
                No vehicles in stock match “{keyword.trim()}”.
              </p>
            ) : (
              results.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="option"
                  aria-selected={item.slug === vehicle?.slug}
                  onClick={() => choose(item)}
                  className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{vehicleTitle(item)}</span>
                    <span className="block text-xs text-muted-foreground">
                      Stock #{item.stock_number}
                      {item.exterior_color ? ` · ${item.exterior_color}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 font-semibold text-primary">
                    {usd(Number(item.price_cents) / 100)}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {vehicle ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          <span className="flex min-w-0 items-center gap-2">
            <CarFront className="size-4 shrink-0 text-primary" aria-hidden="true" />
            <span className="truncate">
              Selected from inventory: <strong>{vehicle.title}</strong>
            </span>
          </span>
          <Button type="button" variant="ghost" size="sm" onClick={() => onSelectVehicle(null)}>
            <X className="size-4" aria-hidden="true" /> Clear
          </Button>
        </div>
      ) : vehicleLoading ? (
        <p className="text-sm text-muted-foreground" role="status">
          Loading the selected vehicle…
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-4">
        {readOnly("lto-vehicle-stock", "Stock Number", vehicle?.stockNumber)}
        {vehicle ? (
          <>
            {readOnly("lto-vehicle-year", "Year", vehicle.year)}
            {readOnly("lto-vehicle-make", "Make", vehicle.make)}
            {readOnly("lto-vehicle-model", "Model", vehicle.model)}
          </>
        ) : (
          <>
            <TextField {...pref("year")} label="Year" inputMode="numeric" maxLength={4} />
            <TextField {...pref("make")} label="Make" />
            <TextField {...pref("model")} label="Model" />
          </>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        {readOnly(
          "lto-vehicle-price",
          vehicle ? "Vehicle Price" : "Vehicle Value (package)",
          usd(vehicle?.price ?? estimate.vehicleValue),
        )}
        {readOnly("lto-vehicle-down", "Down Payment (estimate)", usd(estimate.downPayment))}
        {vehicle ? (
          <>
            {readOnly("lto-vehicle-exterior", "Exterior Color", vehicle.exteriorColor)}
            {readOnly("lto-vehicle-interior", "Interior Color", vehicle.interiorColor)}
          </>
        ) : (
          <>
            <TextField {...pref("exteriorColor")} label="Exterior Color" />
            <TextField {...pref("interiorColor")} label="Interior Color" />
          </>
        )}
      </div>
      {vehicle && vehicle.price != null && vehicle.price !== estimate.vehicleValue && (
        <p className="text-xs text-muted-foreground">
          The package estimate uses {usd(estimate.vehicleValue)}, the closest value in the program's{" "}
          illustrative range. Final terms come only from your approved agreement.
        </p>
      )}

      <div className="flex items-center gap-2">
        <Checkbox
          id="lto-trade-enabled"
          checked={tradeInEnabled}
          onCheckedChange={(state) => onTradeInEnabledChange(state === true)}
        />
        <Label
          htmlFor="lto-trade-enabled"
          className="cursor-pointer text-sm font-semibold text-primary"
        >
          Add Trade-In? (optional)
        </Label>
      </div>
      {tradeInEnabled && (
        <div className="grid gap-4 rounded-lg border border-border bg-muted/30 p-4 sm:grid-cols-5">
          <TextField {...trade("year")} label="Year" required inputMode="numeric" maxLength={4} />
          <TextField {...trade("make")} label="Make" required />
          <TextField {...trade("model")} label="Model" required />
          <TextField {...trade("mileage")} label="Mileage" inputMode="numeric" maxLength={7} />
          <TextField
            {...trade("payoff")}
            label="Amount Owed"
            inputMode="decimal"
            placeholder="0.00"
          />
        </div>
      )}
    </FormSection>
  );
}

/** Read-only summary of the application's vehicle, shown on the Co-Buyer tab. */
export function VehicleSummary({
  vehicle,
  preferences,
  estimate,
}: {
  vehicle: LeaseVehicleSnapshot | null;
  preferences: VehiclePreferences;
  estimate: PackageEstimate;
}) {
  const wanted = [preferences.year, preferences.make, preferences.model].filter(Boolean).join(" ");
  return (
    <FormSection
      title="Interested Vehicle"
      description="Shared by the whole application. The Buyer chooses it on the Buyer tab."
    >
      <dl className="grid gap-3 rounded-lg border border-border bg-muted/30 p-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">Vehicle</dt>
          <dd className="font-semibold">{vehicle?.title ?? (wanted || "Not chosen yet")}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">
            {vehicle ? "Vehicle Price" : "Vehicle Value (package)"}
          </dt>
          <dd className="font-semibold">{usd(vehicle?.price ?? estimate.vehicleValue)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Down Payment (estimate)</dt>
          <dd className="font-semibold">{usd(estimate.downPayment)}</dd>
        </div>
      </dl>
    </FormSection>
  );
}
