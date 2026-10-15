import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, FileCheck2, Loader2, LockKeyhole, MapPin, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { getMyPurchase, saveMyPurchase, submitMyPurchase } from "@/lib/purchases.functions";
import { canSubmit, paymentLabel, type Purchase, type PurchaseStep } from "@/lib/purchase-flow";
import { formatDate, formatMiles, formatUsd } from "@/lib/format";
import { getAttributionDetails } from "@/lib/attribution";
import { isSetupPending, SetupPending, StatusBadge } from "@/components/purchase/PurchaseBits";

export const Route = createFileRoute("/my/purchases/$id")({
  component: PurchaseWorkspace,
});

type Draft = Partial<Purchase>;
type Fulfillment = "pickup" | "delivery" | null;
const STEPS = [
  { key: "vehicle", label: "Vehicle" },
  { key: "personal", label: "Personal details" },
  { key: "payment", label: "Payment" },
  { key: "trade", label: "Trade-in" },
  { key: "fulfillment", label: "Pickup or delivery" },
  { key: "license", label: "Driver's license" },
  { key: "review", label: "Review & submit" },
  { key: "schedule", label: "Appointment" },
  { key: "tracking", label: "Status" },
] as const;
type PageStep = (typeof STEPS)[number]["key"];


function PurchaseWorkspace() {
  const { id } = Route.useParams();
  const { session } = useAuth();
  const token = session?.access_token ?? "";
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["my-purchase", id],
    enabled: !!token,
    retry: false,
    queryFn: () => getMyPurchase({ data: { accessToken: token, id: Number(id) } }),
  });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [step, setStep] = useState<PageStep>("vehicle");
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  const [submitting, setSubmitting] = useState(false);
  const [fulfillment, setFulfillment] = useState<Fulfillment>(null);
  const [preferredDate, setPreferredDate] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const dirty = useRef<Record<string, unknown>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingPromise = useRef<Promise<boolean> | null>(null);

  useEffect(() => {
    if (query.data?.purchase && !draft) {
      setDraft(query.data.purchase);
      const initial = query.data.purchase.status === "draft" ? query.data.purchase.current_step : "tracking";
      setStep(initial === "vehicle" || initial === "personal" || initial === "payment" || initial === "trade" || initial === "review" ? initial : "vehicle");
      if (query.data.purchase.status !== "draft") setStep("tracking");
    }
  }, [query.data, draft]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const locked = draft?.status !== "draft";
  const traditional = (s: PageStep): PurchaseStep | undefined => {
    if (s === "vehicle" || s === "personal" || s === "payment" || s === "trade" || s === "review") return s;
    return undefined;
  };
  async function flush(next?: PurchaseStep): Promise<boolean> {
    if (timer.current) clearTimeout(timer.current);
    if (locked) return true;
    if (savingPromise.current) await savingPromise.current;
    const patch = dirty.current;
    dirty.current = {};
    if (!Object.keys(patch).length && !next) return true;
    setSaving("saving");
    const task = (async () => {
      try {
        await saveMyPurchase({ data: { accessToken: token, id: Number(id), patch, step: next } });
        setSaving("saved");
        void qc.invalidateQueries({ queryKey: ["my-purchases"] });
        return true;
      } catch (error) {
        dirty.current = { ...patch, ...dirty.current };
        setSaving("idle");
        toast.error((error as Error).message);
        return false;
      }
    })();
    savingPromise.current = task;
    const result = await task;
    if (savingPromise.current === task) savingPromise.current = null;
    return result;
  }
  function update(field: keyof Purchase, value: unknown) {
    if (locked) return;
    setDraft((old) => old ? { ...old, [field]: value } : old);
    Object.assign(dirty.current, { [field]: value });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void flush(); }, 800);
  }
  async function go(next: PageStep) {
    if (!(await flush(traditional(next)))) return;
    setStep(next);
  }
  async function submit() {
    if (!(await flush("review"))) return;
    if (!draft || !canSubmit(draft)) { toast.error("Complete the required purchase details first."); return; }
    setSubmitting(true);
    try {
      const result = await submitMyPurchase({ data: { accessToken: token, id: Number(id), attribution: getAttributionDetails() } });
      setDraft(result);
      setStep("schedule");
      toast.success("Purchase request submitted for dealership review.");
      void qc.invalidateQueries({ queryKey: ["my-purchase", id] });
      void qc.invalidateQueries({ queryKey: ["my-purchases"] });
    } catch (error) { toast.error((error as Error).message); }
    finally { setSubmitting(false); }
  }

  if (!token) return <div className="rounded-xl border p-8 text-center">Please sign in to view your purchase.</div>;
  if (query.isError) return isSetupPending(query.error) ? <SetupPending /> : <p className="text-sm text-destructive">{(query.error as Error).message}</p>;
  if (query.isLoading || (query.data && !draft)) return <div className="flex items-center gap-2 p-8 text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading your purchase…</div>;
  if (!draft || !query.data) return <div className="p-8">Purchase not found. <Link to="/my" className="underline">Back to My Car</Link></div>;

  const idx = STEPS.findIndex((s) => s.key === step);
  const prev = STEPS[idx - 1]?.key;
  const next = STEPS[idx + 1]?.key;
  const submitted = draft.status !== "draft";
  const appointmentNote = "Appointment booking is not yet connected. Your selected date/time is not saved or sent to My Car. Please contact the dealership to request confirmation.";
  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><Link to="/my" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3" /> My Car dashboard</Link><h1 className="mt-2 font-display text-2xl font-bold sm:text-3xl">Buy your {draft.vehicle_title || "vehicle"}</h1></div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">{saving === "saving" && <span><Loader2 className="inline size-3 animate-spin" /> Saving</span>}{saving === "saved" && "All purchase changes saved"}<StatusBadge status={draft.status ?? "draft"} /></div>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="rounded-xl border bg-card p-4 lg:sticky lg:top-24">
          <div className="mb-4 overflow-hidden rounded-lg bg-muted">{draft.vehicle_photo && <img src={draft.vehicle_photo} alt={draft.vehicle_title || "Selected car"} className="aspect-[16/10] w-full object-cover" />}</div>
          <p className="font-semibold">{draft.vehicle_title}</p><p className="mb-4 text-sm text-muted-foreground">{formatUsd(draft.vehicle_price_cents)}</p>
          <div className="mb-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${Math.round(((idx + 1) / STEPS.length) * 100)}%` }} /></div>
          <nav aria-label="Purchase steps" className="space-y-1">
            {STEPS.map((s, i) => <button key={s.key} type="button" onClick={() => void go(s.key)} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${step === s.key ? "bg-primary/10 font-semibold text-primary" : "hover:bg-muted"}`}>
              <span className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs ${i < idx ? "bg-primary text-primary-foreground" : "border"}`}>{i < idx ? <Check className="size-3" /> : i + 1}</span>{s.label}
            </button>)}
          </nav>
          <p className="mt-4 text-xs text-muted-foreground">Steps shown are a guide. Only dealership-confirmed milestones count as officially completed.</p>
        </aside>
        <main className="space-y-4">
          <div className="rounded-xl border bg-card p-5 sm:p-7">
            {step === "vehicle" && <VehicleStep p={draft} />}
            {step === "personal" && <fieldset disabled={locked}><PersonalStep p={draft} update={update} /></fieldset>}
            {step === "payment" && <fieldset disabled={locked}><PaymentStep p={draft} update={update} /></fieldset>}
            {step === "trade" && <fieldset disabled={locked}><TradeStep p={draft} update={update} /></fieldset>}
            {step === "fulfillment" && <section className="space-y-4"><h2 className="text-xl font-semibold">How would you like to receive your new ride?</h2><p className="text-sm text-muted-foreground">Choose your preferred method. Your dealership team must confirm availability.</p><div className="grid gap-3 sm:grid-cols-2"><Choice title="Pickup at My Car" description="Collect your vehicle from the dealership." active={fulfillment === "pickup"} onClick={() => setFulfillment("pickup")} icon={<MapPin className="size-5" />} /><Choice title="Home delivery" description="Request delivery to your address, where supported." active={fulfillment === "delivery"} onClick={() => setFulfillment("delivery")} icon={<Truck className="size-5" />} /></div><PendingIntegration text="This preference is not yet stored in the purchase database. Lovable must add an authorized fulfillment update function before production use." /></section>}
            {step === "license" && <section className="space-y-4"><h2 className="flex items-center gap-2 text-xl font-semibold"><LockKeyhole className="size-5" /> Verify your identity</h2><p className="text-sm text-muted-foreground">Your driver's license must be uploaded through secure private document storage and reviewed by authorized staff.</p><div className="rounded-lg border border-dashed p-6"><FileCheck2 className="mb-3 size-8 text-muted-foreground" /><p className="font-medium">Secure driver's license upload is awaiting backend setup</p><p className="mt-1 text-sm text-muted-foreground">We will not collect your driver's license until private storage, upload endpoints, and staff permissions are configured.</p><Button type="button" className="mt-4" disabled>Upload license (setup required)</Button></div><PendingIntegration text="A private Supabase Storage bucket, authorization-checked upload server function, document records, and staff verification controls are required." /></section>}
            {step === "review" && <ReviewStep p={draft} fulfillment={fulfillment} />}
            {step === "schedule" && <section className="space-y-4"><h2 className="text-xl font-semibold">Choose your preferred pickup or delivery time</h2>{!submitted && <p className="text-sm text-muted-foreground">Submit your purchase request on the previous step first.</p>}<div className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="appointment-date">Preferred date</Label><Input id="appointment-date" type="date" value={preferredDate} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setPreferredDate(e.target.value)} /></div><div><Label htmlFor="appointment-time">Preferred time</Label><Input id="appointment-time" type="time" value={preferredTime} onChange={(e) => setPreferredTime(e.target.value)} /></div></div><PendingIntegration text={appointmentNote} /><Button disabled>Request appointment (setup required)</Button></section>}
            {step === "tracking" && <section className="space-y-4"><h2 className="text-xl font-semibold">Your purchase status</h2><StatusBadge status={draft.status ?? "draft"} /><p className="text-sm text-muted-foreground">Your dealership team will update this status as your purchase progresses. This is not a financing approval or confirmed appointment.</p><div className="rounded-lg bg-muted/40 p-4 text-sm"><p><strong>Vehicle:</strong> {draft.vehicle_title}</p><p><strong>Purchase submitted:</strong> {draft.submitted_at ? formatDate(draft.submitted_at) : "Not yet"}</p><p><strong>Payment preference:</strong> {paymentLabel(draft.payment_method ?? null)}</p></div></section>}
            {locked && ["personal", "payment", "trade"].includes(step) && <p className="mt-4 text-sm text-muted-foreground">This purchase has been submitted. Contact My Car to change these details.</p>}
            <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t pt-5"><Button variant="outline" disabled={!prev} onClick={() => prev && void go(prev)}><ChevronLeft className="mr-1 size-4" /> Back</Button><div className="flex gap-2">{step === "review" && !submitted ? <Button disabled={!canSubmit(draft) || submitting} onClick={() => void submit()}>{submitting ? "Submitting…" : "Submit for dealership review"}</Button> : next ? <Button onClick={() => void go(next)}>{step === "review" && submitted ? "Continue to appointment" : "Continue"}<ChevronRight className="ml-1 size-4" /></Button> : <Button asChild><Link to="/my">Back to dashboard</Link></Button>}</div></div>
          </div>
          <div className="rounded-xl border bg-card p-5"><h2 className="font-semibold">Activity & updates</h2><ul className="mt-3 space-y-3">{query.data.events.map((event) => <li key={event.id} className="border-l-2 border-primary/50 pl-3 text-sm"><p>{event.message}</p><p className="text-xs text-muted-foreground">{formatDate(event.created_at)}</p></li>)}{!query.data.events.length && <li className="text-sm text-muted-foreground">No activity yet.</li>}</ul></div>
        </main>
      </div>
    </div>
  );
}

function PendingIntegration({ text }: { text: string }) { return <div className="rounded-lg border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/20 dark:text-amber-200"><strong>Additional setup required:</strong> {text}</div>; }
function Row({ label, value }: { label: string; value: string }) { return <div className="flex justify-between gap-4 py-1 text-sm"><dt className="text-muted-foreground">{label}</dt><dd className="text-right font-medium">{value}</dd></div>; }
type Props = { p: Draft; update: (field: keyof Purchase, value: unknown) => void };
function Field({ label, field, p, update, type = "text", placeholder }: Props & { label: string; field: keyof Purchase; type?: string; placeholder?: string }) { return <div className="space-y-1"><Label htmlFor={field}>{label}</Label><Input id={field} type={type} placeholder={placeholder} value={(p[field] as string | number | null | undefined) ?? ""} onChange={(e) => update(field, e.target.value)} /></div>; }
function Choice({ title, description, active, onClick, icon }: { title: string; description: string; active: boolean; onClick: () => void; icon?: ReactNode }) { return <button type="button" onClick={onClick} aria-pressed={active} className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition ${active ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:border-primary/50"}`}>{icon}<span><strong className="block">{title}</strong><span className="mt-1 block text-sm text-muted-foreground">{description}</span></span>{active && <Check className="ml-auto size-4 shrink-0 text-primary" />}</button>; }
function VehicleStep({ p }: { p: Draft }) { return <div className="space-y-4"><h2 className="text-xl font-semibold">Your selected vehicle</h2><div className="grid gap-5 sm:grid-cols-[220px_1fr]"><div className="overflow-hidden rounded-lg bg-muted">{p.vehicle_photo && <img src={p.vehicle_photo} alt={p.vehicle_title || "Vehicle"} className="aspect-[4/3] w-full object-cover" />}</div><div><h3 className="text-lg font-semibold">{p.vehicle_title}</h3><dl className="mt-2"><Row label="Price" value={formatUsd(p.vehicle_price_cents)} /><Row label="Mileage" value={formatMiles(p.vehicle_mileage)} /><Row label="VIN" value={p.vehicle_vin || "—"} /></dl>{p.vehicle_slug && <Link to="/inventory/$slug" params={{ slug: p.vehicle_slug }} className="mt-3 inline-block text-sm text-primary underline">View original listing</Link>}</div></div></div>; }
function PersonalStep(props: Props) { return <div className="space-y-4"><h2 className="text-xl font-semibold">Tell us about yourself</h2><div className="grid gap-4 sm:grid-cols-2"><Field {...props} label="Full name" field="full_name" /><Field {...props} label="Email" field="email" type="email" /><Field {...props} label="Phone number" field="phone" type="tel" /><Field {...props} label="Date of birth" field="date_of_birth" type="date" /><div className="sm:col-span-2"><Field {...props} label="Street address" field="address" /></div><Field {...props} label="City" field="city" /><Field {...props} label="State" field="state" placeholder="VA" /><Field {...props} label="ZIP code" field="zip" /></div></div>; }
function PaymentStep({ p, update }: Props) { return <div className="space-y-4"><div><h2 className="text-xl font-semibold">How would you like to pay for your {p.vehicle_title || "vehicle"}?</h2><p className="mt-1 text-sm text-muted-foreground">Please make your selection below.</p></div><div className="grid gap-3 sm:grid-cols-2"><Choice title="Finance with My Car" description="Explore financing options and build a deal that works for you. Terms subject to lender review." active={p.payment_method === "mycar_financing"} onClick={() => update("payment_method", "mycar_financing")} /><Choice title="Pay with cash" description="I plan to pay with funds from my bank account." active={p.payment_method === "cash"} onClick={() => update("payment_method", "cash")} /></div><Choice title="Use financing from my bank or credit union" description="I will arrange financing through another lender." active={p.payment_method === "outside_financing"} onClick={() => update("payment_method", "outside_financing")} />{p.payment_method === "mycar_financing" && <div className="rounded-lg border p-4"><p className="font-medium">Customize your financing</p><p className="mt-1 text-sm text-muted-foreground">Your existing finance page handles the application. Live rate and payment customization need a verified calculator/lender integration.</p><Link to="/finance" className="mt-3 inline-block text-sm font-medium text-primary underline">Explore financing options</Link></div>}{p.payment_method === "outside_financing" && <div className="grid gap-4 sm:grid-cols-2"><Field p={p} update={update} label="Lender name" field="lender_name" /><Field p={p} update={update} label="Pre-approval amount (optional)" field="preapproval_amount" type="number" /></div>}<p className="text-sm text-muted-foreground">Keep in mind: trading your current vehicle could potentially lower your purchase costs.</p></div>; }
function TradeStep(props: Props) { const { p, update } = props; return <div className="space-y-4"><h2 className="text-xl font-semibold">Will you be trading in your current vehicle?</h2><div className="grid gap-3 sm:grid-cols-2"><Choice title="No trade-in" description="I'm only buying a vehicle." active={p.has_trade_in === false} onClick={() => update("has_trade_in", false)} /><Choice title="Yes, I have a trade-in" description="My Car will review my vehicle for appraisal." active={p.has_trade_in === true} onClick={() => update("has_trade_in", true)} /></div>{p.has_trade_in && <div className="grid gap-4 sm:grid-cols-2"><Field {...props} label="Year, make & model" field="trade_year_make_model" /><Field {...props} label="Mileage" field="trade_mileage" type="number" /><Field {...props} label="VIN (optional)" field="trade_vin" /><Field {...props} label="Outstanding payoff (optional)" field="trade_payoff" type="number" /></div>}</div>; }
function ReviewStep({ p, fulfillment }: { p: Draft; fulfillment: Fulfillment }) { return <div className="space-y-4"><h2 className="text-xl font-semibold">Review everything</h2><p className="text-sm text-muted-foreground">Review the information before submitting your purchase request. Submission does not guarantee approval or complete the sale.</p><div className="grid gap-4 sm:grid-cols-2"><div className="rounded-lg bg-muted/40 p-4"><h3 className="mb-2 font-semibold">Your details</h3><p>{p.full_name || "—"}</p><p>{p.email}</p><p>{p.phone}</p><p>{[p.address, p.city, p.state, p.zip].filter(Boolean).join(", ")}</p></div><div className="rounded-lg bg-muted/40 p-4"><h3 className="mb-2 font-semibold">Your deal</h3><p>{p.vehicle_title} — {formatUsd(p.vehicle_price_cents)}</p><p>Payment: {paymentLabel(p.payment_method ?? null)}</p><p>Trade-in: {p.has_trade_in ? p.trade_year_make_model || "Yes" : p.has_trade_in === false ? "None" : "Not selected"}</p><p>Pickup/delivery preference: {fulfillment ? `${fulfillment === "pickup" ? "Dealership pickup" : "Home delivery"} (not yet saved)` : "Not yet selected"}</p><p>License verification: Not submitted</p></div></div>{p.status !== "draft" && <p className="rounded-lg bg-primary/10 p-3 text-sm">Submitted {formatDate(p.submitted_at ?? null)}. Check the status tracker for dealership updates.</p>}</div>; }
