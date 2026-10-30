import { useState } from "react";
import { Clock } from "lucide-react";

import { formatSignatureDate, type SignerRole } from "@/lib/contract-signatures";
import type { DemoInitial } from "@/lib/demo-signatures";

const SCRIPT_STYLE = {
  fontFamily: '"Brush Script MT", "Segoe Script", "Lucida Handwriting", cursive',
} as const;

/**
 * Initials box for one numbered acknowledgment (Form 4 provisions, Form 5
 * statements). Shows the signer's initials once given; otherwise an input only
 * for the signer who is acting, and "awaiting" for everyone else. Nothing is
 * pre-filled and one signer can never initial for another.
 */
export function AcknowledgmentInitials({
  noun,
  item,
  role,
  who,
  entry,
  acting,
  onInitial,
  onClear,
}: {
  /** "Provision" or "Statement" — used in labels. */
  noun: string;
  item: number;
  /** The signer this box belongs to. */
  role: SignerRole;
  /** Signer label on this form, e.g. "Borrower" or "Purchaser". */
  who: string;
  entry?: DemoInitial;
  /** The signer this box belongs to is the one acting in this session. */
  acting: boolean;
  onInitial?: (item: number, value: string) => string | undefined;
  onClear?: (item: number) => void;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const key = `${item}:${role}`;
  if (entry)
    return (
      <div data-initials={key} data-state="initialed" className="space-y-1">
        <div
          role="img"
          aria-label={`${noun} ${item} ${who} initials: ${entry.initials} (demo)`}
          className="flex h-10 items-center justify-center rounded border border-slate-700 text-xl text-[#0f2a4a]"
          style={SCRIPT_STYLE}
        >
          {entry.initials}
        </div>
        <p className="text-[9px] text-fuchsia-700">
          DEMO {formatSignatureDate(entry.at)} {new Date(entry.at).toTimeString().slice(0, 5)} — not
          legally signed
        </p>
        {acting && onClear && (
          <button
            type="button"
            onClick={() => onClear(item)}
            className="text-[10px] font-semibold text-slate-600 underline"
          >
            Clear initials
          </button>
        )}
      </div>
    );
  if (!acting)
    return (
      <p
        data-initials={key}
        data-state="awaiting"
        className="flex items-center gap-1 rounded border border-dashed border-slate-300 p-2 text-[10px] text-slate-500"
      >
        <Clock className="size-3 shrink-0" aria-hidden="true" /> Awaiting {who} initials
      </p>
    );
  return (
    <form
      data-initials={key}
      data-state="awaiting"
      className="space-y-1"
      onSubmit={(e) => {
        e.preventDefault();
        const err = onInitial?.(item, value) ?? null;
        setError(err);
        if (!err) setValue("");
      }}
    >
      <input
        aria-label={`${noun} ${item} ${who} initials`}
        value={value}
        maxLength={4}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Inits"
        className="w-full rounded border border-slate-300 px-2 py-1 text-center text-sm uppercase"
      />
      <button
        type="submit"
        className="w-full rounded bg-slate-900 px-2 py-1 text-[11px] font-bold text-white hover:bg-slate-700"
      >
        Initial {item}
      </button>
      {error && (
        <p role="alert" className="text-[10px] text-red-600">
          {error}
        </p>
      )}
    </form>
  );
}
