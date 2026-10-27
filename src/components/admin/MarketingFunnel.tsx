import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowDown, ArrowUpRight, CheckCircle2, CircleHelp, Copy, Download, Loader2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FUNNEL_STAGES,
  HEALTH_LABELS,
  stageCoverage,
  stageState,
  type FunnelStage,
  type HealthItem,
  type HealthState,
} from "@/lib/marketing-health";
import { DAILY_GOAL, type LeadGoalReport } from "@/lib/marketing-lead-goal";

const STATE_STYLE: Record<HealthState, { icon: typeof CheckCircle2; box: string }> = {
  green: { icon: CheckCircle2, box: "border-emerald-600/40 bg-emerald-600/10 text-emerald-800 dark:text-emerald-300" },
  yellow: { icon: AlertTriangle, box: "border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-300" },
  red: { icon: XCircle, box: "border-red-600/40 bg-red-600/10 text-red-800 dark:text-red-300" },
  gray: { icon: CircleHelp, box: "border-border bg-muted text-muted-foreground" },
};

/** Colour is never the only signal: every state has an icon and a text label. */
export function HealthBadge({ state }: { state: HealthState }) {
  const { icon: Icon, box } = STATE_STYLE[state];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${box}`}>
      <Icon className="size-3.5" aria-hidden="true" />
      {HEALTH_LABELS[state]}
    </span>
  );
}

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : "No check recorded");

function ItemLink({ link, onOpenTab }: { link: { label: string; tab?: string | undefined; to?: string | undefined }; onOpenTab: (tab: string) => void }) {
  if (link.tab) {
    return (
      <Button variant="link" size="sm" className="h-auto p-0" onClick={() => onOpenTab(link.tab!)}>
        {link.label}
        <ArrowUpRight className="size-3.5" />
      </Button>
    );
  }
  if (link.to) {
    return (
      <Button asChild variant="link" size="sm" className="h-auto p-0">
        <Link to={link.to as "/admin/customers"}>
          {link.label}
          <ArrowUpRight className="size-3.5" />
        </Link>
      </Button>
    );
  }
  return null;
}

/** A plain-text brief of every item that is not green. It contains no customer data, keys or URLs. */
export function buildDiagnosticBrief(items: HealthItem[], generatedAt: string): string {
  const open = items.filter((i) => i.state !== "green");
  const lines = [
    `MyCarCorp marketing health brief (${generatedAt})`,
    "Rules: propose a plan and code changes for review only. Do not change production settings, GoHighLevel workflows,",
    "ad budgets or credentials, do not retry webhook deliveries, delete contacts or deploy.",
    "",
  ];
  if (!open.length) lines.push("No warnings, failures or unknowns were reported.");
  for (const i of open) {
    lines.push(`- [${HEALTH_LABELS[i.state].toUpperCase()}] ${i.name}: ${i.reason} (evidence: ${i.verifiedAt ?? "none"}) Suggested next step: ${i.action}`);
  }
  return lines.join("\n");
}

function AgentPanel({ items }: { items: HealthItem[] }) {
  const [copied, setCopied] = useState(false);
  const brief = buildDiagnosticBrief(items, new Date().toISOString());
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Agent-assisted troubleshooting</h3>
        <Badge variant="outline">Agent not connected</Badge>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        No AI agent is connected to this dashboard, so it shows no automated answers. Copy the brief below into a Claude Code
        session to get an explanation, likely causes and a fix plan for review. The brief tells the agent not to change
        production settings, workflows, ad budgets or credentials, not to retry deliveries, delete contacts or deploy.
      </p>
      <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">{brief}</pre>
      <Button
        variant="outline"
        size="sm"
        className="mt-3"
        onClick={() => {
          void navigator.clipboard?.writeText(brief).then(() => setCopied(true)).catch(() => setCopied(false));
        }}
      >
        <Copy className="size-3.5" />
        {copied ? "Copied" : "Copy brief"}
      </Button>
    </div>
  );
}

export function FunnelMonitor({ items, onOpenTab }: { items: HealthItem[]; onOpenTab: (tab: string) => void }) {
  const [selected, setSelected] = useState<string>(FUNNEL_STAGES[0]!.id);
  const stage = FUNNEL_STAGES.find((s) => s.id === selected) as FunnelStage;
  const stageItems = items.filter((i) => stage.healthIds.includes(i.id));

  return (
    <div className="space-y-6 py-5">
      <ol className="flex flex-col items-stretch gap-1 lg:flex-row lg:items-stretch" aria-label="Marketing funnel stages">
        {FUNNEL_STAGES.map((s, index) => {
          const state = stageState(s, items);
          const active = s.id === selected;
          return (
            <li key={s.id} className="flex flex-1 flex-col items-stretch lg:flex-row lg:items-center">
              <button
                type="button"
                onClick={() => setSelected(s.id)}
                aria-pressed={active}
                className={`flex h-full min-h-28 w-full flex-1 flex-col gap-2 rounded-lg border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  active ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-background hover:border-primary/40"
                }`}
              >
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Stage {index + 1}</span>
                <span className="text-sm font-semibold">{s.title}</span>
                <HealthBadge state={state} />
                <span className="text-[11px] text-muted-foreground">{stageCoverage(s)}</span>
              </button>
              {index < FUNNEL_STAGES.length - 1 && (
                <span className="flex items-center justify-center py-1 text-muted-foreground lg:px-1 lg:py-0" aria-hidden="true">
                  <ArrowDown className="size-4 lg:-rotate-90" />
                </span>
              )}
            </li>
          );
        })}
      </ol>

      <section className="rounded-lg border border-border bg-background p-4" aria-live="polite">
        <h2 className="font-display text-lg font-bold">{stage.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{stage.summary}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {stage.items.map((label) => (
            <Badge key={label} variant="secondary">
              {label}
            </Badge>
          ))}
        </div>

        {stage.notVerified.length > 0 && (
          <div className="mt-4 rounded-md border border-dashed border-border p-3">
            <p className="text-xs font-semibold">Not verified from this dashboard</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
              {stage.notVerified.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        )}

        {stageItems.length > 0 && (
          <div className="mt-4 divide-y divide-border border-y border-border">
            {stageItems.map((i) => (
              <div key={i.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{i.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{i.reason}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Last verified: {when(i.verifiedAt)}</p>
                  <p className="mt-1 text-xs">
                    <span className="font-semibold">Next step:</span> {i.action}
                  </p>
                </div>
                <HealthBadge state={i.state} />
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-4">
          {stage.links.map((link) => (
            <ItemLink key={link.label} link={link} onOpenTab={onOpenTab} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-display text-lg font-bold">All health checks</h2>
        <div className="mt-3 divide-y divide-border border-y border-border">
          {items.map((i) => (
            <div key={i.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{i.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{i.reason}</p>
                <p className="mt-1 text-xs text-muted-foreground">Last verified: {when(i.verifiedAt)}</p>
                <p className="mt-1 text-xs">
                  <span className="font-semibold">Recommended action:</span> {i.action}
                </p>
                <div className="mt-1">
                  <ItemLink link={{ label: "Open related screen", tab: i.tab, to: i.to }} onOpenTab={onOpenTab} />
                </div>
              </div>
              <HealthBadge state={i.state} />
            </div>
          ))}
        </div>
      </section>

      <AgentPanel items={items} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Daily lead goal                                                             */
/* -------------------------------------------------------------------------- */

function Bars({ values, label, max }: { values: Array<{ key: string; value: number; title: string }>; label: string; max: number }) {
  const top = Math.max(1, max, ...values.map((v) => v.value));
  return (
    <div role="img" aria-label={label} className="flex h-24 items-end gap-0.5">
      {values.map((v) => (
        <div key={v.key} title={v.title} className="flex h-full min-w-1 flex-1 items-end">
          <div className="w-full rounded-t bg-primary/70" style={{ height: `${v.value === 0 ? 2 : Math.max(6, (v.value / top) * 100)}%` }} />
        </div>
      ))}
    </div>
  );
}

function CountList({ rows, empty }: { rows: Array<{ label: string; count: number }>; empty: string }) {
  if (!rows.length) return <p className="text-xs text-muted-foreground">{empty}</p>;
  const top = Math.max(...rows.map((r) => r.count));
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label} className="text-xs">
          <div className="flex justify-between gap-2">
            <span>{r.label}</span>
            <span className="font-semibold">{r.count}</span>
          </div>
          <div className="mt-1 h-1.5 rounded bg-muted">
            <div className="h-1.5 rounded bg-primary/70" style={{ width: `${(r.count / top) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

const PROGRESS_TEXT = { below: "Below the daily goal", within: "Within the daily goal", above: "Above the daily goal" } as const;

export function LeadGoalPanel({
  report,
  loading,
  error,
  canExport,
  onExport,
}: {
  report: LeadGoalReport | null;
  loading: boolean;
  error: string | null;
  canExport: boolean;
  onExport: () => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading saved lead records…
      </div>
    );
  }
  if (error || !report) {
    return (
      <div role="alert" className="border-l-2 border-destructive bg-background p-4 text-sm">
        Lead records could not be loaded{error ? `: ${error}` : "."} No lead figures are shown.
      </div>
    );
  }

  const p = report.workableProgress;
  return (
    <div className="space-y-6 py-5">
      <div className="rounded-lg border border-border bg-muted/40 p-4 text-xs text-muted-foreground">
        <p>
          <span className="font-semibold text-foreground">Target, not a result:</span> {DAILY_GOAL.min}–{DAILY_GOAL.max} workable leads per day. Days run
          midnight to midnight in <span className="font-semibold text-foreground">{report.timezone}</span> (assumed dealership time; confirm with
          management). Today is {report.today}; the trend starts {report.windowStart}.
        </p>
        <p className="mt-2">
          <span className="font-semibold text-foreground">Workable</span> = a usable email or phone, and not a repeat of the same person&apos;s same inquiry type
          within 24 hours. <span className="font-semibold text-foreground">Qualified</span> is not reported: {report.qualified.reason}
        </p>
      </div>

      {report.possiblyTruncated && (
        <div role="status" className="border-l-2 border-amber-500 bg-background p-3 text-xs">
          The record limit was reached, so the oldest days in this window may be incomplete.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-border bg-background p-4">
          <p className="text-xs text-muted-foreground">Leads today (all records)</p>
          <p className="mt-2 font-display text-3xl font-bold">{report.today_.total}</p>
          <p className="mt-1 text-xs text-muted-foreground">{report.today_.duplicate} repeat · {report.today_.invalid} without usable contact</p>
        </div>
        <div className="rounded-lg border border-border bg-background p-4">
          <p className="text-xs text-muted-foreground">Workable leads today</p>
          <p className="mt-2 font-display text-3xl font-bold">{p.workable}</p>
          <p className="mt-1 text-xs text-muted-foreground">Goal {p.goalMin}–{p.goalMax} per day</p>
        </div>
        <div className="rounded-lg border border-border bg-background p-4">
          <p className="text-xs text-muted-foreground">Qualified leads today</p>
          <p className="mt-2 font-display text-xl font-bold text-muted-foreground">Not reported</p>
          <p className="mt-1 text-xs text-muted-foreground">Criteria not approved. Staff-engaged today: {report.today_.staffEngaged}</p>
        </div>
        <div className="rounded-lg border border-border bg-background p-4">
          <p className="text-xs text-muted-foreground">Appointment requests ({report.windowDays} days)</p>
          <p className="mt-2 font-display text-3xl font-bold">{report.appointmentRequests}</p>
          <p className="mt-1 text-xs text-muted-foreground">Requests, not confirmed appointments</p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-background p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="font-semibold">Progress toward today&apos;s minimum</span>
          <span>
            {PROGRESS_TEXT[p.status]} · {p.workable} of {p.goalMin}
          </span>
        </div>
        <div className="mt-2 h-2 rounded bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={p.goalMin} aria-valuenow={Math.min(p.workable, p.goalMin)} aria-label="Workable leads today versus daily minimum">
          <div className="h-2 rounded bg-primary" style={{ width: `${p.percentOfMinimum}%` }} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-background p-4">
          <h3 className="text-sm font-semibold">Daily workable leads, last {report.windowDays} days</h3>
          <div className="mt-3">
            <Bars
              label={`Daily workable leads from ${report.windowStart} to ${report.today}`}
              max={DAILY_GOAL.min}
              values={report.daily.map((d) => ({ key: d.date, value: d.workable, title: `${d.date}: ${d.workable} workable of ${d.total}` }))}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Zero-lead days are shown. Hover a bar for the exact count.</p>
        </section>
        <section className="rounded-lg border border-border bg-background p-4">
          <h3 className="text-sm font-semibold">Weekly and monthly workable leads</h3>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold">By week (starting Monday)</p>
              <ul className="mt-1 space-y-1 text-xs">
                {report.weekly.map((w) => (
                  <li key={w.weekStart} className="flex justify-between">
                    <span>{w.weekStart}</span>
                    <span>{w.workable} of {w.total}</span>
                  </li>
                ))}
                {!report.weekly.length && <li className="text-muted-foreground">No leads in this window.</li>}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold">By month</p>
              <ul className="mt-1 space-y-1 text-xs">
                {report.monthly.map((m) => (
                  <li key={m.month} className="flex justify-between">
                    <span>{m.month}</span>
                    <span>{m.workable} of {m.total}</span>
                  </li>
                ))}
                {!report.monthly.length && <li className="text-muted-foreground">No leads in this window.</li>}
              </ul>
            </div>
          </div>
        </section>
        <section className="rounded-lg border border-border bg-background p-4">
          <h3 className="text-sm font-semibold">Workable leads by source (last touch)</h3>
          <div className="mt-3">
            <CountList rows={report.bySource} empty="No workable leads in this window." />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            “Not tracked” are leads saved before channel tracking. These are website lead records, not Search Console clicks or GA4 sessions.
          </p>
        </section>
        <section className="rounded-lg border border-border bg-background p-4">
          <h3 className="text-sm font-semibold">Workable leads by inquiry type</h3>
          <div className="mt-3">
            <CountList rows={report.byInquiry} empty="No workable leads in this window." />
          </div>
        </section>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background p-4">
        <div className="min-w-0 text-xs text-muted-foreground">
          <p className="font-semibold text-foreground">Export leads (CSV)</p>
          <p className="mt-1">
            Staff only. Includes received time, inquiry type, channel, category, name, email, phone and status. It never includes messages, stored details or
            delivery diagnostics. Handle it as customer information.
          </p>
        </div>
        <Button variant="outline" size="sm" disabled={!canExport || report.total === 0} onClick={onExport}>
          <Download className="size-3.5" />
          Export CSV
        </Button>
      </div>
    </div>
  );
}
