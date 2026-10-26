import { useState } from "react";
import { FileSignature, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AGREEMENTS,
  AGREEMENT_DRAFT_VERSION,
  agreementDraft,
  type AgreementContext,
  type AgreementKey,
} from "@/lib/lease-to-own-content";
import type { LeaseAgreementRow, LeaseIntegrationStatus } from "@/lib/lease-to-own.functions";
import { PendingIntegration, ReviewNote, StatusPill } from "./shared";
import { SignaturePad } from "./SignaturePad";

const DRAFT_BANNER = "DRAFT PREVIEW — NOT AN APPROVED CONTRACT AND NOT FOR SIGNATURE";

export function ESignStep({
  context,
  agreements,
  integrations,
}: {
  context: AgreementContext;
  agreements: LeaseAgreementRow[];
  integrations: LeaseIntegrationStatus;
}) {
  const [active, setActive] = useState<AgreementKey>("master_lease");
  const [hasSignature, setHasSignature] = useState(false);
  const [consent, setConsent] = useState(false);
  const executionAvailable = integrations.esignProvider && integrations.approvedTemplates;

  const statusFor = (key: AgreementKey) =>
    agreements.find((a) => a.agreement_key === key)?.status ?? "draft";

  return (
    <div className="space-y-6">
      <PendingIntegration title="Electronic signing is not available yet">
        These are draft previews built from the program summary so you can see your package details.
        Final agreements must come from templates approved by My Car management and Virginia counsel
        and be signed through an approved e-signature provider with a full audit trail. Until then,
        nothing you draw or type here is saved or treated as a signature.
      </PendingIntegration>

      <Tabs value={active} onValueChange={(v) => setActive(v as AgreementKey)}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList className="h-auto flex-wrap justify-start">
            {AGREEMENTS.map((doc) => (
              <TabsTrigger key={doc.key} value={doc.key} className="text-xs">
                {doc.tab}
              </TabsTrigger>
            ))}
          </TabsList>
          <Button type="button" variant="outline" size="sm" onClick={() => printDraft(context)}>
            <Printer className="size-4" /> Print draft packet
          </Button>
        </div>
        {AGREEMENTS.map((doc) => (
          <TabsContent key={doc.key} value={doc.key}>
            <article
              className="max-h-96 overflow-y-auto rounded-lg border border-border bg-card p-5 text-sm leading-relaxed"
              tabIndex={0}
              aria-label={`${doc.title} draft`}
            >
              <p className="rounded bg-[#F7941D]/15 px-2 py-1 text-center text-[11px] font-bold tracking-wider text-accent-text">
                {DRAFT_BANNER}
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-lg font-bold uppercase text-primary">{doc.title}</h3>
                <StatusPill tone={statusFor(doc.key) === "executed" ? "success" : "neutral"}>
                  {statusFor(doc.key) === "executed" ? "Executed" : "Not executed"}
                </StatusPill>
              </div>
              <p className="text-xs text-muted-foreground">
                My Car Business Services LLC • Template {AGREEMENT_DRAFT_VERSION}
              </p>
              <ol className="mt-4 space-y-3">
                {agreementDraft(doc.key, context).map((section, index) => (
                  <li key={section.heading}>
                    <p className="font-semibold text-foreground">
                      {index + 1}. {section.heading}
                    </p>
                    <p className="text-muted-foreground">{section.body}</p>
                  </li>
                ))}
              </ol>
            </article>
          </TabsContent>
        ))}
      </Tabs>

      <ReviewNote
        ids={["vaCompliance", "mileageFee", "smsWarnings", "bypassPin", "dealerLicense"]}
      />

      <section
        aria-labelledby="lto-sign-title"
        className="rounded-xl border border-border bg-surface p-5"
      >
        <h3
          id="lto-sign-title"
          className="flex items-center gap-2 text-base font-bold text-foreground"
        >
          <FileSignature className="size-4 text-[#F7941D]" aria-hidden="true" /> Your signature
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Practice preview only. Signing opens once approved agreements and the e-signature provider
          are in place.
        </p>
        <div className="mt-4">
          <SignaturePad typedName={context.customerName} onChange={setHasSignature} />
        </div>
        <div className="mt-4 flex items-start gap-2">
          <Checkbox
            id="lto-esign-consent"
            checked={consent}
            onCheckedChange={(v) => setConsent(v === true)}
          />
          <Label
            htmlFor="lto-esign-consent"
            className="text-xs font-normal leading-relaxed text-muted-foreground"
          >
            I agree to use electronic records and signatures for these Lease to Own agreements, and
            I understand I can request paper copies. (Consent wording pending legal approval.)
          </Label>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {hasSignature && consent
              ? "Ready — waiting for e-signing to be enabled."
              : "Add a signature and consent to preview the signing step."}
          </p>
          <Button type="button" disabled={!executionAvailable || !hasSignature || !consent}>
            Sign {AGREEMENTS.length} agreements
          </Button>
        </div>
      </section>
    </div>
  );
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

/** Opens a print-only window containing the watermarked draft text. */
function printDraft(context: AgreementContext) {
  const body = AGREEMENTS.map((doc) => {
    const sections = agreementDraft(doc.key, context)
      .map(
        (s, i) =>
          `<p><strong>${i + 1}. ${escapeHtml(s.heading)}</strong><br>${escapeHtml(s.body)}</p>`,
      )
      .join("");
    return `<section><p class="banner">${DRAFT_BANNER}</p><h2>${escapeHtml(doc.title)}</h2>${sections}</section>`;
  }).join("");
  const win = window.open("", "_blank", "width=800,height=900");
  if (!win) return;
  win.document.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>Lease to Own draft packet</title><style>body{font-family:Arial,sans-serif;line-height:1.5;padding:32px;color:#111}section{page-break-after:always}h2{text-transform:uppercase;color:#10385d}.banner{border:2px solid #b45309;color:#b45309;text-align:center;font-weight:bold;padding:4px}</style></head><body>${body}</body></html>`,
  );
  win.document.close();
  win.focus();
  win.print();
}
