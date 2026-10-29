import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, LockKeyhole, UserMinus, UserPlus } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trackLeaseEvent } from "@/lib/analytics";
import { getAttributionDetails } from "@/lib/attribution";
import {
  APPLICANT_ROLE_LABELS,
  EMPTY_APPLICANT,
  EMPTY_CONSENTS,
  EMPTY_TRADE_IN,
  EMPTY_VEHICLE_PREFERENCES,
  coBuyerErrors,
  missingRequiredConsents,
  validateApplicantProfile,
  validateTradeIn,
  validateVehiclePreferences,
  type ApplicantErrors,
  type ApplicantField,
  type ApplicantProfile,
  type ApplicantRole,
  type ConsentChoices,
  type LeaseConsentType,
  type LeaseDocType,
  type LeaseTierKey,
  type PackageEstimate,
  type TradeIn,
  type TradeInErrors,
  type VehiclePreferences,
} from "@/lib/lease-to-own";
import { PREQUAL } from "@/lib/lease-to-own-content";
import { submitLeaseApplication, type LeaseVehicleSnapshot } from "@/lib/lease-to-own.functions";
import { leaseErrorMessage, uploadLeaseDocument } from "@/lib/lease-to-own-client";
import { ctaButtonClass } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { ApplicantFields } from "./ApplicantFields";
import { ConsentPanel } from "./ConsentPanel";
import { InterestedVehicle, VehicleSummary } from "./InterestedVehicle";
import { PendingIntegration, ReviewNote } from "./shared";
import { StagedAttachments, type StagedFiles } from "./StagedAttachments";
import { applicantFieldId } from "./helpers";

type PerRole<T> = Record<ApplicantRole, T>;

function splitName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return { firstName: parts[0] ?? "", lastName: "" };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts.at(-1)! };
}

/**
 * Step 1: "Get Pre-Qualified" with Buyer and optional Co-Buyer tabs.
 *
 * Each applicant has independent state, validation, attachments and consents;
 * nothing is copied between them. Sensitive values live only in this
 * component's memory, go once over HTTPS to the authenticated server function,
 * and are cleared after a confirmed save. SSN/ITIN is never part of this form.
 *
 * Guests can fill everything in. Saving requires a MyCar account, so on submit
 * a guest is sent through the existing sign-in / create-account sheet (opened
 * by the page) and the submission resumes once the session exists.
 */
export function ApplicantStep({
  accessToken,
  defaultEmail,
  defaultName,
  tier,
  estimate,
  vehicle,
  vehicleLoading,
  onSelectVehicle,
  secureCollection,
  consentsAllowed,
  integrationsLoading,
  onRequireAccount,
  onSubmitted,
  intro,
  onDemoSubmit,
}: {
  /**
   * Set by the page ONLY in local Development Test Mode (see lease-to-own-demo.ts).
   * When present, Submit opens the fictional demo preview instead: no validation,
   * no server call, no analytics, and the entered values are not used or sent.
   * Production builds never pass it.
   */
  onDemoSubmit?: () => void;
  /** Page content shown between the heading and the tabs (account notice, package picker). */
  intro?: React.ReactNode;
  accessToken: string;
  defaultEmail: string;
  defaultName: string;
  tier: LeaseTierKey;
  estimate: PackageEstimate;
  vehicle: LeaseVehicleSnapshot | null;
  vehicleLoading: boolean;
  onSelectVehicle: (slug: string | null) => void;
  secureCollection: boolean;
  /** False in production until counsel approves the required consent wording. */
  consentsAllowed: boolean;
  integrationsLoading: boolean;
  onRequireAccount: () => void;
  onSubmitted: (result: { id: number; resumed: boolean }) => void;
}) {
  const [tab, setTab] = useState<ApplicantRole>("buyer");
  const [applicants, setApplicants] = useState<PerRole<ApplicantProfile>>(() => ({
    buyer: { ...EMPTY_APPLICANT, ...splitName(defaultName), email: defaultEmail },
    co_buyer: { ...EMPTY_APPLICANT },
  }));
  const [coBuyerIncluded, setCoBuyerIncluded] = useState(false);
  const [errors, setErrors] = useState<PerRole<ApplicantErrors>>({ buyer: {}, co_buyer: {} });
  const [consents, setConsents] = useState<PerRole<ConsentChoices>>({
    buyer: { ...EMPTY_CONSENTS },
    co_buyer: { ...EMPTY_CONSENTS },
  });
  const [missing, setMissing] = useState<PerRole<LeaseConsentType[]>>({ buyer: [], co_buyer: [] });
  const [preferences, setPreferences] = useState<VehiclePreferences>({
    ...EMPTY_VEHICLE_PREFERENCES,
  });
  const [preferenceErrors, setPreferenceErrors] = useState<
    Partial<Record<keyof VehiclePreferences, string>>
  >({});
  const [tradeInEnabled, setTradeInEnabled] = useState(false);
  const [tradeIn, setTradeIn] = useState<TradeIn>({ ...EMPTY_TRADE_IN });
  const [tradeInErrors, setTradeInErrors] = useState<TradeInErrors>({});
  const [staged, setStaged] = useState<PerRole<StagedFiles>>({ buyer: {}, co_buyer: {} });
  const [submitting, setSubmitting] = useState(false);
  const [awaitingAccount, setAwaitingAccount] = useState(false);
  const [blocked, setBlocked] = useState<"storage" | "consents" | null>(null);
  const submittingRef = useRef(false);
  const started = useRef(false);

  // Prefill only the Buyer's non-sensitive account details, never over typed values.
  useEffect(() => {
    const { firstName, lastName } = splitName(defaultName);
    setApplicants((prev) => ({
      ...prev,
      buyer: {
        ...prev.buyer,
        email: prev.buyer.email || defaultEmail,
        firstName: prev.buyer.firstName || firstName,
        lastName: prev.buyer.lastName || lastName,
      },
    }));
  }, [defaultEmail, defaultName]);

  function errorsFor(role: ApplicantRole, all = applicants): ApplicantErrors {
    return {
      ...validateApplicantProfile(all[role]),
      ...(role === "co_buyer" ? coBuyerErrors(all.buyer, all.co_buyer) : {}),
    };
  }

  const update = (role: ApplicantRole) => (patch: Partial<ApplicantProfile>) => {
    setApplicants((prev) => ({ ...prev, [role]: { ...prev[role], ...patch } }));
    const cleared = Object.keys(patch) as ApplicantField[];
    setErrors((prev) => {
      const next = { ...prev[role] };
      for (const key of cleared) delete next[key];
      return { ...prev, [role]: next };
    });
  };

  /** Shows a field's message once the applicant leaves it. */
  const validateField = (role: ApplicantRole) => (field: ApplicantField) => {
    const message = errorsFor(role)[field];
    setErrors((prev) => ({ ...prev, [role]: { ...prev[role], [field]: message } }));
  };

  function setConsent(role: ApplicantRole, type: LeaseConsentType, accepted: boolean) {
    setConsents((prev) => ({ ...prev, [role]: { ...prev[role], [type]: accepted } }));
    if (accepted) setMissing((prev) => ({ ...prev, [role]: prev[role].filter((t) => t !== type) }));
  }

  function removeCoBuyer() {
    // Only the Co-Buyer's own entries are discarded; the Buyer's are untouched.
    setCoBuyerIncluded(false);
    setApplicants((prev) => ({ ...prev, co_buyer: { ...EMPTY_APPLICANT } }));
    setErrors((prev) => ({ ...prev, co_buyer: {} }));
    setConsents((prev) => ({ ...prev, co_buyer: { ...EMPTY_CONSENTS } }));
    setMissing((prev) => ({ ...prev, co_buyer: [] }));
    setStaged((prev) => ({ ...prev, co_buyer: {} }));
    setTab("buyer");
  }

  function markStarted() {
    if (started.current || (import.meta.env.DEV && onDemoSubmit)) return;
    started.current = true;
    trackLeaseEvent("lease_to_own_application_started", { tier });
  }

  /** Uploads attachments through the existing private flow after the application exists. */
  async function uploadStaged(applicationId: number): Promise<number> {
    let failures = 0;
    const roles: ApplicantRole[] = coBuyerIncluded ? ["buyer", "co_buyer"] : ["buyer"];
    for (const role of roles) {
      for (const item of Object.values(staged[role])) {
        if (!item || item.state === "uploaded") continue;
        const patch = (next: Partial<typeof item>) =>
          setStaged((prev) => ({
            ...prev,
            [role]: { ...prev[role], [item.docType]: { ...prev[role][item.docType]!, ...next } },
          }));
        patch({ state: "uploading", progress: 0, error: undefined });
        try {
          await uploadLeaseDocument({
            accessToken,
            applicationId,
            applicantRole: role,
            docType: item.docType as LeaseDocType,
            file: item.file,
            onProgress: (progress) => patch({ progress }),
          });
          patch({ state: "uploaded", progress: 100 });
          trackLeaseEvent("lease_to_own_document_upload_completed", {
            document_type: item.docType,
          });
        } catch (error) {
          failures += 1;
          patch({ state: "failed", error: leaseErrorMessage(error) });
        }
      }
    }
    return failures;
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
          vehicleValue: estimate.vehicleValue,
          buyer: applicants.buyer,
          coBuyer: coBuyerIncluded ? applicants.co_buyer : null,
          consents: { buyer: consents.buyer, coBuyer: coBuyerIncluded ? consents.co_buyer : null },
          vehicleSlug: vehicle?.slug ?? null,
          vehiclePreferences: preferences,
          tradeIn: tradeInEnabled ? tradeIn : null,
          attribution: getAttributionDetails(),
        },
      });
      if (result.resumed) {
        toast.info(
          "You already have a Lease to Own application in progress, so we've opened it. Nothing new was saved.",
        );
      } else {
        trackLeaseEvent("lease_to_own_application_submitted", { tier });
        trackLeaseEvent("lease_to_own_application_step_completed", { step: 1 });
        const failures = await uploadStaged(result.id);
        if (failures)
          toast.warning(
            "Application received. Some attachments didn't upload — add them under Document Uploads.",
          );
        else toast.success("Application received. It's saved to your MyCar account.");
      }
      // Drop sensitive entries from memory once the server has confirmed the save.
      setApplicants({ buyer: { ...EMPTY_APPLICANT }, co_buyer: { ...EMPTY_APPLICANT } });
      setStaged({ buyer: {}, co_buyer: {} });
      onSubmitted(result);
    } catch (error) {
      toast.error(leaseErrorMessage(error));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    accessToken,
    tier,
    estimate.vehicleValue,
    applicants,
    coBuyerIncluded,
    consents,
    vehicle?.slug,
    preferences,
    tradeInEnabled,
    tradeIn,
    staged,
    onSubmitted,
  ]);

  /** Validates everything; returns false and moves focus to the first problem. */
  function validateAll(): boolean {
    const found: PerRole<ApplicantErrors> = {
      buyer: errorsFor("buyer"),
      co_buyer: coBuyerIncluded ? errorsFor("co_buyer") : {},
    };
    const missingNow: PerRole<LeaseConsentType[]> = {
      buyer: missingRequiredConsents(consents.buyer),
      co_buyer: coBuyerIncluded ? missingRequiredConsents(consents.co_buyer) : [],
    };
    const prefErrors = validateVehiclePreferences(preferences);
    const tradeErrors = tradeInEnabled ? validateTradeIn(tradeIn) : {};
    setErrors(found);
    setMissing(missingNow);
    setPreferenceErrors(prefErrors);
    setTradeInErrors(tradeErrors);

    const targets: Array<[ApplicantRole, string | undefined]> = [
      ["buyer", firstKey(found.buyer, (k) => applicantFieldId("buyer", k))],
      ["buyer", firstKey(prefErrors, (k) => `lto-vehicle-${k}`)],
      ["buyer", firstKey(tradeErrors, (k) => `lto-trade-${k}`)],
      ["buyer", missingNow.buyer[0] && `lto-buyer-consent-${missingNow.buyer[0]}`],
      ["co_buyer", firstKey(found.co_buyer, (k) => applicantFieldId("co_buyer", k))],
      ["co_buyer", missingNow.co_buyer[0] && `lto-co_buyer-consent-${missingNow.co_buyer[0]}`],
    ];
    const target = targets.find(([, id]) => id);
    if (!target) return true;
    const [role, id] = target;
    setTab(role);
    // Wait for the tab's panel to render before focusing.
    window.setTimeout(() => {
      const el = document.getElementById(id!);
      el?.scrollIntoView({ block: "center" });
      el?.focus();
    }, 50);
    toast.error(
      role === "co_buyer"
        ? "Please check the highlighted Co-Buyer fields."
        : "Please check the highlighted fields.",
    );
    return false;
  }

  // A guest pressed Submit and has now signed in through the existing sheet.
  useEffect(() => {
    if (!awaitingAccount || !accessToken) return;
    setAwaitingAccount(false);
    if (!validateAll()) return;
    void submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awaitingAccount, accessToken]);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;
    if (import.meta.env.DEV && onDemoSubmit) {
      onDemoSubmit();
      return;
    }
    if (!validateAll()) return;
    if (!secureCollection) {
      // Valid, but nothing may be saved without secure collection: say so plainly.
      setBlocked("storage");
      return;
    }
    if (!consentsAllowed) {
      setBlocked("consents");
      return;
    }
    setBlocked(null);
    if (!accessToken) {
      setAwaitingAccount(true);
      onRequireAccount();
      return;
    }
    void submit();
  }

  const storageUnavailable = !secureCollection && !integrationsLoading;
  const consentsUnavailable = !consentsAllowed && !integrationsLoading;
  const formLocked = submitting;

  return (
    <form onSubmit={onSubmit} onInputCapture={markStarted} noValidate className="space-y-6">
      <header className="mx-auto max-w-3xl text-center">
        <h2
          id="lto-step-title"
          className="font-display text-2xl font-extrabold uppercase tracking-tight text-primary sm:text-3xl"
        >
          {PREQUAL.heading}
        </h2>
        <p className="mt-3 text-sm font-medium text-muted-foreground sm:text-base">
          {PREQUAL.subheading}
        </p>
        <ReviewNote ids={PREQUAL.claims} className="mt-4" />
      </header>

      {intro}

      {storageUnavailable && (
        <PendingIntegration title="Integration required: secure application storage">
          Server-side encryption for driver's license numbers is not configured yet, so this
          application cannot be saved online. You can still enter and check your details — nothing
          you type is stored or sent. Call us at (540) 426-3322 to apply by phone.
        </PendingIntegration>
      )}
      {consentsUnavailable && (
        <PendingIntegration title="Pending approval: application disclosures">
          The consent and credit-authorization wording below is a draft awaiting legal approval, so
          online applications can't be submitted yet. Call us at (540) 426-3322 to apply by phone.
        </PendingIntegration>
      )}

      <Tabs value={tab} onValueChange={(value) => setTab(value as ApplicantRole)}>
        <TabsList className="h-auto w-full justify-start gap-1 rounded-none border-b border-border bg-transparent p-0">
          {(["buyer", "co_buyer"] as const).map((role) => (
            <TabsTrigger
              key={role}
              value={role}
              className={cn(
                "rounded-b-none rounded-t-md px-6 py-2.5 text-sm font-bold",
                "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none",
                "data-[state=inactive]:bg-muted data-[state=inactive]:text-muted-foreground",
              )}
            >
              {APPLICANT_ROLE_LABELS[role]}
              {role === "co_buyer" && !coBuyerIncluded && (
                <span className="ml-1.5 text-xs font-medium opacity-80">(optional)</span>
              )}
              {Object.keys(errors[role]).some((k) => errors[role][k as ApplicantField]) && (
                <span
                  className="ml-1.5 size-2 rounded-full bg-destructive"
                  aria-label="has errors"
                />
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        <p className="mt-4 text-xs text-muted-foreground">
          All fields marked with an asterisk (<span className="text-destructive">*</span>) are
          required.
        </p>

        <TabsContent value="buyer" className="mt-6 space-y-8">
          <ApplicantFields
            role="buyer"
            value={applicants.buyer}
            errors={errors.buyer}
            onChange={update("buyer")}
            onBlurField={validateField("buyer")}
            secureCollection={secureCollection}
          />
          <InterestedVehicle
            vehicle={vehicle}
            vehicleLoading={vehicleLoading}
            estimate={estimate}
            onSelectVehicle={onSelectVehicle}
            preferences={preferences}
            onPreferencesChange={(patch) => {
              setPreferences((prev) => ({ ...prev, ...patch }));
              setPreferenceErrors({});
            }}
            preferenceErrors={preferenceErrors}
            tradeInEnabled={tradeInEnabled}
            onTradeInEnabledChange={(enabled) => {
              setTradeInEnabled(enabled);
              if (!enabled) {
                setTradeIn({ ...EMPTY_TRADE_IN });
                setTradeInErrors({});
              }
            }}
            tradeIn={tradeIn}
            onTradeInChange={(patch) => {
              setTradeIn((prev) => ({ ...prev, ...patch }));
              setTradeInErrors((prev) => {
                const next = { ...prev };
                for (const key of Object.keys(patch)) delete next[key as keyof TradeIn];
                return next;
              });
            }}
            tradeInErrors={tradeInErrors}
          />
          <StagedAttachments
            role="buyer"
            files={staged.buyer}
            onChange={(next) => setStaged((prev) => ({ ...prev, buyer: next }))}
            disabled={formLocked}
          />
          <ConsentPanel
            role="buyer"
            value={consents.buyer}
            onChange={(type, accepted) => setConsent("buyer", type, accepted)}
            missing={missing.buyer}
          />
        </TabsContent>

        <TabsContent value="co_buyer" className="mt-6 space-y-8">
          {!coBuyerIncluded ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center">
              <p className="font-semibold text-foreground">No Co-Buyer added</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                A Co-Buyer is optional. Add one only if they agree to apply with you; they'll
                confirm their own participation and consent separately.
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-4"
                onClick={() => setCoBuyerIncluded(true)}
                disabled={formLocked}
              >
                <UserPlus className="size-4" aria-hidden="true" /> Add a Co-Buyer
              </Button>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-primary/5 px-4 py-3 text-sm">
                <span>Enter the Co-Buyer's own details. Nothing is copied from the Buyer.</span>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="ghost" size="sm" disabled={formLocked}>
                      <UserMinus className="size-4" aria-hidden="true" /> Remove Co-Buyer
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remove the Co-Buyer?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This clears everything entered on the Co-Buyer tab, including attachments
                        and consents. The Buyer's details are not affected.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep Co-Buyer</AlertDialogCancel>
                      <AlertDialogAction onClick={removeCoBuyer}>Remove</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
              <ApplicantFields
                role="co_buyer"
                value={applicants.co_buyer}
                errors={errors.co_buyer}
                onChange={update("co_buyer")}
                onBlurField={validateField("co_buyer")}
                secureCollection={secureCollection}
              />
              <VehicleSummary vehicle={vehicle} preferences={preferences} estimate={estimate} />
              <StagedAttachments
                role="co_buyer"
                files={staged.co_buyer}
                onChange={(next) => setStaged((prev) => ({ ...prev, co_buyer: next }))}
                disabled={formLocked}
              />
              <ConsentPanel
                role="co_buyer"
                value={consents.co_buyer}
                onChange={(type, accepted) => setConsent("co_buyer", type, accepted)}
                missing={missing.co_buyer}
              />
            </>
          )}
        </TabsContent>
      </Tabs>

      <div className="space-y-4 border-t border-border pt-6">
        <div className="space-y-1 text-xs text-muted-foreground">
          <p className="flex items-start gap-2">
            <LockKeyhole className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            Submitting is not a credit decision, a pre-approval or an offer. Our team reviews every
            application.
          </p>
          {blocked === "storage" && !secureCollection && (
            <p className="pl-5.5 font-semibold text-foreground" role="alert">
              Your details look complete, but online applications can't be saved until secure
              application storage is configured. Nothing was sent. Please call (540) 426-3322.
            </p>
          )}
          {blocked === "consents" && !consentsAllowed && (
            <p className="pl-5.5 font-semibold text-foreground" role="alert">
              Your details look complete, but online applications open once our disclosures are
              approved. Nothing was sent. Please call (540) 426-3322.
            </p>
          )}
          {!accessToken && secureCollection && consentsAllowed && (
            <p className="pl-5.5" role="status">
              {awaitingAccount
                ? "Sign in or create your MyCar account to save this application. Your entries stay on this page."
                : "You'll sign in or create your MyCar account before anything is saved. Google sign-in reloads the page, so your entries would need to be re-entered."}
            </p>
          )}
        </div>
        <Button
          type="submit"
          disabled={submitting || (integrationsLoading && !(import.meta.env.DEV && onDemoSubmit))}
          aria-busy={submitting || undefined}
          className={cn(
            ctaButtonClass,
            "h-12 w-full text-base font-extrabold uppercase tracking-wide",
          )}
        >
          {submitting ? (
            "Submitting securely…"
          ) : (
            <>
              Submit Pre-Qualification Application{" "}
              <ArrowRight className="size-5" aria-hidden="true" />
            </>
          )}
        </Button>
        {import.meta.env.DEV && onDemoSubmit && (
          <p className="text-center text-xs font-semibold text-fuchsia-800" role="note">
            DEMO MODE: this button opens the fictional demo preview. Nothing you entered is checked,
            saved or sent.
          </p>
        )}
      </div>
    </form>
  );
}

function firstKey<K extends string>(
  errors: Partial<Record<K, string | undefined>>,
  toId: (key: K) => string,
): string | undefined {
  const key = (Object.keys(errors) as K[]).find((k) => errors[k]);
  return key ? toId(key) : undefined;
}
