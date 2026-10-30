import { useState, type ReactNode } from "react";
import {
  CircleAlert,
  CircleCheck,
  Clock,
  FileLock2,
  Scale,
  ShieldOff,
  TriangleAlert,
} from "lucide-react";

import { formatSignatureDate, type SignerRole } from "@/lib/contract-signatures";
import { fieldDef, fullName, text, type Deal, type EditActor } from "@/lib/deal-model";
import { initialKey, type DemoInitials } from "@/lib/demo-signatures";
import {
  GPS_LEGAL_REVIEW,
  GPS_PROVISION_INITIAL_ROLES,
  GPS_PROVISIONS,
  gpsCreditorName,
  gpsDeviceState,
  gpsDisclosureIssues,
  type GpsProvision,
} from "@/lib/gps-disclosure";
import { formatFormDate } from "@/lib/retail-installment";
import { cn } from "@/lib/utils";
import { AcknowledgmentInitials } from "./AcknowledgmentInitials";
import {
  Bar,
  PageHeading,
  PendingNote,
  PendingText,
  Provenance,
  TextField,
} from "./ContractFormParts";

const PAGES = 2;
const ROLE: Partial<Record<SignerRole, string>> = { buyer: "Borrower", co_buyer: "Co-Borrower" };
const SCRIPT_STYLE = {
  fontFamily: '"Brush Script MT", "Segoe Script", "Lucida Handwriting", cursive',
} as const;
const WORDING = "Approved GPS disclosure wording required";

/**
 * Form 4 — Disclosure Statement and Agreement for GPS Installation as a web
 * form, in the reference's two pages:
 *   1. Borrower / Co-Borrower, vehicle, GPS device ID, opening disclosure and
 *      provisions 1–4 (4 continues on page 2);
 *   2. provisions 4 (continued)–8, default provision, NOTICE and signatures.
 *
 * Borrower, vehicle and dealer values are the shared deal fields (edited on
 * Forms 1–3), shown read-only. Each provision is initialled on its own by its
 * own signer; nothing is pre-initialled. This form never tracks, disables or
 * otherwise acts on a vehicle or device.
 */
export function GpsDisclosureEditor({
  deal,
  actor,
  onEdit,
  renderSignatures,
  initials,
  actingRole,
  onInitial,
  onClearInitial,
}: {
  deal: Deal;
  actor: EditActor;
  /** Returns an error message when the edit is refused. */
  onEdit: (key: string, value: string | boolean) => string | undefined;
  renderSignatures?: (slotIds: string[]) => ReactNode | null;
  /** Provision initials (demo: page memory only). */
  initials: DemoInitials;
  /** The signer currently acting (chosen in the signature pad). */
  actingRole: SignerRole;
  onInitial?: (provision: number, value: string) => string | undefined;
  onClearInitial?: (provision: number) => void;
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const canEdit = actor === "staff";
  const canInitial = actor === "customer" && Boolean(onInitial);
  const device = gpsDeviceState(deal);
  const issues = gpsDisclosureIssues(deal);
  const creditor = gpsCreditorName(deal);
  const date = text(deal, "deal.date");

  const edit = (key: string, value: string | boolean) => {
    const error = onEdit(key, value);
    setErrors((prev) => {
      const next = { ...prev };
      if (error) next[key] = error;
      else delete next[key];
      return next;
    });
  };
  const field = (key: string, label?: string) => (
    <TextField
      deal={deal}
      fieldKey={key}
      label={label ?? fieldDef(key)?.label ?? key}
      canEdit={canEdit}
      error={errors[key]}
      onEdit={edit}
      idPrefix="gps"
    />
  );

  const progress = GPS_PROVISION_INITIAL_ROLES.map((role) => ({
    role,
    done: GPS_PROVISIONS.filter((p) => initials[initialKey("gps_disclosure", p.number, role)])
      .length,
  }));
  const shownSignatures = renderSignatures?.(["gps-p2-borrower", "gps-p2-coborrower"]);

  const provision = (p: GpsProvision, page: 1 | 2) => {
    const continued = p.pages.length > 1 && page === 2;
    return (
      <li
        key={`${p.number}-${page}`}
        data-provision={p.number}
        data-provision-page={page}
        className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-[9rem_1fr]"
      >
        <div className="space-y-2">
          {continued ? (
            <p className="text-[11px] text-slate-500">Initialled once, with provision 4 above.</p>
          ) : (
            GPS_PROVISION_INITIAL_ROLES.map((role) => (
              <AcknowledgmentInitials
                key={role}
                role={role}
                noun="Provision"
                item={p.number}
                who={ROLE[role] ?? role}
                entry={initials[initialKey("gps_disclosure", p.number, role)]}
                acting={canInitial && actingRole === role}
                onInitial={onInitial}
                onClear={onClearInitial}
              />
            ))
          )}
        </div>
        <div className="min-w-0 text-xs">
          <p className="font-extrabold">
            {p.number}.{continued && " (continued)"}{" "}
            <span className="font-semibold text-slate-700">{p.title}</span>
          </p>
          {p.pages.length > 1 && !continued && (
            <p className="text-[11px] font-semibold text-slate-500">Continues on page 2.</p>
          )}
          {p.legalReview && !continued && (
            <p className="mt-1 inline-flex items-center gap-1 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-800">
              <Scale className="size-3" aria-hidden="true" /> Qualified legal review required
            </p>
          )}
          <p className="mt-1 text-[10px] font-semibold text-amber-700">
            {WORDING}. Creditor named in this provision: {creditor || "missing"}.
          </p>
        </div>
      </li>
    );
  };

  return (
    <div className="rounded-xl bg-white p-4 text-slate-900 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-fuchsia-700">
            DEMO — not a legal contract
          </p>
          <h4 className="font-display text-xl font-extrabold">
            DISCLOSURE STATEMENT AND AGREEMENT FOR GPS INSTALLATION
          </h4>
          <p className="text-xs text-slate-500">
            {canEdit
              ? "Staff view: record the assigned device. Borrower and vehicle details come from Forms 1–3."
              : "Customer view: read the disclosure and initial each provision yourself."}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
          <FileLock2 className="size-3.5" aria-hidden="true" /> Approved template unavailable
        </span>
      </div>

      <p
        role="note"
        className="mt-4 flex gap-2 rounded-lg border border-violet-300 bg-violet-50 p-3 text-xs text-violet-950"
      >
        <Scale className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>
          <strong>Legal review.</strong> {GPS_LEGAL_REVIEW}
        </span>
      </p>
      <p
        role="note"
        className="mt-3 flex gap-2 rounded-lg border border-slate-300 bg-slate-50 p-3 text-xs text-slate-800"
      >
        <ShieldOff className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>
          Disclosure only. This form never tracks, locates, disables or controls a vehicle or
          device, and does not activate any GPS service.
        </span>
      </p>

      <ul
        aria-label="Disclosure status"
        className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold"
      >
        <Status
          ok={Boolean(text(deal, "vehicle.vin"))}
          text={text(deal, "vehicle.vin") ? "Vehicle assigned" : "Vehicle not assigned"}
        />
        <Status
          ok={device === "verified"}
          pending={device === "pending_verification"}
          text={
            device === "verified"
              ? "GPS device verified (staff)"
              : device === "pending_verification"
                ? "GPS device assignment pending verification"
                : "GPS device not assigned"
          }
        />
        <Status ok={false} text="Disclosure awaiting review — approved template unavailable" />
        {progress.map((p) => (
          <Status
            key={p.role}
            ok={p.done === GPS_PROVISIONS.length}
            pending={p.done > 0 && p.done < GPS_PROVISIONS.length}
            text={`${ROLE[p.role]} acknowledgments ${p.done}/${GPS_PROVISIONS.length}${p.done === GPS_PROVISIONS.length ? " (demo)" : " — incomplete"}`}
          />
        ))}
        {deal.coBuyerIncluded && (
          <Status
            pending
            ok={false}
            text="Co-Borrower provision acknowledgment — per approved template"
          />
        )}
      </ul>
      {issues.length > 0 && (
        <div
          role="status"
          aria-label="Needs review"
          className="mt-3 rounded-lg border border-red-300 bg-red-50 p-3 text-xs text-red-900"
        >
          <p className="flex items-center gap-1.5 font-bold">
            <TriangleAlert className="size-4" aria-hidden="true" /> Needs review ({issues.length})
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {issues.map((i) => (
              <li key={i.id} data-issue={i.id}>
                {i.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ---------------- Page 1 ---------------- */}
      <PageHeading
        page={1}
        total={PAGES}
        title="GPS Installation Disclosure & Acknowledgments 1–4"
      />
      <div className="mt-3 space-y-3 rounded-lg border border-slate-200 p-3 text-xs">
        <Row
          label="Borrower Name"
          value={fullName(deal, "buyer")}
          source="buyer.firstName"
          deal={deal}
          dateLabel="Date"
          date={date}
        />
        {deal.coBuyerIncluded && (
          <Row
            label="Co-Borrower Name"
            value={fullName(deal, "coBuyer")}
            source="coBuyer.firstName"
            deal={deal}
            dateLabel="Date"
            date={date}
          />
        )}
        <div>
          <p className="mb-1 text-[11px] font-bold text-slate-700">Vehicle Description</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <Cell
              label="Model Year"
              value={text(deal, "vehicle.year")}
              deal={deal}
              fieldKey="vehicle.year"
            />
            <Cell
              label="Model"
              value={text(deal, "vehicle.model")}
              deal={deal}
              fieldKey="vehicle.model"
            />
            <Cell
              label="Make"
              value={text(deal, "vehicle.make")}
              deal={deal}
              fieldKey="vehicle.make"
            />
            <div className="sm:col-span-3">
              <Cell
                label="Vehicle Identification Number (VIN)"
                value={text(deal, "vehicle.vin")}
                deal={deal}
                fieldKey="vehicle.vin"
              />
            </div>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            {field("gps.deviceId")}
            {!text(deal, "gps.deviceId") && (
              <p data-gps-unassigned className="text-[11px] font-bold text-amber-700">
                GPS Device Not Assigned
              </p>
            )}
          </div>
          <DeviceStatus deal={deal} canEdit={canEdit} onEdit={edit} />
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <Cell
            label="Dealer/Creditor legal name"
            value={text(deal, "dealer.legalName")}
            deal={deal}
            fieldKey="dealer.legalName"
          />
          {field("gps.controller")}
          {field("gps.assignee")}
        </div>
      </div>

      <div className="mt-3 space-y-3">
        <PendingText title="GPS electronic device disclosure (tracking unit, ignition interrupter, creditor control, when tracking records are shared)">
          <p className="mt-1 text-slate-600">
            Creditor named in the disclosure: {creditor || "missing"}.
          </p>
          <p className="text-[10px] font-semibold text-amber-700">{WORDING}.</p>
        </PendingText>
        <Bar>By reading and signing below — acceptance of the installation terms</Bar>
        <PendingNote />
        <ol className="space-y-2">
          {GPS_PROVISIONS.filter((p) => p.pages.includes(1)).map((p) => provision(p, 1))}
        </ol>
      </div>

      {/* ---------------- Page 2 ---------------- */}
      <PageHeading page={2} total={PAGES} title="Acknowledgments 4–8, Final Notice & Signatures" />
      <div className="mt-3 space-y-3">
        <ol className="space-y-2">
          {GPS_PROVISIONS.filter((p) => p.pages.includes(2)).map((p) => provision(p, 2))}
        </ol>
        <PendingText title="Violation of this Agreement as a default under the Contract; creditor's remedies">
          <p className="mt-1 inline-flex items-center gap-1 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-800">
            <Scale className="size-3" aria-hidden="true" /> Qualified legal review required
          </p>
        </PendingText>
        <div data-gps-notice className="rounded-lg border-2 border-slate-900 p-3">
          <p className="text-sm font-extrabold uppercase">
            Notice — do not sign without reading the agreement
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Acknowledgment of the opportunity to read and ask questions, and incorporation into the
            Contract.
          </p>
          <PendingNote />
        </div>
        <Bar>Signatures</Bar>
        {shownSignatures ? (
          <div className="rounded-lg border border-slate-200 p-3">{shownSignatures}</div>
        ) : (
          <p className="rounded-lg border border-dashed border-slate-300 p-3 text-xs text-slate-600">
            Borrower and Co-Borrower signature lines appear here once signing is available.
          </p>
        )}
        <p className="text-[11px] text-slate-500">
          BORROWER / CO-BORROWER (Print Name) come from the application. Signature dates are the
          date each signer actually signs — never backdated to the contract date.
        </p>
      </div>
    </div>
  );
}

function Status({ ok, pending, text: label }: { ok: boolean; pending?: boolean; text: string }) {
  return (
    <li
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1",
        ok
          ? "border-emerald-300 bg-emerald-50 text-emerald-800"
          : pending
            ? "border-sky-300 bg-sky-50 text-sky-800"
            : "border-amber-300 bg-amber-50 text-amber-900",
      )}
    >
      {ok ? (
        <CircleCheck className="size-3" aria-hidden="true" />
      ) : (
        <CircleAlert className="size-3" aria-hidden="true" />
      )}
      {label}
    </li>
  );
}

function Cell({
  label,
  value,
  deal,
  fieldKey,
}: {
  label: string;
  value: string;
  deal: Deal;
  fieldKey: string;
}) {
  return (
    <div className="min-w-0 space-y-0.5">
      <p className="text-[11px] font-semibold text-slate-700">
        {label}
        <Provenance deal={deal} fieldKey={fieldKey} />
      </p>
      <output
        aria-label={label}
        className="block truncate rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs"
      >
        {value || <span className="text-amber-700">Missing</span>}
      </output>
    </div>
  );
}

function Row({
  label,
  value,
  source,
  deal,
  dateLabel,
  date,
}: {
  label: string;
  value: string;
  source: string;
  deal: Deal;
  dateLabel: string;
  date: string;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-[1fr_10rem]">
      <Cell label={label} value={value} deal={deal} fieldKey={source} />
      <Cell
        label={dateLabel}
        value={date ? formatFormDate(date) : ""}
        deal={deal}
        fieldKey="deal.date"
      />
    </div>
  );
}

function DeviceStatus({
  deal,
  canEdit,
  onEdit,
}: {
  deal: Deal;
  canEdit: boolean;
  onEdit: (key: string, value: string) => void;
}) {
  const options = fieldDef("gps.deviceStatus")?.options ?? [];
  return (
    <div className="space-y-0.5">
      <label htmlFor="gps-device-status" className="block text-[11px] font-semibold text-slate-700">
        GPS device assignment
        <Provenance deal={deal} fieldKey="gps.deviceStatus" />
      </label>
      <select
        id="gps-device-status"
        value={text(deal, "gps.deviceStatus")}
        disabled={!canEdit}
        onChange={(e) => onEdit("gps.deviceStatus", e.target.value)}
        className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs disabled:bg-slate-50"
      >
        <option value="">Not set</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <p className="text-[10px] text-slate-500">
        Never shown as installed or active without a verified provider record.
      </p>
    </div>
  );
}
