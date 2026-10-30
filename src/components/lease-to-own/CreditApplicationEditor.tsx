import { useState, type ReactNode } from "react";
import { CircleAlert, FileLock2, Lock, Scale, ShieldAlert, TriangleAlert } from "lucide-react";

import {
  applicableStateNotices,
  CREDIT_APP_STRUCTURE_REVIEW,
  CREDIT_STATE_NOTICES,
  creditApplicationIssues,
  creditApplicationMissing,
  dealerUseFinancials,
  dealerUseTradeIn,
  jointCreditRequested,
  NOTICE_RULE_STATUS,
  PREVIOUS_HISTORY_MONTHS,
  previousAddressApplies,
  previousEmployerApplies,
  wisconsinApplies,
  wisconsinSpouseSigns,
  type DealerUseValue,
} from "@/lib/credit-application";
import type { CreditParty } from "@/lib/credit-application-fields";
import { fieldDef, text, type Deal, type EditActor } from "@/lib/deal-model";
import { cn } from "@/lib/utils";
import {
  Bar,
  ChoiceField,
  MoneyInput,
  PageHeading,
  PendingNote,
  PendingText,
  Provenance,
  TextField,
} from "./ContractFormParts";

const PAGES = 3;
const PARTY_TITLE: Record<CreditParty, string> = {
  buyer: "(A) Applicant",
  coBuyer: "(B) Joint Applicant or Other Party",
};

/**
 * Form 3 — Retail Motor Vehicle Credit Application as a web form, in the
 * reference's three pages:
 *   1. credit request and applicant information, (A) and (B) side by side;
 *   2. certification/authorization, signatures and state notices;
 *   3. important applicant information, signatures, For Dealer Use Only.
 *
 * A structured view of the existing pre-qualification application: (A) is the
 * Buyer and (B) the Co-Buyer record, so nothing is retyped and no second
 * application exists. SSN/ITIN and ID numbers are shown masked from secure
 * storage only and can't be typed here. Legal wording is never written here;
 * each place it belongs is marked pending. `renderSignatures` only displays
 * signature and initials locations; nothing is signed here.
 */
export function CreditApplicationEditor({
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
  const joint = jointCreditRequested(deal);
  const missing = creditApplicationMissing(deal);
  const issues = creditApplicationIssues(deal);
  const notices = applicableStateNotices(deal);
  const parties: CreditParty[] = ["buyer", "coBuyer"];

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
      idPrefix="ca"
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
  const box = (key: string, label: string) => (
    <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-700">
      <input
        type="checkbox"
        checked={deal.fields[key]?.value === true}
        disabled={!canEdit}
        onChange={(e) => edit(key, e.target.checked)}
      />
      {label}
    </label>
  );
  const choice = (key: string, label: ReactNode, className?: string) => (
    <ChoiceField
      deal={deal}
      fieldKey={key}
      label={label}
      canEdit={canEdit}
      onEdit={edit}
      name={`ca-${key}`}
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
  const pageInitials = (page: number) => (
    <div className="mt-4">
      <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-600">
        Page {page} initials
      </p>
      {signatures(
        [`ca-p${page}-inits-buyer`, `ca-p${page}-inits-cobuyer`],
        "No initials apply on this page.",
      )}
    </div>
  );

  /** One row of the reference: (A) on the left, (B) on the right. */
  const columns = (title: string, render: (p: CreditParty) => ReactNode) => (
    <section className="mt-4">
      <Bar>{title}</Bar>
      <div className="grid gap-4 border border-t-0 border-slate-200 p-3 lg:grid-cols-2">
        {parties.map((p) => (
          <div key={p} data-applicant={p} className="min-w-0 space-y-2">
            <p className="text-xs font-extrabold text-slate-800">{PARTY_TITLE[p]}</p>
            {p === "coBuyer" && !deal.coBuyerIncluded ? (
              <p className="rounded-lg border border-dashed border-slate-300 p-3 text-xs text-slate-600">
                No Joint Applicant on this deal.
              </p>
            ) : (
              <>
                {p === "coBuyer" && !joint && (
                  <p className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] text-amber-900">
                    Used only if joint credit is requested. Joint credit is not selected.
                  </p>
                )}
                {render(p)}
              </>
            )}
          </div>
        ))}
      </div>
    </section>
  );
  const grid = (children: ReactNode) => (
    <div className="grid gap-x-3 gap-y-2 sm:grid-cols-2">{children}</div>
  );

  return (
    <div className="rounded-xl bg-white p-4 text-slate-900 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-fuchsia-700">
            DEMO — not a legal contract
          </p>
          <p className="text-sm font-bold">
            {text(deal, "dealer.legalName") || "Creditor name missing"}
          </p>
          <p className="text-xs text-slate-600">
            {[text(deal, "dealer.street"), text(deal, "dealer.city"), text(deal, "dealer.state")]
              .filter(Boolean)
              .join(", ")}{" "}
            {text(deal, "dealer.zip")}
          </p>
          <h4 className="mt-1 font-display text-xl font-extrabold">
            RETAIL MOTOR VEHICLE CREDIT APPLICATION
          </h4>
          <p className="text-xs text-slate-500">
            {canEdit
              ? "Staff view: complete only the details the pre-qualification did not collect."
              : "Customer view: read-only. Only authorized staff can change application values."}
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
          <strong>Credit sale vs. lease — management/legal review required.</strong>{" "}
          {CREDIT_APP_STRUCTURE_REVIEW}
        </span>
      </p>
      <p
        role="note"
        className="mt-3 flex gap-2 rounded-lg border border-slate-300 bg-slate-50 p-3 text-xs text-slate-800"
      >
        <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>
          This is the existing pre-qualification application, not a new one. SSN/ITIN and ID numbers
          appear masked from secure storage only; they can't be typed or stored here.
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
              {missing.length} detail{missing.length === 1 ? "" : "s"} still needed:
            </strong>{" "}
            {missing.join("; ")}.
          </p>
        </div>
      )}
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
      <PageHeading page={1} total={PAGES} title="Credit Request & Applicant Information" />
      <div className="mt-3 grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-2 lg:grid-cols-4">
        {choice("credit.saleOrLease", "Credit Sale / Lease")}
        <div className="space-y-0.5">
          <p className="text-[11px] font-semibold text-slate-700">
            Application Number
            <Provenance deal={deal} fieldKey="deal.appNumber" />
          </p>
          <output
            aria-label="Application number"
            className="block rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs"
          >
            {text(deal, "deal.appNumber") || "—"}
          </output>
        </div>
        {field("deal.date", "Date")}
        <div className="space-y-0.5">
          <p className="text-[11px] font-semibold text-slate-700">Creditor Name and Address</p>
          <output aria-label="Creditor name and address" className="block text-xs">
            {text(deal, "dealer.legalName") || "Creditor name missing"},{" "}
            {text(deal, "dealer.street")} {text(deal, "dealer.city")} {text(deal, "dealer.state")}{" "}
            {text(deal, "dealer.zip")}
          </output>
        </div>
      </div>
      <div className="mt-3 space-y-2 rounded-lg border border-slate-200 p-3">
        {choice("credit.creditType", <strong>TYPE OF CREDIT REQUESTED</strong>)}
        <p className="text-[11px] text-slate-500">
          Joint credit is never selected automatically, even when a Co-Buyer is on the deal.
        </p>
        {joint ? (
          <>
            <p className="text-xs font-semibold">
              Joint — We intend to apply for joint credit (each applicant's own initials):
            </p>
            {signatures(
              ["ca-p1-joint-buyer", "ca-p1-joint-cobuyer"],
              "Add the Joint Applicant first.",
            )}
          </>
        ) : (
          <p className="text-[11px] text-slate-600">
            Joint-credit initials apply only when Joint is selected.
          </p>
        )}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <PendingText title="Meaning of “you”, “we” and “married / spouse”" />
        <PendingText title="Important applicant information (identity verification)" />
      </div>

      {columns("Applicant Information", (p) =>
        grid(
          <>
            {field(`${p}.firstName`, "First name")}
            {field(`${p}.middleName`)}
            {field(`${p}.lastName`, "Last name", true)}
            {choice(`${p}.idType`, "Gov't ID type", "sm:col-span-2")}
            <Masked
              label="Gov't ID no."
              value={text(deal, `${p}.idLast4`)}
              format={(v) => `•••• ${v}`}
              empty="Not on file — secure storage"
              deal={deal}
              fieldKey={`${p}.idLast4`}
            />
            {field(`${p}.idIssuedBy`)}
            {field(`${p}.idIssueDate`)}
            {field(`${p}.idExpiryDate`)}
            {field(`${p}.dob`)}
            <Masked
              label="Soc. Sec. No. / ITIN"
              value={
                ["collected", "verified"].includes(text(deal, `${p}.ssnStatus`))
                  ? text(deal, `${p}.ssnLast4`)
                  : ""
              }
              format={(v) => `•••-••-${v}`}
              empty="Secure identity integration required"
              deal={deal}
              fieldKey={`${p}.ssnStatus`}
            />
            <div className="space-y-1">
              {field(`${p}.phone`, "Primary phone")}
              {box(`${p}.phoneCell`, "Cell")}
            </div>
            <div className="space-y-1">
              {field(`${p}.secondPhone`)}
              {box(`${p}.secondPhoneCell`, "Cell")}
            </div>
            {field(`${p}.email`, "Email address", true)}
          </>,
        ),
      )}

      {columns("Residence", (p) => (
        <>
          {grid(
            <>
              {field(`${p}.street`, "Street address", true)}
              {field(`${p}.unit`)}
              <div className="grid grid-cols-2 gap-2">
                {field(`${p}.yearsAtAddress`, "How long? Yrs")}
                {field(`${p}.monthsAtAddress`, "Mos")}
              </div>
              {field(`${p}.city`, "City")}
              <div className="grid grid-cols-2 gap-2">
                {field(`${p}.state`, "State")}
                {field(`${p}.zip`, "ZIP")}
              </div>
              {field(`${p}.mailingStreet`, undefined, true)}
              {field(`${p}.mailingUnit`)}
              {field(`${p}.mailingCity`)}
              {field(`${p}.mailingState`)}
              {field(`${p}.mailingZip`)}
            </>,
          )}
          {amount(`${p}.monthlyHousing`)}
          {choice(`${p}.residentialStatus`, "Residential status")}
          {grid(
            <>
              {field(`${p}.landlord`)}
              {field(`${p}.landlordPhone`)}
            </>,
          )}
          {previousAddressApplies(deal, p) ? (
            <div data-previous-address={p} className="rounded border border-slate-200 p-2">
              <p className="mb-1 text-[11px] font-bold text-slate-700">
                Previous address (if less than {PREVIOUS_HISTORY_MONTHS / 12} yrs at current
                address)
              </p>
              {grid(
                <>
                  {field(`${p}.prevStreet`, undefined, true)}
                  {field(`${p}.prevUnit`)}
                  {field(`${p}.prevCity`)}
                  {field(`${p}.prevState`)}
                  {field(`${p}.prevZip`)}
                  {field(`${p}.prevYears`)}
                  {field(`${p}.prevMonths`)}
                </>,
              )}
            </div>
          ) : (
            <p className="text-[11px] text-slate-500">
              Previous address not required ({PREVIOUS_HISTORY_MONTHS / 12}+ years at current
              address).
            </p>
          )}
        </>
      ))}

      {columns("Employment", (p) => (
        <>
          <p className="text-[11px] text-slate-600">
            Employment status (from application):{" "}
            <strong>{text(deal, `${p}.employmentStatus`) || "—"}</strong>
          </p>
          {grid(
            <>
              {field(`${p}.employer`, undefined, true)}
              {amount(`${p}.income`)}
              {field(`${p}.employerStreet`, undefined, true)}
              {field(`${p}.employerCity`)}
              {field(`${p}.employerState`)}
              {field(`${p}.employerZip`)}
              {field(`${p}.workPhone`)}
              <div className="grid grid-cols-2 gap-2">
                {field(`${p}.yearsAtJob`, "How long? Yrs")}
                {field(`${p}.monthsAtJob`, "Mos")}
              </div>
              {field(`${p}.jobTitle`)}
            </>,
          )}
          {!text(deal, `${p}.employer`) && (
            <p className="text-[11px] text-slate-500">
              No employer — income, if any, is listed under Other Income. Employer details are never
              invented.
            </p>
          )}
          {previousEmployerApplies(deal, p) && (
            <div data-previous-employer={p} className="rounded border border-slate-200 p-2">
              <p className="mb-1 text-[11px] font-bold text-slate-700">
                Previous employer (if less than {PREVIOUS_HISTORY_MONTHS / 12} yrs at current job)
              </p>
              {grid(
                <>
                  {field(`${p}.prevEmployer`, undefined, true)}
                  {amount(`${p}.prevEmployerIncome`)}
                  {field(`${p}.prevEmployerPhone`)}
                  {field(`${p}.prevEmployerAddress`, undefined, true)}
                </>,
              )}
            </div>
          )}
          <div data-secondary-employer={p} className="rounded border border-slate-200 p-2">
            <p className="mb-1 text-[11px] font-bold text-slate-700">
              Secondary employer (if applicable)
            </p>
            {grid(
              <>
                {field(`${p}.secEmployer`)}
                {field(`${p}.secEmployerAddress`)}
                {field(`${p}.secEmployerCity`)}
                <div className="grid grid-cols-2 gap-2">
                  {field(`${p}.secEmployerState`)}
                  {field(`${p}.secEmployerZip`)}
                </div>
                {amount(`${p}.secEmployerIncome`)}
                {field(`${p}.secEmployerPhone`)}
                <div className="grid grid-cols-2 gap-2">
                  {field(`${p}.secYears`, "How long? Yrs")}
                  {field(`${p}.secMonths`, "Mos")}
                </div>
                {field(`${p}.secJobTitle`)}
              </>,
            )}
          </div>
        </>
      ))}

      <section className="mt-4">
        <Bar>Other Income Note</Bar>
        <div className="grid gap-3 border border-t-0 border-slate-200 p-3 lg:grid-cols-2">
          {[1, 2].map((n) => (
            <div key={n} data-other-income={n} className="space-y-2">
              {choice(`credit.otherIncome.${n}.party`, `Row ${n}: (A) or (B)`)}
              {amount(`credit.otherIncome.${n}.amount`)}
              {field(`credit.otherIncome.${n}.source`)}
            </div>
          ))}
          <div className="lg:col-span-2">
            <PendingText title="Alimony, child support or separate maintenance income notice" />
          </div>
        </div>
      </section>

      {columns("References", (p) =>
        grid(
          <>
            {field(`${p}.refName`)}
            {field(`${p}.refPhone`)}
            {field(`${p}.refAddress`)}
            {field(`${p}.refRelationship`)}
            {field(`${p}.bankName`, undefined, true)}
            <div className="flex gap-4 sm:col-span-2">
              {box(`${p}.bankChecking`, "Checking")}
              {box(`${p}.bankSavings`, "Savings")}
            </div>
            <p className="text-[10px] text-slate-500 sm:col-span-2">
              Bank name only — no account numbers are collected. Reference contact details are
              visible to authorized staff and the applicant only.
            </p>
          </>,
        ),
      )}
      {pageInitials(1)}

      {/* ---------------- Page 2 ---------------- */}
      <PageHeading page={2} total={PAGES} title="Authorizations, Signatures & Notices" />
      <div className="mt-3 space-y-3">
        <Bar>Signatures</Bar>
        <PendingText title="Applicant certification and authorization to submit this application" />
        {field("credit.submitTo", undefined, true)}
        <div className="grid gap-3 sm:grid-cols-2">
          <PendingText title="Verification, consumer report and spouse-verification authorization" />
          <PendingText title="Privacy and information-sharing acknowledgment" />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {parties.map((p) => (
            <div key={p} className="space-y-2">
              <p className="text-xs font-extrabold">
                {p === "buyer"
                  ? "Applicant's Signature"
                  : "Jt. Applicant's or Other Party's Signature (when applicable)"}
              </p>
              {p === "buyer" || joint ? (
                signatures(
                  [p === "buyer" ? "ca-p2-buyer" : "ca-p2-cobuyer"],
                  "No Joint Applicant on this deal.",
                )
              ) : (
                <p className="rounded-lg border border-dashed border-slate-300 p-3 text-xs text-slate-600">
                  Applies only when joint credit is requested.
                </p>
              )}
              <p className="text-[11px] text-slate-600">
                DL #:{" "}
                <strong>
                  {text(deal, `${p}.idLast4`)
                    ? `•••• ${text(deal, `${p}.idLast4`)}`
                    : "not on file"}
                </strong>{" "}
                (masked)
              </p>
              {(p === "buyer" || deal.coBuyerIncluded) && (
                <p className="text-[11px] text-slate-500" data-prequal-consent={p}>
                  Recorded at pre-qualification — credit authorization:{" "}
                  {deal.fields[`${p}.consentCreditAuthorization`]?.value === true ? "yes" : "no"};
                  certification:{" "}
                  {deal.fields[`${p}.consentCertification`]?.value === true ? "yes" : "no"}. Not a
                  signature on this document.
                </p>
              )}
            </div>
          ))}
        </div>

        <Bar>Notices</Bar>
        <p className="text-[11px] font-semibold text-violet-800">{NOTICE_RULE_STATUS}</p>
        {notices.length ? (
          notices.map((n) => <PendingText key={n.state} title={`${n.title} (applies)`} />)
        ) : (
          <p className="rounded-lg border border-dashed border-slate-300 p-3 text-xs text-slate-600">
            No state-specific notice applies to this application's residence state(s).
          </p>
        )}
        {wisconsinApplies(deal) && (
          <div data-wisconsin className="space-y-2 rounded-lg border border-slate-200 p-3">
            <p className="text-xs font-bold">Wisconsin residents only</p>
            {choice("credit.wi.maritalStatus", "Applicant is")}
            {grid(
              <>
                {field("credit.wi.spouseName")}
                {field("credit.wi.spouseAddress")}
              </>,
            )}
            <PendingText title="Waiver of notice by non-joint applicant spouse" />
            {wisconsinSpouseSigns(deal) ? (
              signatures(["ca-p2-wi-spouse"], "Enter the spouse's name first.")
            ) : (
              <p className="text-[11px] text-slate-600">
                The non-joint spouse signs only when the applicant is married or separated and the
                spouse is named. The spouse is never the Co-Buyer and no one signs for them.
              </p>
            )}
          </div>
        )}
        <details className="rounded-lg border border-slate-200 p-3 text-xs">
          <summary className="cursor-pointer font-semibold">
            Reference structure — all state notice sections (development review)
          </summary>
          <ul className="mt-2 space-y-1">
            {CREDIT_STATE_NOTICES.map((n) => (
              <li key={n.state} data-state-notice={n.state}>
                {n.title} —{" "}
                {notices.some((a) => a.state === n.state) ? (
                  <strong>applies</strong>
                ) : (
                  "not applicable to this application"
                )}
              </li>
            ))}
          </ul>
          <PendingNote />
        </details>
      </div>
      {pageInitials(2)}

      {/* ---------------- Page 3 ---------------- */}
      <PageHeading
        page={3}
        total={PAGES}
        title="Important Applicant Information & Dealer Use Only"
      />
      <div className="mt-3 space-y-3">
        <Bar>All Applicants: Important Applicant Information</Bar>
        <div className="grid gap-3 sm:grid-cols-2">
          <PendingText title="Consumer report authorization" />
          <PendingText title="Credit and employment verification" />
          <PendingText title="Application retention" />
          <PendingText title="Telephone monitoring, calls and text messages">
            <p className="mt-1 text-slate-600">
              Separate from optional marketing SMS consent, which stays as the applicant chose.
            </p>
          </PendingText>
          <PendingText title="Electronic communications" />
          <PendingText title="Acknowledgment of the notices on this page" />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-1">
            <p className="text-xs font-extrabold">Applicant's Signature</p>
            {signatures(["ca-p3-buyer"], "No signature line applies.")}
          </div>
          <div className="space-y-1">
            <p className="text-xs font-extrabold">Jt. Applicant's Signature (when applicable)</p>
            {joint ? (
              signatures(["ca-p3-cobuyer"], "No Joint Applicant on this deal.")
            ) : (
              <p className="rounded-lg border border-dashed border-slate-300 p-3 text-xs text-slate-600">
                Applies only when joint credit is requested.
              </p>
            )}
          </div>
        </div>

        <section aria-labelledby="ca-dealer-use" className="rounded-lg border-2 border-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900 px-3 py-1.5 text-white">
            <h5 id="ca-dealer-use" className="text-sm font-extrabold italic">
              For Dealer Use Only
            </h5>
            <p className="text-xs font-bold">
              VIN #: <span data-dealer-vin>{text(deal, "vehicle.vin") || "—"}</span>
            </p>
          </div>
          <p className="px-3 pt-2 text-[11px] text-slate-500">
            <Lock className="mr-1 inline size-3" aria-hidden="true" />
            Staff-controlled. Values from Forms 1–2 are shown read-only; change them on their own
            form.
          </p>
          <div className="grid gap-x-3 gap-y-2 p-3 sm:grid-cols-3 lg:grid-cols-4">
            <ReadOnly
              label="New/Used/Demo"
              value={text(deal, "vehicle.condition").toUpperCase()}
              source="Inventory"
            />
            <ReadOnly label="Year" value={text(deal, "vehicle.year")} source="Inventory" />
            <ReadOnly label="Make" value={text(deal, "vehicle.make")} source="Inventory" />
            <ReadOnly label="Model" value={text(deal, "vehicle.model")} source="Inventory" />
            <ReadOnly
              label="Body style"
              value={text(deal, "vehicle.bodyStyle")}
              source="Inventory"
            />
            <ReadOnly label="Mileage" value={text(deal, "vehicle.odometer")} source="Inventory" />
            {amount("credit.dealer.bookValue", "Book value")}
          </div>
          <DealerRow values={dealerUseTradeIn(deal)} />
          <DealerRow
            values={dealerUseFinancials(deal)}
            renderEdit={(key, label) => amount(key, label)}
          />
        </section>
      </div>
      {pageInitials(3)}
    </div>
  );
}

/** A masked identifier from secure storage. Never an input. */
function Masked({
  label,
  value,
  format,
  empty,
  deal,
  fieldKey,
}: {
  label: string;
  value: string;
  format: (v: string) => string;
  empty: string;
  deal: Deal;
  fieldKey: string;
}) {
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] font-semibold text-slate-700">
        {label}
        <Provenance deal={deal} fieldKey={fieldKey} />
      </p>
      <output
        aria-label={label}
        className={cn(
          "flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs",
          !value && "text-amber-800",
        )}
      >
        <Lock className="size-3 shrink-0 text-slate-400" aria-hidden="true" />
        {value ? format(value) : empty}
      </output>
    </div>
  );
}

function ReadOnly({ label, value, source }: { label: string; value: string; source: string }) {
  return (
    <div className="min-w-0 space-y-0.5">
      <p className="text-[10px] font-semibold uppercase text-slate-600">{label}</p>
      <output aria-label={label} className="block truncate text-xs font-semibold" title={source}>
        {value || <span className="font-normal text-amber-700">Pending</span>}
      </output>
      <p className="truncate text-[10px] text-slate-400">{source}</p>
    </div>
  );
}

function DealerRow({
  values,
  renderEdit,
}: {
  values: DealerUseValue[];
  renderEdit?: (key: string, label: string) => ReactNode;
}) {
  return (
    <div className="grid gap-x-3 gap-y-2 border-t border-slate-200 p-3 sm:grid-cols-3 lg:grid-cols-4">
      {values.map((v) =>
        v.editKey && renderEdit ? (
          <div key={v.label}>{renderEdit(v.editKey, v.label)}</div>
        ) : (
          <ReadOnly key={v.label} label={v.label} value={v.value} source={v.source} />
        ),
      )}
    </div>
  );
}
