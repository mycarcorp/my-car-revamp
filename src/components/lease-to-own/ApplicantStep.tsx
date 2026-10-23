import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { LockKeyhole } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trackLeaseEvent } from "@/lib/analytics";
import { getAttributionDetails } from "@/lib/attribution";
import {
  EMPTY_APPLICANT,
  US_STATES,
  formatPhoneInput,
  validateApplicant,
  type ApplicantErrors,
  type ApplicantInput,
  type LeaseTierKey,
} from "@/lib/lease-to-own";
import { submitLeaseApplication, type LeaseVehicleSnapshot } from "@/lib/lease-to-own.functions";
import { leaseErrorMessage } from "@/lib/lease-to-own-client";
import { ctaButtonClass } from "@/lib/ui";
import { PendingIntegration } from "./shared";
import { SecureSsnField } from "./SecureSsnField";

/**
 * Step 1. SSN/ITIN is not part of this form (see SecureSsnField). The driver's
 * license number lives only in this component's state, are sent once
 * over HTTPS to the authenticated server function, and are cleared after
 * submission. They are never written to storage, URLs, analytics, or logs.
 *
 * Guests can fill the form immediately. Saving requires a MyCar account, so on
 * Continue a guest is sent through the existing sign-in / create-account sheet
 * (opened by the page) and the submission resumes once the session exists.
 */
export function ApplicantStep({
  accessToken,
  defaultEmail,
  defaultName,
  tier,
  vehicleValue,
  vehicle,
  secureCollection,
  integrationsLoading,
  onRequireAccount,
  onSubmitted,
}: {
  accessToken: string;
  defaultEmail: string;
  defaultName: string;
  tier: LeaseTierKey;
  vehicleValue: number;
  vehicle: LeaseVehicleSnapshot | null;
  secureCollection: boolean;
  integrationsLoading: boolean;
  onRequireAccount: () => void;
  onSubmitted: (result: { id: number; resumed: boolean }) => void;
}) {
  const [form, setForm] = useState<ApplicantInput>({
    ...EMPTY_APPLICANT,
    email: defaultEmail,
    fullLegalName: defaultName,
  });
  const [errors, setErrors] = useState<ApplicantErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [awaitingAccount, setAwaitingAccount] = useState(false);
  const [blockedNotice, setBlockedNotice] = useState(false);
  const submittingRef = useRef(false);
  const started = useRef(false);

  // Prefill only non-sensitive account details, and never overwrite what was typed.
  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      email: prev.email || defaultEmail,
      fullLegalName: prev.fullLegalName || defaultName,
    }));
  }, [defaultEmail, defaultName]);

  const set = (key: keyof ApplicantInput) => (value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  function currentErrors(values: ApplicantInput): ApplicantErrors {
    return validateApplicant(values);
  }

  /** Shows a field's message once the applicant leaves it. */
  const validateField = (key: keyof ApplicantInput) => () => {
    const message = currentErrors(form)[key];
    setErrors((prev) => ({ ...prev, [key]: message }));
  };

  function markStarted() {
    if (started.current) return;
    started.current = true;
    trackLeaseEvent("lease_to_own_application_started", { tier });
  }

  const submit = useCallback(async () => {
    if (submittingRef.current || !accessToken) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const result = await submitLeaseApplication({
        data: {
          accessToken,
          tier,
          vehicleValue,
          applicant: form,
          vehicle,
          attribution: getAttributionDetails(),
        },
      });
      setForm({ ...EMPTY_APPLICANT });
      if (result.resumed) {
        toast.info("You already have a Lease to Own application in progress, so we've opened it.");
      } else {
        trackLeaseEvent("lease_to_own_application_submitted", { tier });
        trackLeaseEvent("lease_to_own_application_step_completed", { step: 1 });
        toast.success("Application saved to your MyCar account. Next, upload your documents.");
      }
      onSubmitted(result);
    } catch (error) {
      toast.error(leaseErrorMessage(error));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [accessToken, tier, vehicleValue, form, vehicle, onSubmitted]);

  // A guest pressed Continue and has now signed in through the existing sheet.
  useEffect(() => {
    if (!awaitingAccount || !accessToken) return;
    setAwaitingAccount(false);
    if (Object.keys(currentErrors(form)).length) return;
    void submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awaitingAccount, accessToken]);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;
    const found = currentErrors(form);
    setErrors(found);
    const firstKey = Object.keys(found)[0];
    if (firstKey) {
      document.getElementById(`lto-${firstKey}`)?.focus();
      return;
    }
    if (!secureCollection) {
      // Valid, but nothing may be saved without secure collection: say so plainly.
      setBlockedNotice(true);
      return;
    }
    if (!accessToken) {
      setAwaitingAccount(true);
      onRequireAccount();
      return;
    }
    void submit();
  }

  const sensitiveUnavailable = !secureCollection && !integrationsLoading;

  return (
    <form onSubmit={onSubmit} onInputCapture={markStarted} noValidate className="space-y-6">
      {sensitiveUnavailable && (
        <PendingIntegration title="Integration required: secure application storage">
          Server-side encryption for driver's license numbers is not configured yet, so this
          application cannot be saved online. You can still enter and check your details — nothing
          you type is stored or sent. Call us at (540) 426-3322 to apply by phone.
        </PendingIntegration>
      )}

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-foreground">About you</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="fullLegalName" label="Full legal name" error={errors.fullLegalName}>
            <Input
              id="lto-fullLegalName"
              autoComplete="name"
              value={form.fullLegalName}
              onChange={(e) => set("fullLegalName")(e.target.value)}
              {...aria("fullLegalName", errors)}
              onBlur={validateField("fullLegalName")}
            />
          </Field>
          <Field id="dateOfBirth" label="Date of birth" error={errors.dateOfBirth}>
            <Input
              id="lto-dateOfBirth"
              type="date"
              autoComplete="bday"
              value={form.dateOfBirth}
              onChange={(e) => set("dateOfBirth")(e.target.value)}
              {...aria("dateOfBirth", errors)}
              onBlur={validateField("dateOfBirth")}
            />
          </Field>
          <SecureSsnField />
          <Field id="cellPhone" label="Cell phone number" error={errors.cellPhone}>
            <Input
              id="lto-cellPhone"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              value={formatPhoneInput(form.cellPhone)}
              onChange={(e) => set("cellPhone")(e.target.value)}
              {...aria("cellPhone", errors)}
              onBlur={validateField("cellPhone")}
            />
          </Field>
          <Field id="email" label="Email address" error={errors.email}>
            <Input
              id="lto-email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => set("email")(e.target.value)}
              {...aria("email", errors)}
              onBlur={validateField("email")}
            />
          </Field>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-foreground">Driver's license</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="driversLicenseNumber"
            label="Driver's license number"
            error={errors.driversLicenseNumber}
            hint={
              secureCollection
                ? "As printed on your license. Encrypted before it's stored; staff see only the last 4."
                : "As printed on your license. Not saved until secure collection is configured."
            }
          >
            <Input
              id="lto-driversLicenseNumber"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={24}
              value={form.driversLicenseNumber}
              onChange={(e) => set("driversLicenseNumber")(e.target.value.toUpperCase())}
              className="font-mono"
              {...aria("driversLicenseNumber", errors)}
              onBlur={validateField("driversLicenseNumber")}
            />
          </Field>
          <Field
            id="driversLicenseState"
            label="Driver's license state"
            error={errors.driversLicenseState}
          >
            <StateSelect
              id="lto-driversLicenseState"
              value={form.driversLicenseState}
              onChange={set("driversLicenseState")}
              invalid={Boolean(errors.driversLicenseState)}
            />
          </Field>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-foreground">Home address</legend>
        <Field id="street" label="Street address" error={errors.street}>
          <Input
            id="lto-street"
            autoComplete="address-line1"
            value={form.street}
            onChange={(e) => set("street")(e.target.value)}
            {...aria("street", errors)}
            onBlur={validateField("street")}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr]">
          <Field id="city" label="City" error={errors.city}>
            <Input
              id="lto-city"
              autoComplete="address-level2"
              value={form.city}
              onChange={(e) => set("city")(e.target.value)}
              {...aria("city", errors)}
              onBlur={validateField("city")}
            />
          </Field>
          <Field id="state" label="State" error={errors.state}>
            <StateSelect
              id="lto-state"
              value={form.state}
              onChange={set("state")}
              invalid={Boolean(errors.state)}
            />
          </Field>
          <Field id="zip" label="ZIP code" error={errors.zip}>
            <Input
              id="lto-zip"
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength={10}
              value={form.zip}
              onChange={(e) => set("zip")(e.target.value)}
              {...aria("zip", errors)}
              onBlur={validateField("zip")}
            />
          </Field>
        </div>
      </fieldset>

      <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1 text-xs text-muted-foreground">
          <p className="flex items-start gap-2">
            <LockKeyhole className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            Submitting is not a credit decision or an offer. By submitting you authorize My Car
            Business Services LLC to review this application and contact you about it.
          </p>
          {blockedNotice && !secureCollection && (
            <p className="pl-5.5 font-semibold text-foreground" role="alert">
              Your details look complete, but online applications can't be saved until secure
              application storage is configured. Nothing was sent. Please call (540) 426-3322.
            </p>
          )}
          {!accessToken && secureCollection && (
            <p className="pl-5.5" role="status">
              {awaitingAccount
                ? "Sign in or create your MyCar account to save this application. Your entries stay on this page."
                : "You'll sign in or create your MyCar account before anything is saved. Google sign-in reloads the page, so sensitive entries would need to be re-entered."}
            </p>
          )}
        </div>
        <Button
          type="submit"
          disabled={submitting || integrationsLoading}
          aria-busy={submitting || undefined}
          className={`${ctaButtonClass} shrink-0`}
        >
          {submitting ? "Saving securely…" : "Continue to Document Uploads"}
        </Button>
      </div>
    </form>
  );
}

function aria(key: keyof ApplicantInput, errors: ApplicantErrors) {
  return {
    required: true,
    "aria-required": true,
    "aria-invalid": Boolean(errors[key]) || undefined,
    "aria-describedby": errors[key] ? `lto-${key}-error` : undefined,
  } as const;
}

function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: keyof ApplicantInput;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`lto-${id}`}>
        {label}{" "}
        <span aria-hidden="true" className="text-destructive">
          *
        </span>
      </Label>
      {children}
      {error ? (
        <p id={`lto-${id}-error`} className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`lto-${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function StateSelect({
  id,
  value,
  onChange,
  invalid,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  invalid: boolean;
}) {
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger id={id} aria-invalid={invalid || undefined} aria-required>
        <SelectValue placeholder="Select" />
      </SelectTrigger>
      <SelectContent>
        {US_STATES.map((state) => (
          <SelectItem key={state} value={state}>
            {state}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
