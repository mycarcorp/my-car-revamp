import { useEffect, useId, useState, type ReactNode } from "react";
import { CircleAlert, CircleCheck, Eraser, PenLine, Trash2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  formatSignatureDate,
  SIGNER_ROLE_LABELS,
  type SignatureCapture,
  type SignerRole,
} from "@/lib/contract-signatures";
import { cn } from "@/lib/utils";
import { SignaturePad } from "./SignaturePad";

export type SignaturePanelSigner = {
  role: SignerRole;
  printedName: string | null;
  /** False when this signer can't sign from the current session (shown with the reason). */
  available: boolean;
  unavailableReason?: string;
  /** This signer has already adopted a signature in this session. */
  adopted: boolean;
};

export type ActiveDocumentRequirement = {
  role: SignerRole;
  /** e.g. "page 1 and page 3". */
  where: string;
  applied: boolean;
};

/**
 * DIGITAL SIGNATURE PAD — one panel beneath the Contract Suite viewer, shared by
 * all ten tabs. Presentation only: the caller's `onApply` decides what an
 * adopted signature may do (the local demo keeps it in memory; production must
 * hand off to the approved e-signature provider). The selected signer's
 * signature is only ever offered for that signer's own locations.
 *
 * `method="typed"` replaces the drawing canvas with a typed full legal name and
 * a script-style preview; the name on file is suggested but never adopted
 * until the signer confirms it.
 */
export function DigitalSignaturePanel({
  activeDocument,
  requirements,
  signers,
  selectedRole,
  onSelectRole,
  certification,
  applyLabel,
  onApply,
  onRemove,
  notice,
  method = "draw",
}: {
  activeDocument: string;
  requirements: ActiveDocumentRequirement[];
  signers: SignaturePanelSigner[];
  selectedRole: SignerRole;
  onSelectRole: (role: SignerRole) => void;
  certification: ReactNode;
  applyLabel: string;
  /** Returns an error to show, or a success message. */
  onApply: (input: {
    role: SignerRole;
    capture: SignatureCapture | null;
    certified: boolean;
  }) => { error: string } | { message: string };
  onRemove: (role: SignerRole) => void;
  notice?: ReactNode;
  method?: "draw" | "typed";
}) {
  const ids = useId();
  const [capture, setCapture] = useState<SignatureCapture | null>(null);
  const [certified, setCertified] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "error" | "ok"; text: string } | null>(null);
  const signer = signers.find((s) => s.role === selectedRole) ?? signers[0]!;
  const label = SIGNER_ROLE_LABELS[signer.role];

  function select(role: SignerRole) {
    // A different signer starts with an empty pad and an unchecked certification.
    onSelectRole(role);
    setCapture(null);
    setCertified(false);
    setFeedback(null);
  }

  function apply() {
    const result = onApply({ role: signer.role, capture, certified });
    if ("error" in result) setFeedback({ tone: "error", text: result.error });
    else {
      setFeedback({ tone: "ok", text: result.message });
      setCertified(false);
    }
  }

  return (
    <section
      aria-labelledby={`${ids}-title`}
      className="rounded-2xl border border-white/10 bg-[#0b1630] p-4 text-white sm:p-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3
          id={`${ids}-title`}
          className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider"
        >
          <PenLine className="size-4 text-amber-400" aria-hidden="true" /> Digital Signature Pad
          <span className="text-[11px] font-semibold normal-case tracking-normal text-slate-400">
            (E-SIGN Act 15 U.S.C. § 7001)
          </span>
        </h3>
      </div>
      <p className="mt-1 text-[11px] text-slate-400">
        Reference label only. Showing it does not make this pad legally compliant; compliance
        depends on the approved e-signature provider, consent and audit trail.
      </p>
      {notice}

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-3 text-xs">
          <div>
            <p className="font-semibold text-slate-300">Active document</p>
            <p className="mt-0.5 font-bold text-white" data-testid="signature-active-document">
              {activeDocument}
            </p>
            {requirements.length ? (
              <ul className="mt-2 space-y-1" aria-label="Required signatures on this document">
                {requirements.map((r) => (
                  <li key={r.role} className="flex items-center justify-between gap-2">
                    <span>
                      {SIGNER_ROLE_LABELS[r.role]}{" "}
                      <span className="text-slate-400">({r.where})</span>
                    </span>
                    <span
                      className={cn(
                        "font-semibold",
                        r.applied ? "text-fuchsia-300" : "text-slate-400",
                      )}
                    >
                      {r.applied ? "Demo signature shown" : "Awaiting signature"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-slate-400">No signature required on this document.</p>
            )}
          </div>

          <fieldset>
            <legend className="font-semibold text-slate-300">Signing as</legend>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {signers.map((s) => [
                s.role === "dealer" && (
                  <span
                    key="staff-only"
                    className="ml-1 border-l border-white/15 pl-2.5 text-[10px] font-bold uppercase tracking-wider text-amber-300"
                  >
                    Staff only
                  </span>
                ),
                <label
                  key={s.role}
                  className={cn(
                    "inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 font-semibold",
                    s.role === signer.role
                      ? "border-sky-400 bg-sky-500/20 text-white"
                      : "border-white/15 bg-white/5 text-slate-300 hover:bg-white/10",
                    !s.available && "cursor-not-allowed opacity-60",
                  )}
                >
                  <input
                    type="radio"
                    name={`${ids}-signer`}
                    value={s.role}
                    checked={s.role === signer.role}
                    disabled={!s.available}
                    onChange={() => select(s.role)}
                    className="sr-only"
                  />
                  {SIGNER_ROLE_LABELS[s.role]}
                  {s.adopted && (
                    <CircleCheck className="size-3.5 text-fuchsia-300" aria-label="adopted" />
                  )}
                </label>,
              ])}
            </div>
            {signers
              .filter((s) => !s.available && s.unavailableReason)
              .map((s) => (
                <p key={s.role} className="mt-1 text-[11px] text-slate-400">
                  {SIGNER_ROLE_LABELS[s.role]}: {s.unavailableReason}
                </p>
              ))}
          </fieldset>

          <div>
            <p className="font-semibold text-slate-300">Printed name</p>
            {signer.printedName ? (
              <p className="mt-0.5 font-bold text-white" data-testid="signature-signer-name">
                {signer.printedName}
              </p>
            ) : (
              <p className="mt-0.5 inline-flex items-center gap-1 font-semibold text-amber-300">
                <CircleAlert className="size-3.5" aria-hidden="true" /> {label} name missing
              </p>
            )}
          </div>

          {signers.some((s) => s.adopted) && (
            <ul className="space-y-1 border-t border-white/10 pt-2" aria-label="Adopted signatures">
              {signers
                .filter((s) => s.adopted)
                .map((s) => (
                  <li key={s.role} className="flex items-center justify-between gap-2">
                    <span className="text-fuchsia-200">
                      {SIGNER_ROLE_LABELS[s.role]} — demo signature applied
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        onRemove(s.role);
                        setFeedback(null);
                      }}
                      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-slate-300 hover:bg-white/10 hover:text-white"
                    >
                      <Trash2 className="size-3" aria-hidden="true" /> Remove
                      <span className="sr-only"> {SIGNER_ROLE_LABELS[s.role]} demo signature</span>
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </div>

        <div className="min-w-0 space-y-3">
          {method === "typed" ? (
            <TypedSignature
              key={signer.role}
              id={`${ids}-typed`}
              role={signer.role}
              suggestedName={signer.printedName}
              adopted={signer.adopted}
              onCapture={(c) => {
                setCapture(c);
                setFeedback(null);
              }}
            />
          ) : (
            <SignaturePad
              key={signer.role}
              tone="dark"
              scriptName={signer.printedName ?? ""}
              onCapture={(c) => {
                setCapture(c);
                setFeedback(null);
              }}
              label={`${label} signature area. Draw with a mouse, finger or stylus.`}
            />
          )}
          <label className="flex items-start gap-2 text-xs leading-relaxed text-slate-300">
            <input
              type="checkbox"
              checked={certified}
              onChange={(e) => setCertified(e.target.checked)}
              className="mt-0.5 size-4 shrink-0 accent-emerald-500"
              aria-describedby={feedback ? `${ids}-feedback` : undefined}
            />
            <span>{certification}</span>
          </label>
          <button
            type="button"
            onClick={apply}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-xs font-extrabold uppercase tracking-wider text-white shadow hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 sm:ml-auto sm:w-auto"
          >
            {applyLabel}
          </button>
          {feedback && (
            <p
              id={`${ids}-feedback`}
              role={feedback.tone === "error" ? "alert" : "status"}
              className={cn(
                "text-xs font-semibold",
                feedback.tone === "error" ? "text-red-300" : "text-emerald-300",
              )}
            >
              {feedback.text}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

/** Browser-installed script faces only; no font files are downloaded. */
const SCRIPT_STYLE = {
  fontFamily: '"Brush Script MT", "Segoe Script", "Lucida Handwriting", cursive',
} as const;

/**
 * Typed full legal name with a live script-style preview laid out like the
 * document's signature line: signature and date, then printed name and role.
 * The suggestion is only a starting value; nothing is adopted here.
 */
function TypedSignature({
  id,
  role,
  suggestedName,
  adopted,
  onCapture,
}: {
  id: string;
  role: SignerRole;
  suggestedName: string | null;
  adopted: boolean;
  onCapture: (capture: SignatureCapture | null) => void;
}) {
  const [name, setName] = useState(suggestedName ?? "");
  const label = SIGNER_ROLE_LABELS[role];
  const shown = name.trim();

  // A name that arrives later (e.g. staff enter the dealer representative) fills an empty field.
  useEffect(() => {
    if (suggestedName) setName((current) => current || suggestedName);
  }, [suggestedName]);

  // Keep the parent's capture in step with what the preview shows.
  useEffect(() => {
    onCapture(shown ? { kind: "script", name: shown } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- report value changes only
  }, [shown]);

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <label htmlFor={id} className="text-xs font-semibold text-slate-300">
            {label} — type your full legal name
          </label>
          <Input
            id={id}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            className="border-white/20 bg-white/5 text-white placeholder:text-slate-500"
            placeholder="Full legal name"
          />
        </div>
        <button
          type="button"
          onClick={() => setName("")}
          className="inline-flex h-9 items-center gap-1 rounded-md px-2 text-xs font-semibold text-slate-300 hover:bg-white/10 hover:text-white"
        >
          <Eraser className="size-3.5" aria-hidden="true" /> Clear
        </button>
      </div>
      {suggestedName && (
        <p className="text-[11px] text-slate-400">
          Suggested from the {label} record:{" "}
          <strong className="text-slate-200">{suggestedName}</strong>. A suggestion is not a
          signature until you confirm and adopt it.
        </p>
      )}

      <div
        className="rounded-lg bg-white p-4 text-slate-900"
        role="img"
        aria-label={
          shown ? `${label} signature preview: ${shown}` : `${label} signature preview: empty`
        }
        data-testid="typed-signature-preview"
      >
        <div className="flex items-end gap-3">
          <span aria-hidden="true" className="pb-1 text-sm font-bold">
            X
          </span>
          <div className="relative flex h-16 min-w-0 flex-1 items-center overflow-hidden rounded border border-slate-400 px-3">
            <span className="absolute left-1.5 top-0.5 text-[8px] font-bold uppercase tracking-wide text-fuchsia-700">
              {adopted ? "Demo signature — not valid" : "Demo preview — not signed"}
            </span>
            {shown ? (
              <span
                className="truncate pt-2 text-3xl leading-none text-[#0f2a4a]"
                style={SCRIPT_STYLE}
              >
                {shown}
              </span>
            ) : (
              <span className="pt-2 text-xs text-slate-400">Your signature appears here</span>
            )}
          </div>
          <div className="w-24 shrink-0 text-right">
            <p className="border-b border-slate-400 pb-0.5 font-mono text-sm">
              {formatSignatureDate(new Date())}
            </p>
            <p className="text-[10px] text-slate-500">Date</p>
          </div>
        </div>
        <div className="mt-1 flex justify-between gap-2 pl-5 text-xs">
          <span className="truncate font-semibold">
            {suggestedName ?? <span className="text-amber-700">{label} name missing</span>}
          </span>
          <span className="shrink-0 text-slate-500">{label}</span>
        </div>
        <p className="mt-2 text-[11px] font-semibold text-slate-500">
          Status: {adopted ? "demo signature adopted — not legally signed" : "not signed"}
        </p>
      </div>
    </div>
  );
}
