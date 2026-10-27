import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buildSocialStatuses, SOCIAL_METRIC_KINDS } from "@/lib/marketing-social";
import {
  EMPTY_FILTERS,
  METRIC_DEFINITIONS,
  buildChannelReport,
  presetRange,
  type ChannelReport,
  type ReportFilters,
  type TouchKind,
} from "@/lib/marketing-channel-report";
import { DEALERSHIP_TIMEZONE, type GoalLead } from "@/lib/marketing-lead-goal";

const pct = (n: number | null) => (n === null ? "Not available" : `${(n * 100).toFixed(1)}%`);

function Bars({ rows, empty }: { rows: Array<{ label: string; count: number }>; empty: string }) {
  if (!rows.length) return <p className="text-xs text-muted-foreground">{empty}</p>;
  const top = Math.max(...rows.map((r) => r.count));
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label} className="text-xs">
          <div className="flex justify-between gap-2">
            <span className="truncate">{r.label}</span>
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

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-background p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Social channels                                                             */
/* -------------------------------------------------------------------------- */

export function SocialDashboard({ leads, loading }: { leads: GoalLead[] | null; loading: boolean }) {
  const report = useMemo(() => {
    if (!leads) return null;
    const range = presetRange(30);
    return buildChannelReport(leads, { ...EMPTY_FILTERS, ...range });
  }, [leads]);
  const statuses = useMemo(() => buildSocialStatuses(report?.bySource.map((r) => ({ source: r.label, count: r.count })) ?? []), [report]);

  return (
    <div className="space-y-6 py-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {statuses.map((s) => (
          <section key={s.platform.id} className="rounded-lg border border-border bg-background p-4">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold">{s.platform.name}</h3>
              <Badge variant="outline">{s.connection}</Badge>
            </div>
            <dl className="mt-3 space-y-1.5 text-xs">
              <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Last verified</dt><dd>Never connected</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Analytics</dt><dd>{s.analytics}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Campaigns</dt><dd>{s.campaigns}</dd></div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Website leads naming this source (30 days)</dt>
                <dd className="font-semibold">{loading ? "…" : leads ? s.leadsAttributed : "No Data"}</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs">
              <span className="font-semibold">Action required:</span> {s.platform.action}
            </p>
            <details className="mt-3 text-xs">
              <summary className="cursor-pointer font-medium">Connection details</summary>
              <dl className="mt-2 space-y-1.5 text-muted-foreground">
                {(
                  [
                    ["Exists today", s.platform.existing],
                    ["API", s.platform.api],
                    ["Permissions", s.platform.permissions],
                    ["Authentication", s.platform.authentication],
                    ["Token renewal", s.platform.tokenRenewal],
                    ["Metrics", s.platform.metrics],
                    ["Lead data", s.platform.leadData],
                    ["Limits", s.platform.limitations],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k}>
                    <dt className="font-semibold text-foreground">{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-2 text-[11px] text-muted-foreground">API notes are planning information; check each platform&apos;s current documentation before building.</p>
            </details>
          </section>
        ))}
      </div>

      <Card title="Different kinds of social data are kept apart">
        <ul className="divide-y divide-border text-xs">
          {SOCIAL_METRIC_KINDS.map((m) => (
            <li key={m.kind} className="flex flex-wrap justify-between gap-2 py-2">
              <span className="font-medium">{m.kind}</span>
              <span className="text-muted-foreground">{m.status}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Facebook campaign analysis">
        <p className="text-sm font-semibold">Not Connected</p>
        <p className="mt-1 text-xs text-muted-foreground">
          No Meta ad account is connected and no Facebook marketing agent exists in this application, so no spend, cost per lead, CTR, CPC or CPM is shown.
          Once a read-only connection is approved, this section can show campaign summaries and evidence-backed suggestions.
        </p>
        <p className="mt-3 text-xs font-semibold">Actions that would always need a person&apos;s approval first</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Pause or resume a campaign, change a budget, edit creative, create a draft, publish changes. Each would show the exact change, check the approver&apos;s
          permission, read the current state again, be written to an audit log and state how to undo it. Nothing here can run any of them.
        </p>
      </Card>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Lead source and conversion report                                           */
/* -------------------------------------------------------------------------- */

export function ChannelReportPanel({ leads, loading }: { leads: GoalLead[] | null; loading: boolean }) {
  const [filters, setFilters] = useState<ReportFilters>({ ...EMPTY_FILTERS, ...presetRange(30) });
  const [error, setError] = useState<string | null>(null);
  const unfiltered = useMemo(() => (leads ? buildChannelReport(leads, { ...EMPTY_FILTERS, touch: filters.touch, from: filters.from, to: filters.to }) : null), [leads, filters.touch, filters.from, filters.to]);
  const report: ChannelReport | null = useMemo(() => (leads ? buildChannelReport(leads, filters) : null), [leads, filters]);
  const set = (patch: Partial<ReportFilters>) => setFilters((f) => ({ ...f, ...patch }));

  function setDates(from: string | null, to: string | null) {
    if (from && to && from > to) {
      setError("The start date is after the end date.");
      return;
    }
    setError(null);
    set({ from, to });
  }

  if (loading) return <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Loading saved lead records…</div>;
  if (!leads || !report) return <div role="alert" className="border-l-2 border-destructive bg-background p-4 text-sm">Lead records could not be loaded. No figures are shown.</div>;

  const select = (label: string, value: string | null, options: string[], onChange: (v: string | null) => void) => (
    <label className="text-xs">
      <span className="mb-1 block font-medium">{label}</span>
      <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">All</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="space-y-6 py-5">
      <div className="rounded-lg border border-border bg-background p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <label className="text-xs">
            <span className="mb-1 block font-medium">From</span>
            <Input type="date" value={filters.from ?? ""} onChange={(e) => setDates(e.target.value || null, filters.to)} />
          </label>
          <label className="text-xs">
            <span className="mb-1 block font-medium">To</span>
            <Input type="date" value={filters.to ?? ""} onChange={(e) => setDates(filters.from, e.target.value || null)} />
          </label>
          {select("Channel", filters.channel, unfiltered?.options.channels ?? [], (channel) => set({ channel }))}
          {select("Source", filters.source, unfiltered?.options.sources ?? [], (source) => set({ source }))}
          {select("Campaign", filters.campaign, unfiltered?.options.campaigns ?? [], (campaign) => set({ campaign }))}
          <label className="text-xs">
            <span className="mb-1 block font-medium">Touch</span>
            <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={filters.touch} onChange={(e) => set({ touch: e.target.value as TouchKind })}>
              <option value="last">Last touch</option>
              <option value="first">First touch</option>
            </select>
          </label>
          <div className="flex items-end gap-2">
            {[7, 30, 90].map((d) => (
              <Button key={d} variant="outline" size="sm" onClick={() => { setError(null); set({ ...presetRange(d) }); }}>{d}d</Button>
            ))}
            <Button variant="ghost" size="sm" onClick={() => { setError(null); setFilters({ ...EMPTY_FILTERS, touch: filters.touch }); }}>All time</Button>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Dates are {DEALERSHIP_TIMEZONE} days. Source and campaign options list only values that appear in the saved leads.</p>
        {error && <p role="alert" className="mt-2 text-xs text-destructive">{error}</p>}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card title="Leads"><p className="font-display text-3xl font-bold">{report.leads}</p><p className="mt-1 text-xs text-muted-foreground">{report.records} records · {report.duplicates} repeats · {report.invalid} unusable</p></Card>
        <Card title="Appointment requests"><p className="font-display text-3xl font-bold">{report.appointmentRequests}</p><p className="mt-1 text-xs text-muted-foreground">{pct(report.appointmentRequestRate)} of leads. Requests, not confirmed.</p></Card>
        <Card title="Confirmed appointments / sales"><p className="font-display text-xl font-bold text-muted-foreground">{report.confirmedAppointments.status === "available" ? report.confirmedAppointments.count : "Not linked here"}</p><p className="mt-1 text-xs text-muted-foreground">Verified outcomes are in Where Leads Come From. Never inferred from a request.</p></Card>
        <Card title="Qualified leads"><p className="font-display text-xl font-bold text-muted-foreground">Not reported</p><p className="mt-1 text-xs text-muted-foreground">Criteria not approved.</p></Card>
      </div>

      {report.leads === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No leads match these filters.</div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title={`By channel (${filters.touch} touch)`}><Bars rows={report.byChannel} empty="None" /></Card>
          <Card title={`By source (${filters.touch} touch)`}><Bars rows={report.bySource} empty="None" /></Card>
          <Card title={`By campaign (${filters.touch} touch)`}><Bars rows={report.byCampaign} empty="None" /></Card>
          <Card title="By inquiry type"><Bars rows={report.byInquiry} empty="None" /></Card>
        </div>
      )}

      <Card title="What the numbers mean">
        <dl className="space-y-2 text-xs">
          {METRIC_DEFINITIONS.map((d) => (
            <div key={d.name}><dt className="font-semibold">{d.name}</dt><dd className="text-muted-foreground">{d.meaning}</dd></div>
          ))}
        </dl>
      </Card>
    </div>
  );
}
