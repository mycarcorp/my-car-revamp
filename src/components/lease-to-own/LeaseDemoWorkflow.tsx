// DEVELOPMENT ONLY. Loaded only when leaseDemoEnabled() is true; see lease-to-own-demo.ts.
// This file must never import server functions, analytics, CRM or upload helpers.
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CarFront,
  CircleAlert,
  CircleCheck,
  Clock,
  FileText,
  FlaskConical,
  KeyRound,
  Lock,
  PenLine,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { computeBillOfSale } from "@/lib/bill-of-sale";
import {
  requiredSignerRoles,
  signatureSlotsFor,
  signerIdentity,
  SIGNER_ROLE_LABELS,
  type ContractSignatureSlot,
  type SignerRole,
} from "@/lib/contract-signatures";
import { editDealField, fullName, text, type Deal, type EditActor } from "@/lib/deal-model";
import {
  billOfSaleDemoPages,
  buildDemoPdf,
  buildDemoPdfPages,
  creditApplicationDemoPages,
  DEMO_DEAL,
  deliveryChecklistDemoPages,
  gpsDisclosureDemoPages,
  insuranceAgreementDemoPages,
  demoContractLines,
  retailInstallmentDemoPages,
} from "@/lib/demo-contract-pdf";
import {
  adoptDemoInitial,
  adoptDemoSignature,
  clearDemoInitial,
  contractDemoSigned,
  demoCompletionMissing,
  demoSignatureFor,
  removeDemoSignature,
  type DemoInitials,
  type DemoSignatures,
} from "@/lib/demo-signatures";
import type { ContractId, DealContract } from "@/lib/lease-contracts";
import {
  DEMO_PROGRESS_PERCENT,
  demoDeal,
  demoReleasedContracts,
  type LeaseDemoStage,
} from "@/lib/lease-to-own-demo";
import { formatCents } from "@/lib/money";
import { BillOfSaleEditor } from "./BillOfSaleEditor";
import { CreditApplicationEditor } from "./CreditApplicationEditor";
import { DeliveryChecklistEditor } from "./DeliveryChecklistEditor";
import { GpsDisclosureEditor } from "./GpsDisclosureEditor";
import { InsuranceAgreementEditor } from "./InsuranceAgreementEditor";
import { RetailInstallmentEditor } from "./RetailInstallmentEditor";
import { ContractSignatureBlocks, type SignatureBlockEntry } from "./ContractSignatureBlocks";
import { ContractSuite } from "./ContractSuite";
import { DigitalSignaturePanel } from "./DigitalSignaturePanel";

/** Banner shown above the real form. Its button never submits anything. */
export function LeaseDemoBanner({ onPreview }: { onPreview: () => void }) {
  return (
    <div
      role="note"
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border-2 border-dashed border-fuchsia-500 bg-fuchsia-50 px-4 py-3 text-sm text-fuchsia-900"
    >
      <p className="flex items-center gap-2 font-bold">
        <FlaskConical className="size-4 shrink-0" aria-hidden="true" />
        DEMO MODE — No real application will be submitted or approved.
      </p>
      <Button
        type="button"
        size="sm"
        onClick={onPreview}
        className="bg-fuchsia-600 text-white hover:bg-fuchsia-700"
      >
        Preview Next Step (Demo) <ArrowRight className="size-4" aria-hidden="true" />
      </Button>
    </div>
  );
}

/**
 * The demo screens after Submit: the simulated pre-approval result, the
 * Contract Suite with watermarked sample PDFs and demo signatures, and a
 * fictional portal preview. Every decision here exists only in page memory.
 */
export function LeaseDemoWorkflow({
  stage,
  approved,
  vehicleValue,
  downPayment,
  onApprove,
  onViewContracts,
  onComplete,
  onExit,
}: {
  stage: LeaseDemoStage;
  approved: boolean;
  vehicleValue: number;
  downPayment: number;
  onApprove: () => void;
  onViewContracts: () => void;
  onComplete: () => void;
  onExit: () => void;
}) {
  // Kept here so the deal and demo signatures survive moving to the portal preview and back.
  const [deal, setDeal] = useState(() =>
    demoDeal({
      vehicleValueCents: Math.round(vehicleValue * 100),
      packageDownCents: Math.round(downPayment * 100),
    }),
  );
  const [signatures, setSignatures] = useState<DemoSignatures>({});

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border-2 border-dashed border-fuchsia-500 bg-fuchsia-50 px-4 py-2.5 text-sm font-bold text-fuchsia-900">
        <p className="flex items-center gap-2">
          <FlaskConical className="size-4" aria-hidden="true" />
          DEMO MODE — fictional data. Nothing is submitted, approved, signed, saved or sent.
        </p>
        <Button type="button" variant="outline" size="sm" onClick={onExit}>
          <ArrowLeft className="size-4" aria-hidden="true" /> Back to the form
        </Button>
      </div>
      {stage === "portal" ? (
        <DemoPortal deal={deal} signatures={signatures} onBack={onViewContracts} />
      ) : stage === "contracts" ? (
        <DemoContracts
          deal={deal}
          setDeal={setDeal}
          signatures={signatures}
          setSignatures={setSignatures}
          onComplete={onComplete}
        />
      ) : (
        <DemoResult approved={approved} onApprove={onApprove} onViewContracts={onViewContracts} />
      )}
    </div>
  );
}

function DemoResult({
  approved,
  onApprove,
  onViewContracts,
}: {
  approved: boolean;
  onApprove: () => void;
  onViewContracts: () => void;
}) {
  const progress = approved ? 100 : DEMO_PROGRESS_PERCENT;
  return (
    <section
      aria-labelledby="lto-demo-result-title"
      className="rounded-2xl bg-slate-950 px-5 py-12 text-center text-white sm:px-10"
    >
      <div className="mx-auto max-w-2xl">
        <div className="mx-auto flex size-24 items-center justify-center rounded-full border-2 border-sky-500/70 bg-sky-500/10 shadow-[0_0_40px_rgba(14,165,233,0.25)]">
          <CarFront className="size-10 text-sky-400" aria-hidden="true" />
        </div>
        <p className="mt-6 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-300">
          <CircleCheck className="size-3.5" aria-hidden="true" /> Demo milestone (simulated)
        </p>
        <h2
          id="lto-demo-result-title"
          className="mt-4 font-display text-3xl font-extrabold tracking-tight sm:text-5xl"
        >
          DEMO — You're Pre-Approved!
        </h2>
        <p className="mt-2 font-display text-xl font-bold text-sky-400 sm:text-2xl">
          Pending Final Underwriting Review
        </p>
        <p className="mx-auto mt-4 max-w-xl text-sm text-slate-300">
          Example deal <strong className="font-mono text-white">{DEMO_DEAL.reference}</strong> is
          waiting for final dealership review in this local demo. This is a simulation, not a credit
          decision — in the real flow, authorized staff review the figures and documents before
          anything is released.
        </p>

        <div className="mx-auto mt-8 max-w-md rounded-xl border border-white/10 bg-slate-900 p-5 text-left font-mono text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-300">Deal Progress:</span>
            <span className="font-bold text-emerald-400">{progress}% Completed (demo)</span>
          </div>
          <div
            className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"
            role="progressbar"
            aria-label="Demo deal progress (fictional)"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-400 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-4 flex items-center gap-2 text-slate-300">
            <Clock className="size-3.5 text-amber-400" aria-hidden="true" />
            Next Step:{" "}
            {approved ? "Review contracts (demo)" : "Dealership Admin Review & Document Release"}
          </p>
          <p className="mt-2 text-[10px] text-slate-500">
            Fictional demo value. Real progress comes from verified backend milestones.
          </p>
        </div>

        {approved ? (
          <div className="mx-auto mt-6 max-w-md space-y-4">
            <p className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-300">
              <CircleCheck className="size-4" aria-hidden="true" /> DEMO — Contracts Unlocked for
              Preview
            </p>
            <Button
              type="button"
              onClick={onViewContracts}
              className="w-full bg-emerald-600 font-bold text-white hover:bg-emerald-500"
            >
              View Contract Suite (Demo) <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
        ) : (
          <>
            <div className="mx-auto mt-6 max-w-md rounded-xl border border-amber-700/60 bg-amber-950/60 p-5 text-left">
              <p className="flex items-center gap-2 text-sm font-bold text-amber-300">
                <Lock className="size-4" aria-hidden="true" /> Legal Documents Locked Pending Final
                Review
              </p>
              <p className="mt-2 text-xs leading-relaxed text-amber-100/90">
                Your 10 Virginia deal contracts become available only after an authorized dealership
                reviewer releases them. Customers can never unlock their own contracts.
              </p>
            </div>
            <Button
              type="button"
              onClick={onApprove}
              className="mx-auto mt-8 flex h-auto w-full max-w-md whitespace-normal border border-emerald-500/60 bg-emerald-600/20 py-3 text-xs font-extrabold uppercase tracking-wider text-emerald-300 hover:bg-emerald-600/30"
            >
              <KeyRound className="size-4 shrink-0" aria-hidden="true" />
              Simulate Admin Review &amp; Unlock Contracts for Signing
            </Button>
            <p className="mt-2 text-[11px] text-slate-500">
              Local demo only — changes this preview, never a real application.
            </p>
          </>
        )}
      </div>
    </section>
  );
}

/** "pages 1 and 3" style summary of where a signer signs on one contract. */
function wherePages(slots: ContractSignatureSlot[]): string {
  if (slots.some((s) => !s.locationConfirmed)) return "placeholder location";
  const pages = [...new Set(slots.map((s) => s.page))];
  return `${pages.length > 1 ? "pages" : "page"} ${pages.join(" and ")}`;
}

function DemoContracts({
  deal,
  setDeal,
  signatures,
  setSignatures,
  onComplete,
}: {
  deal: Deal;
  setDeal: (deal: Deal) => void;
  signatures: DemoSignatures;
  setSignatures: (signatures: DemoSignatures) => void;
  onComplete: () => void;
}) {
  const contracts = useMemo(() => demoReleasedContracts(), []);
  const heading = useRef<HTMLHeadingElement>(null);
  // Demo-only role switch. Real staff editing and dealer signing require the server-side staff check.
  const [actor, setActor] = useState<EditActor>("customer");
  const [chosenSigner, setChosenSigner] = useState<SignerRole>("buyer");
  const [completeError, setCompleteError] = useState<string | null>(null);
  // Forms 4–5 numbered acknowledgments: page memory only, each initialled separately.
  const [ackInitials, setAckInitials] = useState<DemoInitials>({});
  const initialHandlers = (contractId: ContractId) => ({
    initials: ackInitials,
    actingRole: selectedRole,
    onInitial: (item: number, value: string) => {
      const r = adoptDemoInitial(ackInitials, deal, {
        contractId,
        item,
        role: selectedRole,
        initials: value,
      });
      if (!r.ok) return r.error;
      setAckInitials(r.initials);
      return undefined;
    },
    onClearInitial: (item: number) =>
      setAckInitials(clearDemoInitial(ackInitials, contractId, item, selectedRole)),
  });

  // Forms 3–10: one watermarked placeholder each (with any demo signatures), freed on change.
  const [urls, setUrls] = useState<Map<string, string>>(() => new Map());
  useEffect(() => {
    const made = new Map(
      contracts
        .filter((c) => !WEB_FORMS.has(c.id))
        .map((c) => [
          c.id as string,
          pdfUrl(buildDemoPdf(demoContractLines(c, { deal, signatures }))),
        ]),
    );
    setUrls(made);
    return () => made.forEach((url) => URL.revokeObjectURL(url));
  }, [contracts, deal, signatures]);

  // Web forms: PDF previews rebuilt shortly after the deal or signatures change.
  const [formUrls, setFormUrls] = useState<Partial<Record<ContractId, string>>>({});
  useEffect(() => {
    let made: string[] = [];
    const timer = window.setTimeout(() => {
      const next = {
        bill_of_sale: pdfUrl(buildDemoPdfPages(billOfSaleDemoPages(deal, signatures))),
        retail_installment: pdfUrl(buildDemoPdfPages(retailInstallmentDemoPages(deal, signatures))),
        credit_application: pdfUrl(buildDemoPdfPages(creditApplicationDemoPages(deal, signatures))),
        gps_disclosure: pdfUrl(
          buildDemoPdfPages(gpsDisclosureDemoPages(deal, signatures, ackInitials)),
        ),
        delivery_checklist: pdfUrl(
          buildDemoPdfPages(deliveryChecklistDemoPages(deal, signatures, ackInitials)),
        ),
        insurance_agreement: pdfUrl(
          buildDemoPdfPages(insuranceAgreementDemoPages(deal, signatures)),
        ),
      };
      made = Object.values(next);
      setFormUrls(next);
    }, 300);
    return () => {
      window.clearTimeout(timer);
      made.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [deal, signatures, ackInitials]);

  // Edits build on the latest deal, so several edits in one action all apply.
  const latestDeal = useRef(deal);
  latestDeal.current = deal;
  const onEdit = (key: string, value: string | boolean) => {
    const result = editDealField(latestDeal.current, key, value, actor);
    if (result.error) return result.error;
    latestDeal.current = result.deal;
    setDeal(result.deal);
    return undefined;
  };

  // Bring the suite heading into view once the route change (which resets scroll) settles.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      heading.current?.scrollIntoView({ block: "start" });
      heading.current?.focus({ preventScroll: true });
    }, 120);
    return () => window.clearTimeout(timer);
  }, []);

  // Customers sign only for themselves; only staff sign for the Dealer/Seller.
  const signers = requiredSignerRoles(deal).map((role) => {
    const available = role === "dealer" ? actor === "staff" : actor === "customer";
    return {
      role,
      printedName: signerIdentity(deal, role).printedName,
      available,
      unavailableReason: available
        ? undefined
        : role === "dealer"
          ? "switch the demo view to Staff — only an authorized dealership representative signs here."
          : "switch the demo view to Customer — staff never sign for a Buyer or Co-Buyer.",
      adopted: Boolean(signatures[role]),
    };
  });
  const selectedRole =
    signers.find((s) => s.role === chosenSigner && s.available)?.role ??
    signers.find((s) => s.available)?.role ??
    "buyer";

  const blockEntries = (
    contractId: ContractId,
    include: (slot: ContractSignatureSlot) => boolean,
  ): SignatureBlockEntry[] =>
    signatureSlotsFor(contractId, deal)
      .filter(include)
      .map((slot) => {
        const sig = demoSignatureFor(slot, signatures);
        return {
          slot,
          printedName: signerIdentity(deal, slot.role).printedName,
          status: sig ? "demo_applied" : "awaiting",
          capture: sig?.capture ?? null,
          signedAt: sig?.adoptedAt ?? null,
        };
      });

  function complete() {
    const missing = demoCompletionMissing(deal, signatures);
    if (missing.length) {
      setCompleteError(
        `Still needed before the demo can finish: ${missing
          .map((r) => `${SIGNER_ROLE_LABELS[r]} signature`)
          .join(", ")}.`,
      );
      return;
    }
    setCompleteError(null);
    onComplete();
  }

  return (
    <ContractSuite
      ref={heading}
      contracts={contracts}
      statusBadge={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-400">
            <CircleCheck className="size-3.5" aria-hidden="true" /> DEMO — Contracts Unlocked for
            Preview
          </p>
          <div
            role="radiogroup"
            aria-label="Demo view"
            className="flex flex-wrap items-center gap-2 text-xs"
          >
            <span className="font-semibold text-slate-300">Demo view as:</span>
            {(["customer", "staff"] as const).map((role) => (
              <button
                key={role}
                type="button"
                role="radio"
                aria-checked={actor === role}
                onClick={() => setActor(role)}
                className={
                  actor === role
                    ? "rounded-md bg-fuchsia-600 px-3 py-1 font-semibold text-white"
                    : "rounded-md bg-white/10 px-3 py-1 font-semibold text-slate-200 hover:bg-white/20"
                }
              >
                {role === "customer" ? "Customer (read-only)" : "Staff (demo)"}
              </button>
            ))}
          </div>
        </div>
      }
      resolveDocument={(c) => {
        const src = WEB_FORMS.has(c.id) ? (formUrls[c.id] ?? null) : (urls.get(c.id) ?? null);
        return {
          src,
          state: src ? "ready" : "loading",
          downloadName: `DEMO-${c.number}-${c.id}-NOT-A-LEGAL-CONTRACT.pdf`,
          // Forms 1–2: the web form is the main view; the PDF is offered as actions only.
          ...(WEB_FORMS.has(c.id)
            ? {
                display: "actions" as const,
                actionsNote:
                  "Watermarked demo preview — not a legal contract. A final PDF requires the approved template.",
              }
            : {}),
        };
      }}
      tabBadge={(c) =>
        contractDemoSigned(c.id, deal, signatures) ? (
          <PenLine className="size-3 text-fuchsia-300" aria-label="(demo signatures shown)" />
        ) : null
      }
      signatureSummary={(c) => {
        const roles = [...new Set(signatureSlotsFor(c.id, deal).map((s) => s.role))];
        if (!roles.length) return "No signature required";
        return `Signatures: ${roles
          .map(
            (r) =>
              `${SIGNER_ROLE_LABELS[r]} — ${signatures[r] ? "demo shown, not legally signed" : "awaiting"}`,
          )
          .join(" · ")}`;
      }}
      renderEditor={(c) =>
        c.id === "bill_of_sale" ? (
          <BillOfSaleEditor
            deal={deal}
            actor={actor}
            onEdit={onEdit}
            signatureBlocks={{
              page1: (
                <ContractSignatureBlocks
                  entries={blockEntries("bill_of_sale", (s) => s.page === 1)}
                />
              ),
              page3: (
                <ContractSignatureBlocks
                  entries={blockEntries("bill_of_sale", (s) => s.page === 3)}
                />
              ),
            }}
          />
        ) : c.id === "retail_installment" ? (
          <RetailInstallmentEditor
            deal={deal}
            actor={actor}
            onEdit={onEdit}
            renderSignatures={(ids) => {
              const entries = blockEntries("retail_installment", (s) => ids.includes(s.id));
              return entries.length ? <ContractSignatureBlocks entries={entries} /> : null;
            }}
          />
        ) : c.id === "credit_application" ? (
          <CreditApplicationEditor
            deal={deal}
            actor={actor}
            onEdit={onEdit}
            renderSignatures={(ids) => {
              const entries = blockEntries("credit_application", (s) => ids.includes(s.id));
              return entries.length ? <ContractSignatureBlocks entries={entries} /> : null;
            }}
          />
        ) : c.id === "gps_disclosure" ? (
          <GpsDisclosureEditor
            deal={deal}
            actor={actor}
            onEdit={onEdit}
            renderSignatures={(ids) => {
              const entries = blockEntries("gps_disclosure", (s) => ids.includes(s.id));
              return entries.length ? <ContractSignatureBlocks entries={entries} /> : null;
            }}
            {...initialHandlers("gps_disclosure")}
          />
        ) : c.id === "delivery_checklist" ? (
          <DeliveryChecklistEditor
            deal={deal}
            actor={actor}
            onEdit={onEdit}
            renderSignatures={(ids) => {
              const entries = blockEntries("delivery_checklist", (s) => ids.includes(s.id));
              return entries.length ? <ContractSignatureBlocks entries={entries} /> : null;
            }}
            {...initialHandlers("delivery_checklist")}
            signatureState={{
              buyer: Boolean(signatures.buyer),
              co_buyer: Boolean(signatures.co_buyer),
              dealer: Boolean(signatures.dealer),
            }}
          />
        ) : c.id === "insurance_agreement" ? (
          <InsuranceAgreementEditor
            deal={deal}
            actor={actor}
            onEdit={onEdit}
            renderSignatures={(ids) => {
              const entries = blockEntries("insurance_agreement", (s) => ids.includes(s.id));
              return entries.length ? <ContractSignatureBlocks entries={entries} /> : null;
            }}
            signed={{
              buyer: Boolean(signatures.buyer),
              co_buyer: Boolean(signatures.co_buyer),
              dealer: Boolean(signatures.dealer),
            }}
          />
        ) : null
      }
      renderFooter={(active) => {
        const slots = signatureSlotsFor(active.id, deal);
        const roles = [...new Set(slots.map((s) => s.role))];
        const missing = demoCompletionMissing(deal, signatures);
        return (
          <>
            <DigitalSignaturePanel
              activeDocument={`${active.number}. ${active.title}`}
              requirements={roles.map((role) => ({
                role,
                where: wherePages(slots.filter((s) => s.role === role)),
                applied: Boolean(signatures[role]),
              }))}
              method="typed"
              signers={signers}
              selectedRole={selectedRole}
              onSelectRole={setChosenSigner}
              notice={
                <p className="mt-3 rounded-lg border border-fuchsia-400/40 bg-fuchsia-500/10 px-3 py-2 text-[11px] text-fuchsia-100">
                  DEMO — signatures stay in this page's memory and are shown only on their own
                  signer's lines. Nothing is signed, uploaded, saved or sent. In production each
                  signer signs in their own session through the approved e-signature provider.
                </p>
              }
              certification={
                <>
                  I am the fictional <strong>{SIGNER_ROLE_LABELS[selectedRole]}</strong> in this
                  demo and I adopt the typed name above as my demo signature. I understand it is not
                  a real signature and no document will be signed or executed.
                </>
              }
              applyLabel="Adopt Signature — All 10 Contracts"
              onApply={({ role, capture, certified }) => {
                const result = adoptDemoSignature(signatures, deal, { role, capture, certified });
                if (!result.ok) return { error: result.error };
                setSignatures(result.signatures);
                setCompleteError(null);
                const forms = new Set(result.appliedTo.map((s) => s.contractId)).size;
                const label = SIGNER_ROLE_LABELS[role];
                return {
                  message: `Demo signature shown on ${result.appliedTo.length} ${label} signature location(s) in ${forms} form(s). Other signers' lines are unchanged. Nothing was signed, saved or sent.`,
                };
              }}
              onRemove={(role) => setSignatures(removeDemoSignature(signatures, role))}
            />
            <div className="flex flex-col items-stretch gap-2 border-t border-white/10 pt-6 sm:items-end">
              <button
                type="button"
                onClick={complete}
                aria-describedby="lto-demo-complete-note"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-6 py-3 text-xs font-extrabold uppercase tracking-wider text-white shadow-lg shadow-emerald-900/40 hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
              >
                Complete Deal &amp; Enter Client Portal
                <ArrowRight className="size-4" aria-hidden="true" />
              </button>
              <p id="lto-demo-complete-note" className="text-[11px] text-slate-400 sm:text-right">
                {missing.length
                  ? `Demo: waiting for ${missing.map((r) => SIGNER_ROLE_LABELS[r]).join(", ")} demo signature(s).`
                  : "Demo: opens a fictional portal preview. No contract, lease, delivery or payment is created."}
              </p>
              {completeError && (
                <p role="alert" className="text-xs font-semibold text-red-300 sm:text-right">
                  {completeError}
                </p>
              )}
            </div>
          </>
        );
      }}
      explainUnavailableReason="AI Explain isn't available: no approved AI service is configured for MyCar, and contracts are never sent to an unapproved provider. Nothing was explained or sent."
    />
  );
}

/**
 * Fictional customer portal shown after the simulated completion. It never
 * calls the real portal: no account, lease, payment or document is read or made.
 */
function DemoPortal({
  deal,
  signatures,
  onBack,
}: {
  deal: Deal;
  signatures: DemoSignatures;
  onBack: () => void;
}) {
  const contracts = useMemo(() => demoReleasedContracts(), []);
  const heading = useRef<HTMLHeadingElement>(null);
  const balanceDue = computeBillOfSale(deal).byNumber[31] ?? null;
  const vehicle = [
    text(deal, "vehicle.year"),
    text(deal, "vehicle.make"),
    text(deal, "vehicle.model"),
  ]
    .filter(Boolean)
    .join(" ");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      heading.current?.scrollIntoView({ block: "start" });
      heading.current?.focus({ preventScroll: true });
    }, 120);
    return () => window.clearTimeout(timer);
  }, []);

  const notDone = [
    ["Contracts", "Not executed — demo signatures only"],
    ["Lease", "Not activated"],
    ["Vehicle", "Not delivered"],
    ["Payments", "No payment method connected; nothing charged"],
    ["Insurance & GPS", "Not activated or verified"],
    ["Email / SMS / CRM", "Nothing sent"],
  ] as const;

  return (
    <section aria-labelledby="lto-demo-portal-title" className="space-y-6">
      <div
        role="status"
        className="rounded-xl border-2 border-emerald-500 bg-emerald-50 p-4 text-sm text-emerald-950"
      >
        <p className="flex items-center gap-2 font-extrabold">
          <CircleCheck className="size-5 shrink-0" aria-hidden="true" /> DEMO — Deal completion
          simulated
        </p>
        <p className="mt-1">
          Every required demo signature was adopted. This is a preview only: no real contract was
          signed or executed, no lease was activated and nothing was saved or sent.
        </p>
      </div>

      <h2
        ref={heading}
        id="lto-demo-portal-title"
        tabIndex={-1}
        className="scroll-mt-40 font-display text-3xl font-extrabold tracking-tight text-primary focus:outline-none sm:text-4xl"
      >
        Lease to Own portal (demo preview)
      </h2>

      <div className="rounded-xl bg-primary p-6 text-primary-foreground">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-2xl font-bold">{fullName(deal, "buyer") || "Demo customer"}</p>
            <p className="mt-1 text-sm text-primary-foreground/80">
              Demo deal {DEMO_DEAL.reference} • {vehicle || "Vehicle pending"}
              {text(deal, "vehicle.vin") ? ` • VIN ${text(deal, "vehicle.vin")}` : ""}
            </p>
          </div>
          <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold">
            Lease: demo preview — not active
          </span>
        </div>
        <dl className="mt-5 grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-primary-foreground/70">Balance due (Form 1, line 31)</dt>
            <dd className="font-display text-2xl font-black">
              {balanceDue === null ? "—" : formatCents(balanceDue)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-primary-foreground/70">Co-Buyer</dt>
            <dd className="font-semibold">
              {deal.coBuyerIncluded ? fullName(deal, "coBuyer") || "Name missing" : "None"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-primary-foreground/70">Installments</dt>
            <dd className="font-semibold">Set by the approved contract (not in demo)</dd>
          </div>
        </dl>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="flex items-center gap-2 font-bold">
            <FileText className="size-4 text-primary" aria-hidden="true" /> Documents (demo)
          </h3>
          <ul className="mt-3 space-y-1.5 text-sm">
            {contracts.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {c.number}. {c.title}
                </span>
                <span className="text-xs font-semibold text-fuchsia-700">
                  {contractDemoSigned(c.id, deal, signatures)
                    ? "Demo signatures shown — not executed"
                    : "Not signed"}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="flex items-center gap-2 font-bold">
            <CircleAlert className="size-4 text-amber-600" aria-hidden="true" /> What did not happen
          </h3>
          <dl className="mt-3 space-y-1.5 text-sm">
            {notDone.map(([k, v]) => (
              <div key={k} className="flex flex-wrap justify-between gap-2">
                <dt className="font-semibold">{k}</dt>
                <dd className="text-muted-foreground">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <Button type="button" variant="outline" onClick={onBack}>
        <ArrowLeft className="size-4" aria-hidden="true" /> Back to the Contract Suite (demo)
      </Button>
    </section>
  );
}

/** Contracts shown as web forms, with their PDF offered as Preview/Download/Print only. */
const WEB_FORMS = new Set<ContractId>([
  "bill_of_sale",
  "retail_installment",
  "credit_application",
  "gps_disclosure",
  "delivery_checklist",
  "insurance_agreement",
]);

function pdfUrl(pdf: string): string {
  return URL.createObjectURL(new Blob([pdf], { type: "application/pdf" }));
}
