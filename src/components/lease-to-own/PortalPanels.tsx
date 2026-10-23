import { useState, type ReactNode } from "react";
import {
  AlertTriangle,
  CalendarClock,
  Download,
  FileText,
  Gauge,
  LifeBuoy,
  Wallet,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trackLeaseEvent } from "@/lib/analytics";
import { formatDate } from "@/lib/format";
import {
  DOC_STATUS_LABELS,
  MAINTENANCE_TIME_WINDOWS,
  SERVICE_LOCATION,
  VAULT_DOC_LABELS,
  estimatePayoffDate,
  usd,
  type LeaseDocStatus,
} from "@/lib/lease-to-own";
import {
  requestLeaseEmergencyAssistance,
  requestLeaseMaintenance,
  type LeaseAccountRow,
  type LeaseDocumentRow,
  type LeasePaymentRow,
  type LeaseServiceRequestRow,
} from "@/lib/lease-to-own.functions";
import { leaseErrorMessage } from "@/lib/lease-to-own-client";
import { STATUS_TONES } from "./helpers";
import { PendingIntegration, StatusPill } from "./shared";

const money = (cents: number | null | undefined) => (cents == null ? "—" : usd(cents / 100, true));
const label = (value: string) => value.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

export function Panel({
  title,
  icon,
  children,
  className,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-border bg-card p-5 sm:p-6 ${className ?? ""}`}>
      <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
        <span className="text-[#F7941D]" aria-hidden="true">
          {icon}
        </span>
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function PayoffCountdown({ account }: { account: LeaseAccountRow }) {
  const total = account.total_installments ?? 0;
  const done = Math.min(total, account.completed_installments);
  const remaining = Math.max(0, total - done);
  const payoff = account.payment_frequency
    ? estimatePayoffDate(account.next_payment_date, remaining, account.payment_frequency)
    : null;
  return (
    <Panel title="Payoff countdown" icon={<CalendarClock className="size-5" />}>
      {total ? (
        <>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Metric label="Total installments" value={String(total)} />
            <Metric label="Completed" value={String(done)} />
            <Metric label="Remaining" value={String(remaining)} />
            <Metric label="Remaining balance" value={money(account.current_balance_cents)} />
          </dl>
          <Progress
            className="mt-4"
            value={(done / total) * 100}
            aria-label={`${done} of ${total} installments completed`}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            {payoff
              ? `Estimated payoff: ${formatDate(payoff)} if every remaining payment is made on schedule.`
              : "Payoff date will appear once your payment schedule is set."}
          </p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          Your installment schedule hasn't been posted to your account yet.
        </p>
      )}
    </Panel>
  );
}

export function PaymentCenter({
  account,
  payments,
  onOpenDocument,
}: {
  account: LeaseAccountRow;
  payments: LeasePaymentRow[];
  onOpenDocument: (id: number) => void;
}) {
  return (
    <Panel title="Payment center" icon={<Wallet className="size-5" />}>
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Metric label="Next payment" value={money(account.payment_cents)} />
        <Metric
          label="Due"
          value={account.next_payment_date ? formatDate(account.next_payment_date) : "—"}
        />
        <Metric label="Payment status" value={label(account.payment_status)} />
      </dl>
      <div className="mt-4">
        <PendingIntegration title="Online payments are not available yet">
          ACH and card payments will run through an approved payment processor. A payment only
          appears below as confirmed after the processor confirms it. To pay now, call (540)
          426-3322.
        </PendingIntegration>
      </div>
      <h3 className="mt-5 text-sm font-semibold">Payment history</h3>
      {payments.length ? (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-2 pr-3">Due</th>
                <th className="py-2 pr-3">Amount</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Paid</th>
                <th className="py-2">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="py-2 pr-3">{p.due_date ? formatDate(p.due_date) : "—"}</td>
                  <td className="py-2 pr-3 font-semibold">{money(p.amount_cents)}</td>
                  <td className="py-2 pr-3">
                    <StatusPill
                      tone={
                        p.status === "confirmed"
                          ? "success"
                          : p.status === "failed"
                            ? "danger"
                            : "neutral"
                      }
                    >
                      {label(p.status)}
                    </StatusPill>
                  </td>
                  <td className="py-2 pr-3">{p.paid_at ? formatDate(p.paid_at) : "—"}</td>
                  <td className="py-2">
                    {p.receipt_document_id ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onOpenDocument(p.receipt_document_id!)}
                      >
                        <Download className="size-4" /> Receipt
                      </Button>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">No payments recorded yet.</p>
      )}
    </Panel>
  );
}

export function MileageTracker({ account }: { account: LeaseAccountRow }) {
  const allowance = account.annual_mileage_allowance;
  const hasData =
    account.verified_odometer != null && account.start_odometer != null && account.lease_start_date;
  if (!hasData) {
    return (
      <Panel
        title={`${allowance.toLocaleString()}-mile annual allowance`}
        icon={<Gauge className="size-5" />}
      >
        <p className="text-sm text-muted-foreground">
          Verified mileage isn't available yet. It's recorded at your 90-day service visits;
          telematics mileage will appear here once that integration is connected.
        </p>
      </Panel>
    );
  }
  const used = Math.max(0, account.verified_odometer! - account.start_odometer!);
  const years = Math.max(
    1 / 12,
    (Date.now() - new Date(account.lease_start_date!).getTime()) / (365.25 * 24 * 3600 * 1000),
  );
  const allowanceToDate = Math.round(allowance * years);
  const remaining = allowanceToDate - used;
  const over = remaining < 0;
  return (
    <Panel
      title={`${allowance.toLocaleString()}-mile annual allowance`}
      icon={<Gauge className="size-5" />}
    >
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Metric label="Annual allowance" value={`${allowance.toLocaleString()} mi`} />
        <Metric label="Driven (verified)" value={`${used.toLocaleString()} mi`} />
        <Metric
          label="Prorated allowance to date"
          value={`${allowanceToDate.toLocaleString()} mi`}
        />
        <Metric
          label={over ? "Over allowance" : "Remaining to date"}
          value={`${Math.abs(remaining).toLocaleString()} mi`}
        />
      </dl>
      <Progress
        className="mt-4"
        value={Math.min(100, (used / Math.max(1, allowanceToDate)) * 100)}
        aria-label="Mileage used against prorated allowance"
      />
      <p className="mt-2 text-xs text-muted-foreground">
        Last verified{" "}
        {account.odometer_verified_at ? formatDate(account.odometer_verified_at) : "—"}.
      </p>
      {over && (
        <p
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" /> You're over your prorated mileage
          allowance. Contact us to discuss your options.
        </p>
      )}
    </Panel>
  );
}

export function MaintenanceScheduler({
  accessToken,
  enabled,
  requests,
  onCreated,
}: {
  accessToken: string;
  enabled: boolean;
  requests: LeaseServiceRequestRow[];
  onCreated: () => void;
}) {
  const [date, setDate] = useState("");
  const [timeWindow, setTimeWindow] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await requestLeaseMaintenance({ data: { accessToken, date, timeWindow, notes } });
      trackLeaseEvent("lease_to_own_booking_requested", {}, false);
      toast.success("Request sent. We'll confirm your appointment time.");
      setDate("");
      setNotes("");
      onCreated();
    } catch (error) {
      toast.error(leaseErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  const maintenance = requests.filter((r) => r.kind === "maintenance");
  return (
    <Panel title="Free 90-day service" icon={<Wrench className="size-5" />}>
      <p className="text-sm text-muted-foreground">
        Service location: {SERVICE_LOCATION}. Requests are reviewed by our service team, who confirm
        the final time with you.
      </p>
      {enabled ? (
        <form onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="lto-service-date">Requested date</Label>
            <Input
              id="lto-service-date"
              type="date"
              min={tomorrow}
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lto-service-window">Preferred time window</Label>
            <Select value={timeWindow || undefined} onValueChange={setTimeWindow}>
              <SelectTrigger id="lto-service-window">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {MAINTENANCE_TIME_WINDOWS.map((w) => (
                  <SelectItem key={w} value={w}>
                    {w}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="lto-service-notes">Anything we should know? (optional)</Label>
            <Textarea
              id="lto-service-notes"
              rows={2}
              maxLength={1000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <Button
            type="submit"
            disabled={busy || !date || !timeWindow}
            className="sm:col-span-2 sm:justify-self-start"
          >
            {busy ? "Sending…" : "Request service appointment"}
          </Button>
        </form>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          Service requests open once your lease account is active.
        </p>
      )}
      <RequestList requests={maintenance} empty="No service requests yet." />
    </Panel>
  );
}

export function EmergencyAssistance({
  accessToken,
  enabled,
  requests,
  onCreated,
}: {
  accessToken: string;
  enabled: boolean;
  requests: LeaseServiceRequestRow[];
  onCreated: () => void;
}) {
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await requestLeaseEmergencyAssistance({ data: { accessToken, notes } });
      toast.success("Request received. A team member will contact you.");
      setNotes("");
      onCreated();
    } catch (error) {
      toast.error(leaseErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Emergency mobility assistance" icon={<LifeBuoy className="size-5" />}>
      <p className="text-sm text-muted-foreground">
        Facing a medical emergency or can't get to work? Send a request and an authorized team
        member will review it and contact you. For immediate help call (540) 426-3322. If you are in
        danger, call 911.
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        Vehicle override codes are never issued through this website. Any assistance involving your
        vehicle's telematics device is handled by authorized staff only.
      </p>
      {enabled ? (
        <form onSubmit={submit} className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="lto-emergency-notes">What's happening?</Label>
            <Textarea
              id="lto-emergency-notes"
              rows={3}
              minLength={10}
              maxLength={1000}
              required
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={busy || notes.trim().length < 10}>
            {busy ? "Sending…" : "Request assistance"}
          </Button>
        </form>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          Available once your lease account is active.
        </p>
      )}
      <RequestList
        requests={requests.filter((r) => r.kind === "emergency")}
        empty="No assistance requests."
      />
    </Panel>
  );
}

export function DocumentVault({
  documents,
  onOpen,
}: {
  documents: LeaseDocumentRow[];
  onOpen: (id: number) => void;
}) {
  return (
    <Panel title="Document vault" icon={<FileText className="size-5" />}>
      {documents.length ? (
        <ul className="divide-y divide-border">
          {documents.map((doc) => (
            <li key={doc.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="font-semibold text-foreground">
                  {VAULT_DOC_LABELS[doc.doc_type] ?? doc.doc_type}
                </p>
                <p className="text-xs text-muted-foreground">
                  {doc.source === "staff" ? "From My Car" : "Uploaded by you"} •{" "}
                  {formatDate(doc.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {doc.source === "customer" && (
                  <StatusPill tone={STATUS_TONES[doc.status as LeaseDocStatus] ?? "neutral"}>
                    {DOC_STATUS_LABELS[doc.status as LeaseDocStatus] ?? doc.status}
                  </StatusPill>
                )}
                <Button size="sm" variant="outline" onClick={() => onOpen(doc.id)}>
                  <Download className="size-4" /> Open
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          Executed agreements, receipts, warranty documents and inspection records will appear here.
        </p>
      )}
    </Panel>
  );
}

function RequestList({ requests, empty }: { requests: LeaseServiceRequestRow[]; empty: string }) {
  if (!requests.length) return <p className="mt-4 text-xs text-muted-foreground">{empty}</p>;
  return (
    <ul className="mt-4 divide-y divide-border text-sm">
      {requests.map((r) => (
        <li key={r.id} className="flex flex-wrap items-start justify-between gap-2 py-2">
          <div>
            <p className="font-medium">
              {r.requested_date
                ? `${formatDate(r.requested_date)} • ${r.time_window ?? ""}`
                : formatDate(r.created_at)}
            </p>
            {r.staff_note && (
              <p className="text-xs text-muted-foreground">My Car: {r.staff_note}</p>
            )}
          </div>
          <StatusPill
            tone={
              ["confirmed", "resolved", "completed"].includes(r.status)
                ? "success"
                : ["cancelled", "declined"].includes(r.status)
                  ? "danger"
                  : "warning"
            }
          >
            {label(r.status)}
          </StatusPill>
        </li>
      ))}
    </ul>
  );
}

function Metric({ label: name, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{name}</dt>
      <dd className="font-display text-xl font-extrabold text-foreground">{value}</dd>
    </div>
  );
}
