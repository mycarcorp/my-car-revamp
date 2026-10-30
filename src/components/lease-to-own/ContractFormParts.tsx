import { useState, type ReactNode } from "react";
import { ShieldCheck } from "lucide-react";

import { fieldDef, text, type Deal, type FieldSource } from "@/lib/deal-model";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * Building blocks shared by the contract web forms (Form 1 Bill of Sale,
 * Form 2 Retail Installment). Presentation only: every change is reported
 * through `onEdit`, which enforces who may edit what (see editDealField).
 */

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

export function PageHeading({
  page,
  total,
  title,
}: {
  page: number;
  total: number;
  title: string;
}) {
  return (
    <h5
      className={cn(
        "flex flex-wrap items-baseline gap-2 border-b-2 border-slate-900 pb-1 text-sm font-extrabold",
        page > 1 ? "mt-8" : "mt-5",
      )}
    >
      <span className="rounded bg-slate-900 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
        Page {page} of {total}
      </span>
      {title}
    </h5>
  );
}

export function Bar({ children }: { children: ReactNode }) {
  return (
    <p className="bg-slate-900 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
      {children}
    </p>
  );
}

export function PendingNote() {
  return (
    <p className="text-[10px] font-semibold text-amber-700">
      Approved legal text pending — supplied by the authorized template.
    </p>
  );
}

/** A place where approved legal wording goes. No wording is invented here. */
export function PendingText({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50/40 p-3 text-xs">
      <p className="font-bold text-slate-800">{title}</p>
      {children}
      <PendingNote />
    </div>
  );
}

export function CheckField({
  deal,
  fieldKey,
  canEdit,
  onEdit,
  label,
  pending = true,
  children,
}: {
  deal: Deal;
  fieldKey: string;
  canEdit: boolean;
  onEdit: (key: string, value: boolean) => void;
  label: ReactNode;
  /** Show the "approved legal text pending" note under the checkbox. */
  pending?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="space-y-1 rounded-lg border border-slate-200 p-3 text-xs">
      <label className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={deal.fields[fieldKey]?.value === true}
          disabled={!canEdit}
          onChange={(e) => onEdit(fieldKey, e.target.checked)}
          className="mt-0.5"
        />
        <span>
          {label}
          <Provenance deal={deal} fieldKey={fieldKey} />
        </span>
      </label>
      {children}
      {pending && <PendingNote />}
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200">
      <h5 className="rounded-t-lg bg-slate-900 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white">
        {title}
      </h5>
      <div className="grid gap-x-3 gap-y-2 p-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export function Provenance({ deal, fieldKey }: { deal: Deal; fieldKey: string }) {
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

/** Text, date, rate or count input. `idPrefix` keeps ids unique per form. */
export function TextField({
  deal,
  fieldKey,
  label,
  canEdit,
  error,
  onEdit,
  className,
  idPrefix = "bos",
  placeholder,
}: {
  deal: Deal;
  fieldKey: string;
  label: string;
  canEdit: boolean;
  error?: string;
  onEdit: (key: string, value: string) => void;
  className?: string;
  idPrefix?: string;
  placeholder?: string;
}) {
  const f = deal.fields[fieldKey];
  const id = `${idPrefix}-${fieldKey.replace(/\./g, "-")}`;
  const missing = f?.required && !text(deal, fieldKey);
  const kind = fieldDef(fieldKey)?.kind;
  const [draft, setDraft] = useState<string | null>(null);
  // Rates and counts are validated on blur, so typing isn't interrupted.
  const deferred = kind === "percent" || kind === "integer";
  const value = deferred ? (draft ?? text(deal, fieldKey)) : text(deal, fieldKey);
  return (
    <div className={cn("space-y-0.5", className)}>
      <label htmlFor={id} className="block text-[11px] font-semibold text-slate-700">
        {label}
        {f?.required && <span className="text-red-600"> *</span>}
        <Provenance deal={deal} fieldKey={fieldKey} />
      </label>
      <input
        id={id}
        type={kind === "date" ? "date" : "text"}
        inputMode={deferred ? "decimal" : undefined}
        value={value}
        placeholder={placeholder}
        readOnly={!canEdit}
        onChange={(e) => (deferred ? setDraft(e.target.value) : onEdit(fieldKey, e.target.value))}
        onBlur={() => {
          if (deferred && draft !== null && draft !== text(deal, fieldKey)) onEdit(fieldKey, draft);
          setDraft(null);
        }}
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

/**
 * Amount input: free typing while focused, formatted otherwise. "money" fields
 * hold cents; "amount" fields also hold N/A or INCL. (blank = unknown).
 */
export function MoneyInput({
  deal,
  fieldKey,
  label,
  canEdit,
  error,
  onEdit,
  placeholder = "N/A",
  className,
}: {
  deal: Deal;
  fieldKey: string;
  label: string;
  canEdit: boolean;
  error?: string;
  onEdit: (key: string, value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const value = deal.fields[fieldKey]?.value;
  const formatted =
    typeof value === "number" ? formatCents(value) : typeof value === "string" ? value : "";
  const [draft, setDraft] = useState<string | null>(null);
  const f = deal.fields[fieldKey];
  return (
    <span className="flex items-center justify-end gap-1">
      <span className="text-slate-400">$</span>
      <input
        aria-label={label}
        inputMode="decimal"
        value={draft ?? formatted}
        placeholder={placeholder}
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
          className,
        )}
      />
    </span>
  );
}

/** Radio group for a "choice" field. Nothing is selected until someone chooses. */
export function ChoiceField({
  deal,
  fieldKey,
  label,
  canEdit,
  onEdit,
  name,
  className,
}: {
  deal: Deal;
  fieldKey: string;
  label: ReactNode;
  canEdit: boolean;
  onEdit: (key: string, value: string) => void;
  name: string;
  className?: string;
}) {
  const options = fieldDef(fieldKey)?.options ?? [];
  return (
    <fieldset className={className}>
      <legend className="text-[11px] font-semibold text-slate-700">
        {label}
        <Provenance deal={deal} fieldKey={fieldKey} />
      </legend>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {options.map((o) => (
          <label key={o.value} className="flex items-center gap-1">
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={text(deal, fieldKey) === o.value}
              disabled={!canEdit}
              onChange={() => onEdit(fieldKey, o.value)}
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
