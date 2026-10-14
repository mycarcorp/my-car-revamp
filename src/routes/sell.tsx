import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Calculator,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Copy,
  Fuel,
  Gauge,
  Heart,
  Images,
  Info,
  Mail,
  MapPin,
  Maximize2,
  Phone,
  Search,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  Tag,
  X,
  CarFront,
  CreditCard,
  CalendarDays,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LeadForm } from "@/components/LeadForm";
import { formatMiles, formatUsd, monthlyPayment, vehicleTitle } from "@/lib/format";
import { allVehiclesQuery, siteSettingsQuery, type VehicleWithPhotos } from "@/lib/queries";

export const Route = createFileRoute("/inventory/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `Vehicle Details | My Car — Fredericksburg, VA` },
      {
        name: "description",
        content:
          "See actual vehicle photographs, equipment, specifications, pricing and availability at My Car in Fredericksburg, Virginia.",
      },
      { property: "og:type", content: "product" },
    ],
    links: [{ rel: "canonical", href: `https://mycarcorp.com/inventory/${encodeURIComponent(params.slug)}` }],
  }),
  component: VehicleDetailsPage,
});

type Tab = "overview" | "features" | "details" | "pricing" | "reviews" | "inspection" | "more";
type Media = { url: string; video: boolean; alt: string };
type Inquiry = "availability" | "question";
const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "features", label: "Features" },
  { id: "details", label: "Vehicle Details" },
  { id: "pricing", label: "Pricing" },
  { id: "reviews", label: "Reviews" },
  { id: "inspection", label: "Inspection" },
  { id: "more", label: "More Cars" },
];
const PHONE = "(540) 426-3322";
const PHONE_LINK = "tel:+15404263322";
const SAVED_KEY = "mycar-saved-vehicles";
const s = (v: unknown): string => (v == null ? "" : String(v));
const words = (v: unknown) => s(v).trim();
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
function getMedia(vehicle: VehicleWithPhotos): Media[] {
  const raw = obj(vehicle);
  const entries: unknown[] = [];
  for (const field of ["vehicle_photos", "photos", "images", "gallery", "vehicle_images"]) {
    if (Array.isArray(raw[field])) entries.push(...(raw[field] as unknown[]));
  }
  for (const field of ["primary_photo_url", "primary_image_url", "image_url", "photo_url", "cover_image_url"]) {
    if (raw[field]) entries.push(raw[field]);
  }
  entries.sort(
    (a, b) => Number(obj(a).position ?? obj(a).sort_order ?? 999) - Number(obj(b).position ?? obj(b).sort_order ?? 999),
  );
  const seen = new Set<string>();
  return entries.flatMap((item) => {
    const data = obj(item);
    let url =
      typeof item === "string"
        ? item
        : words(data.url ?? data.photo_url ?? data.image_url ?? data.public_url ?? data.src);
    if (!url || /^javascript:|^data:/i.test(url)) return [];
    if (url.startsWith("//")) url = `https:${url}`;
    else if (!/^https?:\/\//i.test(url) && !url.startsWith("/")) url = `/${url}`;
    if (seen.has(url)) return [];
    seen.add(url);
    return [
      {
        url,
        video: /\.(mp4|webm|mov)(\?|$)/i.test(url),
        alt: words(data.alt ?? data.alt_text) || vehicleTitle(vehicle),
      },
    ];
  });
}
function num(v: unknown, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function cash(v: number) {
  return formatUsd(Math.max(0, Math.round(v)));
}
function getSaved(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(SAVED_KEY) || "[]");
    return Array.isArray(value) ? value.map(String) : [];
  } catch {
    return [];
  }
}
function Spec({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-200 py-3 text-sm">
      <dt className="text-slate-500">{label}</dt>
      <dd className="max-w-[65%] text-right font-semibold text-[#142f4c]">{words(value) || "—"}</dd>
    </div>
  );
}
function VehicleDetailsPage() {
  const { slug } = Route.useParams();
  const { data: vehicles = [], isLoading, isError } = useQuery(allVehiclesQuery());
  const { data: settings } = useQuery(siteSettingsQuery());
  const vehicle = useMemo(() => vehicles.find((v) => v.slug === slug), [vehicles, slug]);
  const media = useMemo(() => (vehicle ? getMedia(vehicle) : []), [vehicle]);
  const images = useMemo(() => media.filter((m) => !m.video), [media]);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryTab, setGalleryTab] = useState<"all" | "exterior" | "interior">("all");
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [saved, setSaved] = useState(false);
  const [inquiry, setInquiry] = useState<Inquiry | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [downPayment, setDownPayment] = useState(0);
  const [term, setTerm] = useState(72);
  const [apr, setApr] = useState(8.9);
  const [copied, setCopied] = useState(false);
  const [brokenImages, setBrokenImages] = useState<string[]>([]);
  const formRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const sections = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    setPhotoIndex(0);
    setActiveTab("overview");
    setBrokenImages([]);
  }, [slug]);
  useEffect(() => {
    if (vehicle) setSaved(getSaved().includes(String(vehicle.id)));
  }, [vehicle?.id]);
  useEffect(() => {
    if (!settings) return;
    const fromSite = num(settings.finance_apr, 8.9);
    if (fromSite >= 0 && fromSite <= 40) setApr(fromSite);
    setTerm(Math.max(12, Math.min(96, num(settings.finance_term_months, 72))));
  }, [settings]);
  useEffect(() => {
    if (!inquiry || !formRef.current) return;
    const scope = formRef.current;
    for (const [label, value] of [
      ["Full name", name],
      ["Email", email],
      ["Phone", phone],
    ]) {
      const target = Array.from(scope.querySelectorAll("label")).find(
        (el) => el.textContent?.trim().toLowerCase() === label.toLowerCase(),
      );
      if (!target) continue;
      const id = target.getAttribute("for");
      const input = id
        ? (document.getElementById(id) as HTMLInputElement | null)
        : (target.parentElement?.querySelector("input") as HTMLInputElement | null);
      if (input && input.value !== value) {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
      if (target.parentElement) (target.parentElement as HTMLElement).style.display = "none";
    }
  }, [inquiry, name, email, phone]);

  useEffect(() => {
    if (!galleryOpen) return;
    const key = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") setPhotoIndex((i) => (images.length ? (i + 1) % images.length : 0));
      if (event.key === "ArrowLeft")
        setPhotoIndex((i) => (images.length ? (i - 1 + images.length) % images.length : 0));
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [galleryOpen, images.length]);

  useEffect(() => {
    const watcher = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActiveTab(visible.target.id.replace("vdp-", "") as Tab);
      },
      { rootMargin: "-135px 0px -52% 0px", threshold: [0, 0.1, 0.4] },
    );
    for (const el of Object.values(sections.current)) if (el) watcher.observe(el);
    return () => watcher.disconnect();
  }, [vehicle?.id]);

  function navigateTab(tab: Tab) {
    setActiveTab(tab);
    const el = sections.current[tab];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function toggleSaved() {
    if (!vehicle) return;
    const id = String(vehicle.id);
    const previous = getSaved();
    const next = previous.includes(id) ? previous.filter((x) => x !== id) : [...previous, id];
    localStorage.setItem(SAVED_KEY, JSON.stringify(next));
    setSaved(next.includes(id));
    window.dispatchEvent(new Event("mycar-favorites-changed"));
  }
  async function share() {
    if (!vehicle) return;
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: vehicleTitle(vehicle), url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2200);
      }
    } catch {
      /* Dismissed share sheet */
    }
  }
  function movePhoto(n: number) {
    setPhotoIndex((i) => (images.length ? (i + n + images.length) % images.length : 0));
  }

  if (isLoading)
    return (
      <main className="mx-auto max-w-7xl px-5 py-24 text-center text-slate-500">Loading vehicle information…</main>
    );
  if (isError || !vehicle)
    return (
      <main className="mx-auto max-w-5xl px-5 py-24 text-center">
        <CarFront className="mx-auto mb-5 size-12 text-slate-400" />
        <h1 className="text-3xl font-bold">Vehicle not found</h1>
        <p className="mt-3 text-slate-500">This vehicle may no longer be listed. Browse our current inventory.</p>
        <Link to="/search" className="mt-6 inline-flex rounded-full bg-[#086ac8] px-7 py-3 font-semibold text-white">
          Browse inventory
        </Link>
      </main>
    );

  const title = vehicleTitle(vehicle);
  const price = num(vehicle.price_cents);
  const oldPrice = num(vehicle.prior_price_cents);
  const discounted = oldPrice > price && price > 0;
  const down = Math.min(price / 100, Math.max(0, downPayment));
  const monthly =
    price > 0
      ? monthlyPayment(price, { apr, termMonths: term, downPercent: price > 0 ? (down * 10000) / price : 0 })
      : 0;
  const features = Array.isArray(vehicle.features) ? vehicle.features.filter(Boolean) : [];
  const specs: [string, unknown][] = [
    ["VIN", vehicle.vin],
    ["Stock number", vehicle.stock_number],
    ["Mileage", formatMiles(vehicle.mileage)],
    ["Body style", vehicle.body_style],
    ["Exterior color", vehicle.exterior_color],
    ["Interior color", vehicle.interior_color],
    ["Transmission", vehicle.transmission],
    ["Drivetrain", vehicle.drivetrain],
    ["Fuel type", vehicle.fuel_type],
    ["Engine", vehicle.engine],
  ];
  const raw = obj(vehicle);
  for (const [label, key] of [
    ["City MPG", "mpg_city"],
    ["Highway MPG", "mpg_highway"],
    ["Combined MPG", "mpg_combined"],
  ]) {
    if (raw[key] !== undefined && raw[key] !== null) specs.push([label, raw[key]]);
  }
  const recommended = vehicles
    .filter((v) => v.id !== vehicle.id && (v.status === "available" || v.status === "pending"))
    .sort((a, b) => Number(a.make !== vehicle.make) - Number(b.make !== vehicle.make))
    .slice(0, 4);
  const galleryImages = images.filter((m) => !brokenImages.includes(m.url));
  const currentImage = galleryImages[Math.min(photoIndex, Math.max(0, galleryImages.length - 1))];

  const photo = (m: Media, className: string, loading: "eager" | "lazy" = "lazy") => (
    <img
      src={m.url}
      alt={m.alt}
      loading={loading}
      onError={() => {
        setBrokenImages((p) => [...p, m.url]);
        setPhotoIndex(0);
      }}
      className={className}
    />
  );

  return (
    <main className="min-h-screen bg-white pb-20 text-[#142f4c] md:pb-0">
      <div className="mx-auto max-w-[1240px] px-4 pb-8 pt-5 sm:px-6 lg:px-10">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Link to="/search" className="hover:text-[#086ac8]">
              Inventory
            </Link>
            <ChevronRight className="size-3" />
            <span className="font-medium text-[#142f4c]">{title}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={share}
              className="inline-flex items-center gap-1 rounded-full border px-3 py-2 hover:bg-slate-50"
            >
              <Share2 className="size-3.5" />
              {copied ? "Copied" : "Share"}
            </button>
            <button
              type="button"
              onClick={toggleSaved}
              className="inline-flex items-center gap-1 rounded-full border px-3 py-2 hover:bg-slate-50"
            >
              <Heart className={`size-3.5 ${saved ? "fill-red-500 text-red-500" : ""}`} />
              {saved ? "Saved" : "Save"}
            </button>
          </div>
        </div>

        {/* Carvana-inspired photography mosaic. Only the photos attached to THIS VIN are used. */}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(310px,0.9fr)] lg:items-start">
          <div className="min-w-0">
            <div className="grid grid-cols-4 grid-rows-2 gap-2 overflow-hidden rounded-2xl bg-[#f1f4f7] sm:h-[430px] lg:h-[490px]">
              <button
                type="button"
                onClick={() => setGalleryOpen(true)}
                className="group relative col-span-4 row-span-2 flex min-h-[290px] items-center justify-center bg-[#f1f4f7] sm:col-span-3"
                aria-label="Open full vehicle photo gallery"
              >
                {currentImage ? (
                  photo(
                    currentImage,
                    "h-full max-h-[490px] w-full object-contain transition-transform duration-500 group-hover:scale-[1.025]",
                    "eager",
                  )
                ) : (
                  <div className="flex flex-col items-center gap-2 text-slate-400">
                    <Camera className="size-12" /> Photos coming soon
                  </div>
                )}
                <span className="absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-full bg-white/95 px-4 py-2 text-xs font-semibold text-[#142f4c] shadow-lg">
                  <Images className="size-4" /> View all {galleryImages.length} photos
                </span>
                {galleryImages.length > 1 && (
                  <span className="absolute bottom-4 right-4 rounded-full bg-white/95 px-3 py-2 text-xs font-semibold">
                    {Math.min(photoIndex + 1, galleryImages.length)} / {galleryImages.length}
                  </span>
                )}
              </button>
              <div className="hidden grid-rows-2 gap-2 sm:grid">
                {galleryImages.slice(1, 3).map((m, i) => (
                  <button
                    key={m.url}
                    type="button"
                    onClick={() => {
                      setPhotoIndex(i + 1);
                      setGalleryOpen(true);
                    }}
                    className="group relative min-h-0 overflow-hidden bg-white"
                  >
                    {photo(m, "h-full w-full object-cover transition-transform duration-500 group-hover:scale-110")}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                disabled={galleryImages.length < 2}
                onClick={() => movePhoto(-1)}
                className="flex size-10 shrink-0 items-center justify-center rounded-full border disabled:opacity-40"
                aria-label="Previous photo"
              >
                <ChevronLeft className="size-5" />
              </button>
              <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: "thin" }}>
                {galleryImages.map((m, i) => (
                  <button
                    type="button"
                    key={m.url}
                    onClick={() => setPhotoIndex(i)}
                    className={`h-16 w-24 shrink-0 overflow-hidden rounded-md border-2 bg-slate-50 transition ${photoIndex === i ? "border-[#086ac8] ring-1 ring-[#086ac8]" : "border-transparent hover:border-slate-300"}`}
                  >
                    {photo(m, "h-full w-full object-cover")}
                  </button>
                ))}
              </div>
              <button
                type="button"
                disabled={galleryImages.length < 2}
                onClick={() => movePhoto(1)}
                className="flex size-10 shrink-0 items-center justify-center rounded-full border disabled:opacity-40"
                aria-label="Next photo"
              >
                <ChevronRight className="size-5" />
              </button>
            </div>
          </div>

          {/* Desktop booking and pricing card */}
          <aside className="hidden lg:block lg:sticky lg:top-24">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_10px_35px_rgba(15,40,65,0.07)]">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="rounded-full bg-blue-50 px-3 py-1 text-[11px] font-bold text-[#086ac8]">
                  {vehicle.status === "pending" ? "Sale pending" : "Available inventory"}
                </span>
                {discounted && (
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700">
                    Price reduced
                  </span>
                )}
              </div>
              <h1 className="mt-4 text-[26px] font-extrabold leading-8 tracking-tight">{title}</h1>
              <p className="mt-1 text-sm text-slate-500">
                {formatMiles(vehicle.mileage)} · Stock #{vehicle.stock_number}
              </p>
              <div className="mt-5 flex items-end gap-3">
                <strong className="text-4xl font-extrabold tracking-tight">{cash(price)}</strong>
                {discounted && <span className="pb-1 text-base text-slate-400 line-through">{cash(oldPrice)}</span>}
              </div>
              {price > 0 && (
                <div className="mt-4 rounded-lg bg-[#f0f5fa] p-3">
                  <p className="text-[13px] font-bold text-[#164a7a]">Est. {cash(monthly * 100)}/mo</p>
                  <p className="mt-1 text-[10px] leading-4 text-slate-500">
                    Illustrative estimate at {apr}% APR for {term} months with {cash(down * 100)} down. Excludes taxes
                    and fees. Not an offer or credit approval.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigateTab("pricing")}
                    className="mt-1 text-xs font-bold text-[#086ac8] underline underline-offset-2"
                  >
                    Adjust estimate
                  </button>
                </div>
              )}
              <div className="mt-5 grid gap-2">
                <Button
                  onClick={() => setInquiry("availability")}
                  className="h-12 rounded-full bg-[#086ac8] font-bold text-white hover:bg-[#064f96]"
                >
                  Check availability <ArrowRight className="ml-2 size-4" />
                </Button>
                <a
                  href={`/finance?vehicle=${encodeURIComponent(vehicle.slug)}`}
                  className="flex h-11 items-center justify-center rounded-full border border-[#086ac8] text-sm font-bold text-[#086ac8] hover:bg-blue-50"
                >
                  Get pre-qualified
                </a>
                <a
                  href={`/schedule?vehicle=${encodeURIComponent(vehicle.slug)}`}
                  className="flex h-11 items-center justify-center rounded-full border text-sm font-semibold hover:bg-slate-50"
                >
                  Schedule a test drive
                </a>
                <Link
                  to="/sell"
                  className="flex h-11 items-center justify-center rounded-full border text-sm font-semibold hover:bg-slate-50"
                >
                  Value my trade
                </Link>
              </div>
              <a
                href={PHONE_LINK}
                className="mt-5 flex items-center justify-center gap-2 text-sm font-semibold text-[#086ac8]"
              >
                <Phone className="size-4" />
                {PHONE}
              </a>
            </div>
          </aside>
        </div>
      </div>

      <div
        ref={tabsRef}
        className="sticky top-0 z-30 border-y border-slate-200 bg-white/95 shadow-[0_5px_15px_rgba(0,0,0,0.04)] backdrop-blur lg:top-0"
      >
        <nav
          aria-label="Vehicle page sections"
          className="mx-auto flex max-w-[1240px] gap-1 overflow-x-auto px-3 sm:px-6 lg:px-10"
          style={{ scrollbarWidth: "none" }}
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => navigateTab(tab.id)}
              className={`shrink-0 border-b-[3px] px-3 py-4 text-xs font-semibold transition sm:px-4 sm:text-sm ${activeTab === tab.id ? "border-[#086ac8] text-[#086ac8]" : "border-transparent text-slate-600 hover:text-[#086ac8]"}`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="mx-auto grid max-w-[1240px] gap-8 px-4 pb-20 pt-9 sm:px-6 lg:grid-cols-[minmax(0,1fr)_350px] lg:px-10">
        <div className="min-w-0 space-y-16">
          <section
            id="vdp-overview"
            ref={(el) => {
              sections.current.overview = el;
            }}
            className="scroll-mt-24"
          >
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">
                {vehicle.year} {vehicle.make}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">
                {vehicle.body_style || "Vehicle"}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">
                {formatMiles(vehicle.mileage)}
              </span>
            </div>
            <h2 className="text-2xl font-extrabold sm:text-3xl">Why you'll love this {vehicle.model}</h2>
            <p className="mt-4 whitespace-pre-line text-sm leading-7 text-slate-600">
              {words(vehicle.description) ||
                `Discover this ${title} at My Car in Fredericksburg, Virginia. Explore the actual vehicle photos, review its listed equipment and specifications, and contact our team to verify availability or arrange a visit.`}
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-[#f3f7fa] p-5">
                <Gauge className="size-6 text-[#086ac8]" />
                <p className="mt-3 text-xs text-slate-500">Mileage</p>
                <p className="mt-1 font-bold">{formatMiles(vehicle.mileage)}</p>
              </div>
              <div className="rounded-xl bg-[#f3f7fa] p-5">
                <Fuel className="size-6 text-[#086ac8]" />
                <p className="mt-3 text-xs text-slate-500">Fuel type</p>
                <p className="mt-1 font-bold">{vehicle.fuel_type || "Ask dealership"}</p>
              </div>
              <div className="rounded-xl bg-[#f3f7fa] p-5">
                <CarFront className="size-6 text-[#086ac8]" />
                <p className="mt-3 text-xs text-slate-500">Body style</p>
                <p className="mt-1 font-bold">{vehicle.body_style || "Ask dealership"}</p>
              </div>
            </div>
          </section>

          <section
            id="vdp-features"
            ref={(el) => {
              sections.current.features = el;
            }}
            className="scroll-mt-24"
          >
            <h2 className="text-2xl font-extrabold sm:text-3xl">Features & equipment</h2>
            <p className="mt-2 text-sm text-slate-500">
              Equipment recorded for this vehicle. Confirm individual options with our team.
            </p>
            {features.length ? (
              <div className="mt-6 grid gap-x-7 gap-y-4 sm:grid-cols-2">
                {features.map((f, i) => (
                  <div key={`${f}-${i}`} className="flex items-start gap-3 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
                A full feature list isn't currently available for this listing. Call us to confirm specific equipment.
              </div>
            )}
          </section>

          <section
            id="vdp-details"
            ref={(el) => {
              sections.current.details = el;
            }}
            className="scroll-mt-24"
          >
            <h2 className="text-2xl font-extrabold sm:text-3xl">Vehicle details</h2>
            <p className="mt-2 text-sm text-slate-500">Listing-specific facts and specifications.</p>
            <dl className="mt-5 grid gap-x-8 sm:grid-cols-2">
              {specs.map(([label, value]) => (
                <Spec key={label} label={label} value={value} />
              ))}
            </dl>
            <button
              type="button"
              onClick={() => setInquiry("question")}
              className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[#086ac8] hover:underline"
            >
              Have a question about these details? <ArrowRight className="size-4" />
            </button>
          </section>

          <section
            id="vdp-pricing"
            ref={(el) => {
              sections.current.pricing = el;
            }}
            className="scroll-mt-24"
          >
            <h2 className="text-2xl font-extrabold sm:text-3xl">Pricing & payment estimate</h2>
            <p className="mt-2 text-sm text-slate-500">
              Explore an illustrative monthly payment. Final terms depend on credit, lender approval and applicable
              charges.
            </p>
            <div className="mt-6 rounded-2xl border border-slate-200 p-5 sm:p-7">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-5">
                <div>
                  <p className="text-xs text-slate-500">Listed vehicle price</p>
                  <strong className="mt-1 block text-3xl">{cash(price)}</strong>
                </div>
                {discounted && (
                  <div className="rounded-lg bg-emerald-50 p-3 text-sm font-bold text-emerald-700">
                    Price drop: {cash(oldPrice - price)}
                  </div>
                )}
              </div>
              <div className="mt-6 grid gap-5 sm:grid-cols-3">
                <div>
                  <Label htmlFor="vdp-down" className="mb-2 block text-xs">
                    Down payment ($)
                  </Label>
                  <Input
                    id="vdp-down"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={Math.round(price / 100)}
                    value={downPayment}
                    onChange={(e) =>
                      setDownPayment(Math.min(Math.max(0, num(e.target.value)), Math.round(price / 100)))
                    }
                    className="h-11"
                  />
                </div>
                <div>
                  <Label htmlFor="vdp-term" className="mb-2 block text-xs">
                    Loan term (months)
                  </Label>
                  <select
                    id="vdp-term"
                    value={term}
                    onChange={(e) => setTerm(num(e.target.value))}
                    className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                  >
                    {[36, 48, 60, 66, 72, 75, 84, 96].map((m) => (
                      <option key={m} value={m}>
                        {m} months
                      </option>
                    ))}
                    {![36, 48, 60, 66, 72, 75, 84, 96].includes(term) && <option value={term}>{term} months</option>}
                  </select>
                </div>
                <div>
                  <Label htmlFor="vdp-apr" className="mb-2 block text-xs">
                    APR (%)
                  </Label>
                  <Input
                    id="vdp-apr"
                    type="number"
                    min={0}
                    max={40}
                    step={0.1}
                    value={apr}
                    onChange={(e) => setApr(Math.max(0, Math.min(40, num(e.target.value))))}
                    className="h-11"
                  />
                </div>
              </div>
              <div className="mt-6 rounded-xl bg-[#f0f5fa] px-5 py-6">
                <p className="text-sm text-slate-600">Estimated monthly payment</p>
                <p className="mt-1 text-4xl font-extrabold text-[#086ac8]">
                  {cash(monthly * 100)}
                  <span className="text-base font-semibold">/mo</span>
                </p>
                <p className="mt-3 text-xs leading-5 text-slate-500">
                  Illustrative only; excludes taxes, registration, documentation fees and other charges. Rates, terms
                  and down payments may vary. Not an offer, approval or guaranteed rate.
                </p>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <a
                  href={`/finance?vehicle=${encodeURIComponent(vehicle.slug)}`}
                  className="inline-flex min-h-11 items-center rounded-full bg-[#086ac8] px-6 text-sm font-bold text-white hover:bg-[#0756a6]"
                >
                  Apply for financing <ArrowRight className="ml-2 size-4" />
                </a>
                <button
                  type="button"
                  onClick={() => setInquiry("availability")}
                  className="inline-flex min-h-11 items-center rounded-full border px-6 text-sm font-semibold hover:bg-slate-50"
                >
                  Ask about this vehicle
                </button>
              </div>
            </div>
          </section>

          <section
            id="vdp-reviews"
            ref={(el) => {
              sections.current.reviews = el;
            }}
            className="scroll-mt-24"
          >
            <h2 className="text-2xl font-extrabold sm:text-3xl">Reviews</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Customer feedback helps buyers choose confidently. We display only verified, approved My Car customer
              reviews when available. Ask our team for recent reviews or vehicle-specific ownership information.
            </p>
            <a
              href="https://www.google.com/maps/search/?api=1&query=My+Car+4720+Harrison+Road+Fredericksburg+VA"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-2 rounded-full border border-[#086ac8] px-5 py-3 text-sm font-semibold text-[#086ac8] hover:bg-blue-50"
            >
              <Star className="size-4" /> Find My Car customer reviews <ArrowRight className="size-4" />
            </a>
          </section>

          <section
            id="vdp-inspection"
            ref={(el) => {
              sections.current.inspection = el;
            }}
            className="scroll-mt-24"
          >
            <h2 className="text-2xl font-extrabold sm:text-3xl">Condition & inspection</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              See the actual vehicle gallery above, including available interior and exterior photos. Inspection
              documents, vehicle-history reports and warranty details should be obtained directly from My Car when
              available.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="flex gap-3 rounded-xl border p-5">
                <ShieldCheck className="size-7 shrink-0 text-[#086ac8]" />
                <div>
                  <h3 className="font-bold">Vehicle condition</h3>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    Ask about any visible cosmetic wear, mechanical inspection findings and service history.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 rounded-xl border p-5">
                <ClipboardCheck className="size-7 shrink-0 text-[#086ac8]" />
                <div>
                  <h3 className="font-bold">Vehicle history</h3>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    Request an available vehicle-history report from our team. No inspection or history claims are made
                    without records.
                  </p>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setInquiry("question")}
              className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[#086ac8] hover:underline"
            >
              Request inspection or history details <ArrowRight className="size-4" />
            </button>
          </section>

          <section
            id="vdp-more"
            ref={(el) => {
              sections.current.more = el;
            }}
            className="scroll-mt-24"
          >
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-2xl font-extrabold sm:text-3xl">More cars you might like</h2>
                <p className="mt-2 text-sm text-slate-500">Other listings from the current My Car inventory.</p>
              </div>
              <Link to="/search" className="text-sm font-bold text-[#086ac8] hover:underline">
                Shop all cars <ArrowRight className="inline size-4" />
              </Link>
            </div>
            {recommended.length ? (
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {recommended.map((v) => {
                  const cover = getMedia(v).find((m) => !m.video);
                  return (
                    <Link
                      key={v.id}
                      to="/inventory/$slug"
                      params={{ slug: v.slug }}
                      className="group overflow-hidden rounded-xl border border-slate-200 transition hover:-translate-y-1 hover:shadow-md"
                    >
                      <div className="flex h-44 items-center justify-center bg-[#f0f3f6]">
                        {cover ? (
                          <img
                            src={cover.url}
                            alt={vehicleTitle(v)}
                            loading="lazy"
                            className="h-full w-full object-contain transition group-hover:scale-105"
                          />
                        ) : (
                          <Camera className="size-9 text-slate-400" />
                        )}
                      </div>
                      <div className="p-4">
                        <p className="font-bold">{vehicleTitle(v)}</p>
                        <p className="mt-1 text-xs text-slate-500">{formatMiles(v.mileage)}</p>
                        <p className="mt-2 text-xl font-bold text-[#086ac8]">{cash(num(v.price_cents))}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <p className="mt-5 text-sm text-slate-500">More listings will appear here when available.</p>
            )}
          </section>
        </div>
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-[#f8fafc] p-6">
              <h3 className="font-extrabold">Interested in this vehicle?</h3>
              <p className="mt-2 text-sm text-slate-600">
                Our Fredericksburg team can help verify availability, answer questions and arrange your visit.
              </p>
              <Button
                onClick={() => setInquiry("availability")}
                className="mt-5 h-11 w-full rounded-full bg-[#086ac8] font-bold text-white hover:bg-[#0756a6]"
              >
                Check availability
              </Button>
              <a
                href={PHONE_LINK}
                className="mt-4 flex items-center justify-center gap-2 text-sm font-bold text-[#086ac8]"
              >
                <Phone className="size-4" />
                {PHONE}
              </a>
            </div>
            <div className="rounded-xl border p-5 text-xs text-slate-600">
              <MapPin className="mb-2 size-5 text-[#086ac8]" />
              <strong className="block text-sm text-[#142f4c]">My Car — Fredericksburg</strong>
              <p className="mt-1">4720 Harrison Rd, Fredericksburg, VA 22408</p>
            </div>
          </div>
        </aside>
      </div>

      {/* Mobile persistent action bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3 shadow-[0_-8px_30px_rgba(0,0,0,0.09)] lg:hidden">
        <div className="min-w-0">
          <p className="truncate text-xs font-bold">
            {vehicle.year} {vehicle.make} {vehicle.model}
          </p>
          <p className="text-lg font-extrabold">{cash(price)}</p>
        </div>
        <Button
          onClick={() => setInquiry("availability")}
          className="h-11 shrink-0 rounded-full bg-[#086ac8] px-5 font-bold text-white"
        >
          Check availability
        </Button>
      </div>

      {/* Fullscreen, keyboard-accessible photo viewer */}
      <Dialog open={galleryOpen} onOpenChange={setGalleryOpen}>
        <DialogContent className="flex h-[96dvh] max-h-[96dvh] w-[98vw] max-w-[1500px] flex-col gap-0 overflow-hidden border-0 bg-[#0d1725] p-0 text-white [&>button]:right-4 [&>button]:top-4 [&>button]:text-white">
          <DialogHeader className="border-b border-white/15 px-5 py-4 text-left">
            <DialogTitle className="pr-10 text-lg font-bold text-white">{title}</DialogTitle>
            <DialogDescription className="text-xs text-white/60">
              Actual photos of this inventory unit · {galleryImages.length} photos · Use arrow keys to browse
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-2 border-b border-white/10 px-5 py-3">
            {["all", "exterior", "interior"].map((x) => (
              <button
                key={x}
                type="button"
                onClick={() => setGalleryTab(x as typeof galleryTab)}
                className={`rounded-full px-4 py-2 text-xs font-semibold capitalize ${galleryTab === x ? "bg-white text-slate-900" : "bg-white/10 text-white hover:bg-white/20"}`}
              >
                {x === "all" ? `All photos (${galleryImages.length})` : x}
              </button>
            ))}
            <span className="ml-auto self-center text-xs text-white/60">
              {galleryImages.length ? Math.min(photoIndex + 1, galleryImages.length) : 0} / {galleryImages.length}
            </span>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center bg-[#111b29] px-12 py-4 sm:px-20">
            {currentImage ? (
              <img
                key={currentImage.url}
                src={currentImage.url}
                alt={currentImage.alt}
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <Camera className="size-12 text-white/50" />
            )}
            <button
              type="button"
              onClick={() => movePhoto(-1)}
              disabled={galleryImages.length < 2}
              aria-label="Previous photo"
              className="absolute left-2 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 hover:bg-white/25 disabled:opacity-30 sm:left-5"
            >
              <ChevronLeft className="size-6" />
            </button>
            <button
              type="button"
              onClick={() => movePhoto(1)}
              disabled={galleryImages.length < 2}
              aria-label="Next photo"
              className="absolute right-2 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 hover:bg-white/25 disabled:opacity-30 sm:right-5"
            >
              <ChevronRight className="size-6" />
            </button>
          </div>
          <div className="flex shrink-0 gap-2 overflow-x-auto border-t border-white/15 p-3">
            {galleryImages.map((m, i) => (
              <button
                key={m.url}
                type="button"
                onClick={() => setPhotoIndex(i)}
                className={`h-16 w-24 shrink-0 overflow-hidden rounded border-2 ${photoIndex === i ? "border-[#56a9ff]" : "border-transparent opacity-65 hover:opacity-100"}`}
              >
                <img src={m.url} alt={m.alt} className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
          {galleryTab !== "all" && (
            <p className="px-4 pb-2 text-center text-[11px] text-white/60">
              Photo categories aren't tagged in the inventory feed; showing all actual vehicle photos instead of
              guessing which are {galleryTab}.
            </p>
          )}
        </DialogContent>
      </Dialog>

      {/* Uses existing LeadForm processing (no new unverified webhook). */}
      <Dialog
        open={Boolean(inquiry)}
        onOpenChange={(open) => {
          if (!open) setInquiry(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {inquiry === "availability" ? "Check vehicle availability" : "Ask about this vehicle"}
            </DialogTitle>
            <DialogDescription>
              {title} · Stock #{vehicle.stock_number}. Our team will review your request and follow up.
            </DialogDescription>
          </DialogHeader>
          <div
            ref={formRef}
            className="[&_button[type=submit]]:!rounded-full [&_button[type=submit]]:!bg-[#086ac8] [&_button[type=submit]]:!text-white"
          >
            <LeadForm
              leadType="availability"
              submitLabel={inquiry === "availability" ? "Check availability" : "Send my question"}
              successTitle="Request received"
              successBody="Thank you. Our team will follow up with you about this vehicle."
              messageLabel="Questions about this vehicle"
              collectDetails={() => ({
                vehicle_id: vehicle.id,
                vehicle_slug: vehicle.slug,
                vehicle_title: title,
                vin: vehicle.vin,
                stock_number: vehicle.stock_number,
                price_cents: vehicle.price_cents,
                lead_source: "mycarcorp.com",
                lead_page: `/inventory/${vehicle.slug}`,
                lead_intent: inquiry,
                customer_name: name,
                customer_email: email,
                customer_phone: phone,
                message,
              })}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="vdp-name">Full Name</Label>
                  <Input
                    id="vdp-name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="vdp-email">Email</Label>
                  <Input
                    id="vdp-email"
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="vdp-phone">Phone</Label>
                  <Input
                    id="vdp-phone"
                    required
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    autoComplete="tel"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="vdp-message">Your question (optional)</Label>
                  <Textarea
                    id="vdp-message"
                    rows={3}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Anything else we can help with?"
                  />
                </div>
              </div>
            </LeadForm>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
