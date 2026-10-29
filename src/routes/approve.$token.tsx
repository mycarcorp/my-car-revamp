import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Loader2, Phone, X } from "lucide-react";
import { getApproval, respondApproval, type PublicApproval } from "@/lib/approvals.functions";
import { PRIORITY_LABEL, approvedTotal, type ApprovalItem, type Decision } from "@/lib/approvals";
import { formatUsd, formatMiles, formatDate } from "@/lib/format";

export const Route = createFileRoute("/approve/$token")({
  head: () => ({
    meta: [
      { title: "Review your repair — My Car Care" },
      { name: "robots", content: "noindex,nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: ApprovePage,
});

const DOT: Record<ApprovalItem["priority"], string> = {
  safety: "bg-[#ff3b30]",
  recommended: "bg-[#ff9500]",
  later: "bg-[#8e8e93]",
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] antialiased">
      <div className="mx-auto max-w-[720px] px-5 pb-40 pt-10 sm:pt-16">{children}</div>
    </div>
  );
}

function Media({ m }: { m: PublicApproval["media"][number] }) {
  return m.type.startsWith("video/") ? (
    <video src={m.url} controls playsInline preload="metadata" className="aspect-[4/3] w-full rounded-xl bg-black object-cover" />
  ) : (
    <a href={m.url} target="_blank" rel="noopener noreferrer">
      <img src={m.url} alt="" loading="lazy" className="aspect-[4/3] w-full rounded-xl bg-[#e8e8ed] object-cover" />
    </a>
  );
}

function Segmented({ value, onChange, disabled }: { value?: Decision; onChange: (d: Decision) => void; disabled?: boolean }) {
  const opt = (d: Decision, label: string, Icon: typeof Check) => (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={value === d}
      onClick={() => onChange(d)}
      className={`flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full text-[14px] font-medium transition ${
        value === d
          ? d === "approved"
            ? "bg-[#0071e3] text-white shadow-sm"
            : "bg-white text-[#1d1d1f] shadow-sm"
          : "text-[#6e6e73] hover:text-[#1d1d1f]"
      }`}
    >
      <Icon className="h-4 w-4" aria-hidden /> {label}
    </button>
  );
  return (
    <div className="flex w-full gap-1 rounded-full bg-[#e8e8ed] p-1 sm:w-64" role="group">
      {opt("approved", "Approve", Check)}
      {opt("declined", "Decline", X)}
    </div>
  );
}

function ApprovePage() {
  const { token } = Route.useParams();
  const q = useQuery({
    queryKey: ["approval", token],
    queryFn: () => getApproval({ data: { token } }),
    retry: false,
  });
  const [choices, setChoices] = useState<Record<string, Decision>>({});
  const [name, setName] = useState("");
  const send = useMutation({
    mutationFn: () => respondApproval({ data: { token, decisions: choices, signedName: name } }),
  });

  const a = send.data ?? q.data;
  const items = a?.items ?? [];
  const done = a?.status === "responded";
  const decisions = done ? a!.decisions : choices;
  const total = useMemo(() => approvedTotal(items, decisions), [items, decisions]);
  const decided = items.filter((i) => decisions[i.id]).length;

  if (q.isLoading)
    return (
      <Shell>
        <div className="flex justify-center pt-24 text-[#6e6e73]">
          <Loader2 className="h-6 w-6 animate-spin" aria-label="Loading" />
        </div>
      </Shell>
    );
  if (!a || q.isError)
    return (
      <Shell>
        <h1 className="text-[32px] font-semibold tracking-tight">This link isn’t available.</h1>
        <p className="mt-3 text-[17px] text-[#6e6e73]">It may have been replaced by a newer estimate. Please call the shop.</p>
      </Shell>
    );

  const general = a.media.filter((m) => !m.item);
  const shopCall = a.shopPhone ? (
    <a href={`tel:${a.shopPhone.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-1.5 text-[15px] text-[#0071e3] hover:underline">
      <Phone className="h-4 w-4" aria-hidden /> Questions? Call {a.shopPhone}
    </a>
  ) : null;

  return (
    <Shell>
      <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#6e6e73]">My Car Care · RO {a.roNo}</p>
      <h1 className="mt-2 text-[34px] font-semibold leading-[1.1] tracking-tight sm:text-[44px]">
        {done ? "Thank you" : "Your estimate is ready"}
        {a.customerFirstName ? `, ${a.customerFirstName}.` : "."}
      </h1>
      <p className="mt-3 text-[19px] leading-snug text-[#6e6e73]">
        {a.vehicle}
        {a.miles ? ` · ${formatMiles(a.miles)}` : ""}
        {a.advisor ? ` · Service advisor ${a.advisor}` : ""}
      </p>
      {done ? (
        <p className="mt-6 rounded-2xl bg-white p-5 text-[17px] shadow-sm">
          Signed by <b>{a.signedName}</b>
          {a.respondedAt ? ` on ${formatDate(a.respondedAt)}` : ""}. We’ll start on the approved work and text you when your car is ready.
        </p>
      ) : a.expired ? (
        <p className="mt-6 rounded-2xl bg-white p-5 text-[17px] shadow-sm">This estimate has expired. Please call the shop for an updated price.</p>
      ) : (
        <p className="mt-6 text-[17px] leading-relaxed">
          We inspected your car and found the items below. Look at the photos, then approve or decline each one. Nothing is done without your OK.
        </p>
      )}
      {a.notes && <p className="mt-4 text-[17px] leading-relaxed text-[#424245]">{a.notes}</p>}
      {shopCall && <div className="mt-4">{shopCall}</div>}

      {general.length > 0 && (
        <section className="mt-10">
          <h2 className="text-[21px] font-semibold tracking-tight">Inspection photos</h2>
          <div className="mt-4 grid grid-cols-2 gap-3">{general.map((m) => <Media key={m.n} m={m} />)}</div>
        </section>
      )}

      <section className="mt-10 space-y-4">
        {items.map((it) => {
          const media = a.media.filter((m) => m.item === it.id);
          return (
            <article key={it.id} className="rounded-2xl bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center gap-2 text-[13px] font-medium text-[#6e6e73]">
                <span className={`h-2 w-2 rounded-full ${DOT[it.priority]}`} aria-hidden /> {PRIORITY_LABEL[it.priority]}
              </div>
              <div className="mt-2 flex items-start justify-between gap-4">
                <h3 className="text-[21px] font-semibold leading-tight tracking-tight">{it.title}</h3>
                <p className="shrink-0 text-[21px] font-semibold tabular-nums">{formatUsd(it.price_cents, { cents: it.price_cents % 100 !== 0 })}</p>
              </div>
              {it.detail && <p className="mt-2 text-[17px] leading-relaxed text-[#424245]">{it.detail}</p>}
              {media.length > 0 && <div className="mt-4 grid grid-cols-2 gap-3">{media.map((m) => <Media key={m.n} m={m} />)}</div>}
              <div className="mt-5">
                {done ? (
                  <p className={`text-[15px] font-medium ${decisions[it.id] === "approved" ? "text-[#0071e3]" : "text-[#6e6e73]"}`}>
                    {decisions[it.id] === "approved" ? "Approved" : "Declined"}
                  </p>
                ) : (
                  <Segmented value={choices[it.id]} disabled={a.expired} onChange={(d) => setChoices((c) => ({ ...c, [it.id]: d }))} />
                )}
              </div>
            </article>
          );
        })}
      </section>

      {!done && !a.expired && (
        <section className="mt-10 rounded-2xl bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-[21px] font-semibold tracking-tight">Sign to confirm</h2>
          <p className="mt-1 text-[15px] text-[#6e6e73]">Typing your name works as your signature for the approved items.</p>
          <label className="mt-4 block">
            <span className="sr-only">Full name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              placeholder="Full name"
              className="h-12 w-full rounded-xl border border-[#d2d2d7] bg-white px-4 text-[17px] outline-none focus:border-[#0071e3] focus:ring-4 focus:ring-[#0071e3]/15"
            />
          </label>
          {send.error && <p className="mt-3 text-[15px] text-[#d70015]">{(send.error as Error).message}</p>}
        </section>
      )}

      <div className="fixed inset-x-0 bottom-0 border-t border-black/5 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[720px] items-center justify-between gap-4 px-5 py-4" style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}>
          <div>
            <p className="text-[13px] text-[#6e6e73]">{done ? "Approved total" : `Approved · ${decided} of ${items.length} decided`}</p>
            <p className="text-[24px] font-semibold tabular-nums tracking-tight">{formatUsd(total, { cents: total % 100 !== 0 })}</p>
          </div>
          {!done && !a.expired && (
            <button
              type="button"
              disabled={decided < items.length || name.trim().length < 2 || send.isPending}
              onClick={() => send.mutate()}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-[#0071e3] px-6 text-[17px] font-medium text-white transition hover:bg-[#0077ed] disabled:bg-[#0071e3]/35"
            >
              {send.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {decided < items.length ? "Decide every item" : name.trim().length < 2 ? "Sign to send" : "Send to shop"}
            </button>
          )}
        </div>
      </div>
      <p className="mt-10 text-center text-[12px] text-[#86868b]">Prices include parts and labor. Tax and shop supplies may apply. Estimate valid 14 days.</p>
    </Shell>
  );
}
