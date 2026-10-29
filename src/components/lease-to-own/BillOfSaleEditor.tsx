import { useState, type ReactNode } from "react";
import { CircleAlert, FileLock2, Lock, ShieldCheck } from "lucide-react";

import {
  BILL_OF_SALE_LAYOUT,
  BILL_OF_SALE_SECTION_TITLES,
  computeBillOfSale,
} from "@/lib/bill-of-sale";
import {
  fieldDef,
  missingRequiredFields,
  text,
  type Deal,
  type EditActor,
  type FieldSource,
} from "@/lib/deal-model";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";

const SOURCE_LABELS: Record<FieldSource, string> = {
  application: "Application",
  inventory: "Inventory",
  package: "Package",
  dealer_profile: "Dealer profile",
  document: "Document",
  staff: "Staff entry",
  demo: "Demo",
  none: "Not provided",
};

/**
 * Form 1 — Bill of Sale / Buyer's Order editor, laid out like page 1 of the
 * reference (left: dealer, references, vehicle, insurance, trade-ins; right:
 * buyers, itemization lines 1–31, acknowledgment, signatures).
 *
 * Presentation only: every change goes through `onEdit`, which enforces who
 * may edit what (see editDealField). Calculated lines are always computed and
 * never editable. Signing is not performed here: signatures appear only in the
 * document itself (see `signaturesNote`).
 */
export function BillOfSaleEditor({
  deal,
  actor,
  onEdit,
  signaturesNote,
}: {
  deal: Deal;
  actor: EditActor;
  /** Returns an error message when the edit is refused. */
  onEdit: (key: string, value: string | boolean) => string | undefined;
  /** Replaces the "not available" signatures note (e.g. where signatures appear instead). */
  signaturesNote?: ReactNode;
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { lines } = computeBillOfSale(deal);
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

      <div className="mt-5 grid gap-6 lg:grid-cols-2">
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

          <label className="flex items-start gap-2 rounded-lg border border-slate-200 p-3 text-xs">
            <input
              type="checkbox"
              checked={deal.fields["asIs"]?.value === true}
              disabled={!canEdit}
              onChange={(e) => edit("asIs", e.target.checked)}
              className="mt-0.5"
            />
            <span>
              <strong>"AS IS" acknowledgment</strong> — the approved wording from the authorized
              template appears here. (See the Used Car Buyer Notice and Additional Virginia Notice
              on page 3.)
            </span>
          </label>

          {signaturesNote ?? (
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

      <section aria-labelledby="bos-pages" className="mt-6 border-t border-slate-200 pt-4">
        <h5 id="bos-pages" className="text-sm font-bold">
          Document pages
        </h5>
        <ol className="mt-2 grid gap-3 md:grid-cols-3">
          {BILL_OF_SALE_LAYOUT.map((page) => (
            <li key={page.page} className="rounded-lg border border-slate-200 p-3 text-xs">
              <p className="font-bold">Page {page.page} of 3</p>
              <ul className="mt-1 space-y-0.5 text-slate-600">
                {page.sections.map((s) => (
                  <li key={s.id}>
                    {s.title}
                    {s.legalTextRequired && (
                      <span className="ml-1 text-[10px] font-semibold text-amber-700">
                        · approved text required
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200">
      <h5 className="rounded-t-lg bg-slate-900 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white">
        {title}
      </h5>
      <div className="grid gap-x-3 gap-y-2 p-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Provenance({ deal, fieldKey }: { deal: Deal; fieldKey: string }) {
  const f = deal.fields[fieldKey];
  if (!f) return null;
  return (
    <span className="ml-1 inline-flex items-center gap-1 text-[10px] font-medium text-slate-500">
      · {SOURCE_LABELS[f.source]}
      {f.verified && <ShieldCheck className="size-3 text-emerald-600" aria-label="verified" />}
      {f.edited && <span className="text-sky-700">· edited</span>}
    </span>
  );
}

function TextField({
  deal,
  fieldKey,
  label,
  canEdit,
  error,
  onEdit,
  className,
}: {
  deal: Deal;
  fieldKey: string;
  label: string;
  canEdit: boolean;
  error?: string;
  onEdit: (key: string, value: string) => void;
  className?: string;
}) {
  const f = deal.fields[fieldKey];
  const id = `bos-${fieldKey.replace(/\./g, "-")}`;
  const missing = f?.required && !text(deal, fieldKey);
  return (
    <div className={cn("space-y-0.5", className)}>
      <label htmlFor={id} className="block text-[11px] font-semibold text-slate-700">
        {label}
        {f?.required && <span className="text-red-600"> *</span>}
        <Provenance deal={deal} fieldKey={fieldKey} />
      </label>
      <input
        id={id}
        type={fieldDef(fieldKey)?.kind === "date" ? "date" : "text"}
        value={text(deal, fieldKey)}
        readOnly={!canEdit}
        onChange={(e) => onEdit(fieldKey, e.target.value)}
        aria-invalid={Boolean(error || missing) || undefined}
        className={cn(
          "w-full rounded border px-2 py-1 text-xs",
          canEdit ? "border-slate-300 bg-white" : "border-slate-200 bg-slate-50 text-slate-700",
          missing && "border-amber-400 bg-amber-50",
        )}
      />
      {error && <p className="text-[11px] text-red-600">{error}</p>}
    </div>
  );
}

/** Amount input: free typing while focused, formatted cents otherwise. */
function MoneyInput({
  deal,
  fieldKey,
  label,
  canEdit,
  error,
  onEdit,
}: {
  deal: Deal;
  fieldKey: string;
  label: string;
  canEdit: boolean;
  error?: string;
  onEdit: (key: string, value: string) => void;
}) {
  const value = deal.fields[fieldKey]?.value;
  const formatted = typeof value === "number" ? formatCents(value) : "";
  const [draft, setDraft] = useState<string | null>(null);
  const f = deal.fields[fieldKey];
  return (
    <span className="flex items-center justify-end gap-1">
      <span className="text-slate-400">$</span>
      <input
        aria-label={label}
        inputMode="decimal"
        value={draft ?? formatted}
        placeholder="N/A"
        readOnly={!canEdit}
        onFocus={() => canEdit && setDraft(formatted)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft !== null && draft !== formatted) onEdit(fieldKey, draft);
          setDraft(null);
        }}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        aria-invalid={Boolean(error) || undefined}
        title={f ? `Source: ${SOURCE_LABELS[f.source]}${f.edited ? " (edited)" : ""}` : undefined}
        className={cn(
          "w-24 rounded border px-1.5 py-0.5 text-right tabular-nums",
          canEdit ? "border-slate-300 bg-white" : "border-slate-200 bg-slate-50",
          f?.edited && "border-sky-400",
        )}
      />
    </span>
  );
}

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
