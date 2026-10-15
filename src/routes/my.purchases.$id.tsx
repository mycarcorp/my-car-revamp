import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { getMyPurchase, saveMyPurchase, submitMyPurchase } from "@/lib/purchases.functions";
import {
  PAYMENT_METHODS,
  PURCHASE_STEPS,
  canSubmit,
  isStepComplete,
  paymentLabel,
  type Purchase,
  type PurchaseStep,
} from "@/lib/purchase-flow";
import { formatDate, formatMiles, formatUsd } from "@/lib/format";
import { getAttributionDetails } from "@/lib/attribution";
import { isSetupPending, PurchaseProgress, SetupPending, StatusBadge } from "@/components/purchase/PurchaseBits";

export const Route = createFileRoute("/my/purchases/$id")({
  component: PurchaseWorkspace,
});

type Draft = Partial<Purchase>;

function PurchaseWorkspace() {
  const { id } = Route.useParams();
  const { session } = useAuth();
  const token = session?.access_token ?? "";
  const queryClient = useQueryClient();
  const q = useQuery({
    queryKey: ["my-purchase", id],
    enabled: !!token,
    retry: false,
    queryFn: () => getMyPurchase({ data: { accessToken: token, id: Number(id) } }),
  });

  const [draft, setDraft] = useState<Draft | null>(null);
  const [step, setStep] = useState<PurchaseStep>("vehicle");
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  const [submitting, setSubmitting] = useState(false);
  const dirty = useRef<Record<string, unknown>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (q.data?.purchase && !draft) {
      setDraft(q.data.purchase);
      setStep(q.data.purchase.status === "draft" ? q.data.purchase.current_step : "review");
    }
  }, [q.data, draft]);

  const locked = (draft?.status ?? "draft") !== "draft";

  async function flush(nextStep?: PurchaseStep) {
    if (timer.current) clearTimeout(timer.current);
    if (locked) return;
    const patch = dirty.current;
    dirty.current = {};
    if (!Object.keys(patch).length && !nextStep) return;
    setSaving("saving");
    try {
      await saveMyPurchase({ data: { accessToken: token, id: Number(id), patch, step: nextStep } });
      setSaving("saved");
      void queryClient.invalidateQueries({ queryKey: ["my-purchases"] });
    } catch (e) {
      setSaving("idle");
      toast.error((e as Error).message);
    }
  }

  function update(field: keyof Purchase, value: unknown) {
    setDraft((d) => ({ ...d, [field]: value }));
    dirty.current[field] = value;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 800);
  }

  function go(next: PurchaseStep) {
    setStep(next);
    void flush(next);
  }

  async function submit() {
    await flush();
    setSubmitting(true);
    try {
      const updated = await submitMyPurchase({
        data: { accessToken: token, id: Number(id), attribution: getAttributionDetails() },
      });
      setDraft(updated);
      toast.success("Submitted! We'll be in touch shortly.");
      void queryClient.invalidateQueries({ queryKey: ["my-purchase", id] });
      void queryClient.invalidateQueries({ queryKey: ["my-purchases"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (q.isError) return isSetupPending(q.error) ? <SetupPending /> : <p className="text-sm text-destructive">{(q.error as Error).message}</p>;
  if (q.isLoading || (q.data && !draft)) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!q.data || !draft) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">We couldn't find that purchase.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/my">Back to dashboard</Link>
        </Button>
      </div>
    );
  }

  const idx = PURCHASE_STEPS.findIndex((s) => s.key === step);
  const prev = PURCHASE_STEPS[idx - 1]?.key;
  const next = PURCHASE_STEPS[idx + 1]?.key;

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
      <section className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Buy a car</p>
            <h1 className="font-display text-2xl font-bold sm:text-3xl">{draft.vehicle_title}</h1>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {saving === "saving" && (
              <span className="flex items-center gap-1">
                <Loader2 className="size-3 animate-spin" /> Saving
              </span>
            )}
            {saving === "saved" && <span>All changes saved</span>}
            <StatusBadge status={draft.status ?? "draft"} />
          </div>
        </div>

        <ol className="grid grid-cols-5 gap-2">
          {PURCHASE_STEPS.map((s, i) => {
            const done = isStepComplete(draft, s.key);
            const active = s.key === step;
            return (
              <li key={s.key}>
                <button
                  type="button"
                  onClick={() => go(s.key)}
                  className={`w-full rounded-lg border px-2 py-2 text-left text-xs transition ${
                    active ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"
                  }`}
                >
                  <span
                    className={`mb-1 flex size-5 items-center justify-center rounded-full text-[10px] font-bold ${
                      done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {done ? <Check className="size-3" /> : i + 1}
                  </span>
                  <span className="hidden font-medium sm:block">{s.label}</span>
                </button>
              </li>
            );
          })}
        </ol>

        <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
          {locked && step !== "review" && (
            <p className="mb-4 rounded-md bg-muted p-3 text-xs text-muted-foreground">
              This purchase has been submitted. Contact us if anything needs to change.
            </p>
          )}
          <fieldset disabled={locked} className="space-y-4">
            {step === "vehicle" && <VehicleStep p={draft} />}
            {step === "personal" && <PersonalStep p={draft} update={update} />}
            {step === "payment" && <PaymentStep p={draft} update={update} />}
            {step === "trade" && <TradeStep p={draft} update={update} />}
          </fieldset>
          {step === "review" && <ReviewStep p={draft} />}

          <div className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-4">
            <Button variant="outline" disabled={!prev} onClick={() => prev && go(prev)}>
              <ChevronLeft className="mr-1 size-4" /> Back
            </Button>
            {next ? (
              <Button onClick={() => go(next)}>
                Continue <ChevronRight className="ml-1 size-4" />
              </Button>
            ) : locked ? null : (
              <Button onClick={() => void submit()} disabled={!canSubmit(draft) || submitting}>
                {submitting ? "Submitting…" : "Submit to My Car"}
              </Button>
            )}
          </div>
          {step === "review" && !locked && !canSubmit(draft) && (
            <p className="mt-2 text-right text-xs text-muted-foreground">Complete steps 2–4 to submit.</p>
          )}
        </div>
      </section>

      <aside className="space-y-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <PurchaseProgress purchase={draft} />
          <dl className="mt-4 space-y-1 text-sm">
            <Row k="Price" v={formatUsd(draft.vehicle_price_cents)} />
            <Row k="Payment" v={paymentLabel(draft.payment_method ?? null)} />
            <Row k="Trade-in" v={draft.has_trade_in == null ? "—" : draft.has_trade_in ? "Yes" : "No"} />
          </dl>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Activity</h2>
          <ul className="mt-3 space-y-3">
            {q.data.events.map((e) => (
              <li key={e.id} className="border-l-2 border-primary/40 pl-3 text-xs">
                <p>{e.message}</p>
                <p className="mt-0.5 text-muted-foreground">{formatDate(e.created_at)}</p>
              </li>
            ))}
            {!q.data.events.length && <li className="text-xs text-muted-foreground">No activity yet.</li>}
          </ul>
        </div>
      </aside>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="font-medium">{v}</dd>
    </div>
  );
}

type StepProps = { p: Draft; update: (f: keyof Purchase, v: unknown) => void };

function Field({ label, field, p, update, type = "text", placeholder }: StepProps & { label: string; field: keyof Purchase; type?: string; placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={field}>{label}</Label>
      <Input
        id={field}
        type={type}
        placeholder={placeholder}
        value={(p[field] as string | number | null | undefined) ?? ""}
        onChange={(e) => update(field, e.target.value)}
      />
    </div>
  );
}

function VehicleStep({ p }: { p: Draft }) {
  return (
    <div className="grid gap-5 sm:grid-cols-[220px_1fr]">
      <div className="aspect-[4/3] overflow-hidden rounded-lg bg-muted">
        {p.vehicle_photo && <img src={p.vehicle_photo} alt={p.vehicle_title ?? ""} className="size-full object-cover" />}
      </div>
      <div className="space-y-2">
        <h2 className="font-display text-xl font-semibold">{p.vehicle_title}</h2>
        <dl className="space-y-1 text-sm">
          <Row k="Price" v={formatUsd(p.vehicle_price_cents)} />
          <Row k="Mileage" v={formatMiles(p.vehicle_mileage)} />
          <Row k="VIN" v={p.vehicle_vin ?? "—"} />
        </dl>
        {p.vehicle_slug && (
          <Link to="/inventory/$slug" params={{ slug: p.vehicle_slug }} className="text-sm font-medium text-primary underline">
            View listing
          </Link>
        )}
      </div>
    </div>
  );
}

function PersonalStep(props: StepProps) {
  return (
    <>
      <h2 className="font-display text-xl font-semibold">Personal details</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field {...props} label="Full name" field="full_name" />
        <Field {...props} label="Email" field="email" type="email" />
        <Field {...props} label="Phone" field="phone" type="tel" />
        <Field {...props} label="Date of birth" field="date_of_birth" type="date" />
        <div className="sm:col-span-2">
          <Field {...props} label="Street address" field="address" />
        </div>
        <Field {...props} label="City" field="city" />
        <div className="grid grid-cols-2 gap-4">
          <Field {...props} label="State" field="state" placeholder="VA" />
          <Field {...props} label="ZIP" field="zip" />
        </div>
      </div>
    </>
  );
}

function Choice({ active, onClick, title, text }: { active: boolean; onClick: () => void; title: string; text: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border p-4 text-left transition ${active ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/40"}`}
    >
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{text}</p>
    </button>
  );
}

const PAYMENT_TEXT: Record<string, string> = {
  cash: "Pay in full with cash, check or wire.",
  mycar_financing: "Let our team find a loan for you.",
  outside_financing: "Use your own bank or credit union.",
};

function PaymentStep(props: StepProps) {
  const { p, update } = props;
  return (
    <>
      <h2 className="font-display text-xl font-semibold">How would you like to pay?</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        {PAYMENT_METHODS.map((m) => (
          <Choice key={m.key} active={p.payment_method === m.key} onClick={() => update("payment_method", m.key)} title={m.label} text={PAYMENT_TEXT[m.key]!} />
        ))}
      </div>
      {p.payment_method === "mycar_financing" && (
        <p className="text-sm text-muted-foreground">
          Want to speed things up?{" "}
          <Link to="/finance" className="font-medium text-primary underline">
            Fill out the financing application
          </Link>
          .
        </p>
      )}
      {p.payment_method === "outside_financing" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field {...props} label="Lender name" field="lender_name" />
          <Field {...props} label="Pre-approval amount (optional)" field="preapproval_amount" type="number" />
        </div>
      )}
    </>
  );
}

function TradeStep(props: StepProps) {
  const { p, update } = props;
  return (
    <>
      <h2 className="font-display text-xl font-semibold">Do you have a trade-in?</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Choice active={p.has_trade_in === false} onClick={() => update("has_trade_in", false)} title="No trade-in" text="I'm only buying." />
        <Choice active={p.has_trade_in === true} onClick={() => update("has_trade_in", true)} title="Yes, I have a trade-in" text="We'll appraise it for you." />
      </div>
      {p.has_trade_in && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field {...props} label="Year, make & model" field="trade_year_make_model" placeholder="2018 Honda CR-V" />
          <Field {...props} label="Mileage" field="trade_mileage" type="number" />
          <Field {...props} label="VIN (optional)" field="trade_vin" />
          <Field {...props} label="Amount still owed (optional)" field="trade_payoff" type="number" />
        </div>
      )}
    </>
  );
}

function ReviewStep({ p }: { p: Draft }) {
  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl font-semibold">Review & submit</h2>
      <div className="grid gap-4 text-sm sm:grid-cols-2">
        <div className="space-y-1 rounded-lg bg-muted/40 p-4">
          <p className="font-semibold">You</p>
          <p>{p.full_name || "—"}</p>
          <p>{p.email}</p>
          <p>{p.phone}</p>
          <p className="text-muted-foreground">{[p.address, p.city, p.state, p.zip].filter(Boolean).join(", ")}</p>
        </div>
        <div className="space-y-1 rounded-lg bg-muted/40 p-4">
          <p className="font-semibold">Deal</p>
          <p>{p.vehicle_title} · {formatUsd(p.vehicle_price_cents)}</p>
          <p>Payment: {paymentLabel(p.payment_method ?? null)}{p.lender_name ? ` (${p.lender_name})` : ""}</p>
          <p>Trade-in: {p.has_trade_in ? p.trade_year_make_model : p.has_trade_in === false ? "None" : "—"}</p>
        </div>
      </div>
      {p.status !== "draft" && (
        <p className="rounded-md bg-primary/10 p-3 text-sm text-primary">
          Submitted {formatDate(p.submitted_at ?? null)}. We'll update the status here as your purchase moves along.
        </p>
      )}
    </div>
  );
}
