import { useState, type ReactNode } from "react";
import { CircleAlert, CircleCheck, FileLock2, Scale } from "lucide-react";

import type { SignerRole } from "@/lib/contract-signatures";
import { fieldDef, fullName, text, type Deal, type EditActor } from "@/lib/deal-model";
import {
  DELIVERY_INITIAL_ROLES,
  DELIVERY_STATEMENTS,
  DELIVERY_TEMPLATE_REVIEW,
  deliveryRecordsMade,
  purchaserNames,
  type DeliveryStatement,
} from "@/lib/delivery-checklist";
import { initialKey, initialsProgress, type DemoInitials } from "@/lib/demo-signatures";
import { itemApplies } from "@/lib/acknowledgments";
import { cn } from "@/lib/utils";
import { AcknowledgmentInitials } from "./AcknowledgmentInitials";
import { Bar, PendingNote, PendingText, Provenance, TextField } from "./ContractFormParts";

const ROLE: Partial<Record<SignerRole, string>> = { buyer: "Purchaser", co_buyer: "Co-Purchaser" };
const WORDING = "Approved statement wording required";

/**
 * Form 5 — Customer Delivery Checklist as a web form, laid out like the
 * one-page reference: dealer heading, purchasers and vehicle, introduction,
 * nine initialled statements, closing message and three signature lines.
 *
 * Purchasers, vehicle, trade-in and dealer come from the shared deal (edited
 * on Forms 1–3). Document-delivery facts are recorded by staff only and never
 * inferred. Each statement is initialled on its own by its own signer, using
 * the same initials system as Form 4. Completing the checklist never marks a
 * vehicle delivered or a lease active.
 */
export function DeliveryChecklistEditor({
  deal,
  actor,
  onEdit,
  renderSignatures,
  initials,
  actingRole,
  onInitial,
  onClearInitial,
  signatureState,
}: {
  deal: Deal;
  actor: EditActor;
  onEdit: (key: string, value: string | boolean) => string | undefined;
  renderSignatures?: (slotIds: string[]) => ReactNode | null;
  initials: DemoInitials;
  actingRole: SignerRole;
  onInitial?: (item: number, value: string) => string | undefined;
  onClearInitial?: (item: number) => void;
  /** Whether each signer's (demo) signature is shown, for the status summary. */
  signatureState: Partial<Record<SignerRole, boolean>>;
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const canEdit = actor === "staff";
  const canInitial = actor === "customer" && Boolean(onInitial);
  const vin = text(deal, "vehicle.vin");
  const progress = initialsProgress("delivery_checklist", deal, initials);
  const records = deliveryRecordsMade(deal);

  const edit = (key: string, value: string | boolean) => {
    const error = onEdit(key, value);
    setErrors((prev) => {
      const next = { ...prev };
      if (error) next[key] = error;
      else delete next[key];
      return next;
    });
  };
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

  const purchaserComplete =
    Boolean(fullName(deal, "buyer")) &&
    (!deal.coBuyerIncluded || Boolean(fullName(deal, "coBuyer")));
  const acksComplete = progress.every((p) => p.done === p.total);
  const sigsComplete =
    Boolean(signatureState.buyer) &&
    (!deal.coBuyerIncluded || Boolean(signatureState.co_buyer)) &&
    Boolean(signatureState.dealer);
  const allDone =
    purchaserComplete &&
    Boolean(vin) &&
    records.done === records.total &&
    acksComplete &&
    sigsComplete;

  const statement = (s: DeliveryStatement) => {
    const applies = itemApplies(s, deal);
    return (
      <li
        key={s.number}
        data-statement={s.number}
        data-applies={applies.applies}
        className={cn(
          "grid gap-3 rounded-lg border p-3 sm:grid-cols-[9rem_1fr]",
          applies.applies ? "border-slate-200" : "border-dashed border-slate-300 bg-slate-50",
        )}
      >
        <div className="space-y-2">
          {applies.applies ? (
            DELIVERY_INITIAL_ROLES.map((role) => (
              <AcknowledgmentInitials
                key={role}
                role={role}
                noun="Statement"
                item={s.number}
                who={ROLE[role] ?? role}
                entry={initials[initialKey("delivery_checklist", s.number, role)]}
                acting={canInitial && actingRole === role}
                onInitial={onInitial}
                onClear={onClearInitial}
              />
            ))
          ) : (
            <p className="rounded border border-slate-300 bg-white p-2 text-center text-[11px] font-bold text-slate-600">
              Not Applicable
            </p>
          )}
        </div>
        <div className="min-w-0 space-y-1 text-xs">
          <p className="font-extrabold">
            {s.number}. <span className="font-semibold text-slate-700">{s.title}</span>
          </p>
          {!applies.applies && <p className="text-[11px] text-slate-600">{applies.reason}</p>}
          {s.legalReview && (
            <p className="inline-flex items-center gap-1 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-800">
              <Scale className="size-3" aria-hidden="true" /> Legal review: {s.legalReview}
            </p>
          )}
          {s.number === 1 && (
            <p className="text-[11px] text-slate-600">
              Form 1 (Bill of Sale / Buyer's Order) is a demo preview only — the approved document
              has not been issued.
            </p>
          )}
          {s.number === 2 && (
            <p className="text-[11px] text-slate-600">
              Includes the Buyer's Guide display acknowledgment.
            </p>
          )}
          {s.number === 5 && (
            <p className="text-[11px] text-slate-600">
              Trade-in lienholder on file:{" "}
              <strong>{text(deal, "tradeIn1.lienholderName") || "none recorded"}</strong> (not
              verified here).
            </p>
          )}
          {s.records?.map((key) => (
            <label key={key} className="flex items-center gap-1.5 text-[11px]">
              <input
                type="checkbox"
                checked={deal.fields[key]?.value === true}
                disabled={!canEdit}
                onChange={(e) => edit(key, e.target.checked)}
              />
              <span>
                Staff record: {fieldDef(key)?.label}
                {deal.fields[key]?.value !== true && (
                  <strong className="ml-1 text-amber-700">— not recorded</strong>
                )}
              </span>
            </label>
          ))}
          <p className="text-[10px] font-semibold text-amber-700">{WORDING}.</p>
        </div>
      </li>
    );
  };

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
      <header className="mt-2 text-center">
        <p data-dealer-name className="text-lg font-extrabold uppercase">
          {text(deal, "dealer.legalName") || "Dealer name missing"}
        </p>
        <p data-dealer-address className="text-xs uppercase text-slate-700">
          {text(deal, "dealer.street")} {text(deal, "dealer.city")}, {text(deal, "dealer.state")}{" "}
          {text(deal, "dealer.zip")}
        </p>
        <h4 className="mt-2 font-display text-lg font-extrabold">CUSTOMER DELIVERY CHECKLIST</h4>
      </header>

      <p
        role="note"
        className="mt-3 flex gap-2 rounded-lg border border-violet-300 bg-violet-50 p-3 text-xs text-violet-950"
      >
        <Scale className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>{DELIVERY_TEMPLATE_REVIEW}</span>
      </p>

      <div className="mt-3 space-y-2 rounded-lg border border-slate-200 p-3 text-xs">
        <div className="grid gap-1 sm:grid-cols-[9rem_1fr] sm:items-baseline">
          <p className="font-semibold text-slate-700">
            Purchaser Name(s):
            <Provenance deal={deal} fieldKey="buyer.firstName" />
          </p>
          <output aria-label="Purchaser names" className="border-b border-slate-400 pb-0.5 text-sm">
            {purchaserNames(deal) || <span className="text-amber-700">Missing</span>}
          </output>
        </div>
        <div className="grid gap-1 sm:grid-cols-[9rem_1fr] sm:items-baseline">
          <p className="font-semibold text-slate-700">Vehicle Description:</p>
          {vin ? (
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_2fr]">
              {(
                [
                  ["Year", text(deal, "vehicle.year")],
                  ["Make", text(deal, "vehicle.make")],
                  ["Model", text(deal, "vehicle.model")],
                  ["Vehicle Identification Number", vin],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <output
                    aria-label={label}
                    className="block truncate border-b border-slate-400 pb-0.5 text-sm"
                  >
                    {value || <span className="text-amber-700">Missing</span>}
                  </output>
                  <p className="text-[10px] text-slate-500">{label}</p>
                </div>
              ))}
            </div>
          ) : (
            <p data-vehicle-unassigned className="font-bold text-amber-700">
              Vehicle Not Assigned — delivery stays pending.
            </p>
          )}
        </div>
      </div>

      <ul
        aria-label="Checklist status"
        className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold"
      >
        <Status
          ok={purchaserComplete}
          text={`Purchaser information ${purchaserComplete ? "complete" : "incomplete"}`}
        />
        <Status ok={Boolean(vin)} text={vin ? "Vehicle assigned" : "Vehicle not assigned"} />
        <Status
          ok={records.done === records.total}
          text={`Document delivery records ${records.done}/${records.total} (staff)`}
        />
        {progress.map((p) => (
          <Status
            key={p.role}
            ok={p.done === p.total}
            text={`${ROLE[p.role]} acknowledgments ${p.done}/${p.total}`}
          />
        ))}
        <Status
          ok={Boolean(signatureState.buyer)}
          text={`Purchaser signature ${signatureState.buyer ? "shown (demo)" : "pending"}`}
        />
        {deal.coBuyerIncluded && (
          <Status
            ok={Boolean(signatureState.co_buyer)}
            text={`Co-Purchaser signature ${signatureState.co_buyer ? "shown (demo)" : "pending"}`}
          />
        )}
        <Status
          ok={Boolean(signatureState.dealer)}
          text={`Authorized representative signature ${signatureState.dealer ? "shown (demo)" : "pending"}`}
        />
        <li
          data-overall
          className={cn(
            "inline-flex items-center gap-1 rounded-full border-2 px-2.5 py-1",
            allDone ? "border-emerald-500 text-emerald-800" : "border-slate-400 text-slate-700",
          )}
        >
          Overall:{" "}
          {allDone
            ? "checklist complete (demo) — vehicle not marked delivered"
            : "checklist incomplete"}
        </li>
      </ul>

      <div className="mt-4 space-y-2">
        <PendingText title="Introduction — review these statements before taking delivery; initial each statement you agree with" />
        <Bar>
          Please read — by initialing and signing below you consent to the following statements
        </Bar>
        <PendingNote />
        {deal.coBuyerIncluded && (
          <p className="text-[11px] text-slate-600">
            The reference shows one Purchaser initials box per statement. Co-Purchaser initials are
            added only if the approved template requires them.
          </p>
        )}
        <ol className="space-y-2">{DELIVERY_STATEMENTS.map(statement)}</ol>
        <PendingText title="Closing message to the customer" />
        <p className="text-[11px] text-slate-500">
          No delivery is recorded here. Delivery and lease activation stay in the dealership's
          authorized workflow.
        </p>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-600">
            Signature of Purchaser
          </p>
          {signature("dc-purchaser", "Purchaser signature line appears once signing is available.")}
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-600">
            Signature of Authorized Representative
          </p>
          <TextField
            deal={deal}
            fieldKey="dealer.authorizedSigner"
            label="Authorized staff representative"
            canEdit={canEdit}
            error={errors["dealer.authorizedSigner"]}
            onEdit={edit}
            idPrefix="dc"
          />
          <TextField
            deal={deal}
            fieldKey="delivery.representativeTitle"
            label="Staff role / authorization"
            canEdit={canEdit}
            error={errors["delivery.representativeTitle"]}
            onEdit={edit}
            idPrefix="dc"
          />
          {signature(
            "dc-representative",
            "Representative signature line appears once signing is available.",
          )}
          <p className="text-[10px] text-slate-500">
            Only an authorized dealership representative signs here.
          </p>
        </div>
        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-600">
            Signed Co-Purchaser
          </p>
          {deal.coBuyerIncluded ? (
            signature(
              "dc-copurchaser",
              "Co-Purchaser signature line appears once signing is available.",
            )
          ) : (
            <p className="rounded-lg border border-dashed border-slate-300 p-3 text-xs text-slate-600">
              No Co-Purchaser on this deal.
            </p>
          )}
          <p className="text-[11px] text-slate-500">
            Dates are the dates each person actually signs.
          </p>
        </div>
      </div>
    </div>
  );
}

function Status({ ok, text: label }: { ok: boolean; text: string }) {
  return (
    <li
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1",
        ok
          ? "border-emerald-300 bg-emerald-50 text-emerald-800"
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
