import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  FileText,
  Globe,
  Link2,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Users,
  Settings2,
  ClipboardList,
  Download,
  GitBranch,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { listLeads } from "@/lib/admin-leads.functions";
import { FunnelMonitor, HealthBadge, LeadGoalPanel } from "@/components/admin/MarketingFunnel";
import { ChannelReportPanel, SocialDashboard } from "@/components/admin/MarketingChannels";
import { ContentAgentPanel } from "@/components/admin/MarketingContentPlan";
import { computeHealth } from "@/lib/marketing-health";
import {
  DEALERSHIP_TIMEZONE,
  buildLeadExportCsv,
  buildLeadGoalReport,
  groupChannelRows,
} from "@/lib/marketing-lead-goal";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  getMarketing,
  getLeadAttribution,
  getMarketingGa4,
  getMarketingGa4Diagnostics,
  getMarketingGa4Realtime,
  inspectMarketingUrl,
  refreshMarketingFn,
  saveMarketingProspect,
  deleteMarketingProspect,
} from "@/lib/marketing.functions";
import {
  emptySnapshot,
  type MarketingSnapshot,
  type ServiceReport,
  type SearchRow,
  type SemrushTable,
  type ProspectInput,
  type Prospect,
  type LeadAttributionReport,
} from "@/lib/marketing";
import {
  GA4_SECTION_LABELS,
  formatGa4DateLabel,
  ga4ReportHasData,
  resolveGa4IntegrationStatus,
  type Ga4EventCount,
  type Ga4RangeInput,
  type Ga4Report,
  type Ga4RuntimeDiagnostics,
  type Ga4SectionKey,
} from "@/lib/ga4-reporting";
import { buildAttributionCsv, type AttributionRangeInput } from "@/lib/marketing-attribution";

export const Route = createFileRoute("/admin/marketing")({
  head: () => ({
    meta: [
      { title: "Marketing Automation — MyCar Admin" },
      {
        name: "description",
        content:
          "Private MyCar search monitoring, content automation, keyword research and backlink outreach.",
      },
      { property: "og:title", content: "Marketing Automation — MyCar Admin" },
      {
        property: "og:description",
        content: "MyCar marketing monitoring and integration management.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Marketing,
});
const TABS = [
  ["overview", "Overview", BarChart3],
  ["funnel", "Lead Journey", GitBranch],
  ["leadgoal", "Daily Leads", Users],
  ["channels", "Channel Report", BarChart3],
  ["social", "Social Channels", Globe],
  ["contentplan", "Content Plan", FileText],
  ["seo", "Search Performance", Activity],
  ["gsc", "Google Search", Search],
  ["inspection", "Check a Page on Google", Search],
  ["keywords", "Keyword Ideas", Globe],
  ["backlinks", "Links to Our Site", Link2],
  ["attribution", "Where Leads Come From", Users],
  ["analytics", "Website Visitors", BarChart3],
  ["content", "Blog Performance", FileText],
  ["health", "Website Health", CheckCircle2],
  ["reports", "Saved Reports", ClipboardList],
  ["integrations", "Connections", Settings2],
] as const;
const articleOrigin = (source: string) => (source === "AutoSEO" ? "Imported article" : "Editorial");
const GOAL_RECORD_LIMIT = 2000;
const date = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleString() : "Not checked";
const number = (value: number | null | undefined) => (value == null ? "—" : value.toLocaleString());
const blankProspect = (): ProspectInput => ({
  domain: "",
  status: "Researching",
  relevance: "",
  notes: "",
  backlinkUrl: "",
});

function Status({ report }: { report: ServiceReport }) {
  return (
    <Badge
      variant={report.state === "Error" ? "destructive" : "outline"}
      className={report.state === "Connected" ? "gap-1 border-border text-positive-text" : "gap-1"}
    >
      {report.state === "Connected" ? (
        <CheckCircle2 className="size-3" />
      ) : (
        <span className="size-1.5 rounded-full bg-current" />
      )}
      {report.state}
    </Badge>
  );
}
function Unavailable({ report, name }: { report: ServiceReport; name: string }) {
  if (report.state === "Connected") return null;
  return (
    <div role="status" className="mb-4 border-l-2 border-amber-500 bg-background p-3 text-xs">
      <p className="font-semibold">
        {name}: {report.state}
      </p>
      <p className="mt-1 text-muted-foreground">
        {report.state === "Not Connected"
          ? `${name} is not connected, so this section has no data. Nothing is estimated.`
          : "The last refresh failed. Rows shown, if any, come from the last saved report."}
      </p>
    </div>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-3 border-y border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground">
      <Search className="size-6" />
      {children}
    </div>
  );
}
function Section({
  title,
  subtitle,
  children,
  actions,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <section className="py-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-foreground">{title}</h2>
          {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
function Metric({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Search;
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        {label}
        <Icon className="size-4 text-primary" />
      </div>
      <div className="mt-3 font-display text-3xl font-bold text-foreground">{value}</div>
      <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}
function SearchTable({ rows, label }: { rows: SearchRow[]; label: string }) {
  return rows.length ? (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-y border-border bg-muted/40 text-xs text-muted-foreground">
          <tr>
            {[label, "Clicks", "Impressions", "CTR", "Avg. position"].map((v) => (
              <th key={v} className="px-3 py-3 font-medium">
                {v}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border">
              <td className="max-w-96 break-words px-3 py-3 font-medium">{r.keys?.[0]}</td>
              <td className="px-3">{number(r.clicks)}</td>
              <td className="px-3">{number(r.impressions)}</td>
              <td className="px-3">{(r.ctr * 100).toFixed(1)}%</td>
              <td className="px-3">{r.position.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty>No search rows in the saved report. Search Console can omit low-volume queries.</Empty>
  );
}
function CountTable({
  rows,
  label,
  field,
}: {
  rows: Array<{ count: number; [key: string]: string | number }>;
  label: string;
  field: string;
}) {
  return rows.length ? (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-y border-border bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-3 font-medium">{label}</th>
            <th className="px-3 py-3 font-medium">Recorded leads</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={String(row[field])} className="border-b border-border">
              <td className="max-w-xl break-words px-3 py-3 font-medium">{String(row[field])}</td>
              <td className="px-3">{number(row.count)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty>No lead rows in this report window.</Empty>
  );
}
function ProviderTable({ data }: { data?: SemrushTable }) {
  return data?.rows.length ? (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="border-y border-border bg-muted/40">
          <tr>
            {data.columnNames.map((v) => (
              <th key={v} className="whitespace-nowrap px-3 py-3 font-medium">
                {v === "ascore" || v === "page_ascore"
                  ? "Semrush Authority Score"
                  : v.replaceAll("_", " ")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, i) => (
            <tr key={i} className="border-b border-border">
              {row.map((v, j) => (
                <td key={j} className="max-w-80 break-words px-3 py-3">
                  {String(v ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty>
      No provider report is available. No estimated rankings or authority values have been added.
    </Empty>
  );
}

function Marketing() {
  const { user, isStaff, session } = useAuth();
  const client = useQueryClient();
  const get = useServerFn(getMarketing),
    refresh = useServerFn(refreshMarketingFn),
    save = useServerFn(saveMarketingProspect),
    remove = useServerFn(deleteMarketingProspect),
    inspect = useServerFn(inspectMarketingUrl);
  const getAttribution = useServerFn(getLeadAttribution);
  const getGa4 = useServerFn(getMarketingGa4);
  const getGa4Diagnostics = useServerFn(getMarketingGa4Diagnostics);
  const getGa4Realtime = useServerFn(getMarketingGa4Realtime);
  const queryKey = ["marketing", user?.id];
  const query = useQuery({
    queryKey,
    queryFn: () => get(),
    enabled: Boolean(session && isStaff),
    staleTime: 60000,
    retry: false,
  });
  const [attributionRange, setAttributionRange] = useState<AttributionRangeInput>({ preset: 30 });
  const [customStartDate, setCustomStartDate] = useState(() => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - 29);
    return date.toISOString().slice(0, 10);
  });
  const [customEndDate, setCustomEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const attributionQuery = useQuery({
    queryKey: ["marketing", "lead-attribution", user?.id, attributionRange],
    queryFn: () => getAttribution({ data: attributionRange }),
    enabled: Boolean(session && isStaff),
    staleTime: 60000,
    retry: false,
  });
  const [ga4Range, setGa4Range] = useState<Ga4RangeInput>({ preset: 30 });
  const [ga4CustomStart, setGa4CustomStart] = useState(() => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - 29);
    return date.toISOString().slice(0, 10);
  });
  const [ga4CustomEnd, setGa4CustomEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const ga4Query = useQuery({
    queryKey: ["marketing", "ga4", user?.id, ga4Range],
    queryFn: () => getGa4({ data: ga4Range }),
    enabled: Boolean(session && isStaff),
    staleTime: 60000,
    retry: false,
  });
  const [ga4Diagnostics, setGa4Diagnostics] = useState<Ga4RuntimeDiagnostics | null>(null);
  const [ga4DiagnosticsBusy, setGa4DiagnosticsBusy] = useState(false);
  const ga4: Ga4Report | undefined = ga4Query.data;
  const snapshot = query.data?.snapshot ?? emptySnapshot();
  const prospects = query.data?.prospects ?? [];
  const [tab, setTab] = useState("overview"),
    [busy, setBusy] = useState<string | null>(null),
    [keyword, setKeyword] = useState(""),
    [articleFilter, setArticleFilter] = useState("");
  // Realtime is polled only while the Analytics tab is open, so other tabs never spend GA4 quota.
  const realtimeQuery = useQuery({
    queryKey: ["marketing", "ga4-realtime", user?.id],
    queryFn: () => getGa4Realtime(),
    enabled: Boolean(session && isStaff && tab === "analytics"),
    staleTime: 30000,
    refetchInterval: tab === "analytics" ? 60000 : false,
    retry: false,
  });
  const [inspectionUrl, setInspectionUrl] = useState(""),
    [inspectionResult, setInspectionResult] = useState<Awaited<
      ReturnType<typeof inspectMarketingUrl>
    > | null>(null),
    [inspectionError, setInspectionError] = useState<string | null>(null);
  const [edit, setEdit] = useState<ProspectInput | null>(null),
    [deleteId, setDeleteId] = useState<string | null>(null);
  const search = snapshot.search.data,
    website = snapshot.website.data,
    lighthouse = snapshot.lighthouse.data,
    research = snapshot.research.data;
  const leadsQuery = useQuery({
    queryKey: ["marketing", "goal-leads", user?.id],
    queryFn: () => listLeads({ data: { accessToken: session?.access_token ?? "", limit: GOAL_RECORD_LIMIT } }),
    enabled: Boolean(session?.access_token && isStaff),
    staleTime: 60000,
    retry: false,
  });
  const goalReport = useMemo(
    () => (leadsQuery.data ? buildLeadGoalReport(leadsQuery.data, { recordLimit: GOAL_RECORD_LIMIT }) : null),
    [leadsQuery.data],
  );
  const healthItems = useMemo(
    () =>
      computeHealth({
        now: Date.now(),
        search: snapshot.search,
        website: snapshot.website,
        leads: leadsQuery.data ?? null,
        ga4:
          ga4Query.isError
            ? { state: "error", checkedAt: null }
            : ga4?.status === "available"
              ? { state: "ok", checkedAt: ga4.fetchedAt }
              : ga4?.status === "unavailable"
                ? { state: /not configured|missing|credentials/i.test(ga4.message ?? "") ? "not_configured" : "error", checkedAt: ga4.fetchedAt }
                : { state: "unchecked", checkedAt: null },
        // The Pixel ID is defined in src/lib/analytics.ts; whether events arrive cannot be seen from here.
        metaPixelConfigured: true,
      }),
    [snapshot.search, snapshot.website, leadsQuery.data, ga4Query.isError, ga4],
  );
  const outcomes = attributionQuery.data?.outcomes;
  const metricOrState = (state: string, value: number | null | undefined) =>
    state === "Not Connected" ? "Not Connected" : value == null ? "No Data" : number(value);
  const channelRows = groupChannelRows(attributionQuery.data?.bySource ?? []);
  function exportLeads() {
    if (!leadsQuery.data?.length) return;
    const blob = new Blob([`\uFEFF${buildLeadExportCsv(leadsQuery.data)}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `mycar-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
  const keywordRows = useMemo(
    () =>
      (search?.keywords ?? []).filter((r) =>
        (r.keys?.[0] ?? "").toLowerCase().includes(keyword.toLowerCase()),
      ),
    [search, keyword],
  );
  const articles = (website?.articles ?? []).filter((a) =>
    a.title.toLowerCase().includes(articleFilter.toLowerCase()),
  );
  async function update(service: keyof MarketingSnapshot, property?: string) {
    setBusy(service);
    try {
      const result = await refresh({ data: { service, ...(property ? { property } : {}) } });
      client.setQueryData(queryKey, result);
      if (result.snapshot[service].state === "Error")
        toast.error("Report unavailable. See the integration status.");
      else toast.success("Report saved.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not refresh the report.");
    } finally {
      setBusy(null);
    }
  }
  async function checkGa4Connection() {
    setGa4DiagnosticsBusy(true);
    try {
      setGa4Diagnostics(await getGa4Diagnostics());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not check Google Analytics credentials.");
    } finally {
      setGa4DiagnosticsBusy(false);
    }
  }
  async function submitProspect(event: React.FormEvent) {
    event.preventDefault();
    if (!edit) return;
    setBusy("save");
    try {
      await save({ data: edit });
      await client.invalidateQueries({ queryKey });
      setEdit(null);
      toast.success("Outreach record saved.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(null);
    }
  }
  async function deleteProspect() {
    if (!deleteId) return;
    setBusy("delete");
    try {
      await remove({ data: { id: deleteId } });
      await client.invalidateQueries({ queryKey });
      setDeleteId(null);
      toast.success("Outreach record removed.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove.");
    } finally {
      setBusy(null);
    }
  }
  async function inspectPage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("inspection");
    setInspectionError(null);
    setInspectionResult(null);
    try {
      setInspectionResult(await inspect({ data: { url: inspectionUrl } }));
      toast.success("Search Console inspection saved.");
    } catch (e) {
      setInspectionError(e instanceof Error ? e.message : "URL inspection failed.");
    } finally {
      setBusy(null);
    }
  }
  function exportAttributionCsv(report: LeadAttributionReport) {
    const blob = new Blob([buildAttributionCsv(report)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `lead-attribution-${report.startDate}-to-${report.endDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
  const refreshButton = (service: keyof MarketingSnapshot, label = "Refresh report") => (
    <Button
      variant="outline"
      size="sm"
      disabled={Boolean(busy)}
      onClick={() => void update(service)}
    >
      {busy === service ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <RefreshCw className="size-3.5" />
      )}
      {label}
    </Button>
  );
  const propertyPicker = search?.candidates.length ? (
    <div className="flex max-w-xl flex-col gap-2">
      <Label>Verified Search Console property</Label>
      <Select
        value={query.data?.property ?? undefined}
        onValueChange={(value) => void update("search", value)}
        disabled={Boolean(busy)}
      >
        <SelectTrigger>
          <SelectValue placeholder="Choose a verified property" />
        </SelectTrigger>
        <SelectContent>
          {search.candidates.map((p) => (
            <SelectItem key={p} value={p}>
              {p}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  ) : null;
  return (
    <>
      <AdminPageHeader
        title="Marketing Hub"
        subtitle="MyCarCorp · Search, content & growth"
        actions={
          <Button asChild variant="outline" size="sm">
            <a href="https://mycarcorp.com" target="_blank" rel="noreferrer">
              View website
              <ArrowUpRight className="size-3.5" />
            </a>
          </Button>
        }
      />
      <main className="w-full min-w-0 px-4 pb-10 md:px-7">
        <div className="flex flex-wrap items-center justify-between gap-4 py-6">
          <div>
            <div className="mb-1 flex items-center gap-2 text-xs font-medium text-primary">
              <Globe className="size-3.5" /> MYCARCORP.COM
            </div>
            <h1 className="font-display text-2xl font-bold text-foreground">Marketing Hub</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Verified reports, lead sources, and SEO operations.
            </p>
          </div>
          <Badge variant="outline" className="gap-1.5">
            <ShieldCheck className="size-3.5" />
            Staff access only
          </Badge>
        </div>
        {query.isPending && (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading saved reports…
          </div>
        )}
        {query.error && (
          <div
            role="alert"
            className="mb-4 border-l-2 border-destructive bg-background p-4 text-sm"
          >
            <p>{query.error.message}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => void query.refetch()}
            >
              Try again
            </Button>
          </div>
        )}
        <Tabs value={tab} onValueChange={setTab}>
          <div className="overflow-x-auto border-b border-border">
            <TabsList className="h-12 w-max justify-start gap-1 rounded-none bg-transparent p-0">
              {TABS.map(([value, label, Icon]) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="h-10 gap-2 rounded-md px-3 text-xs data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-none"
                >
                  <Icon className="size-3.5" />
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          <TabsContent value="overview">
            <div className="grid gap-3 py-5 sm:grid-cols-2 xl:grid-cols-4">
              <Metric
                label="Leads, last 30 days"
                value={leadsQuery.isPending ? "…" : goalReport ? number(goalReport.total) : "No Data"}
                detail="Website inquiries"
                icon={Users}
              />
              <Metric
                label="Google search clicks"
                value={metricOrState(snapshot.search.state, search?.totals?.clicks)}
                detail="From Google Search"
                icon={Search}
              />
              <Metric
                label="Website visits"
                value={ga4?.status === "available" && ga4.metrics ? number(ga4.metrics.sessions) : ga4Query.isPending ? "…" : ga4?.status === "unavailable" ? "Not Connected" : "No Data"}
                detail="From Google Analytics"
                icon={Globe}
              />
              <Metric
                label="Appointments booked"
                value={outcomes?.confirmedAppointments.status === "available" ? number(outcomes.confirmedAppointments.count) : attributionQuery.isPending ? "…" : "No Data"}
                detail="Confirmed"
                icon={CalendarDays}
              />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-lg border border-border bg-background p-4">
                <h2 className="text-sm font-semibold">Leads per day</h2>
                <p className="text-xs text-muted-foreground">Goal: 6–10 a day</p>
                {goalReport && goalReport.total > 0 ? (
                  <ChartContainer config={{ workable: { label: "Leads", color: "var(--color-primary)" } }} className="mt-3 aspect-auto h-56 w-full">
                    <BarChart data={goalReport.daily} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} tickLine={false} axisLine={false} minTickGap={24} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
                      <Tooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="workable" name="Leads" fill="var(--color-workable)" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <Empty>{leadsQuery.isPending ? "Loading…" : "No lead data yet."}</Empty>
                )}
              </section>
              <section className="rounded-lg border border-border bg-background p-4">
                <h2 className="text-sm font-semibold">Where leads come from</h2>
                <p className="text-xs text-muted-foreground">Last 30 days</p>
                {goalReport && goalReport.bySource.length > 0 ? (
                  <ChartContainer config={{ count: { label: "Leads", color: "var(--color-primary)" } }} className="mt-3 aspect-auto h-56 w-full">
                    <BarChart data={goalReport.bySource} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 8 }}>
                      <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                      <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                      <YAxis type="category" dataKey="label" tickLine={false} axisLine={false} width={110} />
                      <Tooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="count" name="Leads" fill="var(--color-count)" radius={[0, 3, 3, 0]} />
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <Empty>{leadsQuery.isPending ? "Loading…" : "No lead data yet."}</Empty>
                )}
              </section>
              <section className="rounded-lg border border-border bg-background p-4 lg:col-span-2">
                <h2 className="text-sm font-semibold">Website visits per day</h2>
                <p className="text-xs text-muted-foreground">From Google Analytics</p>
                {ga4?.daily?.length ? (
                  <ChartContainer config={{ sessions: { label: "Visits", color: "var(--color-primary)" } }} className="mt-3 aspect-auto h-56 w-full">
                    <LineChart data={ga4.daily} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={32} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={36} />
                      <Tooltip content={<ChartTooltipContent />} />
                      <Line type="monotone" dataKey="sessions" name="Visits" stroke="var(--color-sessions)" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ChartContainer>
                ) : (
                  <Empty>{ga4Query.isPending ? "Loading…" : "No visit data available."}</Empty>
                )}
              </section>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background p-4">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="font-semibold">Status</span>
                {(["green", "yellow", "red", "gray"] as const).map((state) => {
                  const n = healthItems.filter((i) => i.state === state).length;
                  return n ? (
                    <span key={state} className="inline-flex items-center gap-1.5">
                      <HealthBadge state={state} />
                      <span className="text-xs text-muted-foreground">{n}</span>
                    </span>
                  ) : null;
                })}
              </div>
              <Button variant="outline" size="sm" onClick={() => setTab("funnel")}>
                See details
                <ArrowUpRight className="size-3.5" />
              </Button>
            </div>
          </TabsContent>
          <TabsContent value="funnel">
            <FunnelMonitor items={healthItems} onOpenTab={setTab} />
          </TabsContent>
          <TabsContent value="leadgoal">
            <LeadGoalPanel
              report={goalReport}
              loading={leadsQuery.isPending}
              error={leadsQuery.error ? "the lead service did not respond" : null}
              canExport={Boolean(isStaff && leadsQuery.data?.length)}
              onExport={exportLeads}
            />
          </TabsContent>
          <TabsContent value="channels">
            <ChannelReportPanel leads={leadsQuery.data ?? null} loading={leadsQuery.isPending} />
          </TabsContent>
          <TabsContent value="social">
            <SocialDashboard leads={leadsQuery.data ?? null} loading={leadsQuery.isPending} />
          </TabsContent>
          <TabsContent value="contentplan">
            <ContentAgentPanel accessToken={session?.access_token ?? ""} userLabel={user?.email ?? ""} />
          </TabsContent>
          <TabsContent value="seo">
            <Section
              title="SEO performance"
              subtitle="Observed Google and technical audit data; provider estimates remain labeled separately."
              actions={
                <Button variant="outline" size="sm" onClick={() => setTab("gsc")}>
                  Open Search Console
                  <ArrowUpRight className="size-3.5" />
                </Button>
              }
            >
              <div className="grid gap-3 sm:grid-cols-3">
                <Metric
                  label="Organic clicks"
                  value={number(search?.totals?.clicks)}
                  detail={
                    search?.startDate
                      ? `${search.startDate} – ${search.endDate}`
                      : "Search Console · no saved report"
                  }
                  icon={BarChart3}
                />
                <Metric
                  label="Impressions"
                  value={number(search?.totals?.impressions)}
                  detail="Google organic search"
                  icon={Search}
                />
                <Metric
                  label="Average position"
                  value={search?.totals ? search.totals.position.toFixed(1) : "—"}
                  detail="Search Console period average"
                  icon={Activity}
                />
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {(
                  [
                    ["Sitemap", website ? `HTTP ${website.sitemap.status}` : "—"],
                    ["robots.txt", website ? `HTTP ${website.robots.status}` : "—"],
                    ["Lighthouse pages", lighthouse ? number(lighthouse.audits.length) : "—"],
                  ] as const
                ).map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between border-y border-border py-3 text-sm"
                  >
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-semibold">{value}</span>
                  </div>
                ))}
              </div>
            </Section>
            <Section
              title="Semrush keyword research"
              subtitle="Provider estimates, not observed Google rankings."
              actions={
                <Button variant="outline" size="sm" onClick={() => setTab("keywords")}>
                  Open Semrush Research
                  <ArrowUpRight className="size-3.5" />
                </Button>
              }
            >
              <ProviderTable data={research?.keywords} />
            </Section>
          </TabsContent>
          <TabsContent value="gsc">
            <Section
              title="Google Search Console"
              subtitle={search?.siteUrl ?? "Select a verified property before requesting reports."}
              actions={refreshButton("search")}
            >
              {propertyPicker}
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <Metric
                  label="Clicks"
                  value={number(search?.totals?.clicks)}
                  detail="Organic search visits"
                  icon={BarChart3}
                />
                <Metric
                  label="Impressions"
                  value={number(search?.totals?.impressions)}
                  detail="Google search appearances"
                  icon={Search}
                />
                <Metric
                  label="Average position"
                  value={search?.totals ? search.totals.position.toFixed(1) : "—"}
                  detail="Across the saved report period"
                  icon={Activity}
                />
              </div>
            </Section>
            <Section title="Queries" subtitle="Search Console may omit low-volume queries.">
              <SearchTable rows={keywordRows} label="Search query" />
            </Section>
            <Section
              title="Pages"
              subtitle="Performance rows are not a complete index coverage list."
            >
              <SearchTable rows={search?.pages ?? []} label="Page" />
            </Section>
            <Section
              title="Sitemap status"
              subtitle="Counts are provider-reported; they do not establish that URLs are indexed."
            >
              {search?.sitemaps?.length ? (
                search.sitemaps.map((s) => (
                  <div key={s.path} className="border-b border-border py-3 text-sm">
                    <p className="break-all font-medium">{s.path}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Errors: {s.errors ?? "0"} · Warnings: {s.warnings ?? "0"} · Submitted:{" "}
                      {date(s.lastSubmitted)}
                    </p>
                  </div>
                ))
              ) : (
                <Empty>No saved sitemap status.</Empty>
              )}
            </Section>
          </TabsContent>
          <TabsContent value="inspection">
            <Section
              title="Google Search Console URL Inspection"
              subtitle="Asks Google how it sees one URL: indexed or not, last crawl time and any problems. It does not report how many people visited the page; use Google Analytics for that."
            >
              <Unavailable report={snapshot.search} name="Google Search Console" />
              {propertyPicker}
              <form
                onSubmit={(event) => void inspectPage(event)}
                className="mt-4 flex flex-col gap-2 sm:flex-row"
              >
                <Input
                  type="url"
                  value={inspectionUrl}
                  onChange={(event) => setInspectionUrl(event.target.value)}
                  placeholder="https://mycarcorp.com/inventory/..."
                  aria-label="URL to inspect"
                  required
                />
                <Button type="submit" disabled={busy === "inspection" || !query.data?.property}>
                  {busy === "inspection" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Search className="size-4" />
                  )}
                  Inspect URL
                </Button>
              </form>
              {!query.data?.property && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Choose a verified property in the Google Search Console section before inspecting
                  URLs.
                </p>
              )}
              {inspectionError && (
                <div
                  role="alert"
                  className="mt-4 border-l-2 border-destructive bg-background p-3 text-sm"
                >
                  {inspectionError}
                </div>
              )}
              {inspectionResult && (
                <div
                  role="status"
                  className="mt-4 grid gap-3 border-y border-border py-4 text-sm sm:grid-cols-2"
                >
                  <div>
                    <p className="text-xs text-muted-foreground">Inspected URL</p>
                    <p className="mt-1 break-all font-medium">{inspectionResult.url}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Verdict</p>
                    <p className="mt-1 font-semibold">
                      {inspectionResult.verdict ?? "Not reported"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Indexing state</p>
                    <p className="mt-1">{inspectionResult.indexingState ?? "Not reported"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Google canonical</p>
                    <p className="mt-1 break-all">
                      {inspectionResult.googleCanonical ?? "Not reported"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Last crawl</p>
                    <p className="mt-1">{date(inspectionResult.lastCrawlTime)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Inspection saved</p>
                    <p className="mt-1">{date(inspectionResult.inspectedAt)}</p>
                  </div>
                </div>
              )}
            </Section>
          </TabsContent>
          <TabsContent value="keywords">
            <Section
              title="Semrush research"
              subtitle="Provider estimates · US database · available within your plan"
              actions={refreshButton("research")}
            >
              <Unavailable report={snapshot.research} name="Semrush" />
              <ProviderTable data={research?.keywords} />
            </Section>
            <Section
              title="Organic search queries"
              subtitle="Observed in Google Search Console; average position is not a guaranteed rank"
              actions={
                <Button variant="outline" size="sm" onClick={() => setTab("gsc")}>
                  Open Search Console
                  <ArrowUpRight className="size-3.5" />
                </Button>
              }
            >
              <Input
                aria-label="Search keywords"
                placeholder="Filter Search Console queries"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className="mb-4 max-w-sm"
              />
              <SearchTable rows={keywordRows} label="Search query" />
            </Section>
          </TabsContent>
          <TabsContent value="health">
            <Section
              title="Lighthouse & Website Health"
              subtitle="Reads saved GitHub Lighthouse artifacts and live site checks; this page does not start an audit."
              actions={
                <div className="flex flex-wrap gap-2">
                  {refreshButton("website", "Check website")}
                  {refreshButton("lighthouse", "Refresh Lighthouse")}
                </div>
              }
            >
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {(
                  [
                    ["Sitemap HTTP", website ? String(website.sitemap.status) : "—"],
                    ["URLs in sitemap", website ? number(website.sitemap.urls) : "—"],
                    ["Same-origin URLs", website ? number(website.sitemap.sameOriginUrls) : "—"],
                    ["robots.txt HTTP", website ? String(website.robots.status) : "—"],
                  ] as const
                ).map(([label, value]) => (
                  <Metric
                    key={label}
                    label={label}
                    value={value}
                    detail={
                      website
                        ? `Website check · ${date(snapshot.website.checkedAt)}`
                        : "No saved website check"
                    }
                    icon={Globe}
                  />
                ))}
              </div>
              <div className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
                <div className="border-y border-border py-3">
                  <p className="font-semibold">Homepage metadata</p>
                  <p className="mt-2 text-muted-foreground">
                    {website?.metadata.title ?? "No saved title check"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Description:{" "}
                    {website
                      ? website.metadata.description
                        ? "Present"
                        : "Missing"
                      : "Not checked"}{" "}
                    · Verification tag:{" "}
                    {website
                      ? website.metadata.verificationTag
                        ? "Present"
                        : "Missing"
                      : "Not checked"}
                  </p>
                </div>
                <div className="border-y border-border py-3">
                  <p className="font-semibold">Lighthouse report</p>
                  <p className="mt-2 text-muted-foreground">
                    {lighthouse?.audits.length
                      ? `${lighthouse.audits.length} saved page audits`
                      : "No saved Lighthouse scores"}
                  </p>
                  {lighthouse?.runUrl && (
                    <Button asChild variant="link" size="sm" className="mt-1 h-auto p-0">
                      <a href={lighthouse.runUrl} target="_blank" rel="noreferrer">
                        Open GitHub Actions run
                        <ArrowUpRight className="size-3.5" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>
              {lighthouse?.audits.length ? (
                <div className="mt-5 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-muted/40 text-xs">
                      <tr>
                        {[
                          "Audited page",
                          "Performance",
                          "Accessibility",
                          "Best practices",
                          "SEO",
                          "Audit date",
                        ].map((s) => (
                          <th key={s} className="px-3 py-3 font-medium">
                            {s}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {lighthouse.audits.map((a, i) => (
                        <tr key={i} className="border-b border-border">
                          <td className="max-w-xs break-all px-3 py-3">{a.url}</td>
                          {[a.performance, a.accessibility, a.bestPractices, a.seo].map((v, j) => (
                            <td key={j} className="px-3 font-semibold">
                              {number(v)}
                            </td>
                          ))}
                          <td className="px-3 text-xs">{date(a.date)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty>
                  {lighthouse?.artifactAvailable
                    ? "The saved archive has no readable Lighthouse scores."
                    : "No saved Lighthouse scores. Refresh to read the existing GitHub artifact."}
                </Empty>
              )}
            </Section>
          </TabsContent>
          <TabsContent value="reports">
            <Section
              title="Saved marketing reports"
              subtitle="Snapshots are persisted privately. Refreshes run only when requested, except for the existing authenticated job endpoint."
            >
              <div className="divide-y divide-border border-y border-border">
                {(
                  [
                    ["Google Search Console", snapshot.search, "search"],
                    ["Semrush Research", snapshot.research, "research"],
                    ["GitHub Lighthouse", snapshot.lighthouse, "lighthouse"],
                    ["Website health", snapshot.website, "website"],
                  ] as const
                ).map(([name, report, service]) => (
                  <div
                    key={service}
                    className="flex flex-wrap items-center justify-between gap-3 py-4"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold">{name}</h3>
                        <Status report={report} />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Last checked: {date(report.checkedAt)}
                        {report.state === "Error" && report.data
                          ? " · Showing last successful saved report"
                          : ""}
                      </p>
                      <p className="mt-1 break-words text-xs text-muted-foreground">
                        {report.message}
                      </p>
                    </div>
                    {refreshButton(service, "Refresh")}
                  </div>
                ))}
              </div>
            </Section>
            <Section
              title="Report coverage"
              subtitle="Lead-attribution totals come directly from saved lead records, not ad-platform conversion reporting."
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-y border-border py-4">
                <div>
                  <p className="text-sm font-semibold">Lead attribution</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {attributionQuery.data
                      ? `${attributionQuery.data.startDate} – ${attributionQuery.data.endDate} · ${number(attributionQuery.data.scanned)} rows scanned`
                      : "No saved attribution summary"}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setTab("attribution")}>
                  Open attribution
                  <ArrowUpRight className="size-3.5" />
                </Button>
              </div>
            </Section>
          </TabsContent>
          <TabsContent value="analytics">
            {(() => {
              const status = ga4Query.isPending && !ga4
                ? "Loading"
                : resolveGa4IntegrationStatus(ga4, ga4Query.error);
              const unavailableLabel = status === "Loading" || status === "Connected" || status === "No Data Yet" || status === "Partial Data" ? "Not Configured" : status;
              const hasActivity = Boolean(ga4 && ga4ReportHasData(ga4));
              const rangeLabel = ga4Range.preset ? `Last ${ga4Range.preset} days` : `${ga4Range.startDate} – ${ga4Range.endDate}`;
              const displayDate = (value: string) => formatGa4DateLabel(value, "axis");
              const dateTooltip = <ChartTooltipContent labelFormatter={(value) => formatGa4DateLabel(String(value))} />;
              const sectionNote = (key: Ga4SectionKey, fallback: string) => {
                const failure = ga4?.sectionErrors?.[key];
                return failure ? `${GA4_SECTION_LABELS[key]} is unavailable: ${failure}` : fallback;
              };
              const statusVariant = status === "Connected" ? "outline" : status === "Loading" ? "secondary" : status === "No Data Yet" || status === "Partial Data" ? "secondary" : "destructive";
              const pageTable = (rows: NonNullable<Ga4Report["landingPages"]>, heading: string, key: Ga4SectionKey) => (
                <section>
                  <h3 className="mb-2 text-sm font-semibold">{heading}</h3>
                  {rows.length ? (
                    <div className="overflow-x-auto border-y border-border">
                      <table className="w-full min-w-[560px] text-left text-xs">
                        <thead className="bg-muted/40 text-muted-foreground"><tr>
                          {["Page path", "Sessions", "Page views", "Engaged sessions", "Engagement rate"].map((label) => <th key={label} className="px-3 py-2 font-medium">{label}</th>)}
                        </tr></thead>
                        <tbody>{rows.map((row) => <tr key={row.label} className="border-t border-border">
                          <td className="max-w-72 break-all px-3 py-2 font-medium">{row.label}</td>
                          <td className="px-3 py-2">{number(row.sessions)}</td>
                          <td className="px-3 py-2">{number(row.pageViews)}</td>
                          <td className="px-3 py-2">{number(row.engagedSessions)}</td>
                          <td className="px-3 py-2">{(row.engagementRate * 100).toFixed(1)}%</td>
                        </tr>)}</tbody>
                      </table>
                    </div>
                  ) : <Empty>{sectionNote(key, "No page rows were returned for this period.")}</Empty>}
                </section>
              );
              const rt = realtimeQuery.data;
              const eventTable = (rows: Ga4EventCount[], showUsers: boolean) => (
                <div className="overflow-x-auto border-y border-border">
                  <table className="w-full min-w-[360px] text-left text-xs">
                    <thead className="bg-muted/40 text-muted-foreground"><tr>
                      <th className="px-3 py-2 font-medium">Event</th>
                      <th className="px-3 py-2 font-medium">Count</th>
                      {showUsers && <th className="px-3 py-2 font-medium">Users</th>}
                    </tr></thead>
                    <tbody>{rows.map((row) => <tr key={row.eventName} className="border-t border-border">
                      <td className="px-3 py-2 font-mono font-medium">{row.eventName}</td>
                      <td className="px-3 py-2">{number(row.eventCount)}</td>
                      {showUsers && <td className="px-3 py-2">{number(row.totalUsers)}</td>}
                    </tr>)}</tbody>
                  </table>
                </div>
              );
              const realtimeSection = (
                <Section
                  title="GA4 Realtime"
                  subtitle="Live activity from the GA4 Realtime API for the last 30 minutes. Separate from the historical reports below, which can take 24–48 hours to finish processing."
                  actions={
                    <Button variant="outline" size="sm" disabled={realtimeQuery.isFetching} onClick={() => void realtimeQuery.refetch()} aria-label="Refresh GA4 Realtime">
                      <RefreshCw className={`size-3.5 ${realtimeQuery.isFetching ? "animate-spin" : ""}`} />
                      Refresh realtime
                    </Button>
                  }
                >
                  {realtimeQuery.isPending ? (
                    <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Loading GA4 Realtime…</div>
                  ) : realtimeQuery.error ? (
                    <div role="alert" className="my-4 border-l-2 border-destructive bg-background p-4 text-sm">GA4 Realtime request failed. Try again or check server configuration.</div>
                  ) : rt?.status === "unavailable" ? (
                    <div role="alert" className="my-4 border-l-2 border-destructive bg-background p-4 text-sm"><p className="font-semibold">GA4 Realtime unavailable</p><p className="mt-1">{rt.message}</p></div>
                  ) : rt ? (
                    <>
                      {(rt.sectionErrors.activeUsers || rt.sectionErrors.events) && (
                        <div role="status" className="mb-3 border-l-2 border-amber-500 bg-background p-3 text-xs">
                          {rt.sectionErrors.activeUsers && <p>Active users are unavailable: {rt.sectionErrors.activeUsers}</p>}
                          {rt.sectionErrors.events && <p>Recent events are unavailable: {rt.sectionErrors.events}</p>}
                        </div>
                      )}
                      <div className="grid gap-3 pb-4 sm:grid-cols-2">
                        <Metric label="Active users · last 30 min" value={number(rt.activeUsers)} detail="GA4 Realtime activeUsers" icon={Users} />
                        <Metric label="Tracked events · last 30 min" value={number(rt.events ? rt.events.reduce((total, row) => total + row.eventCount, 0) : null)} detail="Sum of the site events listed below" icon={Activity} />
                      </div>
                      {rt.events ? eventTable(rt.events, false) : <Empty>Recent event counts are unavailable.</Empty>}
                      <p className="pt-3 text-xs text-muted-foreground" aria-live="polite">
                        Realtime · updated {date(rt.fetchedAt)}. {rt.activeUsers === 0 ? "No consented visitors were active in the last 30 minutes. " : ""}Only visitors who accepted analytics and are not blocking Google tags are counted.
                      </p>
                    </>
                  ) : null}
                </Section>
              );
              const eventsSection = (
                <section className="border-t border-border py-5">
                  <h3 className="mb-1 text-sm font-semibold">GA4 event counts</h3>
                  <p className="mb-2 text-xs text-muted-foreground">Existing site events for this period, from GA4 only. These measure consented activity and are separate from lead records saved in the database.</p>
                  {ga4?.events ? eventTable(ga4.events, true) : <Empty>{sectionNote("events", "No event rows were returned.")}</Empty>}
                </section>
              );
              return (
            <>
            {realtimeSection}
            <Section
              title="Google Analytics 4"
              subtitle="GA4 property 559909149 · website activity from Google Analytics, separate from Supabase leads and completed purchases."
              actions={
                <div className="flex items-center gap-2">
                  <Badge variant={statusVariant} className={status === "Connected" ? "gap-1 border-border text-positive-text" : "gap-1"}>
                    {status === "Connected" ? <CheckCircle2 className="size-3" /> : status === "Loading" ? <Loader2 className="size-3 animate-spin" /> : <span className="size-1.5 rounded-full bg-current" />}
                    {status}
                  </Badge>
                  <Button variant="outline" size="sm" disabled={ga4Query.isFetching} onClick={() => void ga4Query.refetch()} aria-label="Refresh Google Analytics report">
                  <RefreshCw className={`size-3.5 ${ga4Query.isFetching ? "animate-spin" : ""}`} />
                  Refresh report
                  </Button>
                  <Button variant="outline" size="sm" disabled={ga4DiagnosticsBusy} onClick={() => void checkGa4Connection()}>
                    <ShieldCheck className={`size-3.5 ${ga4DiagnosticsBusy ? "animate-pulse" : ""}`} />
                    Connection check
                  </Button>
                </div>
              }
            >
              <form className="flex flex-wrap items-end justify-between gap-3 border-y border-border py-4" onSubmit={(event) => {
                event.preventDefault();
                setGa4Range({ startDate: ga4CustomStart, endDate: ga4CustomEnd });
              }}>
                <div className="flex gap-2" role="group" aria-label="GA4 reporting period">
                  {([7, 30, 90] as const).map((days) => (
                    <Button key={days} type="button" size="sm" variant={ga4Range.preset === days ? "default" : "outline"} onClick={() => setGa4Range({ preset: days })}>
                      {days} days
                    </Button>
                  ))}
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="space-y-1"><Label htmlFor="ga4-start">Start date</Label><Input id="ga4-start" type="date" value={ga4CustomStart} onChange={(event) => setGa4CustomStart(event.target.value)} required /></div>
                  <div className="space-y-1"><Label htmlFor="ga4-end">End date</Label><Input id="ga4-end" type="date" value={ga4CustomEnd} onChange={(event) => setGa4CustomEnd(event.target.value)} required /></div>
                  <Button type="submit" variant="outline" size="sm"><CalendarDays className="size-3.5" />Apply range</Button>
                </div>
              </form>
              <p className="py-3 text-xs text-muted-foreground" aria-live="polite">
                {ga4 ? `${rangeLabel} · ${ga4.startDate} – ${ga4.endDate} · ${ga4.timeZone ?? "Property time zone unavailable"} · Reported ${date(ga4.fetchedAt)}` : `${rangeLabel} · GA4 report freshness and property time zone appear when available`}
              </p>
              <p className="pb-3 text-xs text-muted-foreground">
                GA4 measures only consented, non-blocked activity: visitors who decline analytics, or whose browsers block Google tags, are not counted. GA4 counts are therefore lower than real traffic and are kept separate from lead records saved in the database.
              </p>
              {ga4Diagnostics && (
                <div className="mb-4 border-y border-border py-3 text-xs" aria-live="polite">
                  <p className="mb-2 font-semibold">Server connection diagnostics</p>
                  <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2 xl:grid-cols-4">
                    <p>Auth mode: <span className="font-medium">{ga4Diagnostics.authenticationMode}</span></p>
                    <p>OAuth client ID: <span className="font-medium">{ga4Diagnostics.oauthCredentialsPresent.clientId ? "Present" : "Missing"}</span></p>
                    <p>OAuth client secret: <span className="font-medium">{ga4Diagnostics.oauthCredentialsPresent.clientSecret ? "Present" : "Missing"}</span></p>
                    <p>OAuth refresh token: <span className="font-medium">{ga4Diagnostics.oauthCredentialsPresent.refreshToken ? "Present" : "Missing"}</span></p>
                    <p>Service account: <span className="font-medium">{ga4Diagnostics.serviceAccountConfigured ? "Present" : "Missing"}</span></p>
                    <p>Token exchange attempted: <span className="font-medium">{ga4Diagnostics.tokenExchangeAttempted ? "Yes" : "No"}</span></p>
                    <p>Google HTTP status: <span className="font-medium">{ga4Diagnostics.googleHttpStatus ?? "Not available"}</span></p>
                    <p>Sanitized error category: <span className="font-medium">{ga4Diagnostics.errorCategory ?? "None"}</span></p>
                    <p>Property time zone setting: <span className="font-medium">{ga4Diagnostics.propertyTimeZoneAvailable ? "Present" : "Missing"}</span></p>
                  </div>
                </div>
              )}
              {ga4Query.isPending ? (
                <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Loading GA4 report…</div>
              ) : ga4Query.error ? (
                <div role="alert" className="my-4 border-l-2 border-destructive bg-background p-4 text-sm">{unavailableLabel}. GA4 report request failed. Try again or check server configuration.</div>
              ) : ga4?.status === "unavailable" ? (
                <div role="alert" className="my-4 border-l-2 border-destructive bg-background p-4 text-sm"><p className="font-semibold">{unavailableLabel}</p><p className="mt-1">{ga4.message}</p></div>
              ) : ga4?.status === "available" ? (
                <>
                  {Object.keys(ga4.sectionErrors).length > 0 && (
                    <div role="status" className="my-4 border-l-2 border-amber-500 bg-background p-4 text-sm">
                      <p className="font-semibold">Some GA4 sections could not be loaded</p>
                      <p className="mt-1 text-xs text-muted-foreground">The sections below that loaded are accurate for this period. The rest are marked unavailable and can be retried with Refresh report.</p>
                      <ul className="mt-2 list-disc pl-5 text-xs">
                        {(Object.keys(ga4.sectionErrors) as Ga4SectionKey[]).map((key) => <li key={key}>{GA4_SECTION_LABELS[key]}: {ga4.sectionErrors[key]}</li>)}
                      </ul>
                    </div>
                  )}
                  {ga4.metrics ? (
                  <div className="grid gap-3 py-5 sm:grid-cols-2 xl:grid-cols-4">
                    <Metric label="Active users" value={number(ga4.metrics.activeUsers)} detail="GA4 active users" icon={Users} />
                    <Metric label="Total users" value={number(ga4.metrics.totalUsers)} detail="GA4 total users" icon={Users} />
                    <Metric label="Sessions" value={number(ga4.metrics.sessions)} detail="GA4 sessions" icon={Activity} />
                    <Metric label="Engaged sessions" value={number(ga4.metrics.engagedSessions)} detail="GA4 engaged sessions" icon={CheckCircle2} />
                    <Metric label="Engagement rate" value={`${(ga4.metrics.engagementRate * 100).toFixed(1)}%`} detail="Engaged sessions / sessions" icon={BarChart3} />
                    <Metric label="Page views" value={number(ga4.metrics.screenPageViews)} detail="GA4 screenPageViews" icon={Globe} />
                    <Metric label="GA4 generate_lead" value={number(ga4.generateLeadEvents)} detail="GA4 event count; not Supabase leads or verified purchases" icon={CheckCircle2} />
                  </div>
                  ) : <Empty>{sectionNote("metrics", "Summary metrics were not returned.")}</Empty>}
                  <div className="border-y border-border py-4">
                    <h3 className="mb-3 text-sm font-semibold">Daily traffic</h3>
                    {ga4.daily?.length ? (
                      <ChartContainer config={{ sessions: { label: "Sessions", color: "var(--color-primary)" }, screenPageViews: { label: "Page views", color: "var(--color-positive)" } }} className="aspect-auto h-72 w-full">
                        <LineChart data={ga4.daily} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                          <CartesianGrid vertical={false} />
                          <XAxis dataKey="date" tickFormatter={displayDate} tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
                          <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                          <Tooltip content={dateTooltip} />
                          <Line type="monotone" dataKey="sessions" stroke="var(--color-sessions)" strokeWidth={2} dot={false} />
                          <Line type="monotone" dataKey="screenPageViews" stroke="var(--color-screenPageViews)" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ChartContainer>
                    ) : <Empty>{sectionNote("daily", "No daily traffic rows were returned for this period.")}</Empty>}
                  </div>
                  <div className="grid gap-6 py-5 xl:grid-cols-2">
                    {([ ["Sessions by acquisition channel", ga4.trafficChannels], ["Traffic source / medium", ga4.trafficSources] ] as const).map(([heading, rows]) => (
                      <section key={heading}>
                        <h3 className="mb-2 text-sm font-semibold">{heading}</h3>
                        {rows?.length ? <ChartContainer config={{ sessions: { label: "Sessions", color: "var(--color-primary)" } }} className="aspect-auto h-64 w-full"><BarChart data={rows.slice(0, 10)} margin={{ top: 8, right: 8, bottom: 28, left: 0 }}><CartesianGrid vertical={false} /><XAxis dataKey="label" tickLine={false} axisLine={false} angle={-25} textAnchor="end" interval={0} height={56} tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} /><Tooltip content={<ChartTooltipContent />} /><Bar dataKey="sessions" fill="var(--color-sessions)" radius={[3, 3, 0, 0]} /></BarChart></ChartContainer> : <Empty>{sectionNote(heading === "Traffic source / medium" ? "trafficSources" : "trafficChannels", "No acquisition rows were returned.")}</Empty>}
                      </section>
                    ))}
                    <section>
                      <h3 className="mb-2 text-sm font-semibold">Sessions by device</h3>
                      {ga4.deviceCategories?.length ? <ChartContainer config={{ sessions: { label: "Sessions", color: "var(--color-primary)" } }} className="aspect-auto h-64 w-full"><BarChart data={ga4.deviceCategories} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}><CartesianGrid vertical={false} /><XAxis dataKey="label" tickLine={false} axisLine={false} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} /><Tooltip content={<ChartTooltipContent />} /><Bar dataKey="sessions" fill="var(--color-sessions)" radius={[3, 3, 0, 0]} /></BarChart></ChartContainer> : <Empty>{sectionNote("deviceCategories", "No device rows were returned.")}</Empty>}
                    </section>
                    <section>
                      <h3 className="mb-2 text-sm font-semibold">GA4 generate_lead events over time</h3>
                      {ga4.generateLeadDaily?.length ? <ChartContainer config={{ eventCount: { label: "Events", color: "var(--color-positive)" } }} className="aspect-auto h-64 w-full"><LineChart data={ga4.generateLeadDaily} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}><CartesianGrid vertical={false} /><XAxis dataKey="date" tickFormatter={displayDate} tickLine={false} axisLine={false} minTickGap={24} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} /><Tooltip content={dateTooltip} /><Line type="monotone" dataKey="eventCount" stroke="var(--color-eventCount)" strokeWidth={2} dot={false} /></LineChart></ChartContainer> : <Empty>{sectionNote("generateLeadDaily", "No generate_lead event rows were returned.")}</Empty>}
                    </section>
                  </div>
                  {eventsSection}
                  <div className="grid gap-6 border-t border-border py-5 xl:grid-cols-2">
                    {pageTable(ga4.landingPages ?? [], "Top landing pages", "landingPages")}
                    {pageTable(ga4.vehiclePages ?? [], "Top vehicle-detail pages under /inventory/", "vehiclePages")}
                  </div>
                  {!hasActivity && <div className="border-t border-border py-3 text-sm text-muted-foreground">The GA4 API responded successfully, but returned no activity for this reporting period. This is not a connection failure: standard GA4 reports can take 24–48 hours to finish processing, and activity is only recorded from the day consent-gated collection began working. Check GA4 Realtime above for live activity.</div>}
                </>
              ) : <Empty>No GA4 report data was returned.</Empty>}
            </Section>
            </>
              );
            })()}
          </TabsContent>
          <TabsContent value="attribution">
            <Section
              title="Lead attribution"
              subtitle="Observed MyCar lead records only. Inferred attribution is labeled; counts are not ad-platform conversions."
              actions={
                attributionQuery.data && (
                  <Button variant="outline" size="sm" onClick={() => exportAttributionCsv(attributionQuery.data!)}>
                    <Download className="size-3.5" />
                    Export CSV
                  </Button>
                )
              }
            >
              <form
                className="flex flex-wrap items-end gap-3 border-y border-border py-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  setAttributionRange({ preset: "custom", startDate: customStartDate, endDate: customEndDate });
                }}
              >
                <div className="flex gap-2" role="group" aria-label="Attribution date preset">
                  {([7, 30, 90] as const).map((days) => (
                    <Button
                      key={days}
                      type="button"
                      size="sm"
                      variant={attributionRange.preset === days ? "default" : "outline"}
                      onClick={() => setAttributionRange({ preset: days })}
                    >
                      {days} days
                    </Button>
                  ))}
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="attribution-start">Start date (UTC)</Label>
                    <Input id="attribution-start" type="date" value={customStartDate} onChange={(event) => setCustomStartDate(event.target.value)} required />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="attribution-end">End date (UTC)</Label>
                    <Input id="attribution-end" type="date" value={customEndDate} onChange={(event) => setCustomEndDate(event.target.value)} required />
                  </div>
                  <Button type="submit" size="sm" variant={attributionRange.preset === "custom" ? "default" : "outline"}>Apply dates</Button>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  aria-label="Refresh attribution report"
                  disabled={attributionQuery.isFetching}
                  onClick={() => void attributionQuery.refetch()}
                >
                  <RefreshCw className={`size-4 ${attributionQuery.isFetching ? "animate-spin" : ""}`} />
                </Button>
              </form>
              {attributionQuery.isPending ? (
                <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Loading lead attribution…
                </div>
              ) : attributionQuery.error ? (
                <div
                  role="alert"
                  className="my-4 border-l-2 border-destructive bg-background p-4 text-sm"
                >
                  Could not load lead attribution: {attributionQuery.error.message}
                </div>
              ) : attributionQuery.data ? (
                <>
                  <div className="flex flex-wrap justify-between gap-2 py-3 text-xs text-muted-foreground">
                    <span>
                      {attributionQuery.data.startDate} – {attributionQuery.data.endDate} UTC · {number(attributionQuery.data.total ?? attributionQuery.data.scanned)} total leads · {number(attributionQuery.data.scanned)} scanned
                    </span>
                    <span>Updated {date(attributionQuery.data.generatedAt)} · source labels from saved lead details</span>
                  </div>
                  {!attributionQuery.data.complete && (
                    <div
                      role="status"
                      className="mt-4 border-l-2 border-amber-500 bg-background p-3 text-sm text-muted-foreground"
                    >
                      Showing {number(attributionQuery.data.scanned)} of{" "}
                      {number(attributionQuery.data.total)} matching leads. This report is partial;
                      all breakdowns and exports cover scanned records only and must not be treated as totals.
                    </div>
                  )}
                  <div className="grid gap-3 py-4 sm:grid-cols-2 xl:grid-cols-4">
                    <Metric
                      label="Leads in window"
                      value={number(attributionQuery.data.total ?? attributionQuery.data.scanned)}
                      detail={
                        attributionQuery.data.complete
                          ? "Exact count from saved lead records"
                          : `${number(attributionQuery.data.scanned)} records scanned; partial`
                      }
                      icon={Users}
                    />
                    <Metric
                      label="Unattributed"
                      value={number(
                        attributionQuery.data.bySource.find((row) => row.source === "Unattributed")
                          ?.count ?? 0,
                      )}
                      detail="No normalized source label saved with the lead"
                      icon={Activity}
                    />
                    <Metric
                      label="Campaigns observed"
                      value={number(
                        attributionQuery.data.byCampaign.filter(
                          (row) => row.campaign !== "Unattributed",
                        ).length,
                      )}
                      detail="Distinct saved UTM campaign labels"
                      icon={Search}
                    />
                    <Metric
                      label="Lead types"
                      value={number(attributionQuery.data.byLeadType.length)}
                      detail="Types present in the filtered records"
                      icon={FileText}
                    />
                  </div>
                  <Section
                    title="Verified outcomes"
                    subtitle="Linked outcomes are grouped by the related lead's creation date in this UTC window, not by the later confirmation or completion date. Attribution describes recorded touch data, not causation."
                  >
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      <Metric
                        label="Appointment requests"
                        value={attributionQuery.data.outcomes.appointmentRequests.status === "available"
                          ? number(attributionQuery.data.outcomes.appointmentRequests.count)
                          : "Not available"}
                        detail="Leads recorded with database type appointment"
                        icon={Users}
                      />
                      <Metric
                        label="Confirmed appointments"
                        value={attributionQuery.data.outcomes.confirmedAppointments.status === "available"
                          ? attributionQuery.data.outcomes.confirmedAppointments.complete
                            ? number(attributionQuery.data.outcomes.confirmedAppointments.count)
                            : `At least ${number(attributionQuery.data.outcomes.confirmedAppointments.scanned)} (partial)`
                          : "Not available"}
                        detail="Distinct confirmed appointment records joined by lead_id"
                        icon={CheckCircle2}
                      />
                      <Metric
                        label="Completed purchases"
                        value={attributionQuery.data.outcomes.completedPurchases.status === "available"
                          ? attributionQuery.data.outcomes.completedPurchases.complete
                            ? number(attributionQuery.data.outcomes.completedPurchases.count)
                            : `At least ${number(attributionQuery.data.outcomes.completedPurchases.scanned)} (partial)`
                          : "Not available"}
                        detail="Distinct completed purchases linked to a lead_id"
                        icon={Activity}
                      />
                    </div>
                    <div className="mt-4 grid gap-6 xl:grid-cols-2">
                      <Section title="Appointment request and booking coverage" subtitle="Request totals follow lead created_at; unlinked confirmed appointment counts follow appointment created_at for this orphan-record check.">
                        <div className="divide-y divide-border border-y border-border text-sm">
                          <div className="flex justify-between gap-3 py-3"><span>Appointment-request leads</span><strong>{attributionQuery.data.outcomes.appointmentRequests.status === "available" ? number(attributionQuery.data.outcomes.appointmentRequests.count) : "Not available"}</strong></div>
                          <div className="flex justify-between gap-3 py-3"><span>Request leads without an appointment record</span><strong>{attributionQuery.data.outcomes.appointmentRequestsWithoutRecord.status === "unavailable" ? "Not available" : attributionQuery.data.outcomes.appointmentRequestsWithoutRecord.count === null ? "Partial" : number(attributionQuery.data.outcomes.appointmentRequestsWithoutRecord.count)}</strong></div>
                          <div className="flex justify-between gap-3 py-3"><span>Confirmed records with missing/invalid lead link</span><strong>{attributionQuery.data.outcomes.confirmedAppointments.status === "unavailable" ? "Not available" : attributionQuery.data.outcomes.confirmedAppointments.missingRelationship === null ? "Partial" : number(attributionQuery.data.outcomes.confirmedAppointments.missingRelationship)}</strong></div>
                          <div className="flex justify-between gap-3 py-3"><span>Confirmed bookings with unknown attribution</span><strong>{attributionQuery.data.outcomes.confirmedAppointments.status === "available" ? number(attributionQuery.data.outcomes.confirmedAppointments.unknownAttribution) : "Not available"}</strong></div>
                          <div className="flex justify-between gap-3 py-3"><span>Outcome data coverage</span><strong>{attributionQuery.data.outcomes.confirmedAppointments.status === "available" ? attributionQuery.data.outcomes.confirmedAppointments.complete ? "Complete for scanned lead cohort" : "Partial" : "Not available"}</strong></div>
                        </div>
                        {attributionQuery.data.outcomes.confirmedAppointments.status === "unavailable" && <p className="mt-3 text-sm text-muted-foreground">{attributionQuery.data.outcomes.confirmedAppointments.message ?? "Appointment records could not be read."}</p>}
                        <div className="mt-4 grid gap-4 sm:grid-cols-2">
                          <CountTable rows={attributionQuery.data.outcomes.appointmentRequests.byFirstTouchSource} label="Requests · first-touch source" field="label" />
                          <CountTable rows={attributionQuery.data.outcomes.appointmentRequests.byLastTouchSource} label="Requests · last-touch source" field="label" />
                          <CountTable rows={attributionQuery.data.outcomes.confirmedAppointments.byFirstTouchSource} label="Confirmed · first-touch source" field="label" />
                          <CountTable rows={attributionQuery.data.outcomes.confirmedAppointments.byLastTouchSource} label="Confirmed · last-touch source" field="label" />
                        </div>
                      </Section>
                      <Section title="Completed-purchase coverage" subtitle="Unlinked completed purchases use purchase created_at for this separate orphan count; the schema has no completed_at field.">
                        <div className="divide-y divide-border border-y border-border text-sm">
                          <div className="flex justify-between gap-3 py-3"><span>Linked completed purchases</span><strong>{attributionQuery.data.outcomes.completedPurchases.status === "available" ? number(attributionQuery.data.outcomes.completedPurchases.count) : "Not available"}</strong></div>
                          <div className="flex justify-between gap-3 py-3"><span>Unlinked completed purchases</span><strong>{attributionQuery.data.outcomes.completedPurchases.unlinkedStatus === "available" ? number(attributionQuery.data.outcomes.completedPurchases.unlinkedCompleted) : "Not available"}</strong></div>
                          <div className="flex justify-between gap-3 py-3"><span>Completed purchases with missing/invalid lead link</span><strong>{attributionQuery.data.outcomes.completedPurchases.status === "unavailable" ? "Not available" : attributionQuery.data.outcomes.completedPurchases.missingRelationship === null ? "Partial" : number(attributionQuery.data.outcomes.completedPurchases.missingRelationship)}</strong></div>
                          <div className="flex justify-between gap-3 py-3"><span>Linked completed purchases with unknown attribution</span><strong>{attributionQuery.data.outcomes.completedPurchases.status === "available" ? number(attributionQuery.data.outcomes.completedPurchases.unknownAttribution) : "Not available"}</strong></div>
                          <div className="flex justify-between gap-3 py-3"><span>Outcome data coverage</span><strong>{attributionQuery.data.outcomes.completedPurchases.status === "available" ? attributionQuery.data.outcomes.completedPurchases.complete ? "Complete for scanned lead cohort" : "Partial" : "Not available"}</strong></div>
                        </div>
                        {attributionQuery.data.outcomes.completedPurchases.status === "unavailable" && <p className="mt-3 text-sm text-muted-foreground">{attributionQuery.data.outcomes.completedPurchases.message ?? "Purchase records could not be read."}</p>}
                        <div className="mt-4 grid gap-4 sm:grid-cols-2">
                          <CountTable rows={attributionQuery.data.outcomes.completedPurchases.byFirstTouchSource} label="Sales · first-touch source" field="label" />
                          <CountTable rows={attributionQuery.data.outcomes.completedPurchases.byLastTouchSource} label="Sales · last-touch source" field="label" />
                        </div>
                      </Section>
                    </div>
                    {(!attributionQuery.data.outcomes.appointmentRequests.complete || !attributionQuery.data.outcomes.confirmedAppointments.complete || !attributionQuery.data.outcomes.completedPurchases.complete) && <p role="status" className="mt-3 border-l-2 border-amber-500 p-3 text-xs text-muted-foreground">Outcome breakdowns are partial when their linked lead cohort or bounded result scan is incomplete. No appointment or purchase causation is implied.</p>}
                  </Section>
                  <div className="grid gap-6 xl:grid-cols-2">
                    <Section
                      title="Latest recorded source"
                      subtitle="Normalized source with saved evidence level and original utm_source values."
                    >
                      {attributionQuery.data.bySource.length ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-sm">
                            <thead className="border-y border-border bg-muted/40 text-xs text-muted-foreground"><tr><th className="px-3 py-3">Source</th><th className="px-3 py-3">Evidence</th><th className="px-3 py-3">Raw utm_source</th><th className="px-3 py-3">Raw utm_medium</th><th className="px-3 py-3">Raw utm_campaign</th><th className="px-3 py-3">Leads</th></tr></thead>
                            <tbody>{attributionQuery.data.bySource.map((row, index) => (
                              <tr key={`${row.source}-${row.evidence}-${index}`} className="border-b border-border">
                                <td className="px-3 py-3 font-medium">{row.source}</td>
                                <td className="px-3"><Badge variant={row.evidence === "confirmed" ? "default" : "outline"}>{row.evidence}</Badge></td>
                                <td className="px-3 py-3 text-xs">{row.rawUtmSources.map((raw) => `${raw.label} (${raw.count})`).join(", ")}</td>
                                <td className="px-3 py-3 text-xs">{row.rawUtmMediums.map((raw) => `${raw.label} (${raw.count})`).join(", ")}</td>
                                <td className="px-3 py-3 text-xs">{row.rawUtmCampaigns.map((raw) => `${raw.label} (${raw.count})`).join(", ")}</td>
                                <td className="px-3">{number(row.count)}</td>
                              </tr>
                            ))}</tbody>
                          </table>
                        </div>
                      ) : <Empty>No leads were recorded in this date range.</Empty>}
                    </Section>
                    <Section title="Daily lead trend" subtitle="Buckets use actual lead creation timestamps grouped by UTC calendar date.">
                      {attributionQuery.data.daily.length ? (
                        <ChartContainer config={{ leads: { label: "Leads", color: "var(--color-primary)" } }} className="h-64 w-full aspect-auto">
                          <LineChart data={attributionQuery.data.daily} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                            <CartesianGrid vertical={false} strokeDasharray="3 3" />
                            <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={24} />
                            <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
                            <Tooltip content={<ChartTooltipContent />} />
                            <Line type="monotone" dataKey="count" name="leads" stroke="var(--color-leads)" strokeWidth={2} dot={false} />
                          </LineChart>
                        </ChartContainer>
                      ) : <Empty>No dated lead records in this range.</Empty>}
                    </Section>
                    <Section title="First touch" subtitle={`${number(attributionQuery.data.firstTouch.missing)} leads have no saved first-touch record.`}>
                      <CountTable rows={attributionQuery.data.firstTouch.bySource} label="Source · evidence" field="source" />
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <CountTable rows={attributionQuery.data.firstTouch.byMedium} label="Medium" field="label" />
                        <CountTable rows={attributionQuery.data.firstTouch.byCampaign} label="Campaign" field="label" />
                      </div>
                    </Section>
                    <Section title="Last touch" subtitle={`${number(attributionQuery.data.lastTouch.missing)} leads have no saved last-touch record.`}>
                      <CountTable rows={attributionQuery.data.lastTouch.bySource} label="Source · evidence" field="source" />
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <CountTable rows={attributionQuery.data.lastTouch.byMedium} label="Medium" field="label" />
                        <CountTable rows={attributionQuery.data.lastTouch.byCampaign} label="Campaign" field="label" />
                      </div>
                    </Section>
                    <Section title="Lead form type">
                      <CountTable rows={attributionQuery.data.byLeadType} label="Database lead type" field="leadType" />
                    </Section>
                    <Section title="Business intent">
                      <CountTable rows={attributionQuery.data.byIntent} label="Intent" field="intent" />
                    </Section>
                    <Section title="Purchase request kind">
                      <CountTable rows={attributionQuery.data.byRequestKind} label="Request kind" field="requestKind" />
                    </Section>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    These counts describe form submissions in MyCar’s lead records. GHL webhook
                    delivery is fire-and-forget and is not counted as a conversion here.
                  </p>
                </>
              ) : (
                <Empty>No lead attribution report is available.</Empty>
              )}
            </Section>
          </TabsContent>
          <TabsContent value="backlinks">
            <Section
              title="Referring domains"
              subtitle="Semrush Authority Score is not Ahrefs Domain Rating; values are not interchangeable."
              actions={refreshButton("research")}
            >
              <Unavailable report={snapshot.research} name="Semrush" />
              <ProviderTable data={research?.domains} />
            </Section>
            <Section title="Provider-discovered backlinks">
              <ProviderTable data={research?.backlinks} />
            </Section>
            <Section
              title="Outreach pipeline"
              subtitle="Research and outreach are manually reviewed; no automatic backlink placement."
              actions={
                <Button size="sm" onClick={() => setEdit(blankProspect())}>
                  <Plus className="size-3.5" />
                  Add prospect
                </Button>
              }
            >
              {prospects.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-muted/40 text-xs">
                      <tr>
                        {[
                          "Referring domain",
                          "Relevance",
                          "Outreach status",
                          "Backlink evidence",
                          "Actions",
                        ].map((s) => (
                          <th key={s} className="px-3 py-3 font-medium">
                            {s}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {prospects.map((p: Prospect) => (
                        <tr key={p.id} className="border-b border-border">
                          <td className="px-3 py-3 font-semibold">{p.domain}</td>
                          <td className="max-w-64 break-words px-3 text-xs">
                            {p.relevance || "—"}
                          </td>
                          <td className="px-3">
                            <Badge variant="outline">{p.status}</Badge>
                          </td>
                          <td className="px-3">
                            {p.backlinkUrl ? (
                              <a
                                href={p.backlinkUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-primary underline"
                              >
                                View link
                              </a>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-3">
                            <div className="flex">
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`Edit ${p.domain}`}
                                onClick={() => setEdit(p)}
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`Delete ${p.domain}`}
                                onClick={() => setDeleteId(p.id)}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty>No outreach prospects recorded.</Empty>
              )}
            </Section>
          </TabsContent>
          <TabsContent value="content">
            <Section
              title="Blog performance"
              subtitle="Published blog articles on mycarcorp.com. Articles already published stay live."
              actions={
                <div className="flex gap-2">
                  {refreshButton("website")}
                  <Button asChild variant="outline" size="sm">
                    <Link to="/admin/blog">
                      Open Blog workspace
                      <ArrowUpRight className="size-3.5" />
                    </Link>
                  </Button>
                </div>
              }
            >
              <div className="mb-5 flex flex-wrap items-center gap-3 border-y border-border py-4">
                <Badge variant="outline">{website ? `${number(website.articles.length)} published articles` : "Not checked"}</Badge>
                <span className="text-xs text-muted-foreground">
                  Counts and dates come from the website&apos;s published articles. Article views and rankings are in Google Analytics and Search Console.
                </span>
              </div>
              <Input
                aria-label="Search published articles"
                placeholder="Search published articles"
                value={articleFilter}
                onChange={(e) => setArticleFilter(e.target.value)}
                className="mb-4 max-w-sm"
              />
              {articles.length ? (
                <div className="divide-y divide-border">
                  {articles.map((a) => (
                    <div key={a.slug} className="flex items-center justify-between gap-3 py-4">
                      <div>
                        <p className="text-sm font-semibold">{a.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {articleOrigin(a.source)} · {date(a.publishedAt)}
                        </p>
                      </div>
                      <Button asChild variant="outline" size="sm">
                        <a
                          href={`/blog/${encodeURIComponent(a.slug)}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View
                          <ArrowUpRight className="size-3.5" />
                        </a>
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty>No published articles in the saved report.</Empty>
              )}
            </Section>
          </TabsContent>
          <TabsContent value="integrations">
            <Section
              title="Integration status"
              subtitle="Status reflects configured reports or code that is present; provider reporting requires verified authorization."
            >
              <div className="divide-y divide-border border-y border-border">
                {(
                  [
                    ["Google Search Console", "search", snapshot.search],
                    ["GitHub · Lighthouse CI", "lighthouse", snapshot.lighthouse],
                    ["Semrush", "research", snapshot.research],
                    ["Website health", "website", snapshot.website],
                  ] as const
                ).map(([name, service, report]) => (
                  <div
                    key={service}
                    className="flex flex-wrap items-start justify-between gap-4 py-5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-sm font-semibold">{name}</h3>
                        <Status report={report} />
                      </div>
                      <p className="mt-2 break-words text-xs text-muted-foreground">
                        {report.message}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Checked: {date(report.checkedAt)}
                        {report.state === "Error" && report.data
                          ? " · Showing last saved data"
                          : ""}
                      </p>
                    </div>
                    {refreshButton(service, "Check connection")}
                  </div>
                ))}
              </div>
            </Section>
            {propertyPicker}
            <Section title="Additional services">
              <div className="space-y-4 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <span>Google Analytics 4 reporting</span>
                  <Badge variant="outline">Not Connected</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  No GA4 Data API report is configured. Visitor and session reports require a GA4 property and approved server-side authorization.
                </p>
                <div className="flex flex-wrap justify-between gap-2">
                  <span>Google Ads reporting</span>
                  <Badge variant="outline">Not Connected</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  No Google Ads API account report is configured. Search Console organic clicks are not paid Ads performance.
                </p>
                <div className="flex flex-wrap justify-between gap-2">
                  <span>Meta Ads reporting</span>
                  <Badge variant="outline">Not Connected</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  The site source includes Meta Pixel PageView only; no Meta Marketing API reporting or ad conversion totals are connected.
                </p>
                <div className="flex flex-wrap justify-between gap-2"><span>Meta Pixel</span><Badge variant="outline">PageView in source</Badge></div>
                <p className="text-xs text-muted-foreground">The pixel is suppressed on admin routes. Pixel presence does not verify account access, consent configuration, or ad-attributed conversions.</p>
                <div className="flex flex-wrap justify-between gap-2"><span>Daily scheduled refresh</span><Badge variant="outline">Not Activated</Badge></div>
                <p className="text-xs text-muted-foreground">An authenticated refresh endpoint exists, but this dashboard does not claim an active schedule.</p>
              </div>
            </Section>
          </TabsContent>
        </Tabs>
      </main>
      <Dialog
        open={Boolean(edit)}
        onOpenChange={(open) => {
          if (!open) setEdit(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {edit?.id ? "Edit outreach prospect" : "Add outreach prospect"}
            </DialogTitle>
          </DialogHeader>
          {edit && (
            <form onSubmit={(e) => void submitProspect(e)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="prospect-domain">Referring domain</Label>
                <Input
                  id="prospect-domain"
                  value={edit.domain}
                  onChange={(e) => setEdit({ ...edit, domain: e.target.value })}
                  placeholder="example.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Outreach status</Label>
                <Select
                  value={edit.status}
                  onValueChange={(status: ProspectInput["status"]) => setEdit({ ...edit, status })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["Researching", "Contacted", "In discussion", "Acquired", "Not suitable"].map(
                      (s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="prospect-relevance">Relevance to My Car</Label>
                <Input
                  id="prospect-relevance"
                  value={edit.relevance}
                  onChange={(e) => setEdit({ ...edit, relevance: e.target.value })}
                  maxLength={300}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prospect-link">Acquired backlink URL</Label>
                <Input
                  id="prospect-link"
                  type="url"
                  value={edit.backlinkUrl}
                  onChange={(e) => setEdit({ ...edit, backlinkUrl: e.target.value })}
                  required={edit.status === "Acquired"}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prospect-notes">Notes</Label>
                <Textarea
                  id="prospect-notes"
                  value={edit.notes}
                  onChange={(e) => setEdit({ ...edit, notes: e.target.value })}
                  maxLength={2000}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEdit(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={Boolean(busy)}>
                  {busy === "save" && <Loader2 className="size-4 animate-spin" />}Save prospect
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(deleteId)}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove this outreach prospect?</DialogTitle>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={Boolean(busy)}
              onClick={() => void deleteProspect()}
            >
              Remove prospect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
