import { useState, type ReactNode } from "react";
import { CircleAlert, CircleCheck, FileLock2, Lock, TriangleAlert } from "lucide-react";

import { fieldDef, fullName, text, type Deal, type EditActor } from "@/lib/deal-model";
import {
  insuranceCreditor,
  insuranceIssues,
  insuranceSummary,
  VERIFICATION_LABELS,
  verificationStatus,
} from "@/lib/insurance-agreement";
import { INSURANCE_COVERAGES } from "@/lib/insurance-agreement-fields";
import { cn } from "@/lib/utils";
import { CheckField, MoneyInput, PendingText, Provenance, TextField } from "./ContractFormParts";

/**
 * Form 6 — Agreement to Provide Insurance as a web form, laid out like the
 * one-page reference: title, "To:" creditor, two disclosure paragraphs,
 * vehicle insured, purchasers and address, agent and policy, effective dates,
 * coverage and deductibles, purchaser and dealer signatures, customer notice.
 *
 * Purchasers, address, vehicle, dealer and the insurance company / policy /
 * status are the shared deal fields (also used by Forms 1–5). Coverage starts
 * unknown and only staff can record verification; filling fields never proves
 * coverage. Signing is not performed here.
 */
export function InsuranceAgreementEditor({
  deal,
  actor,
  onEdit,
  renderSignatures,
  signed,
}: {
  deal: Deal;
  actor: EditActor;
  onEdit: (key: string, value: string | boolean) => string | undefined;
  renderSignatures?: (slotIds: string[]) => ReactNode | null;
  signed: { buyer: boolean; co_buyer: boolean; dealer: boolean };
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const canEdit = actor === "staff";
  const creditor = insuranceCreditor(deal);
  const issues = insuranceIssues(deal);
  const summary = insuranceSummary(deal, signed);
  const verification = verificationStatus(deal);
  const vin = text(deal, "vehicle.vin");
  const coBuyerAddressDiffers =
    deal.coBuyerIncluded && text(deal, "coBuyer.street") !== text(deal, "buyer.street");

  const edit = (key: string, value: string | boolean) => {
    const error = onEdit(key, value);
    setErrors((prev) => {
      const next = { ...prev };
      if (error) next[key] = error;
      else delete next[key];
      return next;
    });
  };
  const field = (key: string, label?: string, className?: string) => (
    <TextField
      deal={deal}
      fieldKey={key}
      label={label ?? fieldDef(key)?.label ?? key}
      canEdit={canEdit}
      error={errors[key]}
      onEdit={edit}
      idPrefix="ins"
      className={className}
    />
  );
  const money = (key: string, label: string) => (
    <div className="space-y-0.5">
      <span className="flex items-center gap-2 text-[11px] font-semibold text-slate-700">
        {label}
        <MoneyInput
          deal={deal}
          fieldKey={key}
          label={label}
          canEdit={canEdit}
          error={errors[key]}
          onEdit={edit}
          placeholder=""
        />
      </span>
      {errors[key] && <p className="text-[11px] text-red-600">{errors[key]}</p>}
    </div>
  );
  const signature = (id: string, none: string) => {
    const shown = renderSignatures?.([id]);
    return shown ? (
      <div className="rounded-lg border border-slate-200 p-3">{shown}</div>
    ) : (
      <p className="rounded-lg border border-dashed border-slate-300 p-3 text-xs text-slate-600">
        {none}
      </p>
    );
  };
  const line = (label: string, value: ReactNode, fieldKey?: string) => (
    <div className="grid gap-1 sm:grid-cols-[9rem_1fr] sm:items-baseline">
      <p className="text-xs font-bold sm:text-right">
        {label}:{fieldKey && <Provenance deal={deal} fieldKey={fieldKey} />}
      </p>
      <output aria-label={label} className="min-w-0 border-b border-slate-400 pb-0.5 text-sm">
        {value || <span className="text-amber-700">Missing</span>}
      </output>
    </div>
  );

  return (
    <div className="rounded-xl bg-white p-4 text-slate-900 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-widest text-fuchsia-700">
          DEMO — not a legal contract
        </p>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
          <FileLock2 className="size-3.5" aria-hidden="true" /> Approved template pending
        </span>
      </div>
      <h4 className="mt-2 text-center font-display text-xl font-extrabold">
        AGREEMENT TO PROVIDE INSURANCE
      </h4>

      <section aria-labelledby="ins-to" className="mt-4 rounded-lg border border-slate-200 p-3">
        <h5 id="ins-to" className="text-xs font-extrabold uppercase">
          To: Lender / Creditor (loss payee)
        </h5>
        {creditor.status === "confirmed" ? (
          <address data-creditor className="mt-1 text-sm font-bold not-italic">
            {creditor.name}
            <br />
            {creditor.street}
            <br />
            {creditor.cityStateZip}
          </address>
        ) : (
          <p data-creditor-pending className="mt-1 text-xs font-bold text-amber-700">
            Creditor / loss payee pending confirmation — not assumed to be the dealership.
          </p>
        )}
        <div className="mt-2 space-y-2">
          <CheckField
            deal={deal}
            fieldKey="ins.lenderIsDealer"
            canEdit={canEdit}
            onEdit={edit}
            pending={false}
            label={<strong>The dealership is the creditor / loss payee (staff confirm)</strong>}
          />
          {deal.fields["ins.lenderIsDealer"]?.value !== true && (
            <div className="grid gap-2 sm:grid-cols-2">
              {field("ins.lenderName", undefined, "sm:col-span-2")}
              {field("ins.lenderStreet", undefined, "sm:col-span-2")}
              {field("ins.lenderCity")}
              <div className="grid grid-cols-2 gap-2">
                {field("ins.lenderState")}
                {field("ins.lenderZip")}
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="mt-3 space-y-2">
        <PendingText title="Insurance requirement: continuous fire, theft and collision coverage; consequences of a lapse; lender's interest and loss-payable endorsement" />
        <PendingText title="If insurance is not obtained or maintained: lender-placed insurance and related charges" />
      </div>

      <section
        aria-label="Vehicle insured and purchasers"
        className="mt-4 space-y-2 rounded-lg border border-slate-200 p-3"
      >
        <div className="grid gap-1 sm:grid-cols-[9rem_1fr] sm:items-baseline">
          <p className="text-xs font-bold sm:text-right">Vehicle Insured:</p>
          {vin ? (
            <div className="grid gap-2 sm:grid-cols-3">
              {(
                [
                  ["Year", "vehicle.year"],
                  ["Make", "vehicle.make"],
                  ["Model", "vehicle.model"],
                ] as const
              ).map(([label, key]) => (
                <p key={key} className="text-xs">
                  {label}:{" "}
                  <output aria-label={label} className="border-b border-slate-400 text-sm">
                    {text(deal, key) || "—"}
                  </output>
                </p>
              ))}
            </div>
          ) : (
            <p data-vehicle-unassigned className="text-xs font-bold text-amber-700">
              Vehicle Not Assigned — the agreement stays incomplete.
            </p>
          )}
        </div>
        {line("VIN", vin, "vehicle.vin")}
        {line(
          "Purchaser(s)",
          [fullName(deal, "buyer"), deal.coBuyerIncluded ? fullName(deal, "coBuyer") : ""]
            .filter(Boolean)
            .join(" and "),
          "buyer.firstName",
        )}
        {line("Address", text(deal, "buyer.street"), "buyer.street")}
        {line(
          "City/State/Zip",
          `${text(deal, "buyer.city")}${text(deal, "buyer.state") ? `, ${text(deal, "buyer.state")}` : ""} ${text(deal, "buyer.zip")}`.trim(),
        )}
        {coBuyerAddressDiffers && (
          <p className="text-[11px] text-slate-600">
            Purchaser address shown. The Co-Purchaser's own address stays on their record (
            {text(deal, "coBuyer.street")}, {text(deal, "coBuyer.city")}) — the approved template
            decides whether both are listed.
          </p>
        )}
      </section>

      <section
        aria-label="Insurance agent and policy"
        className="mt-4 grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-2"
      >
        {field("ins.agentName", "Insurance Agent", "sm:col-span-2")}
        {field("ins.agentPhone", "Phone")}
        {field("insurance.policyNumber", "Policy #")}
        {field("insurance.company", "Insurance Company", "sm:col-span-2")}
        <div className="grid grid-cols-2 gap-2 sm:col-span-2">
          {field("ins.effectiveFrom", "Effective Date From")}
          {field("ins.effectiveTo", "To")}
        </div>
        <p className="text-[11px] text-slate-500 sm:col-span-2">
          <Lock className="mr-1 inline size-3" aria-hidden="true" />
          Policy details are kept with the deal only — never sent to analytics or marketing tools.
          {text(deal, "insurance.documentId") ||
          text(deal, "insurance.status") === "provided_unverified"
            ? " An uploaded insurance document is on file in secure storage; an upload is not proof of verification."
            : " No insurance document has been uploaded."}
        </p>
      </section>

      <section
        aria-labelledby="ins-coverage"
        className="mt-4 rounded-lg border border-slate-200 p-3"
      >
        <h5 id="ins-coverage" className="text-xs font-extrabold uppercase">
          Coverage
        </h5>
        <ul className="mt-2 space-y-2">
          {INSURANCE_COVERAGES.map((c) => {
            const key = `ins.cov.${c.key}`;
            const state = text(deal, key);
            return (
              <li
                key={c.key}
                data-coverage={c.key}
                data-state={state || "unknown"}
                className="grid gap-2 sm:grid-cols-[10rem_1fr_auto] sm:items-center"
              >
                <p className="text-sm font-bold">{c.label}</p>
                <select
                  aria-label={`${c.label} coverage`}
                  value={state}
                  disabled={!canEdit}
                  onChange={(e) => edit(key, e.target.value)}
                  className={cn(
                    "w-full min-w-0 rounded border px-2 py-1 text-xs disabled:bg-slate-50",
                    state ? "border-slate-300" : "border-amber-400 bg-amber-50",
                  )}
                >
                  <option value="">Unknown — information required</option>
                  {(fieldDef(key)?.options ?? []).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                {c.deductible ? (
                  money(
                    c.key === "collision" ? "ins.collisionDeductible" : "ins.compDeductible",
                    `${c.label} deductible`,
                  )
                ) : (
                  <span className="text-[10px] text-slate-400">No deductible on the reference</span>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 p-3 text-xs">
        <span className="font-bold">Insurance verification:</span>
        <span
          data-verification={verification}
          className={cn(
            "rounded-full px-2.5 py-0.5 font-bold",
            verification === "verified"
              ? "bg-emerald-100 text-emerald-800"
              : ["expired", "rejected"].includes(verification)
                ? "bg-red-100 text-red-800"
                : "bg-amber-100 text-amber-900",
          )}
        >
          {VERIFICATION_LABELS[verification] ?? verification}
        </span>
        <label className="ml-auto flex items-center gap-1">
          <span className="sr-only">Set insurance verification status</span>
          <select
            aria-label="Insurance verification status (staff)"
            value={text(deal, "insurance.status")}
            disabled={!canEdit}
            onChange={(e) => edit("insurance.status", e.target.value)}
            className="rounded border border-slate-300 px-2 py-1 disabled:bg-slate-50"
          >
            {(fieldDef("insurance.status")?.options ?? []).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <p className="w-full text-[10px] text-slate-500">
          Only authorized staff or a verified insurance integration can mark coverage verified.
        </p>
      </div>

      {issues.length > 0 && (
        <div
          role="status"
          aria-label="Insurance issues"
          className="mt-3 rounded-lg border border-red-300 bg-red-50 p-3 text-xs text-red-900"
        >
          <p className="flex items-center gap-1.5 font-bold">
            <TriangleAlert className="size-4" aria-hidden="true" /> Needs attention ({issues.length}
            )
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

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-600">
            Signed — Purchaser(s)
          </p>
          {signature(
            "ins-purchaser",
            "Purchaser signature line appears once signing is available.",
          )}
          {deal.coBuyerIncluded &&
            signature(
              "ins-copurchaser",
              "Co-Purchaser signature line appears once signing is available.",
            )}
        </div>
        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-600">
            Signed — Dealer ({text(deal, "dealer.legalName") || "dealer name missing"})
          </p>
          {field("dealer.authorizedSigner", "Authorized dealer representative")}
          {signature("ins-dealer", "Dealer signature line appears once signing is available.")}
          <p className="text-[10px] text-slate-500">
            Only an authorized dealership representative signs here.
          </p>
        </div>
      </div>

      <div className="mt-4">
        <PendingText title="Note to customer: the dealership may contact your agent to verify the insurance information" />
      </div>

      <ul
        aria-label="Agreement status"
        className="mt-4 grid gap-1 rounded-lg border border-slate-200 p-3 text-[11px] sm:grid-cols-2"
      >
        {summary.items.map((i) => (
          <li key={i.label} className="flex items-center gap-1.5">
            {i.ok ? (
              <CircleCheck className="size-3.5 text-emerald-600" aria-hidden="true" />
            ) : (
              <CircleAlert className="size-3.5 text-amber-600" aria-hidden="true" />
            )}
            <span className="font-semibold">{i.label}:</span> {i.detail}
          </li>
        ))}
        <li data-overall className="font-bold sm:col-span-2">
          Overall:{" "}
          {summary.complete
            ? "form complete (demo) — not a verified or executed agreement"
            : "incomplete"}
        </li>
      </ul>
    </div>
  );
}
