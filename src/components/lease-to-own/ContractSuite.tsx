import { forwardRef, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Lock, Printer, Sparkles } from "lucide-react";

import { APPLICANT_ROLE_LABELS } from "@/lib/lease-to-own";
import type { DealContract } from "@/lib/lease-contracts";
import { cn } from "@/lib/utils";
import {
  ContractDocumentViewer,
  type ContractViewerHandle,
  type ContractViewerState,
} from "./ContractDocumentViewer";

export type ResolvedContractDocument = {
  src: string | null;
  state: ContractViewerState;
  missingMessage?: string;
  downloadName?: string;
  /** "actions" shows Preview/Download/Print instead of an embedded viewer. */
  display?: "embedded" | "actions";
  actionsNote?: string;
};

/**
 * Virginia Deal Contract Suite: ten numbered tabs over one document viewer.
 * Presentation only — the caller decides which documents are released and
 * resolves each one (after its own authorization) through `resolveDocument`.
 * Signing is never performed here.
 */
export const ContractSuite = forwardRef<
  HTMLHeadingElement,
  {
    contracts: DealContract[];
    statusBadge: ReactNode;
    resolveDocument: (contract: DealContract) => ResolvedContractDocument;
    /** Why AI explanations are unavailable; null once an approved service is connected. */
    explainUnavailableReason: string | null;
    /** Optional form editor shown above a contract's document (e.g. Form 1). */
    renderEditor?: (contract: DealContract) => ReactNode;
    /** Optional marker after a tab's label (e.g. signature progress). */
    tabBadge?: (contract: DealContract) => ReactNode;
    /** Replaces the default per-signer status line for the active contract. */
    signatureSummary?: (contract: DealContract) => ReactNode;
    /** Shown once below the viewer for whichever contract is active (e.g. the signature panel). */
    renderFooter?: (contract: DealContract) => ReactNode;
  }
>(function ContractSuite(
  {
    contracts,
    statusBadge,
    resolveDocument,
    explainUnavailableReason,
    renderEditor,
    tabBadge,
    signatureSummary,
    renderFooter,
  },
  ref,
) {
  const [activeId, setActiveId] = useState(contracts[0]?.id);
  const [explainNote, setExplainNote] = useState(false);
  const [printNote, setPrintNote] = useState<string | null>(null);
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());
  const listRef = useRef<HTMLDivElement>(null);
  const viewer = useRef<ContractViewerHandle>(null);
  const active = contracts.find((c) => c.id === activeId) ?? contracts[0]!;
  const doc = resolveDocument(active);

  // Keep the selected tab in view (tabs 8–10 sit off-screen on narrow widths).
  useEffect(() => {
    tabRefs.current.get(active.id)?.scrollIntoView({ block: "nearest", inline: "nearest" });
    setPrintNote(null);
  }, [active.id]);

  function select(index: number) {
    const next = contracts[(index + contracts.length) % contracts.length]!;
    setActiveId(next.id);
    tabRefs.current.get(next.id)?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent, index: number) {
    const moves: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: contracts.length - 1,
    };
    if (event.key in moves) {
      event.preventDefault();
      select(moves[event.key]!);
    }
  }

  const scrollTabs = (direction: 1 | -1) =>
    listRef.current?.scrollBy({ left: direction * 260, behavior: "smooth" });

  return (
    <section
      aria-labelledby="lto-contract-suite-title"
      className="rounded-2xl bg-slate-950 px-4 py-8 text-white sm:px-8"
    >
      <div className="mx-auto max-w-5xl">
        {statusBadge}
        <h2
          ref={ref}
          id="lto-contract-suite-title"
          tabIndex={-1}
          className="mt-2 scroll-mt-40 font-display text-2xl font-extrabold tracking-tight focus:outline-none sm:text-3xl"
        >
          Virginia Deal Contract Suite (10 Forms)
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Review each document below. Each form is signed separately through the approved
          e-signature provider once it is connected.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setExplainNote((v) => !v)}
            aria-expanded={explainNote}
            className="inline-flex items-center gap-1.5 rounded-lg border border-violet-400/40 bg-violet-500/15 px-3 py-1.5 text-xs font-semibold text-violet-200 hover:bg-violet-500/25"
          >
            <Sparkles className="size-3.5" aria-hidden="true" /> AI Explain This Contract
          </button>
          <button
            type="button"
            disabled={doc.state !== "ready" || !doc.src}
            onClick={() => {
              if (!viewer.current?.print()) setPrintNote("There's no document to print yet.");
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            title={doc.state !== "ready" ? "Available once this document exists" : undefined}
          >
            <Printer className="size-3.5" aria-hidden="true" /> Print Active Document
          </button>
        </div>
        {explainNote && (
          <p
            role="status"
            className="mt-3 rounded-lg border border-violet-400/30 bg-violet-500/10 p-3 text-xs text-violet-100"
          >
            {explainUnavailableReason ??
              "AI explanations are general information, not legal advice."}
          </p>
        )}
        {printNote && (
          <p role="status" className="mt-3 text-xs text-amber-300">
            {printNote}
          </p>
        )}

        <div className="mt-6 flex items-center gap-1 border-t border-white/10 pt-4">
          <button
            type="button"
            aria-label="Scroll tabs left"
            onClick={() => scrollTabs(-1)}
            className="hidden shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-white/10 hover:text-white sm:block"
          >
            <ChevronLeft className="size-4" />
          </button>
          <div
            ref={listRef}
            role="tablist"
            aria-label="Contract documents"
            className="flex min-w-0 flex-1 gap-2 overflow-x-auto scroll-smooth pb-3 [scrollbar-color:#334155_transparent] [scrollbar-width:thin]"
          >
            {contracts.map((contract, index) => {
              const selected = contract.id === active.id;
              return (
                <button
                  key={contract.id}
                  ref={(el) => {
                    if (el) tabRefs.current.set(contract.id, el);
                    else tabRefs.current.delete(contract.id);
                  }}
                  type="button"
                  role="tab"
                  id={`lto-contract-tab-${contract.id}`}
                  aria-selected={selected}
                  aria-controls="lto-contract-panel"
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setActiveId(contract.id)}
                  onKeyDown={(e) => onKeyDown(e, index)}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400",
                    selected
                      ? "bg-blue-600 text-white shadow"
                      : "bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white",
                  )}
                >
                  {!contract.released && <Lock className="size-3" aria-label="Locked" />}
                  {contract.number}. {contract.tabLabel}
                  {tabBadge?.(contract)}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            aria-label="Scroll tabs right"
            onClick={() => scrollTabs(1)}
            className="hidden shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-white/10 hover:text-white sm:block"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        <div
          id="lto-contract-panel"
          role="tabpanel"
          aria-labelledby={`lto-contract-tab-${active.id}`}
          className="mt-4 space-y-3"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-lg font-bold">
              {active.number}. {active.title}
            </h3>
            <p className="text-xs text-slate-400">
              {signatureSummary
                ? signatureSummary(active)
                : active.requiresSignature
                  ? `Signature: ${active.signerRoles
                      .map(
                        (r) =>
                          `${APPLICANT_ROLE_LABELS[r]} — ${active.signedBy[r] ? "signed" : "not signed"}`,
                      )
                      .join(" · ")}`
                  : "No signature required"}
            </p>
          </div>
          {renderEditor?.(active)}
          <ContractDocumentViewer
            ref={viewer}
            title={`${active.number}. ${active.title}`}
            src={doc.src}
            state={doc.state}
            missingMessage={doc.missingMessage}
            downloadName={doc.downloadName}
            display={doc.display}
            actionsNote={doc.actionsNote}
          />
        </div>
        {renderFooter && <div className="mt-6 space-y-6">{renderFooter(active)}</div>}
      </div>
    </section>
  );
});
