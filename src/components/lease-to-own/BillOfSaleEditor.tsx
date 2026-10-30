import { useState, type ReactNode } from "react";
import { CircleAlert, FileLock2, Lock } from "lucide-react";

import {
  BILL_OF_SALE_LAYOUT,
  BILL_OF_SALE_SECTION_TITLES,
  computeBillOfSale,
} from "@/lib/bill-of-sale";
import { fieldDef, missingRequiredFields, text, type Deal, type EditActor } from "@/lib/deal-model";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import {
  Bar,
  CheckField,
  MoneyInput,
  PageHeading,
  PendingNote,
  PendingText,
  Provenance,
  Section,
  TextField,
} from "./ContractFormParts";

/**
 * Form 1 — Bill of Sale / Buyer's Order as a web form, in the reference's three
 * pages:
 *   1. dealer, references, vehicle, insurance, trade-ins | buyers, itemization
 *      lines 1–31, "AS IS" acknowledgment, Buyer/Co-Buyer signatures;
 *   2. Additional Terms;
 *   3. Warranty Information and Notices | financing notice, Signatures.
 *
 * Presentation only: every change goes through `onEdit`, which enforces who
 * may edit what (see editDealField). Calculated lines are always computed and
 * never editable. Legal wording is never written here: each place it belongs
 * is marked pending until the approved template supplies it. Signing is not
 * performed here; `signatureBlocks` only displays each signature location.
 */
export function BillOfSaleEditor({
  deal,
  actor,
  onEdit,
  signatureBlocks,
}: {
  deal: Deal;
  actor: EditActor;
  /** Returns an error message when the edit is refused. */
  onEdit: (key: string, value: string | boolean) => string | undefined;
  /** Signature locations for page 1 (Buyer/Co-Buyer) and page 3 (all signers). */
  signatureBlocks?: { page1: ReactNode; page3: ReactNode };
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { lines, negativeEquityCents } = computeBillOfSale(deal);
  const missing = missingRequiredFields(deal);
  const canEdit = actor === "staff";

  const edit = (key: string, value: string | boolean) => {
    const error = onEdit(key, value);
    setErrors((prev) => {
      const next = { ...prev };
      if (error) next[key] = error;
      else delete next[key];
      return next;
    });
  };

  const field = (key: string, label?: string, wide = false) => (
    <TextField
      key={key}
      deal={deal}
      fieldKey={key}
      label={label ?? fieldDef(key)?.label ?? key}
      canEdit={canEdit}
      error={errors[key]}
      onEdit={edit}
      className={wide ? "sm:col-span-2" : undefined}
    />
  );

  return (
    <div className="rounded-xl bg-white p-4 text-slate-900 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-fuchsia-700">
            DEMO — not a legal contract
          </p>
          <h4 className="font-display text-xl font-extrabold">BILL OF SALE / BUYER'S ORDER</h4>
          <p className="text-xs text-slate-500">
            {canEdit
              ? "Staff view: enter or correct deal-specific values. Totals recalculate automatically."
              : "Customer view: read-only. Only authorized staff can change contract values."}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
          <FileLock2 className="size-3.5" aria-hidden="true" /> Approved PDF template required
        </span>
      </div>

      {missing.length > 0 && (
        <div
          role="status"
          className="mt-4 flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>
            <strong>
              {missing.length} required field{missing.length === 1 ? "" : "s"} missing:
            </strong>{" "}
            {missing.map((k) => fieldDef(k)?.label ?? k).join(", ")}.
          </p>
        </div>
      )}

      <PageHeading page={1} total={3} title="Vehicle, parties and itemization of sale" />
      <div className="mt-3 grid gap-6 lg:grid-cols-2">
        {/* Left column */}
        <div className="space-y-5">
          <Section title="Dealer/Seller Name and Address">
            {field("dealer.legalName", undefined, true)}
            {field("dealer.street", undefined, true)}
            {field("dealer.city")}
            {field("dealer.state")}
            {field("dealer.zip")}
            {field("dealer.phone")}
            {field("dealer.licenseNumber")}
            {field("dealer.authorizedSigner")}
          </Section>
          <Section title="Date / Stock / Salesperson / App / Contract">
            {field("deal.date")}
            {field("deal.stockNumber")}
            {field("dealer.salesperson")}
            {field("deal.appNumber")}
            {field("deal.contractNumber")}
          </Section>
          <Section title="Vehicle Information">
            <ConditionField deal={deal} canEdit={canEdit} onEdit={edit} />
            {field("vehicle.year")}
            {field("vehicle.licenseNumber")}
            {field("vehicle.make")}
            {field("vehicle.odometer")}
            {field("vehicle.model")}
            {field("vehicle.color")}
            {field("vehicle.bodyStyle")}
            {field("vehicle.vin")}
            {field("vehicle.other", undefined, true)}
          </Section>
          <Section title="Insurance Information">
            {field("insurance.company")}
            {field("insurance.policyNumber")}
            <InsuranceStatus deal={deal} canEdit={canEdit} onEdit={edit} />
            <p className="text-[11px] text-slate-500 sm:col-span-2">
              The insurance disclosure wording comes from the approved template. Insurance shows as
              verified only after staff review the declaration page.
            </p>
          </Section>
          {[1, 2].map((n) => (
            <Section key={n} title={`Trade-in ${n}`}>
              {field(`tradeIn${n}.year`)}
              {field(`tradeIn${n}.licenseNumber`)}
              {field(`tradeIn${n}.make`)}
              {field(`tradeIn${n}.odometer`)}
              {field(`tradeIn${n}.model`)}
              {field(`tradeIn${n}.color`)}
              {field(`tradeIn${n}.bodyStyle`)}
              {field(`tradeIn${n}.vin`)}
              {field(`tradeIn${n}.lienholderName`, undefined, true)}
              {field(`tradeIn${n}.lienholderAddress`, undefined, true)}
              {field(`tradeIn${n}.lienholderPhone`)}
              {field(`tradeIn${n}.payoff`, "Payoff (see line 26)")}
              {field(`tradeIn${n}.payoffGoodThrough`)}
              {field(`tradeIn${n}.approved`)}
            </Section>
          ))}
        </div>

        {/* Right column */}
        <div className="space-y-5">
          <Section title="Buyer/Co-Buyer Name(s) and Address(es)">
            <p className="text-xs font-bold text-slate-600 sm:col-span-2">Buyer</p>
            {["firstName", "lastName", "phone", "email", "street", "city", "state", "zip"].map(
              (k) => field(`buyer.${k}`),
            )}
            {deal.coBuyerIncluded ? (
              <>
                <p className="mt-2 text-xs font-bold text-slate-600 sm:col-span-2">Co-Buyer</p>
                {["firstName", "lastName", "phone", "email", "street", "city", "state", "zip"].map(
                  (k) => field(`coBuyer.${k}`),
                )}
              </>
            ) : (
              <p className="text-xs text-slate-500 sm:col-span-2">No Co-Buyer on this deal.</p>
            )}
          </Section>

          <section aria-labelledby="bos-itemization" className="rounded-lg border border-slate-200">
            <h5
              id="bos-itemization"
              className="rounded-t-lg bg-slate-900 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white"
            >
              Itemization of Sale
            </h5>
            <ol className="divide-y divide-slate-100 text-xs">
              {lines.map((line, index) => {
                const title = BILL_OF_SALE_SECTION_TITLES[line.section];
                const showTitle =
                  title &&
                  title !== BILL_OF_SALE_SECTION_TITLES[lines[index - 1]?.section ?? "sale"];
                return (
                  <li key={line.number}>
                    {showTitle && (
                      <p className="bg-slate-50 px-3 py-1 text-[11px] font-bold text-slate-700">
                        {title}
                      </p>
                    )}
                    <div
                      className={cn(
                        "grid grid-cols-[1.75rem_1fr_7.5rem] items-center gap-2 px-3 py-1",
                        line.kind === "calc" && "bg-slate-50 font-bold",
                      )}
                    >
                      <span className="text-slate-500">{line.number}.</span>
                      <span>
                        {line.configurableLabel && canEdit ? (
                          <input
                            aria-label={`Line ${line.number} label`}
                            value={text(deal, `lineLabel.${line.number}`)}
                            placeholder={`${line.label} (approved label)`}
                            onChange={(e) => edit(`lineLabel.${line.number}`, e.target.value)}
                            className="w-full rounded border border-slate-200 px-1.5 py-0.5"
                          />
                        ) : (
                          line.label
                        )}
                        {line.formula && (
                          <span className="block text-[10px] font-normal text-slate-500">
                            ({line.formula})
                          </span>
                        )}
                      </span>
                      {line.kind === "calc" ? (
                        <output
                          aria-label={`Line ${line.number} ${line.label} (calculated)`}
                          className="flex items-center justify-end gap-1 text-right tabular-nums"
                        >
                          <Lock className="size-3 text-slate-400" aria-hidden="true" />
                          {line.cents === null ? "N/A" : `$${formatCents(line.cents)}`}
                        </output>
                      ) : (
                        <MoneyInput
                          deal={deal}
                          fieldKey={`line.${line.number}`}
                          label={`Line ${line.number} ${line.label}`}
                          canEdit={canEdit}
                          error={errors[`line.${line.number}`]}
                          onEdit={edit}
                        />
                      )}
                    </div>
                    {errors[`line.${line.number}`] && (
                      <p className="px-3 pb-1 text-right text-[11px] text-red-600">
                        {errors[`line.${line.number}`]}
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>

          <CheckField
            deal={deal}
            fieldKey="asIs"
            canEdit={canEdit}
            onEdit={edit}
            label={<strong>"AS IS" acknowledgment</strong>}
          />

          {signatureBlocks ? (
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-slate-600">
                Buyer / Co-Buyer signatures (page 1)
              </p>
              {signatureBlocks.page1}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 p-3 text-xs text-slate-600">
              <p className="flex items-center gap-1.5 font-bold text-slate-800">
                <Lock className="size-3.5" aria-hidden="true" /> Signatures (page 1: Buyer,
                Co-Buyer; page 3: Buyer, Co-Buyer, Dealer/Seller)
              </p>
              <p className="mt-1">
                Not available: signing needs the approved blank template, a staff-approved final
                deal and the approved e-signature provider. Each signer signs separately.
              </p>
            </div>
          )}
        </div>
      </div>

      <PageHeading page={2} total={3} title="Additional Terms" />
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {ADDITIONAL_TERMS.map((title) => (
          <PendingText key={title} title={title} />
        ))}
      </div>
      <p className="mt-2 text-[11px] text-slate-500">
        Any acknowledgments or initials within these terms are added from the approved template.
      </p>

      <PageHeading page={3} total={3} title="Warranty Information, Notices & Signatures" />
      <div className="mt-3 grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <Bar>Warranty Information</Bar>
          <PendingText title="Warranty" />
          <PendingText title="Used Car Buyer Notice" />
          <PendingText title="Used Car Buyer Notice (Spanish)" />
          <PendingText title="Additional Virginia Notice" />
          <Bar>Notices</Bar>
          <div className="space-y-1 rounded-lg border border-slate-200 p-3 text-xs">
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={Boolean(negativeEquityCents)}
                disabled
                className="mt-0.5"
              />
              <span>
                <strong>Negative equity notice</strong> — amount:{" "}
                <output
                  aria-label="Negative equity amount (from line 27)"
                  className="font-semibold tabular-nums"
                >
                  {negativeEquityCents ? `$${formatCents(negativeEquityCents)}` : "N/A"}
                </output>{" "}
                <span className="text-slate-500">(calculated from line 27)</span>
              </span>
            </label>
            <PendingNote />
          </div>
          <CheckField
            deal={deal}
            fieldKey="notice.demonstrator"
            canEdit={canEdit}
            onEdit={edit}
            label={<strong>Demonstrator mileage notice</strong>}
          />
          <CheckField
            deal={deal}
            fieldKey="notice.financing"
            canEdit={canEdit}
            onEdit={edit}
            label={<strong>Financing notice (retail installment sales contract)</strong>}
          />
        </div>

        <div className="space-y-4">
          <Bar>Signatures</Bar>
          <PendingText title="Dealer acceptance statement" />
          <PendingText title="Signer acknowledgment" />
          <CheckField
            deal={deal}
            fieldKey="notice.arbitration"
            canEdit={canEdit}
            onEdit={edit}
            label={<strong>Separate arbitration agreement</strong>}
          />
          {signatureBlocks ? (
            <div className="rounded-lg border border-slate-200 p-3">{signatureBlocks.page3}</div>
          ) : (
            <p className="rounded-lg border border-dashed border-slate-300 p-3 text-xs text-slate-600">
              Buyer, Co-Buyer and Dealer/Seller signature lines appear here once signing is
              available.
            </p>
          )}
          <address className="text-xs not-italic text-slate-700">
            <strong>{text(deal, "dealer.legalName") || "Dealer legal name missing"}</strong>
            <br />
            {text(deal, "dealer.street")}
            <br />
            {[text(deal, "dealer.city"), text(deal, "dealer.state")]
              .filter(Boolean)
              .join(", ")}{" "}
            {text(deal, "dealer.zip")}
          </address>
        </div>
      </div>
    </div>
  );
}

const ADDITIONAL_TERMS = BILL_OF_SALE_LAYOUT.find((p) => p.page === 2)!.sections.map((s) =>
  s.title.replace(/^Additional Terms — /, ""),
);

function ConditionField({
  deal,
  canEdit,
  onEdit,
}: {
  deal: Deal;
  canEdit: boolean;
  onEdit: (key: string, value: string) => void;
}) {
  const options = fieldDef("vehicle.condition")?.options ?? [];
  return (
    <fieldset className="sm:col-span-2">
      <legend className="text-[11px] font-semibold text-slate-700">
        New / Used / Demo<span className="text-red-600"> *</span>
        <Provenance deal={deal} fieldKey="vehicle.condition" />
      </legend>
      <div className="mt-1 flex gap-4 text-xs">
        {options.map((o) => (
          <label key={o.value} className="flex items-center gap-1">
            <input
              type="radio"
              name="bos-vehicle-condition"
              value={o.value}
              checked={text(deal, "vehicle.condition") === o.value}
              disabled={!canEdit}
              onChange={() => onEdit("vehicle.condition", o.value)}
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function InsuranceStatus({
  deal,
  canEdit,
  onEdit,
}: {
  deal: Deal;
  canEdit: boolean;
  onEdit: (key: string, value: string) => void;
}) {
  const options = fieldDef("insurance.status")?.options ?? [];
  return (
    <div className="space-y-0.5 sm:col-span-2">
      <label
        htmlFor="bos-insurance-status"
        className="block text-[11px] font-semibold text-slate-700"
      >
        Insurance status
        <Provenance deal={deal} fieldKey="insurance.status" />
      </label>
      <select
        id="bos-insurance-status"
        value={text(deal, "insurance.status")}
        disabled={!canEdit}
        onChange={(e) => onEdit("insurance.status", e.target.value)}
        className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs disabled:bg-slate-50"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
