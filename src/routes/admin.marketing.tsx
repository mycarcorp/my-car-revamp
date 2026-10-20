import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
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
} from "lucide-react";
import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
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
  ["seo", "SEO Performance", Activity],
  ["gsc", "Google Search Console", Search],
  ["inspection", "URL Inspection", Search],
  ["keywords", "Semrush Research", Globe],
  ["backlinks", "Backlink Research", Link2],
  ["attribution", "Lead Attribution", Users],
  ["content", "SEO Automation", FileText],
  ["health", "Lighthouse & Website Health", CheckCircle2],
  ["reports", "Reports", ClipboardList],
  ["integrations", "Integrations & Settings", Settings2],
] as const;
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
  const snapshot = query.data?.snapshot ?? emptySnapshot();
  const prospects = query.data?.prospects ?? [];
  const [tab, setTab] = useState("overview"),
    [busy, setBusy] = useState<string | null>(null),
    [keyword, setKeyword] = useState(""),
    [articleFilter, setArticleFilter] = useState("");
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
                label="Organic search clicks"
                value={number(search?.totals?.clicks)}
                detail={
                  search?.startDate
                    ? `${search.startDate} – ${search.endDate}`
                    : "Search Console · No saved report"
                }
                icon={BarChart3}
              />
              <Metric
                label="Search impressions"
                value={number(search?.totals?.impressions)}
                detail="Google organic web search"
                icon={Search}
              />
              <Metric
                label="Published articles"
                value={website ? number(website.articles.length) : "—"}
                detail="AutoSEO + My Car editorial"
                icon={FileText}
              />
              <Metric
                label="Recorded outreach acquired"
                value={number(prospects.filter((p) => p.status === "Acquired").length)}
                detail="Manual prospect records; not a backlink count"
                icon={Link2}
              />
            </div>
            <Section
              title="Lead attribution snapshot"
              subtitle="Counts from saved lead records; no ad conversion totals are inferred."
              actions={
                <Button variant="outline" size="sm" onClick={() => setTab("attribution")}>
                  View attribution
                  <ArrowUpRight className="size-3.5" />
                </Button>
              }
            >
              {attributionQuery.isPending ? (
                <div className="flex items-center gap-2 py-5 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Loading lead source totals…
                </div>
              ) : attributionQuery.error ? (
                <div
                  role="alert"
                  className="border-l-2 border-destructive bg-background p-4 text-sm"
                >
                  Lead attribution could not be loaded: {attributionQuery.error.message}
                </div>
              ) : attributionQuery.data ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {attributionQuery.data.bySource.slice(0, 4).map((row) => (
                    <Metric
                      key={`${row.source}-${row.evidence}`}
                      label={`${row.source} · ${row.evidence}`}
                      value={number(row.count)}
                      detail={`${attributionQuery.data!.startDate} – ${attributionQuery.data!.endDate} · recorded leads`}
                      icon={Users}
                    />
                  ))}
                </div>
              ) : (
                <Empty>No lead attribution report is available.</Empty>
              )}
            </Section>
            <Section
              title="Monitoring pulse"
              subtitle="Saved reports only · no background polling"
              actions={
                <Button variant="outline" size="sm" onClick={() => setTab("integrations")}>
                  Manage integrations
                  <ArrowUpRight className="size-3.5" />
                </Button>
              }
            >
              <div className="divide-y divide-border border-y border-border">
                {(
                  [
                    ["Google Search Console", snapshot.search],
                    ["Semrush research", snapshot.research],
                    ["Lighthouse CI", snapshot.lighthouse],
                    ["Website & AutoSEO", snapshot.website],
                  ] as const
                ).map(([name, report]) => (
                  <div
                    key={name}
                    className="flex flex-wrap items-center justify-between gap-3 py-4"
                  >
                    <div>
                      <div className="text-sm font-semibold">{name}</div>
                      <p className="mt-1 text-xs text-muted-foreground">{date(report.checkedAt)}</p>
                    </div>
                    <Status report={report} />
                  </div>
                ))}
              </div>
            </Section>
            <Section
              title="Recent publications"
              actions={
                <Button variant="ghost" size="sm" onClick={() => setTab("content")}>
                  All articles
                  <ArrowUpRight className="size-3.5" />
                </Button>
              }
            >
              {articles.length ? (
                <div className="divide-y divide-border">
                  {articles.slice(0, 5).map((a) => (
                    <div key={a.slug} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{a.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {a.source} · {date(a.publishedAt)}
                        </p>
                      </div>
                      <Button asChild size="icon" variant="ghost">
                        <a
                          href={`/blog/${encodeURIComponent(a.slug)}`}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`View ${a.title}`}
                        >
                          <ArrowUpRight className="size-4" />
                        </a>
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty>Refresh Website & AutoSEO to read the existing publications.</Empty>
              )}
            </Section>
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
              subtitle="Inspects one URL against the currently selected verified Search Console property."
            >
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
                    ["Website & AutoSEO", snapshot.website, "website"],
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
              title="SEO Automation"
              subtitle="Manage AutoSEO quality checks, review, and publishing in the existing Blog workspace."
              actions={
                <div className="flex gap-2">
                  {refreshButton("website")}
                  <Button asChild variant="outline" size="sm">
                    <Link to="/admin/blog">
                      Open Blog & AutoSEO
                      <ArrowUpRight className="size-3.5" />
                    </Link>
                  </Button>
                </div>
              }
            >
              <div className="mb-5 flex flex-wrap items-center gap-3 border-y border-border py-4">
                <Badge variant="outline">
                  {website?.autoSeoTokenConfigured
                    ? "AutoSEO token configured"
                    : "AutoSEO not checked"}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Quality rules, duplicate-intent checks, review, and publish controls remain in the existing workflow.
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="border-y border-border py-4">
                  <p className="text-sm font-semibold">AutoSEO pipeline</p>
                  <p className="mt-1 text-xs text-muted-foreground">Existing generated-article queue and editorial tools.</p>
                  <Button asChild variant="link" size="sm" className="mt-2 h-auto p-0"><Link to="/admin/blog">Open article workspace<ArrowUpRight className="size-3.5" /></Link></Button>
                </div>
                <div className="border-y border-border py-4">
                  <p className="text-sm font-semibold">Quality checks & publishing</p>
                  <p className="mt-1 text-xs text-muted-foreground">Existing approval, quality scan, quality rules, and publish status controls.</p>
                  <Button asChild variant="link" size="sm" className="mt-2 h-auto p-0"><Link to="/admin/blog">Review controls<ArrowUpRight className="size-3.5" /></Link></Button>
                </div>
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
                          {a.source} · {date(a.publishedAt)}
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
                    ["Website & AutoSEO", "website", snapshot.website],
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
