import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BadgeDollarSign,
  CarFront,
  Check,
  Handshake,
  ImagePlus,
  Plus,
  Minus,
  Search,
  TrendingUp,
  X,
  Camera,
  Banknote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
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
      { title: "Sell or Trade Your Car in Fredericksburg, VA | My Car" },
      {
        name: "description",
        content:
          "Sell or trade your vehicle with My Car in Fredericksburg, VA. Submit your plate, VIN, mileage and condition to request an offer from our team.",
      },
      { property: "og:title", content: "Sell or Trade Your Car | My Car" },
      {
        property: "og:description",
        content:
          "Get started with a simple online sell or trade-in request. Our team reviews your vehicle details and follows up.",
      },
      { property: "og:url", content: "https://mycarcorp.com/sell" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://mycarcorp.com/sell" }],
  }),
  component: SellPage,
});

type EntryTab = "plate" | "vin";
type Intent = "sell" | "trade";
type PickerTab = "matching" | "all";
type WishList = {
  makeModel: string;
  minYear: string;
  maxPrice: string;
  maxMileage: string;
  bodyType: string;
};
const EMPTY_WISH: WishList = { makeModel: "", minYear: "", maxPrice: "", maxMileage: "", bodyType: "" };
const US_STATES = [
  ["AL", "Alabama"],
  ["AK", "Alaska"],
  ["AZ", "Arizona"],
  ["AR", "Arkansas"],
  ["CA", "California"],
  ["CO", "Colorado"],
  ["CT", "Connecticut"],
  ["DE", "Delaware"],
  ["DC", "District of Columbia"],
  ["FL", "Florida"],
  ["GA", "Georgia"],
  ["HI", "Hawaii"],
  ["ID", "Idaho"],
  ["IL", "Illinois"],
  ["IN", "Indiana"],
  ["IA", "Iowa"],
  ["KS", "Kansas"],
  ["KY", "Kentucky"],
  ["LA", "Louisiana"],
  ["ME", "Maine"],
  ["MD", "Maryland"],
  ["MA", "Massachusetts"],
  ["MI", "Michigan"],
  ["MN", "Minnesota"],
  ["MS", "Mississippi"],
  ["MO", "Missouri"],
  ["MT", "Montana"],
  ["NE", "Nebraska"],
  ["NV", "Nevada"],
  ["NH", "New Hampshire"],
  ["NJ", "New Jersey"],
  ["NM", "New Mexico"],
  ["NY", "New York"],
  ["NC", "North Carolina"],
  ["ND", "North Dakota"],
  ["OH", "Ohio"],
  ["OK", "Oklahoma"],
  ["OR", "Oregon"],
  ["PA", "Pennsylvania"],
  ["RI", "Rhode Island"],
  ["SC", "South Carolina"],
  ["SD", "South Dakota"],
  ["TN", "Tennessee"],
  ["TX", "Texas"],
  ["UT", "Utah"],
  ["VT", "Vermont"],
  ["VA", "Virginia"],
  ["WA", "Washington"],
  ["WV", "West Virginia"],
  ["WI", "Wisconsin"],
  ["WY", "Wyoming"],
] as const;

const FAQS: { q: string; a: string }[] = [
  {
    q: "How do I sell my car to My Car?",
    a: "Enter your license plate, VIN or vehicle details and complete the short request. Our team reviews the information and contacts you about valuation and next steps.",
  },
  {
    q: "Can I sell my car without buying a vehicle from My Car?",
    a: "You can select Sell My Vehicle without choosing a replacement. Our team will review the request and discuss available options.",
  },
  {
    q: "How do I trade in my current vehicle?",
    a: "Select Trade My Vehicle, provide details about your current car and optionally choose a vehicle from our available inventory. We will review the trade-in information with you.",
  },
  {
    q: "How is the value of my car determined?",
    a: "An offer may take into account the vehicle's year, make, model, trim, mileage, condition, title status, market demand and an inspection. The online form requests information; it does not generate an automated guaranteed offer.",
  },
  {
    q: "What documents do I need to sell or trade my car?",
    a: "Typically, you'll need valid identification, registration, title or lender information if financed, and any keys or relevant records. Our team will confirm which documents apply to your situation.",
  },
  {
    q: "Can I sell my car if I still owe money on it?",
    a: "You can still submit a request for a financed vehicle. Provide the title/lien information; our team can review the payoff situation and explain your options.",
  },
  {
    q: "Can I trade in a vehicle with negative equity?",
    a: "You can request a trade-in review even if your payoff may be higher than the vehicle's value. Whether a deal is possible depends on your vehicle, lender payoff and financing terms.",
  },
  {
    q: "Will you buy my vehicle if it has damage or high mileage?",
    a: "You're welcome to submit the vehicle details and accurately describe its condition. Our team will determine whether an offer is possible.",
  },
  {
    q: "Is the offer guaranteed from the information I enter?",
    a: "No. A submitted request is not an instant binding offer. Final figures, if offered, may depend on verification of vehicle information, title and condition.",
  },
  {
    q: "How and when would I get paid?",
    a: "Payment method and timing depend on the agreed transaction and verification of ownership or lien payoff. Our team will explain the process before you finalize.",
  },
  {
    q: "Can I use my trade-in toward any vehicle in My Car inventory?",
    a: "You can browse available inventory and select cars you like while submitting your trade request. Availability, vehicle pricing and deal terms are confirmed by the team.",
  },
];

function digits(value: string, max?: number) {
  const s = value.replace(/\D/g, "");
  return max ? s.slice(0, max) : s;
}
function phoneFormat(value: string) {
  const s = digits(value, 10);
  if (s.length <= 3) return s ? `(${s}` : "";
  if (s.length <= 6) return `(${s.slice(0, 3)}) ${s.slice(3)}`;
  return `(${s.slice(0, 3)}) ${s.slice(3, 6)}-${s.slice(6)}`;
}
function vehiclePhoto(vehicle: VehicleWithPhotos) {
  return [...(vehicle.vehicle_photos ?? [])].sort((a, b) => a.position - b.position)[0]?.url;
}
function numeric(text: string) {
  const n = Number(text.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function SellPage() {
  const [entryTab, setEntryTab] = useState<EntryTab>("plate");
  const [plate, setPlate] = useState("");
  const [plateState, setPlateState] = useState("VA");
  const [vin, setVin] = useState("");
  const [heroError, setHeroError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [intent, setIntent] = useState<Intent>("sell");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [ymm, setYmm] = useState("");
  const [mileage, setMileage] = useState("");
  const [zip, setZip] = useState("");
  const [condition, setCondition] = useState("good");
  const [titleStatus, setTitleStatus] = useState("clean");
  const [message, setMessage] = useState("");
  const [photoNames, setPhotoNames] = useState<string[]>([]);
  const [wish, setWish] = useState<WishList>(EMPTY_WISH);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTab, setPickerTab] = useState<PickerTab>("all");
  const [pickerSearch, setPickerSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const leadScope = useRef<HTMLDivElement>(null);

  const { data: allVehicles = [], isLoading: inventoryLoading } = useQuery(allVehiclesQuery());
  const inventory = useMemo(
    () => allVehicles.filter((v) => v.status === "available" || v.status === "pending"),
    [allVehicles],
  );
  const selectedVehicles = useMemo(() => inventory.filter((v) => selectedIds.includes(v.id)), [inventory, selectedIds]);
  const options = useMemo(
    () => ({
      names: [...new Set(inventory.map((v) => `${v.make} ${v.model}`))].sort(),
      bodies: [...new Set(inventory.map((v) => v.body_style).filter((v): v is string => Boolean(v)))].sort(),
    }),
    [inventory],
  );
  const matchingVehicles = useMemo(
    () =>
      inventory.filter((v) => {
        const has = Object.values(wish).some(Boolean);
        if (!has) return false;
        if (
          wish.makeModel &&
          !`${v.make} ${v.model} ${v.trim ?? ""}`.toLowerCase().includes(wish.makeModel.toLowerCase())
        )
          return false;
        if (wish.minYear && v.year < numeric(wish.minYear)) return false;
        if (wish.maxPrice && Number(v.price_cents) / 100 > numeric(wish.maxPrice)) return false;
        if (wish.maxMileage && v.mileage > numeric(wish.maxMileage)) return false;
        if (wish.bodyType && !(v.body_style ?? "").toLowerCase().includes(wish.bodyType.toLowerCase())) return false;
        return true;
      }),
    [inventory, wish],
  );
  const pickerVehicles = useMemo(() => {
    const source = pickerTab === "matching" ? matchingVehicles : inventory;
    const q = pickerSearch.trim().toLowerCase();
    return !q
      ? source
      : source.filter((v) =>
          [v.year, v.make, v.model, v.trim, v.vin, v.stock_number].join(" ").toLowerCase().includes(q),
        );
  }, [pickerTab, pickerSearch, inventory, matchingVehicles]);

  // Keep the established LeadForm's contact fields in sync without replacing its API/submission pipeline.
  useEffect(() => {
    if (!formOpen) return;
    const scope = leadScope.current;
    if (!scope) return;
    const contacts = [
      { label: "Full name", value: customerName },
      { label: "Email", value: customerEmail },
      { label: "Phone", value: phoneFormat(customerPhone) },
    ];
    contacts.forEach(({ label, value }) => {
      const labelNode = Array.from(scope.querySelectorAll("label"))
        .filter((el) => el.textContent?.trim().toLowerCase() === label.toLowerCase())
        .at(-1);
      if (!labelNode) return;
      const fieldId = labelNode.getAttribute("for");
      const field = fieldId
        ? scope.querySelector<HTMLInputElement | HTMLTextAreaElement>(`#${CSS.escape(fieldId)}`)
        : labelNode.parentElement?.querySelector<HTMLInputElement | HTMLTextAreaElement>("input,textarea");
      if (field && field.value !== value) {
        const proto = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(field, value);
        field.dispatchEvent(new Event("input", { bubbles: true }));
        field.dispatchEvent(new Event("change", { bubbles: true }));
      }
      if (labelNode.parentElement) labelNode.parentElement.style.display = "none";
    });
  }, [formOpen, customerName, customerEmail, customerPhone]);

  function startOffer(nextIntent: Intent = "sell") {
    setIntent(nextIntent);
    setHeroError("");
    setFormOpen(true);
  }
  function submitHero(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (entryTab === "plate" && (!plate.trim() || !plateState)) {
      setHeroError("Enter your license plate and state to continue.");
      return;
    }
    if (entryTab === "vin" && !/^[A-HJ-NPR-Z0-9]{17}$/.test(vin.trim().toUpperCase())) {
      setHeroError("Enter a valid 17-character VIN to continue.");
      return;
    }
    startOffer("sell");
  }
  function toggleVehicle(id: string) {
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((v) => v !== id) : [...ids, id]));
  }

  return (
    <main className="min-h-screen bg-white text-[#133656]">
      {/* Shared site header/footer are provided by the app layout. */}
      <section className="bg-[#10385d] text-white">
        <div className="mx-auto grid max-w-[1100px] items-center gap-10 px-5 py-12 sm:px-8 md:grid-cols-[1fr_420px] md:gap-16 md:py-14 lg:px-12">
          <div className="mx-auto w-full max-w-md md:mx-0">
            <h1 className="font-display text-[clamp(2.25rem,4.5vw,3.65rem)] font-extrabold uppercase leading-[0.99] tracking-[-0.035em]">
              Get an offer for your car in minutes
            </h1>
            <p className="mt-5 text-base leading-6 text-white/95">
              Sell or trade your car 100% online.
              <br />
              No guesswork. Clear next steps.
            </p>
          </div>
          <form
            onSubmit={submitHero}
            className="rounded-[14px] bg-white p-5 text-[#173552] shadow-[0_18px_45px_rgba(0,0,0,0.12)] sm:p-6"
          >
            <div
              className="grid grid-cols-2 border-b border-slate-200"
              role="tablist"
              aria-label="Vehicle identification"
            >
              <button
                type="button"
                role="tab"
                aria-selected={entryTab === "plate"}
                onClick={() => {
                  setEntryTab("plate");
                  setHeroError("");
                }}
                className={`border-b-2 pb-3 text-sm font-semibold transition ${entryTab === "plate" ? "border-[#0872cf] text-[#153c61]" : "border-transparent text-slate-500 hover:text-[#153c61]"}`}
              >
                License Plate
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={entryTab === "vin"}
                onClick={() => {
                  setEntryTab("vin");
                  setHeroError("");
                }}
                className={`border-b-2 pb-3 text-sm font-semibold transition ${entryTab === "vin" ? "border-[#0872cf] text-[#153c61]" : "border-transparent text-slate-500 hover:text-[#153c61]"}`}
              >
                VIN
              </button>
            </div>
            {entryTab === "plate" ? (
              <div className="mt-5 grid grid-cols-[minmax(0,1fr)_112px] gap-2">
                <Input
                  aria-label="License plate"
                  autoComplete="off"
                  value={plate}
                  onChange={(e) =>
                    setPlate(
                      e.target.value
                        .toUpperCase()
                        .replace(/[^A-Z0-9 -]/g, "")
                        .slice(0, 12),
                    )
                  }
                  placeholder="License Plate"
                  className="h-12 rounded-md border-slate-300 text-sm"
                />
                <Select value={plateState} onValueChange={setPlateState}>
                  <SelectTrigger aria-label="Plate state" className="h-12 rounded-md border-slate-300 text-sm">
                    <SelectValue placeholder="State" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {US_STATES.map(([code, name]) => (
                      <SelectItem key={code} value={code}>
                        {code} — {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="mt-5">
                <Input
                  aria-label="Vehicle identification number"
                  value={vin}
                  onChange={(e) =>
                    setVin(
                      e.target.value
                        .toUpperCase()
                        .replace(/[^A-HJ-NPR-Z0-9]/g, "")
                        .slice(0, 17),
                    )
                  }
                  placeholder="Enter 17-character VIN"
                  maxLength={17}
                  className="h-12 rounded-md border-slate-300 text-sm"
                />
                <p className="mt-1.5 text-xs text-slate-500">{vin.length}/17 characters</p>
              </div>
            )}
            {heroError && (
              <p role="alert" className="mt-2 text-xs font-medium text-red-600">
                {heroError}
              </p>
            )}
            <Button
              type="submit"
              className="mt-4 h-12 w-full rounded-full bg-[#0969c5] text-sm font-bold text-white hover:bg-[#0756a2]"
            >
              Get My Offer <ArrowRight className="ml-2 size-4" />
            </Button>
            <p className="mt-3 text-center text-[11px] leading-4 text-slate-500">
              No instant quote is generated. Our team reviews your request.
            </p>
          </form>
        </div>
      </section>

      <div className="mx-auto max-w-[1020px] px-5 pb-20 pt-9 sm:px-8 lg:px-12">
        {/* Value tracker-style secondary conversion */}
        <section className="grid items-center gap-5 rounded-xl bg-[#f3f6f9] p-5 sm:grid-cols-[130px_1fr_auto] sm:gap-7 sm:px-8 sm:py-5">
          <div className="relative mx-auto flex h-[94px] w-[130px] items-center justify-center rounded-2xl bg-gradient-to-br from-[#e1f1ff] to-white">
            <CarFront className="size-[76px] text-[#1d6fac]" strokeWidth={1.3} />
            <TrendingUp className="absolute -right-1 top-1 size-6 text-[#1499e7]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-sm font-bold text-[#136bac]">
              <TrendingUp className="size-5" /> Vehicle Value
            </div>
            <h2 className="mt-1 text-lg font-bold leading-6 text-[#173552] sm:text-xl">
              Wondering what your car is worth?
            </h2>
            <p className="mt-2 text-xs leading-5 text-slate-600">
              Not ready to sell? Start with your vehicle details and explore your options.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => startOffer("sell")}
            className="rounded-full border-[#123f68] bg-transparent px-5 text-[#123f68] hover:bg-[#e3edf6]"
          >
            Request My Value
          </Button>
        </section>

        {/* Carvana-like, minimalist three-step process */}
        <section className="pt-16 sm:pt-20">
          <h2 className="text-2xl font-bold tracking-tight">How it works</h2>
          <p className="mt-2 text-sm text-slate-500">Start selling or trading in three simple steps.</p>
          <div className="mt-9 grid gap-9 md:grid-cols-3 md:gap-8">
            {[
              {
                Icon: BadgeDollarSign,
                title: "Get your offer",
                description: "Share a few details about your vehicle so our team can review your request.",
              },
              {
                Icon: Handshake,
                title: "Sell or trade",
                description: "Sell your current vehicle or explore a trade toward one from our inventory.",
              },
              {
                Icon: Banknote,
                title: "Complete the deal",
                description: "Review the details with our team and finalize an agreed transaction.",
              },
            ].map(({ Icon, title, description }) => (
              <div key={title} className="flex items-start gap-4">
                <Icon className="mt-0.5 size-8 shrink-0 text-[#1495ec]" strokeWidth={1.5} />
                <div>
                  <h3 className="text-sm font-bold">{title}</h3>
                  <p className="mt-2 text-xs leading-5 text-slate-500">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Frequently asked questions */}
        <section className="mt-20 grid gap-9 md:grid-cols-[0.75fr_1.25fr] md:gap-14" id="sell-faq">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Frequently asked questions</h2>
            <p className="mt-3 max-w-xs text-sm leading-6 text-slate-500">
              Have questions about selling or trading your car? We’ve got you covered.
            </p>
            <a
              href="mailto:socials@mycarcorp.com?subject=Sell%20or%20Trade%20Question"
              className="mt-5 inline-flex min-h-9 items-center justify-center rounded-full border border-[#174368] px-4 text-xs font-semibold transition hover:bg-slate-50"
            >
              Ask Us a Question
            </a>
          </div>
          <div className="border-t border-slate-200">
            {FAQS.map(({ q, a }, index) => (
              <div key={q} className="border-b border-slate-200">
                <button
                  type="button"
                  aria-expanded={openFaq === index}
                  onClick={() => setOpenFaq((current) => (current === index ? null : index))}
                  className="flex w-full items-center justify-between gap-5 py-4 text-left text-[13px] font-semibold leading-5 transition hover:text-[#0969c5]"
                >
                  <span>{q}</span>
                  {openFaq === index ? <Minus className="size-4 shrink-0" /> : <Plus className="size-4 shrink-0" />}
                </button>
                {openFaq === index && <p className="pb-5 pr-7 text-[13px] leading-6 text-slate-600">{a}</p>}
              </div>
            ))}
          </div>
        </section>

        {/* Bottom promotional CTA */}
        <section className="mt-20 overflow-hidden rounded-xl bg-[#10385d] text-white sm:grid sm:grid-cols-2">
          <div className="flex flex-col items-start justify-center px-7 py-10 sm:px-9 sm:py-12">
            <h2 className="text-xl font-bold sm:text-2xl">Trade in and move into your next car</h2>
            <p className="mt-3 max-w-sm text-xs leading-5 text-white/85">
              Find the vehicle you want, then let My Car review your current vehicle as a possible trade-in.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => startOffer("trade")}
              className="mt-6 rounded-full border-white bg-transparent text-white hover:bg-white hover:text-[#10385d]"
            >
              Get Started <ArrowRight className="ml-2 size-4" />
            </Button>
          </div>
          <div className="relative min-h-[220px] bg-gradient-to-br from-[#b8d8ee] to-[#e9f3fa]">
            <img
              src="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1000&q=85"
              alt="Friends enjoying time together"
              className="absolute inset-0 size-full object-cover"
              loading="lazy"
            />
          </div>
        </section>
      </div>

      {/* The short hero entry continues into the EXISTING LeadForm submission, not a fabricated instant valuation. */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="flex max-h-[94dvh] w-[calc(100%-1.5rem)] max-w-4xl flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:w-full">
          <DialogHeader className="border-b border-slate-200 bg-white px-5 py-4 text-left sm:px-7">
            <DialogTitle className="text-xl font-bold text-[#12385c]">
              Request Your {intent === "trade" ? "Trade-In" : "Vehicle"} Offer
            </DialogTitle>
            <DialogDescription className="mt-1 text-sm">
              Complete your details so the My Car team can review your vehicle.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 overflow-y-auto bg-[#f7f9fb] px-4 py-5 sm:px-7">
            <div
              ref={leadScope}
              className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 [&_button[type=submit]]:!bg-[#0969c5] [&_button[type=submit]]:!text-white [&_button[type=submit]]:!rounded-full"
            >
              <LeadForm
                leadType="trade"
                submitLabel={intent === "trade" ? "Request My Trade-In Offer" : "Request My Offer"}
                successTitle="Your request has been received"
                successBody="Our team will review your vehicle information and follow up with next steps."
                messageLabel="Damage, service history, or anything else we should know"
                collectDetails={() => ({
                  customer_name: customerName,
                  customer_email: customerEmail,
                  customer_phone: phoneFormat(customerPhone),
                  customer_address: customerAddress,
                  lead_type: intent === "trade" ? "trade" : "sell",
                  intent,
                  vin,
                  plate,
                  license_state: plateState,
                  year_make_model: ymm,
                  mileage,
                  zip,
                  condition,
                  title_status: titleStatus,
                  additional_vehicle_information: message,
                  customer_wish_list: intent === "trade" ? JSON.stringify(wish) : "",
                  selected_vehicle_ids: intent === "trade" ? selectedIds.join(",") : "",
                  selected_vehicles:
                    intent === "trade"
                      ? JSON.stringify(
                          selectedVehicles.map((v) => ({
                            id: v.id,
                            title: vehicleTitle(v),
                            stock_number: v.stock_number,
                            vin: v.vin,
                            price_cents: v.price_cents,
                          })),
                        )
                      : "",
                  vehicle_photo_names: photoNames.join(","),
                  lead_source: "mycarcorp.com",
                  lead_page: "/sell",
                })}
              >
                <div className="space-y-6">
                  <div
                    className="grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1"
                    role="group"
                    aria-label="Sell or trade"
                  >
                    <button
                      type="button"
                      onClick={() => setIntent("sell")}
                      className={`min-h-11 rounded-md px-3 text-sm font-semibold transition ${intent === "sell" ? "bg-white text-[#0969c5] shadow" : "text-slate-600"}`}
                    >
                      Sell My Vehicle
                    </button>
                    <button
                      type="button"
                      onClick={() => setIntent("trade")}
                      className={`min-h-11 rounded-md px-3 text-sm font-semibold transition ${intent === "trade" ? "bg-white text-[#0969c5] shadow" : "text-slate-600"}`}
                    >
                      Trade My Vehicle
                    </button>
                  </div>
                  <div>
                    <h3 className="mb-4 border-b border-slate-100 pb-2 text-sm font-bold text-[#12385c]">
                      Your Contact Information
                    </h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Full Name" htmlFor="sell-fullname">
                        <Input
                          id="sell-fullname"
                          autoComplete="name"
                          required
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          placeholder="First and last name"
                        />
                      </Field>
                      <Field label="Email" htmlFor="sell-email">
                        <Input
                          id="sell-email"
                          type="email"
                          autoComplete="email"
                          required
                          value={customerEmail}
                          onChange={(e) => setCustomerEmail(e.target.value)}
                          placeholder="name@example.com"
                        />
                      </Field>
                      <Field label="Phone" htmlFor="sell-phone">
                        <Input
                          id="sell-phone"
                          autoComplete="tel"
                          type="tel"
                          required
                          value={phoneFormat(customerPhone)}
                          onChange={(e) => setCustomerPhone(digits(e.target.value, 10))}
                          placeholder="(555) 123-4567"
                        />
                      </Field>
                      <Field label="Address" htmlFor="sell-address">
                        <Input
                          id="sell-address"
                          autoComplete="street-address"
                          value={customerAddress}
                          onChange={(e) => setCustomerAddress(e.target.value)}
                          placeholder="Street, city, state"
                        />
                      </Field>
                    </div>
                  </div>
                  <div>
                    <h3 className="mb-4 border-b border-slate-100 pb-2 text-sm font-bold text-[#12385c]">
                      Your Vehicle
                    </h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="VIN (if available)" htmlFor="sell-vin">
                        <Input
                          id="sell-vin"
                          value={vin}
                          maxLength={17}
                          onChange={(e) =>
                            setVin(
                              e.target.value
                                .toUpperCase()
                                .replace(/[^A-HJ-NPR-Z0-9]/g, "")
                                .slice(0, 17),
                            )
                          }
                          placeholder="17-character VIN"
                        />
                      </Field>
                      <div className="grid grid-cols-[1fr_108px] gap-2">
                        <Field label="License Plate" htmlFor="sell-plate">
                          <Input
                            id="sell-plate"
                            value={plate}
                            onChange={(e) => setPlate(e.target.value.toUpperCase())}
                            placeholder="Plate"
                          />
                        </Field>
                        <div className="space-y-1.5">
                          <Label>State</Label>
                          <Select value={plateState} onValueChange={setPlateState}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="max-h-56">
                              {US_STATES.map(([code, name]) => (
                                <SelectItem key={code} value={code}>
                                  {code} — {name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="sm:col-span-2">
                        <Field label="Or Year, Make, Model and Trim" htmlFor="sell-ymm">
                          <Input
                            id="sell-ymm"
                            required={!vin.trim() && !plate.trim()}
                            value={ymm}
                            onChange={(e) => setYmm(e.target.value)}
                            placeholder="2019 Toyota RAV4 XLE"
                          />
                        </Field>
                      </div>
                      <Field label="Mileage" htmlFor="sell-mileage">
                        <Input
                          id="sell-mileage"
                          inputMode="numeric"
                          required
                          value={mileage}
                          onChange={(e) => setMileage(digits(e.target.value))}
                          placeholder="e.g. 65000"
                        />
                      </Field>
                      <Field label="ZIP Code" htmlFor="sell-zip">
                        <Input
                          id="sell-zip"
                          inputMode="numeric"
                          maxLength={5}
                          required
                          value={zip}
                          onChange={(e) => setZip(digits(e.target.value, 5))}
                          placeholder="22407"
                        />
                      </Field>
                      <Choice
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
                      <Choice
                        label="Title Status"
                        value={titleStatus}
                        onChange={setTitleStatus}
                        options={[
                          ["clean", "Clean, in Hand"],
                          ["lien", "Lien / Loan Payoff"],
                          ["salvage", "Salvage or Rebuilt"],
                          ["lost", "Lost Title"],
                        ]}
                      />
                    </div>
                    <div className="mt-4">
                      <Field label="Additional vehicle information" htmlFor="sell-message">
                        <Textarea
                          id="sell-message"
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          rows={3}
                          placeholder="Damage, service history, accident history or anything we should know"
                        />
                      </Field>
                    </div>
                    <div className="mt-4">
                      <Label htmlFor="sell-photos" className="text-sm">
                        Vehicle photos (optional)
                      </Label>
                      <label
                        htmlFor="sell-photos"
                        className="mt-2 flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-center hover:border-[#0969c5]"
                      >
                        <ImagePlus className="size-7 text-[#0969c5]" />
                        <span className="mt-2 text-xs font-semibold">Choose vehicle photos</span>
                        <span className="mt-1 text-[11px] text-slate-500">
                          JPG or PNG. Photo names are recorded; files are not uploaded by this form.
                        </span>
                        <input
                          id="sell-photos"
                          type="file"
                          accept="image/jpeg,image/png"
                          multiple
                          className="sr-only"
                          onChange={(e) => setPhotoNames(Array.from(e.target.files ?? []).map((f) => f.name))}
                        />
                      </label>
                      {photoNames.length > 0 && (
                        <p className="mt-2 text-xs text-slate-500">Selected: {photoNames.join(", ")}</p>
                      )}
                    </div>
                  </div>
                  {intent === "trade" && (
                    <div className="space-y-4 rounded-xl border border-[#c9deee] bg-[#f4f9fe] p-4">
                      <div>
                        <h3 className="text-sm font-bold text-[#12385c]">What are you looking for next?</h3>
                        <p className="mt-1 text-xs text-slate-500">
                          Optional — explore My Car's actual available inventory.
                        </p>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <Field label="Make or Model" htmlFor="trade-make">
                          <Input
                            id="trade-make"
                            list="sell-trade-models"
                            value={wish.makeModel}
                            onChange={(e) => setWish((w) => ({ ...w, makeModel: e.target.value }))}
                            placeholder="Any make or model"
                          />
                          <datalist id="sell-trade-models">
                            {options.names.map((n) => (
                              <option key={n} value={n} />
                            ))}
                          </datalist>
                        </Field>
                        <Field label="Year or newer" htmlFor="trade-year">
                          <Input
                            id="trade-year"
                            inputMode="numeric"
                            value={wish.minYear}
                            onChange={(e) => setWish((w) => ({ ...w, minYear: digits(e.target.value, 4) }))}
                            placeholder="Any year"
                          />
                        </Field>
                        <Field label="Max Price" htmlFor="trade-price">
                          <Input
                            id="trade-price"
                            inputMode="numeric"
                            value={wish.maxPrice}
                            onChange={(e) => setWish((w) => ({ ...w, maxPrice: e.target.value }))}
                            placeholder="Any price"
                          />
                        </Field>
                        <Field label="Max Mileage" htmlFor="trade-miles">
                          <Input
                            id="trade-miles"
                            inputMode="numeric"
                            value={wish.maxMileage}
                            onChange={(e) => setWish((w) => ({ ...w, maxMileage: e.target.value }))}
                            placeholder="Any mileage"
                          />
                        </Field>
                        <Field label="Body Type" htmlFor="trade-body">
                          <Input
                            id="trade-body"
                            list="sell-trade-bodies"
                            value={wish.bodyType}
                            onChange={(e) => setWish((w) => ({ ...w, bodyType: e.target.value }))}
                            placeholder="Any body style"
                          />
                          <datalist id="sell-trade-bodies">
                            {options.bodies.map((n) => (
                              <option key={n} value={n} />
                            ))}
                          </datalist>
                        </Field>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setPickerTab("matching");
                            setPickerSearch("");
                            setPickerOpen(true);
                          }}
                          className="rounded-full border-[#0969c5] text-[#0969c5]"
                        >
                          <Search className="mr-2 size-4" /> Find Matching Vehicles ({matchingVehicles.length})
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => {
                            setPickerTab("all");
                            setPickerSearch("");
                            setPickerOpen(true);
                          }}
                          className="text-[#0969c5]"
                        >
                          Browse All Inventory <ArrowRight className="ml-1 size-4" />
                        </Button>
                      </div>
                      {selectedVehicles.length > 0 && (
                        <div className="grid gap-2 sm:grid-cols-2">
                          {selectedVehicles.map((v) => (
                            <div
                              key={v.id}
                              className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-2"
                            >
                              {vehiclePhoto(v) ? (
                                <img
                                  src={vehiclePhoto(v)}
                                  alt={vehicleTitle(v)}
                                  className="h-16 w-24 rounded object-cover"
                                />
                              ) : (
                                <div className="flex h-16 w-24 items-center justify-center bg-slate-100">
                                  <CarFront />
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-bold">{vehicleTitle(v)}</p>
                                <p className="text-xs text-slate-600">{formatUsd(Number(v.price_cents))}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => toggleVehicle(v.id)}
                                aria-label={`Remove ${vehicleTitle(v)}`}
                                className="rounded-md p-1 hover:bg-slate-100"
                              >
                                <X className="size-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  <p className="text-[11px] leading-5 text-slate-500">
                    Submitting does not guarantee an offer. Vehicle details and any final valuation are subject to
                    review and verification.
                  </p>
                </div>
              </LeadForm>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="flex max-h-[85dvh] max-w-4xl flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b p-5 text-left">
            <DialogTitle>Choose Vehicles From My Car Inventory</DialogTitle>
            <DialogDescription>Select any vehicles you may want to trade toward.</DialogDescription>
          </DialogHeader>
          <div className="border-b p-4">
            <div className="mb-3 flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={pickerTab === "matching" ? "default" : "outline"}
                onClick={() => setPickerTab("matching")}
              >
                Matching ({matchingVehicles.length})
              </Button>
              <Button
                type="button"
                size="sm"
                variant={pickerTab === "all" ? "default" : "outline"}
                onClick={() => setPickerTab("all")}
              >
                All Vehicles ({inventory.length})
              </Button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                placeholder="Search make, model, VIN or stock number"
                className="pl-9"
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {inventoryLoading ? (
              <p className="py-12 text-center text-sm text-slate-500">Loading inventory...</p>
            ) : pickerVehicles.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-500">
                No vehicles matched. Try All Vehicles or update your preferences.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {pickerVehicles.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => toggleVehicle(v.id)}
                    className={`flex gap-3 rounded-lg border p-2 text-left transition hover:border-[#0969c5] ${selectedIds.includes(v.id) ? "border-[#0969c5] bg-blue-50" : "border-slate-200"}`}
                  >
                    {vehiclePhoto(v) ? (
                      <img
                        src={vehiclePhoto(v)}
                        alt={vehicleTitle(v)}
                        className="h-24 w-32 shrink-0 rounded-md object-cover"
                      />
                    ) : (
                      <div className="flex h-24 w-32 shrink-0 items-center justify-center bg-slate-100">
                        <Camera className="size-6" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-bold">{vehicleTitle(v)}</span>
                        <span
                          className={`flex size-5 shrink-0 items-center justify-center rounded border ${selectedIds.includes(v.id) ? "border-[#0969c5] bg-[#0969c5] text-white" : "border-slate-300"}`}
                        >
                          {selectedIds.includes(v.id) && <Check className="size-4" />}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-bold text-[#0969c5]">{formatUsd(Number(v.price_cents))}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatMiles(v.mileage)} · Stock {v.stock_number}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center justify-between border-t bg-slate-50 p-4">
            <span className="text-sm text-slate-600">{selectedIds.length} selected</span>
            <Button type="button" className="rounded-full" onClick={() => setPickerOpen(false)}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-xs font-medium text-slate-700">
        {label}
      </Label>
      {children}
    </div>
  );
}
function Choice({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[][];
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-slate-700">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(([val, text]) => (
            <SelectItem key={val} value={val}>
              {text}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
