import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Lock, Phone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { SignInSheet } from "@/components/SignInSheet";
import { ApplicantStep } from "@/components/lease-to-own/ApplicantStep";
import { DocumentsStep } from "@/components/lease-to-own/DocumentsStep";
import { ESignStep } from "@/components/lease-to-own/ESignStep";
import { draftContext } from "@/components/lease-to-own/helpers";
import { ActivationSummary } from "@/components/lease-to-own/ActivationSummary";
import { PendingIntegration, StatusPill } from "@/components/lease-to-own/shared";
import { useAuth } from "@/hooks/useAuth";
import { trackLeaseEvent } from "@/lib/analytics";
import { vehicleTitle } from "@/lib/format";
import {
  DEFAULT_TIER,
  LEASE_TIERS,
  TITLE_BUYOUT,
  VEHICLE_VALUE,
  APPLICANT_ROLE_LABELS,
  applicantDocumentStatuses,
  applicationStatusLabel,
  clampVehicleValue,
  documentsReadyForSigning,
  estimatePackage,
  isLeaseTierKey,
  paymentLabel,
  usd,
  type LeaseTierKey,
  type PackageEstimate,
} from "@/lib/lease-to-own";
import { AGREEMENTS, ESTIMATE_DISCLAIMER } from "@/lib/lease-to-own-content";
import {
  buyerApplicantId,
  getLeaseIntegrationStatus,
  getMyLeaseApplication,
  type LeaseApplicantSummary,
  type LeaseApplicationSummary,
  type LeaseConsentSummary,
  type LeaseVehicleSnapshot,
  type MyLeaseApplication,
} from "@/lib/lease-to-own.functions";
import {
  clearLeaseApplyReturn,
  isLeaseSetupPending,
  leaseErrorMessage,
  rememberLeaseApplyReturn,
} from "@/lib/lease-to-own-client";
import { vehicleBySlugQuery } from "@/lib/queries";
import {
  isLeaseDemoStage,
  leaseDemoEnabled,
  visibleDemoStage,
  type LeaseDemoStage,
} from "@/lib/lease-to-own-demo";
import { cn } from "@/lib/utils";

// Local Development Test Mode (UI preview only; see lease-to-own-demo.ts). The
// literal import.meta.env.DEV is false in production builds, so this is null and
// the demo module is dropped from the bundle even if the flag is set.
const demoModule =
  import.meta.env.DEV && leaseDemoEnabled(import.meta.env)
    ? import("@/components/lease-to-own/LeaseDemoWorkflow")
    : null;
const LeaseDemoBanner = demoModule
  ? lazy(() => demoModule.then((m) => ({ default: m.LeaseDemoBanner })))
  : null;
const LeaseDemoWorkflow = demoModule
  ? lazy(() => demoModule.then((m) => ({ default: m.LeaseDemoWorkflow })))
  : null;

type ApplySearch = {
  tier: LeaseTierKey;
  value: number;
  vehicle?: string;
  /** Local Demo Mode screen; ignored unless Demo Mode is on. */
  demo?: LeaseDemoStage;
};

export const Route = createFileRoute("/lease-to-own/apply")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): ApplySearch => {
    const vehicle =
      typeof search["vehicle"] === "string" && /^[a-z0-9-]{1,200}$/i.test(search["vehicle"])
        ? search["vehicle"]
        : undefined;
    return {
      tier: isLeaseTierKey(search["tier"]) ? search["tier"] : DEFAULT_TIER,
      value: clampVehicleValue(search["value"] ?? VEHICLE_VALUE.default),
      ...(vehicle ? { vehicle } : {}),
      ...(import.meta.env.DEV && demoModule && isLeaseDemoStage(search["demo"])
        ? { demo: search["demo"] }
        : {}),
    };
  },
  head: () => ({
    meta: [
      { title: "Lease to Own Application | My Car Corp" },
      {
        name: "description",
        content: "Apply for the My Car Lease to Own program in Fredericksburg, VA.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ApplyPage,
});

const STEPS = ["Pre-Qualification", "Document Uploads", "E-Sign Room", "Activation"] as const;
type StepNumber = 1 | 2 | 3 | 4;

/** Rebuilds the estimate from the amounts the server stored with the application. */
function estimateFromApplication(app: LeaseApplicationSummary): PackageEstimate {
  const base = estimatePackage(app.tier, (app.vehicle_value_cents ?? 0) / 100);
  const down = app.down_payment_cents != null ? app.down_payment_cents / 100 : base.downPayment;
  const payment = app.payment_cents != null ? app.payment_cents / 100 : base.payment;
  const installments = app.installments ?? base.installments;
  return {
    ...base,
    downPayment: down,
    payment,
    installments,
    totalOfPayments: payment * installments,
    totalCost: down + payment * installments + TITLE_BUYOUT,
  };
}

/** Same profile-name source the site header uses; never a sensitive field. */
function profileName(user: { user_metadata?: Record<string, unknown> } | null): string {
  return String(user?.user_metadata?.["full_name"] ?? user?.user_metadata?.["name"] ?? "").trim();
}

function ApplyPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const queryClient = useQueryClient();
  const { user, session, loading } = useAuth();
  const token = session?.access_token ?? "";
  const [signInOpen, setSignInOpen] = useState(false);
  const [chosenStep, setChosenStep] = useState<StepNumber | null>(null);
  // Local Demo Mode only: the screen comes from ?demo= (so Back works); the
  // simulated admin review and deal completion live in page memory and reset on reload.
  const [demoApproved, setDemoApproved] = useState(false);
  const [demoCompleted, setDemoCompleted] = useState(false);
  const demoStage = search.demo ? visibleDemoStage(search.demo, demoApproved, demoCompleted) : null;
  const demoOpen = Boolean(demoModule && demoStage);
  const goDemo = (stage: LeaseDemoStage | null) => {
    void navigate({
      search: (prev) => {
        const { demo: _drop, ...rest } = prev;
        return stage ? { ...rest, demo: stage } : rest;
      },
    });
    window.scrollTo({ top: 0 });
  };

  const integrations = useQuery({
    queryKey: ["lease-integrations"],
    queryFn: () => getLeaseIntegrationStatus(),
    staleTime: 5 * 60 * 1000,
  });
  const applicationKey = ["lease-application", user?.id ?? "anon"];
  const appQuery = useQuery({
    queryKey: applicationKey,
    enabled: Boolean(token),
    retry: false,
    queryFn: () => getMyLeaseApplication({ data: { accessToken: token } }),
  });
  const vehicleQuery = useQuery({
    ...vehicleBySlugQuery(search.vehicle ?? ""),
    enabled: Boolean(search.vehicle),
  });

  const vehicle: LeaseVehicleSnapshot | null = useMemo(() => {
    const v = vehicleQuery.data;
    if (!v) return null;
    return {
      id: v.id,
      slug: v.slug,
      vin: v.vin,
      title: vehicleTitle(v),
      price: v.price_cents / 100,
      stockNumber: v.stock_number,
      year: v.year,
      make: v.make,
      model: v.model,
      exteriorColor: v.exterior_color,
      interiorColor: v.interior_color,
    };
  }, [vehicleQuery.data]);

  const application = appQuery.data?.application ?? null;
  const documents = appQuery.data?.documents ?? [];
  const agreements = appQuery.data?.agreements ?? [];

  // Before submission the package comes from the URL (or the chosen vehicle's price);
  // after submission it always comes from what the server stored.
  const vehicleValue = vehicle?.price ? clampVehicleValue(vehicle.price) : search.value;
  const estimate = application
    ? estimateFromApplication(application)
    : estimatePackage(search.tier, vehicleValue);

  // The Buyer's required documents unlock the next step; Co-Buyer documents are extra.
  const docStatuses = appQuery.data
    ? applicantDocumentStatuses(documents, buyerApplicantId(appQuery.data), true)
    : {};
  const docsReady = Boolean(application) && documentsReadyForSigning(docStatuses);
  const agreementsExecuted =
    Boolean(application) &&
    AGREEMENTS.every((a) =>
      agreements.some((r) => r.agreement_key === a.key && r.status === "executed"),
    );
  const reachable: Record<StepNumber, boolean> = {
    1: true,
    2: Boolean(application),
    3: docsReady,
    4: agreementsExecuted,
  };
  const defaultStep: StepNumber = !application ? 1 : !docsReady ? 2 : !agreementsExecuted ? 3 : 4;
  const step: StepNumber = chosenStep && reachable[chosenStep] ? chosenStep : defaultStep;
  const completed: Record<StepNumber, boolean> = {
    1: Boolean(application),
    2: docsReady,
    3: agreementsExecuted,
    4: false,
  };
  const progress = (Object.values(completed).filter(Boolean).length / STEPS.length) * 100;

  useEffect(() => {
    if (docsReady && !demoModule)
      trackLeaseEvent("lease_to_own_application_step_completed", { step: 2 });
  }, [docsReady]);

  function setApplication(next: MyLeaseApplication) {
    queryClient.setQueryData(applicationKey, next);
  }

  // The existing MyCar sign-in sheet closes itself only via the header; close this
  // page's copy once the session exists so the applicant lands back on the form.
  useEffect(() => {
    if (user && signInOpen) setSignInOpen(false);
  }, [user, signInOpen]);

  function requireAccount() {
    // Only non-sensitive package choices are remembered, for the Google redirect round-trip.
    rememberLeaseApplyReturn({ tier: search.tier, value: search.value, vehicle: search.vehicle });
    setSignInOpen(true);
  }

  const summary = (
    <PackageSummary
      estimate={estimate}
      vehicleTitle={application?.vehicle_title ?? vehicle?.title ?? null}
    />
  );

  // Never replace the form with loading/error screens: the applicant may have just
  // signed in mid-form, and unmounting it would discard what they typed.
  const accountNotice = loading ? null : !user ? (
    <p className="flex items-start gap-2 rounded-lg bg-surface px-4 py-3 text-sm text-muted-foreground">
      <Lock className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
      Start your application now. Before anything is saved, you'll sign in or create your MyCar
      account so only you and authorized staff can see your application and documents.
    </p>
  ) : appQuery.isLoading ? (
    <p className="text-sm text-muted-foreground" role="status">
      Checking for a saved application on {user.email}…
    </p>
  ) : appQuery.error ? (
    <PendingIntegration
      title={
        isLeaseSetupPending(appQuery.error)
          ? "Online applications are being set up"
          : "We couldn't load your saved application"
      }
    >
      {leaseErrorMessage(appQuery.error)}
      <a
        href="tel:+15404263322"
        className="mt-3 flex items-center gap-2 font-semibold text-primary"
      >
        <Phone className="size-4" /> (540) 426-3322
      </a>
    </PendingIntegration>
  ) : null;

  return (
    <PageShell>
      {summary}

      <nav aria-label="Application progress" className="mt-8">
        <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {STEPS.map((label, index) => {
            const n = (index + 1) as StepNumber;
            const current = n === step;
            return (
              <li key={label}>
                <button
                  type="button"
                  disabled={!reachable[n]}
                  aria-current={current ? "step" : undefined}
                  onClick={() => setChosenStep(n)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                    current
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card hover:border-primary/50",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full text-[10px]",
                      completed[n]
                        ? "bg-success text-success-foreground"
                        : current
                          ? "bg-white/20"
                          : "bg-muted",
                    )}
                  >
                    {completed[n] ? <Check className="size-3" aria-hidden="true" /> : n}
                  </span>
                  {label}
                  {!reachable[n] && <Lock className="ml-auto size-3" aria-label="Locked" />}
                </button>
              </li>
            );
          })}
        </ol>
        <div
          className="mt-3 h-2 overflow-hidden rounded-full bg-primary/15"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          aria-label="Application progress"
        >
          <div
            className="h-full rounded-full bg-[#F7941D] transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </nav>

      <div className="mt-6 rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)] sm:p-8">
        {step === 1 &&
          (application ? (
            <StepHeader
              title="Application received"
              body="This is your receipt. Our team reviews every application; you'll see status changes here and in your portal."
            >
              <SubmittedApplication
                application={application}
                applicants={appQuery.data?.applicants ?? []}
                consents={appQuery.data?.consents ?? []}
              />
            </StepHeader>
          ) : (
            <section aria-labelledby="lto-step-title">
              <>
                {LeaseDemoBanner && LeaseDemoWorkflow && (
                  <Suspense fallback={null}>
                    {demoStage ? (
                      <LeaseDemoWorkflow
                        stage={demoStage}
                        approved={demoApproved}
                        vehicleValue={estimate.vehicleValue}
                        downPayment={estimate.downPayment}
                        onApprove={() => {
                          setDemoApproved(true);
                          goDemo("contracts");
                        }}
                        onViewContracts={() => goDemo("contracts")}
                        onComplete={() => {
                          setDemoCompleted(true);
                          goDemo("portal");
                        }}
                        onExit={() => goDemo(null)}
                      />
                    ) : (
                      <div className="mb-6">
                        <LeaseDemoBanner onPreview={() => goDemo("result")} />
                      </div>
                    )}
                  </Suspense>
                )}
                {/* Stays mounted (hidden) during the demo so typed entries are kept. */}
                <div hidden={demoOpen}>
                  <ApplicantStep
                    onDemoSubmit={demoModule ? () => goDemo("result") : undefined}
                    intro={
                      <>
                        {accountNotice && <div className="mb-6">{accountNotice}</div>}
                        <TierPicker
                          value={search.tier}
                          onChange={(tier) => {
                            void navigate({
                              search: (prev) => ({ ...prev, tier }),
                              replace: true,
                            });
                            if (!demoModule)
                              trackLeaseEvent("lease_to_own_tier_selected", { tier }, false);
                          }}
                        />
                      </>
                    }
                    accessToken={token}
                    defaultEmail={user?.email ?? ""}
                    defaultName={profileName(user)}
                    tier={search.tier}
                    estimate={estimate}
                    vehicle={vehicle}
                    vehicleLoading={vehicleQuery.isLoading && Boolean(search.vehicle)}
                    onSelectVehicle={(slug) =>
                      void navigate({
                        search: (prev) => {
                          const { vehicle: _drop, ...rest } = prev;
                          return slug ? { ...rest, vehicle: slug } : rest;
                        },
                        replace: true,
                      })
                    }
                    secureCollection={integrations.data?.secureCollection ?? false}
                    consentsAllowed={
                      (integrations.data?.consentWordingApproved ||
                        integrations.data?.draftConsentsAllowed) ??
                      false
                    }
                    integrationsLoading={integrations.isLoading}
                    onRequireAccount={requireAccount}
                    onSubmitted={() => {
                      clearLeaseApplyReturn();
                      setChosenStep(null);
                      void queryClient.invalidateQueries({ queryKey: applicationKey });
                    }}
                  />
                </div>
              </>
            </section>
          ))}

        {step === 2 && application && (
          <StepHeader
            title="Document Uploads"
            body="All five Buyer documents are required before your agreements can be prepared."
          >
            <DocumentsStep
              accessToken={token}
              applicationId={application.id}
              applicants={appQuery.data?.applicants ?? []}
              documents={documents}
              locked={["declined", "withdrawn"].includes(application.status)}
              onUpdated={setApplication}
            />
          </StepHeader>
        )}

        {step === 3 && application && integrations.data && (
          <StepHeader
            title="E-Sign Room"
            body="Review your agreements. Signing opens once approved contracts and secure e-signing are in place."
          >
            <ESignStep
              agreements={agreements}
              integrations={integrations.data}
              context={draftContext({
                name: application.full_legal_name,
                street: application.street,
                city: application.city,
                state: application.state,
                zip: application.zip,
                vehicleTitle: application.vehicle_title,
                vehicleVin: application.vehicle_vin,
                estimate,
              })}
            />
            <div className="mt-8 border-t border-border pt-6">
              <ActivationSummary
                preview
                customerName={application.full_legal_name}
                vehicleTitle={application.vehicle_title}
                vehicleVin={application.vehicle_vin}
                estimate={estimate}
              />
            </div>
          </StepHeader>
        )}

        {step === 4 && application && (
          <StepHeader title="Activation" body="Secure your vehicle and open your client portal.">
            <ActivationSummary
              customerName={application.full_legal_name}
              vehicleTitle={application.vehicle_title}
              vehicleVin={application.vehicle_vin}
              estimate={estimate}
            />
          </StepHeader>
        )}

        {application && (
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
            <Button
              variant="outline"
              disabled={step === 1}
              onClick={() => setChosenStep((step - 1) as StepNumber)}
            >
              <ChevronLeft className="size-4" /> Back
            </Button>
            {step < 4 && (
              <Button
                disabled={!reachable[(step + 1) as StepNumber]}
                onClick={() => setChosenStep((step + 1) as StepNumber)}
              >
                Continue <ChevronRight className="size-4" />
              </Button>
            )}
          </div>
        )}
      </div>

      <p className="mt-6 text-xs text-muted-foreground">{ESTIMATE_DISCLAIMER}</p>
      <p className="mt-2 text-sm">
        <Link
          to="/lease-to-own/portal"
          className="font-semibold text-primary underline-offset-2 hover:underline"
        >
          Go to your Lease to Own portal
        </Link>
      </p>

      {/* The existing MyCar sign-in / create-account sheet, reused unchanged. */}
      <Sheet
        open={signInOpen}
        onOpenChange={(open) => {
          setSignInOpen(open);
          // Cancelled without signing in: forget the remembered package choice.
          if (!open && !user) clearLeaseApplyReturn();
        }}
      >
        <SheetContent className="overflow-y-auto">{signInOpen && <SignInSheet />}</SheetContent>
      </Sheet>
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
        <Link to="/" className="hover:text-primary">
          Home
        </Link>{" "}
        /{" "}
        <Link to="/lease-to-own" className="hover:text-primary">
          Lease to Own
        </Link>{" "}
        / Application
      </nav>
      <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-primary sm:text-4xl">
        Lease to Own application
      </h1>
      <div className="mt-6">{children}</div>
    </div>
  );
}

function PackageSummary({
  estimate,
  vehicleTitle,
}: {
  estimate: PackageEstimate;
  vehicleTitle: string | null;
}) {
  const tier = LEASE_TIERS.find((t) => t.key === estimate.tier)!;
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-primary/20 bg-primary/5 px-5 py-4 text-sm">
      <p>
        <span className="text-muted-foreground">Package:</span>{" "}
        <strong className="text-primary">
          Tier {tier.tierNumber}: {tier.name}
        </strong>
      </p>
      <p>
        <span className="text-muted-foreground">Down:</span>{" "}
        <strong>{usd(estimate.downPayment)}</strong>
      </p>
      <p>
        <span className="text-muted-foreground">Payment:</span>{" "}
        <strong>{paymentLabel(estimate)}</strong> × {estimate.installments}
      </p>
      <p>
        <span className="text-muted-foreground">Vehicle:</span>{" "}
        <strong>{vehicleTitle ?? `Value ${usd(estimate.vehicleValue)} — to be assigned`}</strong>
      </p>
    </div>
  );
}

function TierPicker({
  value,
  onChange,
}: {
  value: LeaseTierKey;
  onChange: (tier: LeaseTierKey) => void;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-foreground">Selected package</legend>
      <div role="radiogroup" className="mt-2 grid gap-2 sm:grid-cols-3">
        {LEASE_TIERS.map((tier) => (
          <button
            key={tier.key}
            type="button"
            role="radio"
            aria-checked={tier.key === value}
            onClick={() => onChange(tier.key)}
            className={cn(
              "rounded-lg border px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F7941D]/40",
              tier.key === value
                ? "border-primary bg-primary/5 font-semibold text-primary"
                : "border-border hover:border-primary/40",
            )}
          >
            {tier.name}
            <span className="block text-xs font-normal text-muted-foreground">
              {tier.frequencyLabel} • {tier.installments} payments
            </span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function StepHeader({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby="lto-step-title">
      <h2 id="lto-step-title" className="text-2xl font-bold text-foreground">
        {title}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
      <div className="mt-6">{children}</div>
    </section>
  );
}

/** Receipt for a confirmed, saved application. Never states an approval. */
function SubmittedApplication({
  application,
  applicants,
  consents,
}: {
  application: LeaseApplicationSummary;
  applicants: LeaseApplicantSummary[];
  consents: LeaseConsentSummary[];
}) {
  const reference = `LTO-${String(application.id).padStart(6, "0")}`;
  return (
    <div className="space-y-5 text-sm">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
        <p>
          <span className="text-muted-foreground">Reference:</span>{" "}
          <strong className="font-mono">{reference}</strong>
        </p>
        <p>
          <span className="text-muted-foreground">Received:</span>{" "}
          <strong>
            {new Date(application.submitted_at).toLocaleString("en-US", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </strong>
        </p>
        <StatusPill tone="info">{applicationStatusLabel(application.status)}</StatusPill>
      </div>
      <p className="text-muted-foreground">
        Your pre-qualification application is saved to your MyCar account. It has not been approved
        or declined — our team reviews it after your documents are in, and any decision will appear
        here.
      </p>

      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {(applicants.length
          ? applicants
          : [
              {
                id: 0,
                role: "buyer" as const,
                participation_status: "account_holder",
                first_name: application.full_legal_name,
                last_name: "",
                email: application.email,
                ssn_collection_status: "not_collected",
              },
            ]
        ).map((applicant) => {
          const mine = consents.filter((c) => c.applicant_id === applicant.id);
          const latest = (type: string) => mine.find((c) => c.consent_type === type);
          return (
            <div key={applicant.role} className="rounded-lg border border-border p-3">
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {APPLICANT_ROLE_LABELS[applicant.role]}
              </dt>
              <dd className="mt-1 space-y-1">
                <p className="font-semibold">
                  {applicant.first_name} {applicant.last_name}
                </p>
                <p className="text-muted-foreground">{applicant.email}</p>
                {applicant.role === "co_buyer" &&
                  applicant.participation_status === "pending_confirmation" && (
                    <p className="text-xs font-medium text-accent-text">
                      Co-Buyer confirmation pending — we'll contact them to confirm their
                      participation and consent.
                    </p>
                  )}
                {mine.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Credit authorization:{" "}
                    {latest("credit_authorization")?.accepted ? "given" : "not given"}
                    {" · "}Marketing texts: {latest("marketing_sms")?.accepted ? "yes" : "no"}
                    {" · "}Account texts: {latest("transactional_sms")?.accepted ? "yes" : "no"}
                  </p>
                )}
              </dd>
            </div>
          );
        })}
        <div>
          <dt className="text-muted-foreground">Address</dt>
          <dd className="font-semibold">
            {application.street}, {application.city}, {application.state} {application.zip}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Driver's license & SSN/ITIN</dt>
          <dd className="font-semibold">
            License stored encrypted (never shown). SSN/ITIN: requested later through a secure
            identity provider.
          </dd>
        </div>
      </dl>
      <p className="text-muted-foreground">
        Next: upload your documents. To change submitted details or your package, call us at (540)
        426-3322.
      </p>
    </div>
  );
}
