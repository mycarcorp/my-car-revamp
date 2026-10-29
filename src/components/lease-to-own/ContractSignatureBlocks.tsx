import { CircleAlert, CircleCheck, Clock } from "lucide-react";

import {
  SIGNER_ROLE_LABELS,
  type ContractSignatureSlot,
  type SignatureCapture,
} from "@/lib/contract-signatures";
import { cn } from "@/lib/utils";

export type SignatureBlockStatus = "awaiting" | "demo_applied" | "signed";

export type SignatureBlockEntry = {
  slot: ContractSignatureSlot;
  /** From the application or dealer record; null shows a missing-information state. */
  printedName: string | null;
  organization?: string | null;
  status: SignatureBlockStatus;
  /** Shown only for this slot's own signer. */
  capture?: SignatureCapture | null;
  date?: string | null;
};

const STATUS_TEXT: Record<SignatureBlockStatus, string> = {
  awaiting: "Awaiting signature",
  demo_applied: "Demo signature shown — not legally signed",
  signed: "Signed (verified by provider)",
};

/** Small, non-editable picture of a captured signature. */
export function SignaturePreview({ capture }: { capture: SignatureCapture }) {
  if (capture.kind === "script")
    return (
      <span
        className="truncate text-2xl italic leading-none text-[#10385d]"
        style={{ fontFamily: '"Brush Script MT", "Segoe Script", cursive' }}
      >
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
          stroke="#10385d"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}

/**
 * Labeled signature locations ("X" box, printed name, date, status), laid out
 * like the reference document. Each box shows only its own signer's signature.
 */
export function ContractSignatureBlocks({
  title,
  entries,
}: {
  title: string;
  entries: SignatureBlockEntry[];
}) {
  return (
    <div className="rounded-lg border border-slate-200 p-3 text-xs">
      <p className="font-bold text-slate-800">{title}</p>
      <ul className="mt-2 space-y-3">
        {entries.map((entry) => {
          const label = SIGNER_ROLE_LABELS[entry.slot.role];
          return (
            <li key={entry.slot.id} data-signature-slot={entry.slot.id} data-role={entry.slot.role}>
              <div className="flex items-end gap-2">
                <span aria-hidden="true" className="pb-1 font-bold text-slate-700">
                  X
                </span>
                <div
                  className={cn(
                    "relative flex h-14 min-w-0 flex-1 items-center justify-center overflow-hidden rounded border bg-white px-2",
                    entry.status === "awaiting"
                      ? "border-dashed border-slate-300"
                      : "border-slate-500",
                  )}
                  role="img"
                  aria-label={`${label} signature box: ${STATUS_TEXT[entry.status]}`}
                >
                  {entry.capture && entry.status !== "awaiting" ? (
                    <>
                      {entry.status === "demo_applied" && (
                        <span className="absolute left-1 top-0.5 text-[8px] font-bold uppercase tracking-wide text-fuchsia-700">
                          Demo signature — not valid
                        </span>
                      )}
                      <SignaturePreview capture={entry.capture} />
                    </>
                  ) : (
                    <span className="text-[10px] text-slate-400">{label} signs here</span>
                  )}
                </div>
                <div className="w-20 shrink-0 text-right">
                  <p className="border-b border-slate-400 pb-0.5 font-mono text-[11px]">
                    {entry.date ?? " "}
                  </p>
                  <p className="text-[10px] text-slate-500">Date</p>
                </div>
              </div>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-2 pl-4">
                <p>
                  {entry.printedName ? (
                    <strong className="text-slate-900">{entry.printedName}</strong>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                      <CircleAlert className="size-3" aria-hidden="true" /> {label} name missing
                    </span>
                  )}{" "}
                  <span className="text-slate-500">· {label}</span>
                  {entry.organization && (
                    <span className="block text-slate-600">{entry.organization}</span>
                  )}
                </p>
                <p
                  className={cn(
                    "inline-flex items-center gap-1 font-semibold",
                    entry.status === "awaiting" ? "text-slate-500" : "text-fuchsia-700",
                    entry.status === "signed" && "text-emerald-700",
                  )}
                >
                  {entry.status === "awaiting" ? (
                    <Clock className="size-3" aria-hidden="true" />
                  ) : (
                    <CircleCheck className="size-3" aria-hidden="true" />
                  )}
                  {STATUS_TEXT[entry.status]}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
