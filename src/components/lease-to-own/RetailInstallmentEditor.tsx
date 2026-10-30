import { useState, type ReactNode } from "react";
import { CircleAlert, FileLock2, Lock, Scale, TriangleAlert } from "lucide-react";

import { fieldDef, fullName, text, type Deal, type EditActor } from "@/lib/deal-model";
import { formatCents } from "@/lib/money";
import {
  computeDisclosures,
  computeItemization,
  creditInsuranceElected,
  formatAmount,
  protectionSelected,
  reconcileRetailInstallment,
  retailInstallmentMissing,
  RIC_CONTRACT_TYPE_REVIEW,
  RIC_ITEM_ROWS,
  thirdPartyOwnerIncluded,
  type Disclosures,
} from "@/lib/retail-installment";
import { RIC_INPUT_ROWS, RIC_SCHEDULE_ROWS } from "@/lib/retail-installment-fields";
import { cn } from "@/lib/utils";
import {
  Bar,
  CheckField,
  ChoiceField,
  MoneyInput,
  PageHeading,
  PendingNote,
  PendingText,
  Provenance,
  Section,
  TextField,
} from "./ContractFormParts";

const PAGES = 5;

/**
 * Form 2 — Retail Installment Contract and Security Agreement as a web form,
 * in the reference's five pages:
 *   1. seller/buyers/summary, Truth-In-Lending Disclosure, payment schedule,
 *      property, trade-in, conditional delivery, sales agreement;
 *   2. down payment, additional charge, itemization a–aa, insurance disclosures;
 *   3. additional protections and the sales agreement's additional terms;
 *   4. security agreement, notices, Third Party Agreement;
 *   5. electronic signature acknowledgment, signatures, assignment.
 *
 * Shares the deal with Form 1: parties, dealer, vehicle and trade-ins are the
 * same fields (editing either form changes both). Calculated rows and the
 * Truth-In-Lending figures are always computed, never typed. Legal wording is
 * never written here; each place it belongs is marked pending. Signing is not
 * performed here; `renderSignatures` only displays signature locations.
 */
export function RetailInstallmentEditor({
  deal,
  actor,
  onEdit,
  renderSignatures,
}: {
  deal: Deal;
  actor: EditActor;
  /** Returns an error message when the edit is refused. */
  onEdit: (key: string, value: string | boolean) => string | undefined;
  /** Signature lines for these location ids that apply to the deal, or null if none apply. */
  renderSignatures?: (slotIds: string[]) => ReactNode | null;
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const canEdit = actor === "staff";
  const items = computeItemization(deal);
  const tila = computeDisclosures(deal);
  const issues = reconcileRetailInstallment(deal);
  const missing = retailInstallmentMissing(deal);

  const edit = (key: string, value: string | boolean) => {
    const error = onEdit(key, value);
    setErrors((prev) => {
      const next = { ...prev };
      if (error) next[key] = error;
      else delete next[key];
      return next;
    });
  };

  const field = (key: string, label?: string, wide = false, placeholder?: string) => (
    <TextField
      key={key}
      deal={deal}
      fieldKey={key}
      label={label ?? fieldDef(key)?.label ?? key}
      canEdit={canEdit}
      error={errors[key]}
      onEdit={edit}
      className={wide ? "sm:col-span-2" : undefined}
      idPrefix="ric"
      placeholder={placeholder}
    />
  );
  const amount = (key: string, label?: string) => (
    <div className="space-y-0.5">
      <span className="flex items-center justify-between gap-2 text-[11px] font-semibold text-slate-700">
        {label ?? fieldDef(key)?.label}
        <MoneyInput
          deal={deal}
          fieldKey={key}
          label={label ?? fieldDef(key)?.label ?? key}
          canEdit={canEdit}
          error={errors[key]}
          onEdit={edit}
          placeholder=""
        />
      </span>
      {errors[key] && <p className="text-right text-[11px] text-red-600">{errors[key]}</p>}
    </div>
  );
  const check = (key: string, label: ReactNode, pending = true, children?: ReactNode) => (
    <CheckField
      deal={deal}
      fieldKey={key}
      canEdit={canEdit}
      onEdit={edit}
      label={label}
      pending={pending}
    >
      {children}
    </CheckField>
  );
  const choice = (key: string, label: ReactNode, className?: string) => (
    <ChoiceField
      deal={deal}
      fieldKey={key}
      label={label}
      canEdit={canEdit}
      onEdit={edit}
      name={`ric-${key}`}
      className={className}
    />
  );
  const signatures = (ids: string[], whenNone: string) => {
    const shown = renderSignatures?.(ids);
    return shown ? (
      <div className="rounded-lg border border-slate-200 p-3">{shown}</div>
    ) : (
      <p className="rounded-lg border border-dashed border-slate-300 p-3 text-xs text-slate-600">
        {renderSignatures ? whenNone : "Signature lines appear here once signing is available."}
      </p>
    );
  };

  // Explicit staff action; the Cash Price (row a) is never marked N/A.
  const markBlankRowsNA = () => {
    for (const row of RIC_INPUT_ROWS)
      if (row !== "a" && items[row].amount.state === "unknown") edit(`ric.item.${row}`, "N/A");
  };
  const tradeIns = [1, 2]
    .map((n) =>
      [
        text(deal, `tradeIn${n}.year`),
        text(deal, `tradeIn${n}.make`),
        text(deal, `tradeIn${n}.model`),
        text(deal, `tradeIn${n}.vin`) && `VIN ${text(deal, `tradeIn${n}.vin`)}`,
        text(deal, `tradeIn${n}.odometer`) && `${text(deal, `tradeIn${n}.odometer`)} mi`,
      ]
        .filter(Boolean)
        .join(" "),
    )
    .filter(Boolean);
  const downPayment = formatAmount(items.h.amount);
  const principal = formatAmount(items.aa.amount);

  return (
    <div className="rounded-xl bg-white p-4 text-slate-900 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-fuchsia-700">
            DEMO — not a legal contract
          </p>
          <h4 className="font-display text-xl font-extrabold">
            RETAIL INSTALLMENT CONTRACT AND SECURITY AGREEMENT
          </h4>
          <p className="text-xs text-slate-500">
            {canEdit
              ? "Staff view: enter or correct deal-specific values. Calculated rows and disclosures update automatically."
              : "Customer view: read-only. Only authorized staff can change contract values."}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
          <FileLock2 className="size-3.5" aria-hidden="true" /> Approved PDF template required
        </span>
      </div>

      <p
        role="note"
        className="mt-4 flex gap-2 rounded-lg border border-violet-300 bg-violet-50 p-3 text-xs text-violet-950"
      >
        <Scale className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>
          <strong>Contract type — management/legal review required.</strong>{" "}
          {RIC_CONTRACT_TYPE_REVIEW}
        </span>
      </p>

      {missing.length > 0 && (
        <div
          role="status"
          className="mt-3 flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>
            <strong>
              {missing.length} item{missing.length === 1 ? "" : "s"} missing:
            </strong>{" "}
            {missing.join("; ")}.
          </p>
        </div>
      )}
      {issues.length > 0 && (
        <div
          role="status"
          aria-label="Reconciliation required"
          className="mt-3 rounded-lg border border-red-300 bg-red-50 p-3 text-xs text-red-900"
        >
          <p className="flex items-center gap-1.5 font-bold">
            <TriangleAlert className="size-4" aria-hidden="true" /> Reconciliation required (
            {issues.length})
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
        title="Retail Installment Contract & Truth-In-Lending Disclosure"
      />
      <div className="mt-3 grid gap-4 lg:grid-cols-3">
        <Section title="Seller Name and Address">
          {field("dealer.legalName", "Seller legal name", true)}
          {field("dealer.street", "Street", true)}
          {field("dealer.city")}
          {field("dealer.state")}
          {field("dealer.zip")}
          {field("dealer.authorizedSigner", "Authorized seller representative", true)}
        </Section>
        <Section title="Buyer(s) Name(s) and Address(es)">
          <p className="text-xs font-bold text-slate-600 sm:col-span-2">Buyer</p>
          {["firstName", "lastName"].map((k) => field(`buyer.${k}`))}
          {field("buyer.street", undefined, true)}
          {["city", "state", "zip"].map((k) => field(`buyer.${k}`))}
          {deal.coBuyerIncluded ? (
            <>
              <p className="mt-2 text-xs font-bold text-slate-600 sm:col-span-2">Co-Buyer</p>
              {["firstName", "lastName"].map((k) => field(`coBuyer.${k}`))}
              {field("coBuyer.street", undefined, true)}
              {["city", "state", "zip"].map((k) => field(`coBuyer.${k}`))}
            </>
          ) : (
            <p className="text-xs text-slate-500 sm:col-span-2">No Co-Buyer on this deal.</p>
          )}
        </Section>
        <Section title="Summary">
          <div className="space-y-0.5 sm:col-span-2">
            <p className="text-[11px] font-semibold text-slate-700">No.</p>
            <output
              aria-label="Contract number"
              className="block rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs"
            >
              {text(deal, "deal.contractNumber") || (
                <span className="text-slate-500">
                  Issued by the server when the contract is created
                </span>
              )}
            </output>
          </div>
          {field("deal.date", "Date", true)}
          <div className="sm:col-span-2">
            {check(
              "ric.businessPurpose",
              "Business, commercial or agricultural purpose Contract",
              false,
            )}
          </div>
        </Section>
      </div>

      <div className="mt-5">
        <Bar>Truth-In-Lending Disclosure</Bar>
        <TilaBoxes tila={tila} downPayment={downPayment} />
        {tila.status === "pending" ? (
          <div
            role="status"
            className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900"
          >
            <p className="font-bold">Pending approved financing terms</p>
            <ul className="mt-1 list-disc pl-5">
              {tila.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p
            role="status"
            className={cn(
              "mt-2 rounded-lg border p-2 text-xs",
              tila.status === "approved"
                ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                : "border-sky-300 bg-sky-50 text-sky-900",
            )}
          >
            {tila.status === "approved"
              ? "Calculated from the staff-approved financing terms (actuarial method, Regulation Z Appendix J)."
              : "Draft calculation — the financing terms are not approved yet (actuarial method, Regulation Z Appendix J)."}
          </p>
        )}
        {tila.warnings.map((w) => (
          <p key={w} className="mt-2 text-xs text-amber-800">
            {w}
          </p>
        ))}
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <PendingText title="Box descriptions (APR, Finance Charge, Amount Financed, Total of Payments, Total Sale Price)" />
          {check(
            "ric.financingApproved",
            <strong>Financing terms approved by authorized staff/lender</strong>,
            false,
          )}
        </div>

        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[640px] text-xs">
            <caption className="bg-slate-50 px-3 py-1.5 text-left text-[11px] font-bold text-slate-700">
              Payment Schedule. Your payment schedule is:
            </caption>
            <thead className="bg-slate-50 text-left text-[11px] text-slate-600">
              <tr>
                <th className="px-2 py-1">No. of Payments</th>
                <th className="px-2 py-1">Amount of Payments</th>
                <th className="px-2 py-1">When Payments are Due</th>
                <th className="px-2 py-1">Type</th>
              </tr>
            </thead>
            <tbody>
              {RIC_SCHEDULE_ROWS.map((n) => (
                <ScheduleRowInputs
                  key={n}
                  n={n}
                  deal={deal}
                  canEdit={canEdit}
                  errors={errors}
                  onEdit={edit}
                  whenDue={tila.schedule.find((r) => r.row === n)?.whenDue}
                />
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <PendingText title="Security (security interest in the Property purchased)" />
          {check(
            "ric.lateCharge",
            <strong>Late Charge</strong>,
            true,
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {field("ric.lateChargeDays", "If a payment is more than … days late")}
              {field("ric.lateChargeTerms", "You will be charged (amount or %)")}
              <p className="text-[10px] text-slate-500 sm:col-span-2">
                Use only the approved late-charge rule. The reference's example is not a current
                rule.
              </p>
            </div>,
          )}
          <PendingText title="Prepayment" />
          <PendingText title="Contract Provisions" />
        </div>
      </div>

      <div className="mt-5 space-y-3">
        <Bar>Description of Property</Bar>
        <div className="grid gap-x-3 gap-y-2 sm:grid-cols-3 lg:grid-cols-6">
          {field("vehicle.year")}
          {field("vehicle.make")}
          {field("vehicle.model")}
          {field("vehicle.bodyStyle", "Style")}
          {field("vehicle.vin", "Vehicle Identification Number")}
          {field("vehicle.odometer", "Odometer Mileage")}
        </div>
        <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
          {choice("vehicle.condition", "New / Used / Demo")}
          {field("vehicle.other", "Other")}
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="space-y-3">
          <Bar>Description of Trade-In</Bar>
          <p
            aria-label="Description of trade-in"
            className="rounded-lg border border-slate-200 p-3 text-xs"
          >
            {tradeIns.length ? tradeIns.join("; ") : "N/A"}
            <span className="block text-[10px] text-slate-500">
              From the trade-in details on the Bill of Sale (Form 1).
            </span>
          </p>
          <Bar>Conditional Delivery</Bar>
          {check(
            "ric.conditionalDelivery",
            <strong>Conditional Delivery</strong>,
            true,
            <div className="mt-2">
              {field("ric.conditionalDeliveryAgreement", "Agreement regarding securing financing")}
            </div>,
          )}
        </div>
        <div className="space-y-3">
          {check(
            "ric.noLiabilityInsurance",
            <strong className="text-base">No Liability Insurance Included.</strong>,
          )}
          <Bar>Sales Agreement</Bar>
          <div className="space-y-2 rounded-lg border border-slate-200 p-3 text-xs">
            <p>
              <strong>Payment.</strong> Principal amount:{" "}
              <output aria-label="Principal amount (row aa)" className="font-semibold tabular-nums">
                {principal || "Pending"}
              </output>{" "}
              <span className="text-slate-500">(Amount Financed, row aa)</span>
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {field("ric.contractRate", "Finance charge rate (% per year)")}
              {field("ric.postMaturityRate", "After maturity or default (% per year)")}
            </div>
            <p className="text-[10px] text-slate-500">
              The stated rate is entered from the approved terms; it is not assumed to equal the
              APR.
            </p>
            <PendingNote />
          </div>
        </div>
      </div>

      {/* ---------------- Page 2 ---------------- */}
      <PageHeading
        page={2}
        total={PAGES}
        title="Itemization of Amount Financed & Insurance Disclosures"
      />
      <div className="mt-3 grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <PendingText title="Down Payment">
            <p className="mt-1 text-slate-700">
              Down Payment (row h):{" "}
              <output aria-label="Down payment (row h)" className="font-semibold tabular-nums">
                {downPayment || "Pending"}
              </output>
            </p>
          </PendingText>
          {check(
            "ric.addlCharge",
            <strong>Additional Charge</strong>,
            true,
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {field("ric.addlChargeDescription", "Fee description", true)}
              {amount("ric.addlChargeAmount", "Fee amount")}
              {choice("ric.addlChargePayment", "Fee paid", "sm:col-span-2")}
              <p className="text-[10px] text-slate-500 sm:col-span-2">
                Only an approved, configured charge for this deal. Never added automatically.
              </p>
            </div>,
          )}

          <section aria-labelledby="ric-itemization" className="rounded-lg border border-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-t-lg bg-slate-900 px-3 py-1.5">
              <h5
                id="ric-itemization"
                className="text-xs font-bold uppercase tracking-wide text-white"
              >
                Itemization of Amount Financed
              </h5>
              {canEdit && (
                <button
                  type="button"
                  onClick={markBlankRowsNA}
                  className="rounded bg-white/15 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-white/25"
                >
                  Mark blank rows N/A
                </button>
              )}
            </div>
            <ol className="divide-y divide-slate-100 text-xs">
              {RIC_ITEM_ROWS.map((row) => {
                const value = items[row.letter];
                const key = `ric.item.${row.letter}`;
                return (
                  <li key={row.letter} data-ric-row={row.letter}>
                    <div
                      className={cn(
                        "grid grid-cols-[1.75rem_1fr_7.5rem] items-center gap-2 px-3 py-1",
                        row.kind === "calc" && "bg-slate-50",
                        row.bold && "font-bold",
                      )}
                    >
                      <span className="text-slate-500">{row.letter}.</span>
                      <span className="min-w-0">
                        {row.label}
                        {row.formula && (
                          <span className="block text-[10px] font-normal text-slate-500">
                            ({row.formula})
                          </span>
                        )}
                        {row.letter === "a" && (
                          <span className="mt-0.5 flex items-center gap-1 font-normal">
                            <span className="text-[10px] text-slate-500">incl. sales tax of</span>
                            <MoneyInput
                              deal={deal}
                              fieldKey="ric.item.aTax"
                              label="Sales tax included in row a"
                              canEdit={canEdit}
                              onEdit={edit}
                              error={errors["ric.item.aTax"]}
                              placeholder=""
                              className="w-20"
                            />
                          </span>
                        )}
                        {row.detailKey && (
                          <input
                            aria-label={`Row ${row.letter} ${row.detailLabel}`}
                            value={text(deal, row.detailKey)}
                            placeholder={row.detailLabel}
                            readOnly={!canEdit}
                            onChange={(e) => edit(row.detailKey!, e.target.value)}
                            className={cn(
                              "mt-0.5 block w-full rounded border px-1.5 py-0.5 font-normal",
                              canEdit ? "border-slate-300" : "border-slate-200 bg-slate-50",
                            )}
                          />
                        )}
                        {row.kind === "input" && value.source === "bill_of_sale" && (
                          <span className="block text-[10px] font-normal text-sky-700">
                            From Bill of Sale line {row.billOfSaleLine}
                          </span>
                        )}
                        {row.kind === "input" && value.amount.state === "unknown" && (
                          <span className="block text-[10px] font-semibold text-amber-700">
                            Unknown — enter the amount or N/A
                          </span>
                        )}
                      </span>
                      {row.kind === "calc" ? (
                        <output
                          aria-label={`Row ${row.letter} ${row.label} (calculated)`}
                          className="flex items-center justify-end gap-1 text-right tabular-nums"
                          title={
                            value.missing.length
                              ? `Needs rows ${value.missing.join(", ")}`
                              : undefined
                          }
                        >
                          <Lock className="size-3 text-slate-400" aria-hidden="true" />
                          {value.amount.state === "unknown" ? (
                            <span className="text-[10px] font-semibold text-amber-700">
                              Pending
                            </span>
                          ) : (
                            formatAmount(value.amount)
                          )}
                        </output>
                      ) : (
                        <MoneyInput
                          deal={deal}
                          fieldKey={key}
                          label={`Row ${row.letter} ${row.label}`}
                          canEdit={canEdit}
                          error={errors[key]}
                          onEdit={edit}
                          placeholder={
                            value.source === "bill_of_sale"
                              ? formatAmount(value.amount).slice(1)
                              : ""
                          }
                        />
                      )}
                    </div>
                    {errors[key] && (
                      <p className="px-3 pb-1 text-right text-[11px] text-red-600">{errors[key]}</p>
                    )}
                  </li>
                );
              })}
            </ol>
            <div className="border-t border-slate-100 p-3">
              <PendingText title="Amounts paid to others (retained portion) statement" />
            </div>
          </section>
        </div>

        <div className="space-y-4">
          <Bar>Insurance Disclosures</Bar>
          <PendingText title="Credit Insurance" />
          {(["creditLife", "creditDisability"] as const).map((p) => (
            <div key={p} className="space-y-2 rounded-lg border border-slate-200 p-3">
              {choice(
                `ric.${p}.coverage`,
                <strong>{p === "creditLife" ? "Credit Life" : "Credit Disability"}</strong>,
              )}
              <div className="grid gap-2 sm:grid-cols-2">
                {amount(`ric.${p}.premium`, "Premium")}
                {field(`ric.${p}.term`, "Term")}
                {field(`ric.${p}.insured`, "Insured", true)}
              </div>
            </div>
          ))}
          <PendingText title="Credit insurance signature statement" />
          {creditInsuranceElected(deal) ? (
            <div className="space-y-2">
              <div className="grid gap-2 sm:grid-cols-2">
                {field("ric.creditIns.buyerDob", "Buyer DOB")}
                {deal.coBuyerIncluded && field("ric.creditIns.coBuyerDob", "Co-Buyer DOB")}
              </div>
              {signatures(
                ["ric-p2-ins-buyer", "ric-p2-ins-cobuyer"],
                "No credit insurance signature lines apply.",
              )}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-slate-300 p-3 text-xs text-slate-600">
              By / DOB lines apply only when Credit Life or Credit Disability is elected (Single or
              Joint). Nothing is elected.
            </p>
          )}

          <div className="space-y-2 rounded-lg border border-slate-200 p-3 text-xs">
            <p className="font-bold">Property Insurance</p>
            <PendingNote />
            {amount("ric.propIns.maxDeductible", "Collision deductible may not exceed")}
            <p className="font-semibold text-slate-700">If you get insurance from or through us:</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {amount("ric.propIns.premium", "You will pay")}
              {field("ric.propIns.term", "For (term) of coverage")}
            </div>
            <p className="font-semibold text-slate-700">This premium is calculated as follows:</p>
            {(
              [
                ["collision", "Deductible, Collision Cov.", true],
                ["comprehensive", "Deductible, Comprehensive", true],
                ["fireTheft", "Fire-Theft and Combined Additional Cov.", false],
                ["other", "Other", false],
              ] as const
            ).map(([k, label, deductible]) => (
              <div key={k} className="grid items-center gap-2 sm:grid-cols-[1fr_auto]">
                <label className="flex flex-wrap items-center gap-2">
                  <input
                    type="checkbox"
                    checked={deal.fields[`ric.propIns.${k}`]?.value === true}
                    disabled={!canEdit}
                    onChange={(e) => edit(`ric.propIns.${k}`, e.target.checked)}
                  />
                  {deductible && (
                    <MoneyInput
                      deal={deal}
                      fieldKey={`ric.propIns.${k}Deductible`}
                      label={`${label} amount`}
                      canEdit={canEdit}
                      onEdit={edit}
                      placeholder=""
                      className="w-20"
                    />
                  )}
                  {k === "other" ? (
                    <input
                      aria-label="Other coverage description"
                      value={text(deal, "ric.propIns.otherDescription")}
                      readOnly={!canEdit}
                      placeholder="Coverage"
                      onChange={(e) => edit("ric.propIns.otherDescription", e.target.value)}
                      className="rounded border border-slate-300 px-1.5 py-0.5"
                    />
                  ) : (
                    label
                  )}
                </label>
                <MoneyInput
                  deal={deal}
                  fieldKey={`ric.propIns.${k}Premium`}
                  label={`${label} premium`}
                  canEdit={canEdit}
                  onEdit={edit}
                  error={errors[`ric.propIns.${k}Premium`]}
                  placeholder=""
                />
              </div>
            ))}
          </div>

          {check(
            "ric.singleInterest",
            <strong>Single-Interest Insurance</strong>,
            true,
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {field("ric.singleInterest.provider", "Insurance provider", true)}
              {amount("ric.singleInterest.premium", "You will pay")}
              {field("ric.singleInterest.term", "For (term) of coverage")}
            </div>,
          )}
        </div>
      </div>

      {/* ---------------- Page 3 ---------------- */}
      <PageHeading page={3} total={PAGES} title="Additional Protections & Contract Terms" />
      <div className="mt-3 grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <Bar>Additional Protections</Bar>
          <PendingText title="Voluntary protection plans statement" />
          {check(
            "ric.svc.selected",
            <strong>Service Contract</strong>,
            false,
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {field("ric.svc.provider", "Provider", true)}
              {field("ric.svc.term", "Term (months / miles)")}
              {amount("ric.svc.price", "Price")}
              {field("ric.svc.coverage", "Coverage", true)}
            </div>,
          )}
          {check(
            "ric.gap.selected",
            <strong>Gap Waiver or Gap Insurance</strong>,
            false,
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {choice("ric.gap.type", "Type", "sm:col-span-2")}
              {field("ric.gap.term", "Term")}
              {amount("ric.gap.price", "Price")}
              {field("ric.gap.coverage", "Coverage", true)}
            </div>,
          )}
          {check(
            "ric.otherProtection.selected",
            <strong>Other voluntary protection</strong>,
            false,
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {field("ric.otherProtection.description", "Product", true)}
              {field("ric.otherProtection.term", "Term")}
              {amount("ric.otherProtection.price", "Price")}
              {field("ric.otherProtection.coverage", "Coverage", true)}
            </div>,
          )}
          <PendingText title="Protection signature statement" />
          {protectionSelected(deal) ? (
            signatures(
              ["ric-p3-prot-buyer", "ric-p3-prot-cobuyer"],
              "No protection signature lines apply.",
            )
          ) : (
            <p className="rounded-lg border border-dashed border-slate-300 p-3 text-xs text-slate-600">
              By / Date lines apply only when a voluntary protection is selected. None is selected —
              optional products are never added automatically.
            </p>
          )}
          <Bar>Additional Terms of the Sales Agreement</Bar>
          {["Definitions", "Purchase of Property", "General Terms"].map((t) => (
            <PendingText key={t} title={t} />
          ))}
        </div>
        <div className="space-y-3">
          {[
            "Payments to third parties (commissions)",
            "Use of the Property (not a dwelling)",
            "Prepayment",
            "Balloon Payment",
            "Governing Law and Interpretation",
            "Name and Location",
            "Telephone Monitoring and Calling",
            "Default",
            "Remedies",
            "Notice of intended sale or transfer",
          ].map((t) => (
            <PendingText key={t} title={t} />
          ))}
        </div>
      </div>

      {/* ---------------- Page 4 ---------------- */}
      <PageHeading page={4} total={PAGES} title="Security Agreement, Notices & Third Party Owner" />
      <div className="mt-3 grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <PendingText title="Personal property left in or on the Property" />
          <PendingText title="Electronic tracking device">
            <p className="mt-1 text-slate-600">
              No GPS or starter-interrupt use is enabled or implied. It requires approved hardware,
              the approved disclosure (Form 4) and an approved integration.
            </p>
          </PendingText>
          <PendingText title="Waiver of Homestead Exemption" />
          <PendingText title="Obligations Independent" />
          <PendingText title="Warranty" />
          <Bar>Security Agreement</Bar>
          {[
            "Security",
            "Duties Toward Property",
            "Agreement to Provide Insurance",
            "Gap Waiver or Gap Insurance",
          ].map((t) => (
            <PendingText key={t} title={t} />
          ))}
        </div>
        <div className="space-y-3">
          <Bar>Notices</Bar>
          <PendingText title="Consumer credit contract holder notice">
            {deal.fields["ric.businessPurpose"]?.value === true && (
              <p className="mt-1 font-semibold text-violet-800">
                Marked business/commercial purpose on page 1 — applicability per the approved
                template.
              </p>
            )}
          </PendingText>
          <PendingText title="Used vehicle window form notice">
            <p className="mt-1 text-slate-600">
              {text(deal, "vehicle.condition") === "used"
                ? "Applies: the vehicle is marked Used."
                : "Applies to used vehicles. The vehicle is not marked Used."}
            </p>
          </PendingText>
          <PendingText title="Used vehicle window form notice (Spanish)" />

          <Bar>Third Party Agreement</Bar>
          <PendingText title="Third Party Owner section and acknowledgment of receipt" />
          {check(
            "ric.thirdParty.included",
            <strong>A verified Third Party Owner (NOT a Buyer) is on this deal</strong>,
            false,
          )}
          {thirdPartyOwnerIncluded(deal) ? (
            <div className="space-y-2">
              {field("ric.thirdParty.name", "Third Party Owner legal name")}
              <p className="text-[11px] text-slate-600">
                Signature of Third Party Owner (NOT the Buyer). A Buyer's or Co-Buyer's signature is
                never copied here.
              </p>
              {signatures(["ric-p4-third-party"], "Enter the Third Party Owner's name first.")}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-slate-300 p-3 text-xs text-slate-600">
              No Third Party Owner on this deal — this signature line is not required. A Co-Buyer is
              not a Third Party Owner.
            </p>
          )}
        </div>
      </div>

      {/* ---------------- Page 5 ---------------- */}
      <PageHeading
        page={5}
        total={PAGES}
        title="Electronic Signature Acknowledgment, Signatures & Assignment"
      />
      <div className="mt-3 grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          {check("ric.esignAck", <strong>Electronic Signature Acknowledgment</strong>)}
          <Bar>Signature Notices</Bar>
          <PendingText title="Annual Percentage Rate negotiability / assignment notice" />
          <Bar>Signatures</Bar>
          <PendingText title="Entire Agreement" />
          {signatures(["ric-p5-agree-buyer", "ric-p5-agree-cobuyer"], "No signature lines apply.")}
        </div>
        <div className="space-y-3">
          <PendingText title="Notice to Buyer" />
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-600">Buyer</p>
          {signatures(["ric-p5-buyer", "ric-p5-cobuyer"], "No Buyer signature lines apply.")}
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-600">
            Seller — {text(deal, "dealer.legalName") || "Seller legal name missing"}
          </p>
          {signatures(["ric-p5-seller"], "No Seller signature line applies.")}

          <section className="space-y-2 rounded-lg border-2 border-slate-900 p-3">
            <p className="text-xs font-bold">Assignment</p>
            <PendingNote />
            <div className="grid gap-2 sm:grid-cols-2">
              {field("ric.assign.assigneeName", "Assigned to (Assignee legal name)", true)}
              {field("ric.assign.assigneeAddress", "Assignee address", true)}
              {field("ric.assign.assigneePhone", "Assignee phone")}
              <AssignmentStatus deal={deal} canEdit={canEdit} onEdit={edit} />
            </div>
            {check("ric.assign.recourse", "This Assignment is made with recourse.", false)}
            <p className="text-xs">
              <strong>Seller</strong>{" "}
              {text(deal, "dealer.legalName") || "Seller legal name missing"}
            </p>
            <p className="text-[10px] text-slate-500">
              The Assignee is never assumed to be the Seller. Only authorized staff manage
              assignment data.
            </p>
            {text(deal, "ric.assign.assigneeName") ? (
              signatures(["ric-p5-assign-seller"], "No assignment signature line applies.")
            ) : (
              <p className="rounded-lg border border-dashed border-slate-300 p-3 text-xs text-slate-600">
                The Seller's assignment signature applies once staff enter an Assignee.
              </p>
            )}
          </section>
        </div>
      </div>
      <p className="mt-6 text-[11px] text-slate-500">
        Buyer: {fullName(deal, "buyer") || "—"}
        {deal.coBuyerIncluded ? ` · Co-Buyer: ${fullName(deal, "coBuyer") || "—"}` : ""} · Values
        are shared with the Bill of Sale (Form 1).
      </p>
    </div>
  );
}

function TilaBoxes({ tila, downPayment }: { tila: Disclosures; downPayment: string }) {
  const pending = tila.status === "pending";
  const money = (c: number | null) => (c === null || pending ? null : `$${formatCents(c)}`);
  const boxes: Array<[string, string | null, boolean]> = [
    [
      "Annual Percentage Rate",
      tila.aprPercent === null || pending ? null : `${tila.aprPercent.toFixed(2)} %`,
      true,
    ],
    ["Finance Charge", money(tila.financeChargeCents), true],
    ["Amount Financed", money(tila.amountFinancedCents), false],
    ["Total of Payments", money(tila.totalOfPaymentsCents), false],
    ["Total Sale Price", money(tila.totalSalePriceCents), false],
  ];
  return (
    <dl className="grid grid-cols-2 border border-slate-900 sm:grid-cols-3 lg:grid-cols-5">
      {boxes.map(([label, value, strong]) => (
        <div
          key={label}
          className={cn("border border-slate-300 p-2", strong && "border-2 border-slate-900")}
        >
          <dt className="text-[11px] font-bold">{label}</dt>
          <dd
            aria-label={label}
            className={cn(
              "mt-2 text-base font-extrabold tabular-nums",
              !value && "text-[11px] font-semibold text-amber-700",
            )}
          >
            {value ?? "Pending approved financing terms"}
          </dd>
          {label === "Total Sale Price" && (
            <p className="mt-1 text-[10px] text-slate-500">
              including your down payment of {downPayment || "(pending)"}
            </p>
          )}
          {value && tila.status === "draft" && (
            <p className="text-[10px] font-semibold text-sky-700">Draft — not approved</p>
          )}
        </div>
      ))}
    </dl>
  );
}

function ScheduleRowInputs({
  n,
  deal,
  canEdit,
  errors,
  onEdit,
  whenDue,
}: {
  n: number;
  deal: Deal;
  canEdit: boolean;
  errors: Record<string, string>;
  onEdit: (key: string, value: string) => void;
  whenDue?: string;
}) {
  const k = (f: string) => `ric.schedule.${n}.${f}`;
  const select = (key: string, label: string) => (
    <select
      aria-label={label}
      value={text(deal, key)}
      disabled={!canEdit}
      onChange={(e) => onEdit(key, e.target.value)}
      className="rounded border border-slate-300 bg-white px-1 py-0.5 disabled:bg-slate-50"
    >
      {key.endsWith("frequency") && <option value="">Frequency…</option>}
      {(fieldDef(key)?.options ?? []).map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
  const rowErrors = ["count", "amount", "firstDue"].map((f) => errors[k(f)]).filter(Boolean);
  return (
    <tr className="border-t border-slate-100 align-top" data-schedule-row={n}>
      <td className="px-2 py-1">
        <CompactInput
          deal={deal}
          fieldKey={k("count")}
          label={`Row ${n} number of payments`}
          canEdit={canEdit}
          onEdit={onEdit}
        />
      </td>
      <td className="px-2 py-1">
        <MoneyInput
          deal={deal}
          fieldKey={k("amount")}
          label={`Row ${n} amount of payments`}
          canEdit={canEdit}
          onEdit={onEdit}
          placeholder=""
        />
      </td>
      <td className="px-2 py-1">
        <div className="flex flex-wrap items-center gap-1">
          {select(k("frequency"), `Row ${n} frequency`)}
          <span className="text-[10px] text-slate-500">first due</span>
          <input
            type="date"
            aria-label={`Row ${n} first payment due`}
            value={text(deal, k("firstDue"))}
            readOnly={!canEdit}
            onChange={(e) => onEdit(k("firstDue"), e.target.value)}
            className="rounded border border-slate-300 px-1 py-0.5"
          />
        </div>
        <output
          aria-label={`Row ${n} when payments are due`}
          className="mt-0.5 block text-[11px] font-semibold"
        >
          {whenDue ?? ""}
        </output>
        {rowErrors.map((e) => (
          <p key={e} className="text-[11px] text-red-600">
            {e}
          </p>
        ))}
      </td>
      <td className="px-2 py-1">{select(k("kind"), `Row ${n} payment type`)}</td>
    </tr>
  );
}

/** Small count input, validated on blur. */
function CompactInput({
  deal,
  fieldKey,
  label,
  canEdit,
  onEdit,
}: {
  deal: Deal;
  fieldKey: string;
  label: string;
  canEdit: boolean;
  onEdit: (key: string, value: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      aria-label={label}
      inputMode="numeric"
      value={draft ?? text(deal, fieldKey)}
      readOnly={!canEdit}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== null && draft !== text(deal, fieldKey)) onEdit(fieldKey, draft);
        setDraft(null);
      }}
      className={cn(
        "w-16 rounded border px-1.5 py-0.5 text-right tabular-nums",
        canEdit ? "border-slate-300" : "border-slate-200 bg-slate-50",
      )}
    />
  );
}

function AssignmentStatus({
  deal,
  canEdit,
  onEdit,
}: {
  deal: Deal;
  canEdit: boolean;
  onEdit: (key: string, value: string) => void;
}) {
  const options = fieldDef("ric.assign.status")?.options ?? [];
  return (
    <div className="space-y-0.5">
      <label htmlFor="ric-assign-status" className="block text-[11px] font-semibold text-slate-700">
        Assignment status
        <Provenance deal={deal} fieldKey="ric.assign.status" />
      </label>
      <select
        id="ric-assign-status"
        value={text(deal, "ric.assign.status")}
        disabled={!canEdit}
        onChange={(e) => onEdit("ric.assign.status", e.target.value)}
        className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs disabled:bg-slate-50"
      >
        <option value="">Not set</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
