import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate } from "@/lib/format";
import {
  DOC_STATUS_LABELS,
  LEASE_APPLICATION_STATUSES,
  VAULT_DOC_LABELS,
  applicationStatusLabel,
  getLeaseTier,
  isLeaseTierKey,
  type LeaseDocStatus,
} from "@/lib/lease-to-own";
import {
  LEASE_REQUEST_STATUSES,
  staffGetLeaseDocumentUrl,
  staffReviewLeaseDocument,
  staffUpdateLeaseApplication,
  staffUpdateServiceRequest,
  type StaffLeaseOverview,
} from "@/lib/lease-to-own.functions";
import { leaseErrorMessage } from "@/lib/lease-to-own-client";
import { STATUS_TONES, formatCents, humanize } from "./helpers";
import { PendingIntegration, StatusPill } from "./shared";

export function StaffDms({
  accessToken,
  data,
  queryKey,
}: {
  accessToken: string;
  data: StaffLeaseOverview;
  queryKey: readonly unknown[];
}) {
  const queryClient = useQueryClient();
  const refresh = () => void queryClient.invalidateQueries({ queryKey });
  const awaitingReview = data.documents.filter(
    (d) => d.source === "customer" && (d.status === "uploaded" || d.status === "under_review"),
  );
  const openApps = data.applications.filter(
    (a) => !["approved", "declined", "withdrawn"].includes(a.status),
  );
  const openRequests = data.requests.filter((r) =>
    ["requested", "under_review"].includes(r.status),
  );
  const appName = (id: number) =>
    data.applications.find((a) => a.id === id)?.full_legal_name ?? `Application #${id}`;

  return (
    <div className="space-y-6">
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Open applications" value={openApps.length} />
        <Stat label="Documents awaiting review" value={awaitingReview.length} />
        <Stat label="Lease accounts" value={data.accounts.length} />
        <Stat label="Open service / assistance requests" value={openRequests.length} />
      </dl>

      <Tabs defaultValue="deals">
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="deals">Deals</TabsTrigger>
          <TabsTrigger value="documents">Document queue</TabsTrigger>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="ledger">Ledger</TabsTrigger>
          <TabsTrigger value="service">Maintenance</TabsTrigger>
          <TabsTrigger value="assistance">Assistance requests</TabsTrigger>
          <TabsTrigger value="audit">Audit log</TabsTrigger>
        </TabsList>

        <TabsContent value="deals">
          <Table
            head={["Applicant", "Package", "Vehicle", "Submitted", "Status", "Update"]}
            empty="No applications yet."
          >
            {data.applications.map((a) => (
              <tr key={a.id}>
                <td className="py-2 pr-3">
                  <p className="font-semibold">{a.full_legal_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.email} • SSN/ITIN:{" "}
                    {a.ssn_last4 ? `•••${a.ssn_last4}` : humanize(a.ssn_collection_status)} • DL{" "}
                    {a.dl_state} •••{a.dl_last4}
                  </p>
                </td>
                <td className="py-2 pr-3">
                  {isLeaseTierKey(a.tier) ? getLeaseTier(a.tier).name : a.tier}
                  <p className="text-xs text-muted-foreground">
                    {formatCents(a.down_payment_cents)} down • {formatCents(a.payment_cents)}{" "}
                    {a.payment_frequency}
                  </p>
                </td>
                <td className="py-2 pr-3">{a.vehicle_title ?? "Not assigned"}</td>
                <td className="py-2 pr-3">{formatDate(a.submitted_at)}</td>
                <td className="py-2 pr-3">
                  <StatusPill tone="info">{applicationStatusLabel(a.status)}</StatusPill>
                </td>
                <td className="py-2">
                  <ApplicationStatusEditor
                    accessToken={accessToken}
                    id={a.id}
                    status={a.status}
                    onDone={refresh}
                  />
                </td>
              </tr>
            ))}
          </Table>
        </TabsContent>

        <TabsContent value="documents">
          <Table
            head={["Applicant", "Document", "Uploaded", "Status", "Review"]}
            empty="No documents uploaded yet."
          >
            {data.documents.map((d) => (
              <tr key={d.id}>
                <td className="py-2 pr-3">{appName(d.application_id)}</td>
                <td className="py-2 pr-3">
                  {VAULT_DOC_LABELS[d.doc_type] ?? d.doc_type}
                  <p className="text-xs text-muted-foreground">
                    {d.mime_type} • {(d.size_bytes / 1024 / 1024).toFixed(1)} MB
                  </p>
                </td>
                <td className="py-2 pr-3">{formatDate(d.created_at)}</td>
                <td className="py-2 pr-3">
                  <StatusPill tone={STATUS_TONES[d.status as LeaseDocStatus] ?? "neutral"}>
                    {DOC_STATUS_LABELS[d.status as LeaseDocStatus] ?? d.status}
                  </StatusPill>
                  {d.review_note && (
                    <p className="mt-1 text-xs text-muted-foreground">{d.review_note}</p>
                  )}
                </td>
                <td className="py-2">
                  <DocumentReviewer accessToken={accessToken} id={d.id} onDone={refresh} />
                </td>
              </tr>
            ))}
          </Table>
        </TabsContent>

        <TabsContent value="accounts">
          <PendingIntegration title="DealerCenter / DMS sync is not connected">
            Accounts, balances and payment status are read-only here. They must be created and
            updated by an approved DMS integration so this console never becomes a second,
            conflicting ledger.
          </PendingIntegration>
          <Table
            head={[
              "Account",
              "Vehicle",
              "Status",
              "Balance",
              "Installments",
              "Next payment",
              "Source",
            ]}
            empty="No lease accounts yet."
          >
            {data.accounts.map((a) => (
              <tr key={a.id}>
                <td className="py-2 pr-3 font-semibold">#{a.account_number}</td>
                <td className="py-2 pr-3">
                  {a.vehicle_title ?? "—"}
                  <p className="text-xs text-muted-foreground">{a.vehicle_vin ?? ""}</p>
                </td>
                <td className="py-2 pr-3">
                  {humanize(a.status)} / {humanize(a.payment_status)}
                </td>
                <td className="py-2 pr-3">{formatCents(a.current_balance_cents)}</td>
                <td className="py-2 pr-3">
                  {a.completed_installments} / {a.total_installments ?? "—"}
                </td>
                <td className="py-2 pr-3">
                  {a.next_payment_date ? formatDate(a.next_payment_date) : "—"}
                </td>
                <td className="py-2">{a.dms_source ?? "—"}</td>
              </tr>
            ))}
          </Table>
        </TabsContent>

        <TabsContent value="ledger">
          <PendingIntegration title="Payment processor not connected">
            Ledger rows are written only by the payment processor or DMS after confirmation.
          </PendingIntegration>
          <Table
            head={["Account", "Due", "Amount", "Status", "Method", "Paid"]}
            empty="No payments recorded."
          >
            {data.payments.map((p) => (
              <tr key={p.id}>
                <td className="py-2 pr-3">
                  #
                  {data.accounts.find((a) => a.id === p.account_id)?.account_number ?? p.account_id}
                </td>
                <td className="py-2 pr-3">{p.due_date ? formatDate(p.due_date) : "—"}</td>
                <td className="py-2 pr-3">{formatCents(p.amount_cents)}</td>
                <td className="py-2 pr-3">{humanize(p.status)}</td>
                <td className="py-2 pr-3">{p.method ?? "—"}</td>
                <td className="py-2">{p.paid_at ? formatDate(p.paid_at) : "—"}</td>
              </tr>
            ))}
          </Table>
        </TabsContent>

        {(["maintenance", "emergency"] as const).map((kind) => (
          <TabsContent key={kind} value={kind === "maintenance" ? "service" : "assistance"}>
            {kind === "emergency" && (
              <PendingIntegration title="No telematics provider is connected">
                Review and respond to customer requests here. Starter-interrupt or override actions
                cannot be sent from this console; they require an approved, audited telematics
                provider integration and explicit authorization.
              </PendingIntegration>
            )}
            <Table head={["Requested", "Details", "Status", "Update"]} empty="No requests.">
              {data.requests
                .filter((r) => r.kind === kind)
                .map((r) => (
                  <tr key={r.id}>
                    <td className="py-2 pr-3">
                      {formatDate(r.created_at)}
                      <p className="text-xs text-muted-foreground">
                        Account{" "}
                        {data.accounts.find((a) => a.id === r.account_id)?.account_number ?? "—"}
                      </p>
                    </td>
                    <td className="py-2 pr-3">
                      {r.requested_date
                        ? `${formatDate(r.requested_date)} • ${r.time_window ?? ""}`
                        : ""}
                      <p className="text-xs text-muted-foreground">{r.notes}</p>
                    </td>
                    <td className="py-2 pr-3">
                      {humanize(r.status)}
                      {r.handled_by && (
                        <p className="text-xs text-muted-foreground">by {r.handled_by}</p>
                      )}
                    </td>
                    <td className="py-2">
                      <RequestEditor
                        accessToken={accessToken}
                        id={r.id}
                        kind={kind}
                        status={r.status}
                        onDone={refresh}
                      />
                    </td>
                  </tr>
                ))}
            </Table>
          </TabsContent>
        ))}

        <TabsContent value="audit">
          <Table head={["When", "Actor", "Action", "Record"]} empty="No audit entries.">
            {data.audit.map((e) => (
              <tr key={e.id}>
                <td className="py-2 pr-3">{new Date(e.created_at).toLocaleString("en-US")}</td>
                <td className="py-2 pr-3">
                  {e.actor_email ?? "—"}{" "}
                  <span className="text-xs text-muted-foreground">({e.actor_role})</span>
                </td>
                <td className="py-2 pr-3">{humanize(e.action)}</td>
                <td className="py-2">
                  {e.entity} {e.entity_id ? `#${e.entity_id}` : ""}
                </td>
              </tr>
            ))}
          </Table>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ApplicationStatusEditor({
  accessToken,
  id,
  status,
  onDone,
}: {
  accessToken: string;
  id: number;
  status: string;
  onDone: () => void;
}) {
  const [next, setNext] = useState(status);
  const [note, setNote] = useState("");
  const mutation = useMutation({
    mutationFn: () =>
      staffUpdateLeaseApplication({ data: { accessToken, id, status: next, note } }),
    onSuccess: () => {
      toast.success("Application updated.");
      setNote("");
      onDone();
    },
    onError: (error) => toast.error(leaseErrorMessage(error)),
  });
  return (
    <div className="flex min-w-56 flex-col gap-2">
      <Select value={next} onValueChange={setNext}>
        <SelectTrigger aria-label="Application status" className="h-8">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {LEASE_APPLICATION_STATUSES.map((s) => (
            <SelectItem key={s.key} value={s.key}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        className="h-8"
        placeholder="Internal note (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        aria-label="Internal note"
      />
      <Button
        size="sm"
        disabled={mutation.isPending || (next === status && !note)}
        onClick={() => mutation.mutate()}
      >
        Save
      </Button>
    </div>
  );
}

function DocumentReviewer({
  accessToken,
  id,
  onDone,
}: {
  accessToken: string;
  id: number;
  onDone: () => void;
}) {
  const [note, setNote] = useState("");
  const review = useMutation({
    mutationFn: (status: "under_review" | "verified" | "rejected") =>
      staffReviewLeaseDocument({ data: { accessToken, documentId: id, status, note } }),
    onSuccess: () => {
      toast.success("Document updated.");
      setNote("");
      onDone();
    },
    onError: (error) => toast.error(leaseErrorMessage(error)),
  });
  async function view() {
    const win = window.open("about:blank", "_blank");
    try {
      const { url } = await staffGetLeaseDocumentUrl({ data: { accessToken, documentId: id } });
      if (win) win.location.href = url;
    } catch (error) {
      win?.close();
      toast.error(leaseErrorMessage(error));
    }
  }
  return (
    <div className="flex min-w-64 flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" variant="outline" onClick={() => void view()}>
          <Eye className="size-4" /> View
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={review.isPending}
          onClick={() => review.mutate("under_review")}
        >
          In review
        </Button>
        <Button size="sm" disabled={review.isPending} onClick={() => review.mutate("verified")}>
          Verify
        </Button>
        <Button
          size="sm"
          variant="destructive"
          disabled={review.isPending || !note.trim()}
          onClick={() => review.mutate("rejected")}
        >
          Reject
        </Button>
      </div>
      <Input
        className="h-8"
        placeholder="Note to customer (required to reject)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        aria-label="Review note"
      />
    </div>
  );
}

function RequestEditor({
  accessToken,
  id,
  kind,
  status,
  onDone,
}: {
  accessToken: string;
  id: number;
  kind: "maintenance" | "emergency";
  status: string;
  onDone: () => void;
}) {
  const [next, setNext] = useState(status);
  const [note, setNote] = useState("");
  const mutation = useMutation({
    mutationFn: () =>
      staffUpdateServiceRequest({ data: { accessToken, id, kind, status: next, note } }),
    onSuccess: () => {
      toast.success("Request updated.");
      setNote("");
      onDone();
    },
    onError: (error) => toast.error(leaseErrorMessage(error)),
  });
  return (
    <div className="flex min-w-56 flex-col gap-2">
      <Select value={next} onValueChange={setNext}>
        <SelectTrigger aria-label="Request status" className="h-8">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {LEASE_REQUEST_STATUSES[kind].map((s) => (
            <SelectItem key={s} value={s}>
              {humanize(s)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        className="h-8"
        placeholder="Note visible to customer"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        aria-label="Note to customer"
      />
      <Button
        size="sm"
        disabled={mutation.isPending || (next === status && !note)}
        onClick={() => mutation.mutate()}
      >
        Save
      </Button>
    </div>
  );
}

function Table({
  head,
  empty,
  children,
}: {
  head: string[];
  empty: string;
  children: React.ReactNode[];
}) {
  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-3 py-2.5 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border [&_td:first-child]:pl-3 [&_td:last-child]:pr-3">
          {children.length ? (
            children
          ) : (
            <tr>
              <td colSpan={head.length} className="px-3 py-6 text-center text-muted-foreground">
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 font-display text-3xl font-black text-primary">{value}</dd>
    </div>
  );
}
