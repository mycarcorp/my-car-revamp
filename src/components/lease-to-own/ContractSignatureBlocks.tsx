import { CircleAlert } from "lucide-react";

import {
  formatSignatureDate,
  SIGNER_ROLE_LABELS,
  type ContractSignatureSlot,
  type SignatureCapture,
} from "@/lib/contract-signatures";
import { initialsOf } from "@/lib/credit-application";
import { cn } from "@/lib/utils";

export type SignatureBlockStatus = "awaiting" | "demo_applied" | "signed";

export type SignatureBlockEntry = {
  slot: ContractSignatureSlot;
  /** From the application or dealer record; null shows a missing-information state. */
  printedName: string | null;
  status: SignatureBlockStatus;
  /** Shown only for this slot's own signer. */
  capture?: SignatureCapture | null;
  /** ISO timestamp of the signature. */
  signedAt?: string | null;
};

const STATUS_TEXT: Record<SignatureBlockStatus, string> = {
  awaiting: "Awaiting signature",
  demo_applied: "Demo signature — not legally signed",
  signed: "Signed (verified by provider)",
};

/** Browser-installed script faces only; no font files are downloaded. */
const SCRIPT_STYLE = {
  fontFamily: '"Brush Script MT", "Segoe Script", "Lucida Handwriting", cursive',
} as const;

/** Small, non-editable picture of a captured signature. */
export function SignaturePreview({ capture }: { capture: SignatureCapture }) {
  if (capture.kind === "script")
    return (
      <span className="truncate text-2xl leading-none text-[#0f2a4a]" style={SCRIPT_STYLE}>
        {capture.name}
      </span>
    );
  return (
    <svg
      viewBox={`0 0 ${capture.width} ${capture.height}`}
      preserveAspectRatio="xMidYMid meet"
      className="h-full w-full"
      aria-hidden="true"
    >
      {capture.strokes.map((stroke, i) => (
        <polyline
          key={i}
          points={stroke.map(([x, y]) => `${x},${y}`).join(" ")}
          fill="none"
          stroke="#0f2a4a"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}

function timeOf(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, "0")} ${d.getHours() < 12 ? "AM" : "PM"}`;
}

/**
 * Signature lines laid out like the reference document:
 *   X [signature box]            [date]
 *     printed name       role    Date
 * Each box shows only its own signer's signature. Display only — nothing is
 * signed here.
 */
export function ContractSignatureBlocks({ entries }: { entries: SignatureBlockEntry[] }) {
  return (
    <ul className="space-y-4">
      {entries.map((entry) => {
        const label = SIGNER_ROLE_LABELS[entry.slot.role];
        const shown = entry.status !== "awaiting" && entry.capture;
        const isInitials = entry.slot.mark === "initials";
        const mark = isInitials ? "initials" : "signature";
        const capture =
          shown && isInitials && entry.capture!.kind === "script"
            ? { kind: "script" as const, name: initialsOf(entry.capture!.name) }
            : entry.capture;
        return (
          <li key={entry.slot.id} data-signature-slot={entry.slot.id} data-role={entry.slot.role}>
            <div className="flex items-end gap-2">
              <span aria-hidden="true" className="pb-0.5 text-sm font-bold">
                X
              </span>
              <div
                role="img"
                aria-label={`${label} ${mark}: ${STATUS_TEXT[entry.status]}`}
                className={cn(
                  "relative flex h-14 min-w-0 flex-1 items-center justify-center overflow-hidden rounded-sm border px-2",
                  shown ? "border-slate-700" : "border-slate-300",
                )}
              >
                {shown ? (
                  <>
                    <span className="absolute left-1 top-0.5 text-[8px] font-bold uppercase tracking-wide text-fuchsia-700">
                      {entry.status === "demo_applied" ? "Demo signature — not valid" : "Signed by"}
                    </span>
                    <SignaturePreview capture={capture!} />
                    {entry.signedAt && (
                      <span className="absolute bottom-0.5 right-1 text-[8px] text-slate-500">
                        {entry.status === "demo_applied" && "DEMO "}
                        {formatSignatureDate(entry.signedAt)} {timeOf(entry.signedAt)}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-[11px] text-slate-400">
                    {label} {mark}
                  </span>
                )}
              </div>
              <div className="w-24 shrink-0 text-right">
                <p className="min-h-5 border-b border-slate-500 pb-0.5 text-sm tabular-nums">
                  {shown && entry.signedAt ? formatSignatureDate(entry.signedAt) : " "}
                </p>
                <p className="text-[10px] text-slate-500">Date</p>
              </div>
            </div>
            <div className="mt-0.5 flex items-baseline justify-between gap-2 pl-5 pr-[6.5rem] text-xs">
              {entry.printedName ? (
                <span className="truncate font-semibold">{entry.printedName}</span>
              ) : (
                <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                  <CircleAlert className="size-3" aria-hidden="true" /> {label} name missing
                </span>
              )}
              <span className="shrink-0 text-slate-500">{label}</span>
            </div>
            <p
              className={cn(
                "pl-5 text-[10px] font-semibold",
                entry.status === "awaiting" ? "text-slate-400" : "text-fuchsia-700",
              )}
            >
              Status: {STATUS_TEXT[entry.status]}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
