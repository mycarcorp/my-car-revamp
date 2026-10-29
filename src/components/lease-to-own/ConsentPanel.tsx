import { Link } from "@tanstack/react-router";
import { FileWarning } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  LEASE_CONSENT_TYPES,
  type ApplicantRole,
  type ConsentChoices,
  type LeaseConsentType,
} from "@/lib/lease-to-own";
import { LEASE_CONSENT_WORDING } from "@/lib/lease-to-own-content";
import { FormSection } from "./FormFields";

/**
 * Separate consents for one applicant. Every box starts unchecked; optional
 * marketing texts are never required and never inferred from anything else.
 * The Co-Buyer's panel is phrased for the Co-Buyer and is recorded as entered
 * on the Buyer's device, to be confirmed by the Co-Buyer before it is relied on.
 */
export function ConsentPanel({
  role,
  value,
  onChange,
  missing,
}: {
  role: ApplicantRole;
  value: ConsentChoices;
  onChange: (type: LeaseConsentType, accepted: boolean) => void;
  missing: readonly LeaseConsentType[];
}) {
  const drafts = LEASE_CONSENT_TYPES.some((type) => !LEASE_CONSENT_WORDING[type].approved);
  return (
    <FormSection
      title={role === "buyer" ? "Consent & Authorization" : "Co-Buyer Consent & Authorization"}
      description={
        role === "co_buyer"
          ? "The Co-Buyer must read and decide on each item themselves. We'll ask them to confirm separately before anything is relied on."
          : undefined
      }
    >
      {drafts && (
        <p className="flex items-start gap-2 rounded-lg border border-dashed border-[#F7941D] bg-[#F7941D]/10 p-3 text-xs font-semibold text-accent-text">
          <FileWarning className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          DRAFT wording pending legal approval. No credit report is requested when you submit.
        </p>
      )}
      <ul className="space-y-3">
        {LEASE_CONSENT_TYPES.map((type) => {
          const wording = LEASE_CONSENT_WORDING[type];
          const id = `lto-${role}-consent-${type}`;
          const isMissing = missing.includes(type);
          return (
            <li
              key={type}
              className={`rounded-lg border p-3 ${isMissing ? "border-destructive bg-destructive/5" : "border-border"}`}
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  id={id}
                  checked={value[type]}
                  onCheckedChange={(state) => onChange(type, state === true)}
                  aria-required={wording.required || undefined}
                  aria-invalid={isMissing || undefined}
                  aria-describedby={`${id}-text`}
                  className="mt-0.5"
                />
                <div className="space-y-1">
                  <Label htmlFor={id} className="cursor-pointer text-sm font-semibold">
                    {wording.label}
                    {!wording.approved && (
                      <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                        {wording.version}
                      </span>
                    )}
                  </Label>
                  <p id={`${id}-text`} className="text-xs leading-relaxed text-muted-foreground">
                    {role === "co_buyer" ? "Co-Buyer: " : ""}
                    {wording.text}
                  </p>
                  {isMissing && (
                    <p className="text-xs font-medium text-destructive">
                      This authorization is required to submit.
                    </p>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted-foreground">
        Read our{" "}
        <Link
          to="/privacy"
          className="font-semibold text-primary underline-offset-2 hover:underline"
        >
          Privacy Policy
        </Link>{" "}
        and{" "}
        <Link to="/terms" className="font-semibold text-primary underline-offset-2 hover:underline">
          Terms
        </Link>
        .
      </p>
    </FormSection>
  );
}
