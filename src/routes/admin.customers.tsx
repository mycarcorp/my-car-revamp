import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CalendarCheck,
  Car,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  HandCoins,
  Mail,
  MessageSquare,
  Loader2,
  Phone,
  Repeat2,
  Search,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTeamSection } from "@/components/admin/AdminTeamSection";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/app-client";
import { listCustomers } from "@/lib/admin-customers.functions";
import { listLeads, type AdminLeadRow } from "@/lib/admin-leads.functions";
import { getGhlDeliveryStatus, needsGhlFollowUp } from "@/lib/ghl-delivery-status";

export const Route = createFileRoute("/admin/customers")({
  component: AdminCustomers,
});

type PageTab = "customers" | "admins";

type AccountProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  legacy_user_id: string | null;
  created_at: string | null;
  roles: string[];
  position_id: number | null;
};

function AdminCustomers() {
  const { session } = useAuth();
  const accessToken = session?.access_token ?? "";

  const [pageTab, setPageTab] = useState<PageTab>("customers");
  const [adminSearch, setAdminSearch] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "customers"],
    enabled: Boolean(accessToken),
    queryFn: () =>
      listCustomers({
        data: { accessToken },
      }),
  });

  const accounts = (data ?? []) as AccountProfile[];

  const customerAccounts = useMemo(
    () => accounts.filter((account) => (account.roles ?? []).some((role) => role.trim().toLowerCase() === "customer")),
    [accounts],
  );

  return (
    <div className="w-full">
      <AdminPageHeader title="Customers" />

      <main className="space-y-6 p-4 sm:p-6">
        <div className="flex w-full overflow-x-auto border-b border-border">
          <button
            type="button"
            onClick={() => setPageTab("customers")}
            className={`flex min-w-max items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
              pageTab === "customers"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Users className="size-4" />
            Customers
          </button>

          <button
            type="button"
            onClick={() => setPageTab("admins")}
            className={`flex min-w-max items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
              pageTab === "admins"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <ShieldCheck className="size-4" />
            Admins
          </button>
        </div>

        {pageTab === "customers" ? (
          <LeadsSection accessToken={accessToken} accounts={customerAccounts} />
        ) : (
          <AdminTeamSection
            accounts={accounts}
            accessToken={accessToken}
            search={adminSearch}
            onSearchChange={setAdminSearch}
            isLoading={isLoading}
            error={error}
          />
        )}
      </main>
    </div>
  );
}

const LEAD_TYPES = [
  { key: "all", label: "All Customers" },
  { key: "finance", label: "Financing" },
  { key: "sell", label: "Sell" },
  { key: "trade", label: "Trade" },
  { key: "appointment", label: "Appointments" },
  { key: "availability", label: "Check Availability" },
  { key: "car_finder", label: "Car Finder" },
  { key: "contact", label: "Contact" },
] as const;

type LeadFilterType = (typeof LEAD_TYPES)[number]["key"];

type DateFilterType = "all" | "today";

const LEAD_LABELS: Record<string, string> = {
  finance: "Financing",
  appointment: "Appointment",
  availability: "Check Availability",
  contact: "Contact",
};

function normalizeEmail(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

function normalizePhone(value?: string | null) {
  return value?.replace(/\D/g, "") ?? "";
}

function normalizeName(value?: string | null) {
  return value?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";
}

function findAccountForLead(lead: AdminLeadRow, accounts: AccountProfile[]) {
  const leadEmail = normalizeEmail(lead.email);

  if (leadEmail) {
    const match = accounts.find((account) => normalizeEmail(account.email) === leadEmail);

    if (match) return match;
  }

  const leadPhone = normalizePhone(lead.phone);

  if (leadPhone) {
    const match = accounts.find((account) => normalizePhone(account.phone) === leadPhone);

    if (match) return match;
  }

  const leadName = normalizeName(lead.full_name);

  if (leadName) {
    return accounts.find((account) => normalizeName(account.full_name) === leadName);
  }

  return undefined;
}

function getTradeIntent(lead: AdminLeadRow) {
  const intent = lead.details?.["intent"];

  return typeof intent === "string" ? intent.trim().toLowerCase() : "";
}

function getLeadRequestType(lead: AdminLeadRow) {
  const value = getFirstDetail(lead, ["request_type", "requestType", "form_type", "formType"]);

  return typeof value === "string" ? normalizeDetailKey(value) : "";
}

function isCarFinderLead(lead: AdminLeadRow) {
  return lead.lead_type === "car_finder" || getLeadRequestType(lead) === "car_finder";
}

function getLeadTypeLabel(lead: AdminLeadRow) {
  if (isCarFinderLead(lead)) return "Car Finder";

  if (lead.lead_type === "trade") {
    return getTradeIntent(lead).includes("sell") ? "Sell" : "Trade";
  }

  return LEAD_LABELS[lead.lead_type] ?? lead.lead_type;
}

function matchesLeadType(lead: AdminLeadRow, selectedType: LeadFilterType) {
  if (selectedType === "all") return true;

  if (selectedType === "car_finder") {
    return isCarFinderLead(lead);
  }

  if (selectedType === "contact") {
    return lead.lead_type === "contact" && !isCarFinderLead(lead);
  }

  if (selectedType === "sell") {
    return lead.lead_type === "trade" && getTradeIntent(lead).includes("sell");
  }

  if (selectedType === "trade") {
    return lead.lead_type === "trade" && !getTradeIntent(lead).includes("sell");
  }

  return lead.lead_type === selectedType;
}

function getLeadCreatedDate(lead: AdminLeadRow) {
  if (!lead.created_at) return null;

  const date = new Date(lead.created_at);

  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function toLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function leadDateKey(lead: AdminLeadRow) {
  const date = getLeadCreatedDate(lead);

  return date ? toLocalDateKey(date) : null;
}

function formatSelectedCalendarDate(dateKey: string) {
  const [year = 1970, month = 1, day = 1] = dateKey.split("-").map(Number);

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function matchesDateFilter(lead: AdminLeadRow, selectedDate: DateFilterType, now = new Date()) {
  if (selectedDate === "all") return true;

  const createdAt = getLeadCreatedDate(lead);

  if (!createdAt) return false;

  const today = startOfLocalDay(now);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return createdAt >= today && createdAt < tomorrow;
}

function getFirstDetail(lead: AdminLeadRow, keys: string[]): unknown {
  const details = lead.details ?? {};

  for (const key of keys) {
    const value = details[key];

    if (value !== null && value !== undefined && value !== "") {
      return value;
    }
  }

  return null;
}

function getPreferredDate(lead: AdminLeadRow) {
  const value = getFirstDetail(lead, [
    "preferred_date",
    "preferredDate",
    "appointment_date",
    "appointmentDate",
    "visit_date",
    "visitDate",
    "date",
  ]);

  return value == null ? "—" : formatLongDate(value);
}

function getPreferredTime(lead: AdminLeadRow) {
  const value = getFirstDetail(lead, [
    "preferred_time",
    "preferredTime",
    "appointment_time",
    "appointmentTime",
    "visit_time",
    "visitTime",
    "time",
  ]);

  return value == null ? "—" : formatSimpleValue(value);
}

const ATTRIBUTION_KEYS = new Set([
  "lead_source",
  "lead_medium",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "fbclid",
  "gclid",
  "gbraid",
  "wbraid",
  "ttclid",
  "li_fat_id",
  "rdt_cid",
  "referrer",
  "landing_page",
  "conversion_page",
]);

function isAttributionDetailKey(key: string) {
  const normalized = normalizeDetailKey(key);
  return (
    ATTRIBUTION_KEYS.has(normalized) || normalized.startsWith("first_touch_") || normalized.startsWith("last_touch_")
  );
}

function getLeadSource(lead: AdminLeadRow) {
  const value = getFirstDetail(lead, ["lead_source", "last_touch_source"]);
  return value == null || String(value).trim() === "" ? "Not tracked" : String(value).trim();
}

function getLeadMedium(lead: AdminLeadRow) {
  const value = getFirstDetail(lead, ["lead_medium", "last_touch_medium"]);
  return value == null || String(value).trim() === "" ? "—" : String(value).trim();
}

function getAttributionEntries(lead: AdminLeadRow): LeadDetailEntry[] {
  return Object.entries(lead.details ?? {}).filter(
    ([key, value]) => value != null && value !== "" && isAttributionDetailKey(key),
  );
}

function detailText(lead: AdminLeadRow, keys: string[]) {
  const value = getFirstDetail(lead, keys);
  return value == null || String(value).trim() === "" ? "" : String(value).trim();
}

const CLICK_ID_KEYS = ["fbclid", "gclid", "gbraid", "wbraid", "ttclid", "li_fat_id", "rdt_cid"];

function LeadAttributionView({ lead, entries }: { lead: AdminLeadRow; entries: LeadDetailEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Not tracked — this lead was submitted before source tracking was added.
      </p>
    );
  }
  const touch = (prefix: "first_touch" | "last_touch") => ({
    source: detailText(lead, [`${prefix}_source`]),
    medium: detailText(lead, [`${prefix}_medium`]),
    campaign: detailText(lead, [`${prefix}_utm_campaign`]),
    when: detailText(lead, [`${prefix}_timestamp`]),
  });
  const first = touch("first_touch");
  const last = touch("last_touch");
  const source = getLeadSource(lead);
  const rows: Array<[string, string]> = [
    ["Campaign", detailText(lead, ["utm_campaign", "last_touch_utm_campaign"])],
    ["Ad content", detailText(lead, ["utm_content", "last_touch_utm_content"])],
    ["Keyword", detailText(lead, ["utm_term", "last_touch_utm_term"])],
    ["Landing page", detailText(lead, ["landing_page", "first_touch_landing_page"])],
    ["Conversion page", detailText(lead, ["conversion_page"])],
    ["Referrer", detailText(lead, ["referrer", "last_touch_referrer"])],
  ];
  const clickIds = CLICK_ID_KEYS.map((k) => [k, detailText(lead, [k, `last_touch_${k}`])] as const).filter(([, v]) => v);
  const fmt = (v: string) => {
    const d = new Date(v);
    return v && !Number.isNaN(d.getTime()) ? d.toLocaleString() : "";
  };
  return (
    <div className="space-y-4">
      {source === "Direct" && (
        <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
          Direct: No identifiable marketing source was captured.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {([["First touch", first], ["Last touch", last]] as const).map(([label, t]) => (
          <div key={label} className="rounded-lg border border-border p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-1 font-semibold">{t.source || "Not tracked"}</p>
            <p className="text-xs text-muted-foreground">
              {[t.medium, t.campaign].filter(Boolean).join(" · ") || "—"}
            </p>
            {t.when && <p className="mt-1 text-xs text-muted-foreground">{fmt(t.when)}</p>}
          </div>
        ))}
      </div>
      <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[140px_1fr]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="break-all">{v || "—"}</dd>
          </div>
        ))}
        {clickIds.length > 0 && (
          <div className="contents">
            <dt className="text-muted-foreground">Click IDs</dt>
            <dd className="break-all text-xs">{clickIds.map(([k, v]) => `${k}: ${v}`).join("  ·  ")}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}

function LeadsSection({ accessToken, accounts }: { accessToken: string; accounts: AccountProfile[] }) {
  const queryClient = useQueryClient();
  const [type, setType] = useState<LeadFilterType>("all");
  const [dateFilter, setDateFilter] = useState<DateFilterType>("all");
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();

    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [search, setSearch] = useState("");
  const [followUpOnly, setFollowUpOnly] = useState(false);
  const [selectedLead, setSelectedLead] = useState<AdminLeadRow | null>(null);
  const [deletingLeadId, setDeletingLeadId] = useState<string | number | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "leads", "customers-page"],
    enabled: Boolean(accessToken),
    queryFn: () =>
      listLeads({
        data: {
          accessToken,
          limit: 1000,
        },
      }),
  });

  const leads = data ?? [];

  async function removeLead(lead: AdminLeadRow) {
    const confirmed = window.confirm(
      `Remove the ${getLeadTypeLabel(lead).toLowerCase()} lead from ${lead.full_name || "this customer"}? This cannot be undone.`,
    );

    if (!confirmed) return;

    setDeletingLeadId(lead.id);

    try {
      const { data: removedRows, error: removeError } = await supabase
        .from("leads")
        .delete()
        .eq("id", lead.id)
        .select("id");

      if (removeError) throw removeError;

      if (!removedRows?.length) {
        throw new Error(
          "The lead was not removed. Confirm that authenticated admins have DELETE access to the leads table.",
        );
      }

      setSelectedLead(null);
      await queryClient.invalidateQueries({ queryKey: ["admin", "leads"] });
      toast.success("Lead removed successfully.");
    } catch (removeError) {
      toast.error(removeError instanceof Error ? removeError.message : "Could not remove this lead.");
    } finally {
      setDeletingLeadId(null);
    }
  }

  const leadsToday = useMemo(() => {
    const now = new Date();

    return leads.filter((lead) => matchesDateFilter(lead, "today", now)).length;
  }, [leads]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const now = Date.now();

    return leads.filter((lead) => {
      if (!matchesLeadType(lead, type)) return false;
      if (followUpOnly && !needsGhlFollowUp(lead, now)) return false;
      if (selectedCalendarDate) {
        if (leadDateKey(lead) !== selectedCalendarDate) return false;
      } else if (!matchesDateFilter(lead, dateFilter)) {
        return false;
      }
      if (!needle) return true;

      return [
        lead.full_name,
        getLeadTypeLabel(lead),
        getLeadSource(lead),
        getLeadMedium(lead),
        getPreferredDate(lead),
        getPreferredTime(lead),
        lead.status || "new",
        getGhlDeliveryStatus(lead, now).label,
        lead.created_at ? formatLongDate(lead.created_at) : "—",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [leads, type, dateFilter, selectedCalendarDate, search, followUpOnly]);

  const followUpCount = useMemo(() => {
    const now = Date.now();

    return leads.filter((lead) => needsGhlFollowUp(lead, now)).length;
  }, [leads]);

  const countFor = (key: LeadFilterType) => leads.filter((lead) => matchesLeadType(lead, key)).length;

  const activeOverviewKey =
    !selectedCalendarDate && type === "all" && dateFilter === "today"
      ? "today"
      : !selectedCalendarDate && dateFilter === "all" && type !== "all"
        ? type
        : null;

  const overviewFilters = [
    {
      key: "today",
      label: "Leads today",
      value: leadsToday,
      icon: Clock3,
      className: "text-[#D25B4C] bg-[#D25B4C]/12",
    },

    {
      key: "finance",
      label: "Financing",
      value: countFor("finance"),
      icon: HandCoins,
      className: "text-[#809C61] bg-[#809C61]/12",
    },
    {
      key: "sell",
      label: "Sell",
      value: countFor("sell"),
      icon: Car,
      className: "text-[#EDBA2B] bg-[#EDBA2B]/12",
    },
    {
      key: "trade",
      label: "Trade",
      value: countFor("trade"),
      icon: Repeat2,
      className: "text-[#D25B4C] bg-[#D25B4C]/12",
    },
    {
      key: "appointment",
      label: "Appointments",
      value: countFor("appointment"),
      icon: CalendarCheck,
      className: "text-[#809C61] bg-[#809C61]/12",
    },
    {
      key: "availability",
      label: "Check Availability",
      value: countFor("availability"),
      icon: Car,
      className: "text-[#EDBA2B] bg-[#EDBA2B]/12",
    },
    {
      key: "car_finder",
      label: "Car Finder",
      value: countFor("car_finder"),
      icon: Search,
      className: "text-[#809C61] bg-[#809C61]/12",
    },
    {
      key: "contact",
      label: "Contact",
      value: countFor("contact"),
      icon: MessageSquare,
      className: "text-[#D25B4C] bg-[#D25B4C]/12",
    },
  ] as const;

  function selectOverviewFilter(key: (typeof overviewFilters)[number]["key"]) {
    if (key === "today") {
      const isAlreadyActive = activeOverviewKey === "today";

      setType("all");
      setDateFilter(isAlreadyActive ? "all" : "today");
      setSelectedCalendarDate(null);
      return;
    }

    const isAlreadyActive = activeOverviewKey === key;

    setType(isAlreadyActive ? "all" : key);
    setDateFilter("all");
    setSelectedCalendarDate(null);
  }

  return (
    <>
      <section className="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
        <div className="flex flex-col gap-4 border-b border-border bg-muted/30 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Users className="size-5" />
            </div>

            <h2 className="font-semibold">Customer Submissions</h2>
          </div>

          <div className="flex w-full flex-col gap-2 sm:flex-row lg:max-w-2xl lg:justify-end">
            <button
              type="button"
              onClick={() => {
                if (selectedCalendarDate) {
                  const [year = 1970, month = 1] = selectedCalendarDate.split("-").map(Number);
                  setCalendarMonth(new Date(year, month - 1, 1));
                }

                setCalendarOpen(true);
              }}
              className={`flex h-10 w-full items-center justify-between gap-3 rounded-md border bg-background px-3 text-sm shadow-sm transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-56 ${
                selectedCalendarDate ? "border-primary text-foreground" : "border-input text-muted-foreground"
              }`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <CalendarDays className="size-4 shrink-0" />
                <span className="truncate">
                  {selectedCalendarDate ? formatSelectedCalendarDate(selectedCalendarDate) : "Filter by calendar"}
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 rotate-90" />
            </button>

            <div className="relative w-full sm:min-w-0 sm:flex-1 lg:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

              <Input
                type="search"
                className="pl-9"
                placeholder="Search name, request, date, time or status"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="border-b border-border p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-foreground">Leads overview</h3>
              <p className="mt-1 text-sm text-muted-foreground">Select a card to filter the customer submissions.</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setFollowUpOnly((value) => !value)}
                aria-pressed={followUpOnly}
                title="Leads whose delivery to GoHighLevel failed, is unconfirmed, or stalled while sending. Read-only: nothing is resent."
                className={`inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  followUpOnly
                    ? "border-[#F49923] bg-[#F49923] text-black"
                    : "border-input bg-background text-foreground hover:border-primary/40"
                }`}
              >
                <AlertTriangle className="size-4" aria-hidden="true" />
                Needs GHL Follow-up
                <span className="rounded-full bg-black/10 px-2 text-xs">{isLoading ? "—" : followUpCount.toLocaleString()}</span>
              </button>

              {activeOverviewKey || selectedCalendarDate || followUpOnly ? (
                <button
                  type="button"
                  onClick={() => {
                    setType("all");
                    setDateFilter("all");
                    setSelectedCalendarDate(null);
                    setFollowUpOnly(false);
                  }}
                  className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  Clear filter
                </button>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8">
            {overviewFilters.map((item) => {
              const Icon = item.icon;
              const active = activeOverviewKey === item.key;

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => selectOverviewFilter(item.key)}
                  aria-pressed={active}
                  className={`group rounded-lg border p-4 text-left transition-[background-color,border-color,box-shadow,transform] duration-300 ease-out hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F49923]/40 ${
                    active
                      ? "border-[#F49923] bg-[#F49923] text-black shadow-sm"
                      : "border-border bg-background hover:border-primary/40"
                  }`}
                >
                  <div
                    className={`flex size-9 items-center justify-center rounded-lg transition-colors duration-300 ${
                      active ? "bg-black/10 text-black" : item.className
                    }`}
                  >
                    <Icon className="size-[18px]" aria-hidden="true" />
                  </div>

                  <p
                    className={`mt-3 text-2xl font-semibold transition-colors duration-300 ${
                      active ? "text-black" : "text-foreground"
                    }`}
                  >
                    <span
                      key={`${active}-${item.value}`}
                      className="inline-block animate-in fade-in zoom-in-95 duration-300"
                    >
                      {isLoading ? "—" : item.value.toLocaleString()}
                    </span>
                  </p>

                  <p
                    className={`mt-1 line-clamp-2 text-sm transition-colors duration-300 ${
                      active ? "font-medium text-black" : "text-muted-foreground"
                    }`}
                  >
                    {item.label}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {isLoading ? (
          <RowsLoading />
        ) : error ? (
          <div role="alert" className="p-6">
            <p className="font-medium text-destructive">Couldn&apos;t load customer submissions</p>
            <p className="mt-1 text-sm text-muted-foreground">{(error as Error).message}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <Users className="mx-auto size-8 text-muted-foreground/60" />
            <p className="mt-3 font-medium">No customer submissions found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Try changing the request type, calendar filter, GHL follow-up filter, or search term.
            </p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-border md:hidden">
              {filtered.map((lead) => {
                const account = findAccountForLead(lead, accounts);

                return (
                  <button
                    key={lead.id}
                    type="button"
                    onClick={() => setSelectedLead(lead)}
                    className="flex w-full items-start justify-between gap-3 p-4 text-left transition-colors hover:bg-muted/40"
                  >
                    <div className="flex min-w-0 flex-1 gap-3">
                      <ProfileAvatar
                        avatarUrl={account?.avatar_url}
                        name={account?.full_name ?? lead.full_name ?? "Customer"}
                        verified={Boolean(account)}
                        size="md"
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-medium">{lead.full_name || "Unnamed customer"}</p>

                          <Badge variant="secondary">{getLeadTypeLabel(lead)}</Badge>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                          <MobileValue label="Source" value={getLeadSource(lead)} />
                          <MobileValue label="Medium" value={getLeadMedium(lead)} />
                          <MobileValue label="Date" value={getPreferredDate(lead)} />
                          <MobileValue label="Time" value={getPreferredTime(lead)} />

                          <div>
                            <p className="text-muted-foreground">Status</p>
                            <Badge variant={lead.status === "won" ? "default" : "outline"} className="mt-1 capitalize">
                              {lead.status || "new"}
                            </Badge>
                          </div>

                          <MobileValue
                            label="Submitted"
                            value={lead.created_at ? formatLongDate(lead.created_at) : "—"}
                          />

                          <div>
                            <p className="text-muted-foreground">GHL delivery</p>
                            <GhlDeliveryBadge lead={lead} className="mt-1" />
                          </div>
                        </div>
                      </div>
                    </div>

                    <ChevronRight className="mt-1 size-5 shrink-0 text-muted-foreground" />
                  </button>
                );
              })}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[1150px] table-fixed text-left text-sm">
                <colgroup>
                  <col className="w-[18%]" />
                  <col className="w-[11%]" />
                  <col className="w-[12%]" />
                  <col className="w-[13%]" />
                  <col className="w-[8%]" />
                  <col className="w-[9%]" />
                  <col className="w-[12%]" />
                  <col className="w-[13%]" />
                  <col className="w-[4%]" />
                </colgroup>

                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Request</th>
                    <th className="px-4 py-3 font-medium">Source</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Time</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">GHL delivery</th>
                    <th className="px-4 py-3 font-medium">Submitted</th>
                    <th className="px-4 py-3">
                      <span className="sr-only">Open</span>
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filtered.map((lead) => {
                    const account = findAccountForLead(lead, accounts);

                    return (
                      <tr
                        key={lead.id}
                        role="button"
                        tabIndex={0}
                        aria-label={`Open submission from ${lead.full_name || "customer"}`}
                        onClick={() => setSelectedLead(lead)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelectedLead(lead);
                          }
                        }}
                        className="cursor-pointer border-t border-border transition-colors hover:bg-muted/40 focus:bg-muted/40 focus:outline-none"
                      >
                        <td className="px-4 py-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <ProfileAvatar
                              avatarUrl={account?.avatar_url}
                              name={account?.full_name ?? lead.full_name ?? "Customer"}
                              verified={Boolean(account)}
                              size="sm"
                            />

                            <p className="truncate font-medium">{lead.full_name || "Unnamed customer"}</p>
                          </div>
                        </td>

                        <td className="overflow-hidden px-4 py-3">
                          <Badge variant="secondary" className="max-w-full truncate">
                            {getLeadTypeLabel(lead)}
                          </Badge>
                        </td>

                        <td className="overflow-hidden px-4 py-3">
                          <Badge variant="outline" className="max-w-full truncate">
                            {getLeadSource(lead)}
                          </Badge>
                        </td>

                        <td className="truncate px-4 py-3 text-muted-foreground">{getPreferredDate(lead)}</td>

                        <td className="truncate px-4 py-3 text-muted-foreground">{getPreferredTime(lead)}</td>

                        <td className="px-4 py-3">
                          <Badge
                            variant={lead.status === "won" ? "default" : "outline"}
                            className="max-w-full truncate capitalize"
                          >
                            {lead.status || "new"}
                          </Badge>
                        </td>

                        <td className="overflow-hidden px-4 py-3">
                          <GhlDeliveryBadge lead={lead} />
                        </td>

                        <td className="truncate px-4 py-3 text-muted-foreground">
                          {lead.created_at ? formatLongDate(lead.created_at) : "—"}
                        </td>

                        <td className="px-4 py-3">
                          <ChevronRight className="size-4 text-muted-foreground" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <LeadCalendarDialog
        open={calendarOpen}
        onOpenChange={setCalendarOpen}
        leads={leads}
        month={calendarMonth}
        onMonthChange={setCalendarMonth}
        selectedDate={selectedCalendarDate}
        onSelectDate={(dateKey) => {
          setSelectedCalendarDate(dateKey);
          setDateFilter("all");
          setCalendarOpen(false);
        }}
        onClearDate={() => {
          setSelectedCalendarDate(null);
          setDateFilter("all");
          setCalendarOpen(false);
        }}
      />

      <LeadDetailsDialog
        lead={selectedLead}
        account={selectedLead ? findAccountForLead(selectedLead, accounts) : undefined}
        open={Boolean(selectedLead)}
        deleting={selectedLead ? deletingLeadId === selectedLead.id : false}
        onDelete={(lead) => void removeLead(lead)}
        onOpenChange={(open) => {
          if (!open && !deletingLeadId) setSelectedLead(null);
        }}
      />
    </>
  );
}

/** Read-only GoHighLevel delivery badge: fixed labels only, never HTTP codes, errors or URLs. */
function GhlDeliveryBadge({ lead, className = "" }: { lead: AdminLeadRow; className?: string }) {
  const status = getGhlDeliveryStatus(lead);

  if (status.kind === "not_applicable") return <span className={`text-muted-foreground ${className}`}>—</span>;

  const tone =
    status.kind === "delivered"
      ? "border-[#809C61]/50 bg-[#809C61]/12 text-foreground"
      : status.needsFollowUp
        ? "border-[#D25B4C]/50 bg-[#D25B4C]/12 text-foreground"
        : "text-muted-foreground";

  return (
    <Badge variant="outline" title={status.hint} className={`max-w-full truncate ${tone} ${className}`}>
      {status.label}
    </Badge>
  );
}

function LeadCalendarDialog({
  open,
  onOpenChange,
  leads,
  month,
  onMonthChange,
  selectedDate,
  onSelectDate,
  onClearDate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leads: AdminLeadRow[];
  month: Date;
  onMonthChange: (month: Date) => void;
  selectedDate: string | null;
  onSelectDate: (dateKey: string) => void;
  onClearDate: () => void;
}) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstDayOffset = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const todayKey = toLocalDateKey(new Date());

  const countsByDate = useMemo(() => {
    const counts = new Map<string, number>();

    leads.forEach((lead) => {
      const key = leadDateKey(lead);
      if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
    });

    return counts;
  }, [leads]);

  const monthPrefix = `${year}-${String(monthIndex + 1).padStart(2, "0")}-`;
  const monthTotal = Array.from(countsByDate.entries()).reduce(
    (total, [dateKey, count]) => (dateKey.startsWith(monthPrefix) ? total + count : total),
    0,
  );

  const cells: Array<number | null> = [
    ...Array.from({ length: firstDayOffset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];

  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1.5rem)] max-w-xl p-0">
        <DialogHeader className="border-b border-border px-5 py-4 pr-12">
          <DialogTitle>Filter leads by date</DialogTitle>
          <DialogDescription>
            Select a day to show its submissions. Days with leads display their total.
          </DialogDescription>
        </DialogHeader>

        <div className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => onMonthChange(new Date(year, monthIndex - 1, 1))}
              aria-label="Previous month"
              className="flex size-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronLeft className="size-4" />
            </button>

            <div className="text-center">
              <p className="font-semibold text-foreground">
                {new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(month)}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {monthTotal.toLocaleString()} {monthTotal === 1 ? "lead" : "leads"} this month
              </p>
            </div>

            <button
              type="button"
              onClick={() => onMonthChange(new Date(year, monthIndex + 1, 1))}
              aria-label="Next month"
              className="flex size-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          <div className="mt-5 grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div key={day} className="py-2">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, index) => {
              if (day === null) return <div key={`empty-${index}`} className="aspect-square" />;

              const dateKey = toLocalDateKey(new Date(year, monthIndex, day));
              const count = countsByDate.get(dateKey) ?? 0;
              const selected = selectedDate === dateKey;
              const today = todayKey === dateKey;

              return (
                <button
                  key={dateKey}
                  type="button"
                  onClick={() => onSelectDate(dateKey)}
                  aria-label={`${formatSelectedCalendarDate(dateKey)}${count ? `, ${count} leads` : ", no leads"}`}
                  className={`flex aspect-square min-h-11 flex-col items-center justify-center rounded-lg border text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    selected
                      ? "border-primary bg-primary text-primary-foreground"
                      : count > 0
                        ? "border-[#809C61]/40 bg-[#809C61]/10 text-foreground hover:bg-[#809C61]/20"
                        : "border-transparent text-muted-foreground hover:bg-muted"
                  } ${today && !selected ? "ring-1 ring-[#EDBA2B]" : ""}`}
                >
                  <span className="font-medium">{day}</span>
                  {count > 0 ? (
                    <span
                      className={`mt-0.5 rounded-full px-1.5 text-[10px] font-semibold leading-4 ${
                        selected ? "bg-primary-foreground/20 text-primary-foreground" : "bg-[#809C61] text-white"
                      }`}
                    >
                      {count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <button
              type="button"
              onClick={() => {
                const today = new Date();
                onMonthChange(new Date(today.getFullYear(), today.getMonth(), 1));
              }}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Go to current month
            </button>

            {selectedDate ? (
              <button
                type="button"
                onClick={onClearDate}
                className="rounded-md border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
              >
                Clear date filter
              </button>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LeadDetailsDialog({
  lead,
  account,
  open,
  deleting,
  onDelete,
  onOpenChange,
}: {
  lead: AdminLeadRow | null;
  account?: AccountProfile | undefined;
  open: boolean;
  deleting: boolean;
  onDelete: (lead: AdminLeadRow) => void;
  onOpenChange: (open: boolean) => void;
}) {
  if (!lead) return null;

  const details = Object.entries(lead.details ?? {}).filter(
    ([key, value]) =>
      value !== null && value !== undefined && value !== "" && !isHiddenModalField(key) && !isAttributionDetailKey(key),
  );
  const attributionEntries = getAttributionEntries(lead);

  const selectedVehicleEntries = details.filter(([key]) => isSelectedVehicleKey(key));
  const otherDetails = details.filter(([key]) => !isSelectedVehicleKey(key));
  const detailSections = organizeLeadDetails(lead, otherDetails);
  const preferredContact = getFirstDetail(lead, ["preferred_contact_method", "preferredContactMethod"]);
  const preferredDate = getPreferredDate(lead);
  const preferredTime = getPreferredTime(lead);
  const hasSchedule = preferredDate !== "—" || preferredTime !== "—";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[calc(100%-1.5rem)] max-w-5xl flex-col overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-border bg-background px-5 py-4 pr-12 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <DialogTitle className="text-lg sm:text-xl">{getLeadTypeLabel(lead)} Request</DialogTitle>
              <DialogDescription className="mt-1">
                Review the customer and submitted form information.
              </DialogDescription>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="secondary">{getLeadTypeLabel(lead)}</Badge>
              <Badge variant={lead.status === "won" ? "default" : "outline"} className="capitalize">
                {lead.status || "new"}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto bg-muted/20 p-4 sm:p-6">
          <div className="mx-auto grid max-w-[1100px] grid-cols-1 gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
            <aside className="lg:sticky lg:top-0 lg:self-start">
              <section className="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
                <div className="flex flex-col items-center border-b border-border bg-muted/20 px-5 py-6 text-center">
                  <ProfileAvatar
                    avatarUrl={account?.avatar_url}
                    name={account?.full_name ?? lead.full_name ?? "Customer"}
                    verified={Boolean(account)}
                    size="xl"
                  />

                  <h3 className="mt-4 max-w-full break-words text-lg font-semibold text-foreground">
                    {lead.full_name || "Unnamed customer"}
                  </h3>

                  {account ? (
                    <span className="mt-2 rounded-full bg-[#809c61]/15 px-2.5 py-1 text-[11px] font-medium text-[#61794a]">
                      Registered customer
                    </span>
                  ) : (
                    <span className="mt-2 text-xs text-muted-foreground">Guest submission</span>
                  )}
                </div>

                <div className="space-y-5 p-4">
                  <div className="space-y-3">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Contact information
                    </p>
                    <ContactRow
                      icon={Mail}
                      label="Email"
                      value={lead.email}
                      href={lead.email ? `mailto:${lead.email}` : undefined}
                    />

                    <ContactRow
                      icon={Phone}
                      label="Phone"
                      value={lead.phone}
                      href={lead.phone ? `tel:${lead.phone}` : undefined}
                    />
                  </div>

                  <div className="border-t border-border pt-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Personal information
                    </p>
                    <div className="space-y-3">
                      <CompactValue
                        label="Preferred contact"
                        value={preferredContact ? formatSimpleValue(preferredContact) : "Not provided"}
                      />
                      <CompactValue label="Status" value={capitalizeText(lead.status || "new")} />
                      <CompactValue label="Submitted" value={lead.created_at ? formatLongDate(lead.created_at) : "—"} />
                    </div>
                  </div>

                  <div className="border-t border-border pt-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Lead source
                    </p>
                    <div className="space-y-3">
                      <CompactValue label="Source" value={getLeadSource(lead)} />
                      <CompactValue label="Medium" value={getLeadMedium(lead)} />
                    </div>
                  </div>

                  {hasSchedule ? (
                    <div className="border-t border-border pt-4">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Preferred schedule
                      </p>
                      <div className="space-y-3">
                        <CompactValue label="Date" value={preferredDate} />
                        <CompactValue label="Time" value={preferredTime} />
                      </div>
                    </div>
                  ) : null}

                  <div className="border-t border-border pt-4">
                    <Button
                      type="button"
                      variant="destructive"
                      className="w-full justify-center gap-2"
                      disabled={deleting}
                      onClick={() => onDelete(lead)}
                    >
                      {deleting ? (
                        <>
                          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                          Removing…
                        </>
                      ) : (
                        <>
                          <Trash2 className="size-4" aria-hidden="true" />
                          Remove lead
                        </>
                      )}
                    </Button>
                    <p className="mt-2 text-center text-[11px] leading-4 text-muted-foreground">
                      Permanently removes this submission.
                    </p>
                  </div>
                </div>
              </section>
            </aside>

            <div className="min-w-0 space-y-5">
              <FormSectionCard
                title="Lead Attribution"
                description="Where this customer came from before submitting the form."
              >
                <LeadAttributionView lead={lead} entries={attributionEntries} />
              </FormSectionCard>

              {selectedVehicleEntries.length > 0 && (
                <FormSectionCard
                  title={lead.lead_type === "trade" ? "Vehicle the Customer Wants" : "Selected Vehicle"}
                  description="Vehicle selected by the customer."
                >
                  <div className="space-y-3">
                    {selectedVehicleEntries.map(([key, value]) => (
                      <SelectedVehiclesDisplay key={key} value={value} />
                    ))}
                  </div>
                </FormSectionCard>
              )}

              {detailSections.map((section) => (
                <FormSectionCard key={section.title} title={section.title} description={section.description}>
                  <OrganizedDetailGrid entries={section.entries} />
                </FormSectionCard>
              ))}

              {lead.message ? (
                <FormSectionCard title="Customer Message">
                  <p className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground">{lead.message}</p>
                </FormSectionCard>
              ) : null}

              {selectedVehicleEntries.length === 0 && detailSections.length === 0 && !lead.message ? (
                <div className="rounded-xl border border-dashed border-border bg-background p-8 text-center text-sm text-muted-foreground">
                  No additional form information was submitted.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type LeadDetailEntry = [string, unknown];

type LeadDetailSection = {
  title: string;
  description: string | undefined;
  entries: LeadDetailEntry[];
};

function normalizeDetailKey(key: string) {
  return key
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[-\s]+/g, "_")
    .toLowerCase();
}

function isHiddenModalField(key: string) {
  const normalized = normalizeDetailKey(key);
  return new Set([
    "id",
    "submission_id",
    "submissionid",
    "lead_id",
    "created_at",
    "updated_at",
    "received_at",
    "status",
    "lead_type",
    "form_type",
    "request_type",
    "source",
    "full_name",
    "customer_name",
    "first_name",
    "last_name",
    "email",
    "customer_email",
    "phone",
    "customer_phone",
    "phone_number",
    "message",
    "preferred_contact_method",
    "preferred_date",
    "preferred_time",
    "appointment_date",
    "appointment_time",
  ]).has(normalized);
}

function detailSectionFor(lead: AdminLeadRow, key: string) {
  const normalized = normalizeDetailKey(key);
  const requestType = getLeadTypeLabel(lead).toLowerCase();

  if (isCarFinderLead(lead)) {
    if (
      /(preferred_make|preferred_model|preferred_year|preferred_body|maximum_budget|budget|financing_needed|must_have|feature|vehicle|make|model|year|body_style)/.test(
        normalized,
      )
    ) {
      return "Car Finder Preferences";
    }

    return "Car Finder Request";
  }

  if (/(reference|co_signer|cosigner)/.test(normalized)) return "References";
  if (/(address|city|state|province|postal|zip|residence)/.test(normalized)) return "Address Information";
  if (/(employer|employment|occupation|job_|income|salary|work_)/.test(normalized)) return "Employment & Income";

  if (/(wish|preference|desired_vehicle|vehicle_wanted|looking_for)/.test(normalized)) {
    return "Vehicle the Customer Wants";
  }

  if (requestType === "sell") {
    if (/(vehicle|year|make|model|trim|vin|mileage|condition|payoff|ownership|title)/.test(normalized)) {
      return "Vehicle to Sell";
    }
    return "Sell Request Details";
  }

  if (requestType === "trade") {
    if (/(trade|year|make|model|trim|vin|mileage|condition|payoff|ownership|title)/.test(normalized)) {
      return "Trade-In Vehicle";
    }
    return "Trade Request Details";
  }

  if (requestType === "financing") {
    if (/(vehicle|stock|year|make|model|trim|vin)/.test(normalized)) return "Vehicle Information";
    if (/(credit|payment|down_|loan|finance|bank|rent|mortgage|monthly|annual)/.test(normalized)) {
      return "Financing Information";
    }
    return "Applicant Information";
  }

  if (requestType.includes("appointment")) {
    if (/(vehicle|stock|year|make|model|trim|vin)/.test(normalized)) return "Vehicle Information";
    return "Appointment Details";
  }

  if (requestType.includes("availability")) {
    if (/(vehicle|stock|year|make|model|trim|vin)/.test(normalized)) return "Vehicle Inquiry";
    return "Availability Request";
  }

  if (requestType === "contact") return "Contact Request";
  return "Additional Information";
}

function sectionDescription(title: string) {
  const descriptions: Record<string, string> = {
    "Applicant Information": "Personal information supplied with the financing application.",
    "Address Information": "Current and mailing address details.",
    "Employment & Income": "Employment and income information supplied by the applicant.",
    References: "Personal or professional references supplied with the application.",
    "Financing Information": "Requested financing, credit, and payment information.",
    "Vehicle Information": "Vehicle connected to this request.",
    "Vehicle to Sell": "Information about the vehicle the customer wants to sell.",
    "Trade-In Vehicle": "Information about the vehicle offered for trade-in.",
    "Vehicle the Customer Wants": "Preferences for the customer’s next vehicle.",
    "Car Finder Preferences": "Vehicle preferences submitted through the Car Finder form.",
    "Car Finder Request": "Additional information submitted with the Car Finder request.",
    "Appointment Details": "Information submitted with the visit request.",
    "Vehicle Inquiry": "Vehicle the customer asked about.",
    "Availability Request": "Details submitted with the availability request.",
    "Contact Request": "Additional information submitted through the contact form.",
  };
  return descriptions[title];
}

function organizeLeadDetails(lead: AdminLeadRow, entries: LeadDetailEntry[]): LeadDetailSection[] {
  const groups = new Map<string, LeadDetailEntry[]>();

  for (const entry of entries) {
    const title = detailSectionFor(lead, entry[0]);
    const existing = groups.get(title) ?? [];
    existing.push(entry);
    groups.set(title, existing);
  }

  const preferredOrder = [
    "Applicant Information",
    "Vehicle Information",
    "Vehicle to Sell",
    "Trade-In Vehicle",
    "Vehicle the Customer Wants",
    "Car Finder Preferences",
    "Car Finder Request",
    "Financing Information",
    "Address Information",
    "Employment & Income",
    "References",
    "Appointment Details",
    "Vehicle Inquiry",
    "Availability Request",
    "Contact Request",
    "Sell Request Details",
    "Trade Request Details",
    "Additional Information",
  ];

  return [...groups.entries()]
    .sort(([first], [second]) => {
      const firstIndex = preferredOrder.indexOf(first);
      const secondIndex = preferredOrder.indexOf(second);
      return (firstIndex < 0 ? 999 : firstIndex) - (secondIndex < 0 ? 999 : secondIndex);
    })
    .map(([title, sectionEntries]) => ({
      title,
      description: sectionDescription(title),
      entries: sectionEntries,
    }));
}

function FormSectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
      <div className="border-b border-border bg-muted/20 px-4 py-3 sm:px-5">
        <h3 className="font-semibold text-foreground">{title}</h3>
        {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

function OrganizedDetailGrid({ entries }: { entries: LeadDetailEntry[] }) {
  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
      {entries.map(([key, value]) => {
        const parsed = parsePossibleJson(value);
        const complex = parsed !== null && typeof parsed === "object";

        return (
          <div
            key={key}
            className={
              complex
                ? "rounded-lg border border-border bg-muted/10 p-4 sm:col-span-2"
                : "min-w-0 border-b border-border/70 pb-3"
            }
          >
            <p className="text-xs font-medium text-muted-foreground">{formatFieldLabel(key)}</p>
            <div className="mt-1.5 text-foreground">
              <ReadableValue value={parsed} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ProfileAvatar({
  avatarUrl,
  name,
  verified = false,
  admin = false,
  size = "sm",
}: {
  avatarUrl?: string | null | undefined;
  name: string;
  verified?: boolean | undefined;
  admin?: boolean | undefined;
  size?: "sm" | "md" | "lg" | "xl" | undefined;
}) {
  const sizeClass = size === "xl" ? "size-24" : size === "lg" ? "size-12" : size === "md" ? "size-11" : "size-9";

  const badgeSize = size === "xl" ? "size-6" : size === "lg" ? "size-[17px]" : size === "md" ? "size-4" : "size-[14px]";

  const checkSize = size === "xl" ? "size-4" : size === "lg" ? "size-3" : "size-2.5";

  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join("")
      .toUpperCase() || "C";

  return (
    <div className="relative shrink-0">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={`${name} profile`}
          className={`${sizeClass} rounded-full border border-border bg-muted object-cover`}
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div
          className={`flex ${sizeClass} items-center justify-center rounded-full border text-xs font-semibold ${
            admin
              ? "border-primary/20 bg-primary text-primary-foreground"
              : "border-border bg-muted text-muted-foreground"
          }`}
          aria-label={`${name} profile placeholder`}
        >
          {initials}
        </div>
      )}

      {verified && (
        <span
          title="Registered account"
          aria-label="Registered account"
          className={`absolute -bottom-0.5 -left-0.5 flex ${badgeSize} items-center justify-center rounded-full border-2 border-background bg-[#809c61] text-white shadow-sm`}
        >
          <Check className={checkSize} strokeWidth={3.5} />
        </span>
      )}
    </div>
  );
}

function SelectedVehiclesDisplay({ value }: { value: unknown }) {
  const parsed = parsePossibleJson(value);
  const vehicles = Array.isArray(parsed) ? parsed : [parsed];

  if (
    vehicles.length === 0 ||
    vehicles.every((vehicle) => vehicle === null || vehicle === undefined || vehicle === "")
  ) {
    return <p className="text-sm text-muted-foreground">No selected vehicle information.</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
      {vehicles.map((vehicle, index) => (
        <VehicleCard key={index} vehicle={vehicle} index={index} />
      ))}
    </div>
  );
}

function VehicleCard({ vehicle, index }: { vehicle: unknown; index: number }) {
  const parsed = parsePossibleJson(vehicle);
  const imageUrl = findVehicleImage(parsed);

  const objectValue =
    parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;

  const displayValue = objectValue ? removeImageFields(objectValue) : parsed;

  const title = objectValue ? findVehicleTitle(objectValue) : `Selected Vehicle ${index + 1}`;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
      {imageUrl ? (
        <div className="aspect-[16/9] w-full overflow-hidden border-b border-border bg-muted">
          <img
            src={imageUrl}
            alt={title}
            className="h-full w-full object-cover"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={(event) => {
              event.currentTarget.parentElement?.classList.add("hidden");
            }}
          />
        </div>
      ) : (
        <div className="flex aspect-[16/7] items-center justify-center border-b border-border bg-muted/50">
          <span className="text-xs text-muted-foreground">Vehicle image unavailable</span>
        </div>
      )}

      <div className="p-4">
        <p className="mb-3 font-semibold text-foreground">{title}</p>

        {objectValue ? (
          <ObjectValue value={displayValue as Record<string, unknown>} />
        ) : (
          <ReadableValue value={displayValue} />
        )}
      </div>
    </div>
  );
}

function findVehicleImage(value: unknown): string | null {
  const parsed = parsePossibleJson(value);

  if (typeof parsed === "string") {
    return isImageUrl(parsed) ? parsed : null;
  }

  if (Array.isArray(parsed)) {
    for (const item of parsed) {
      const found = findVehicleImage(item);
      if (found) return found;
    }

    return null;
  }

  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  const record = parsed as Record<string, unknown>;

  const directKeys = [
    "image_url",
    "imageUrl",
    "image",
    "photo_url",
    "photoUrl",
    "photo",
    "featured_image",
    "featuredImage",
    "primary_image",
    "primaryImage",
    "thumbnail",
    "thumbnail_url",
    "thumbnailUrl",
    "main_image",
    "mainImage",
  ];

  for (const key of directKeys) {
    const candidate = record[key];

    if (typeof candidate === "string" && isImageUrl(candidate)) {
      return candidate;
    }
  }

  const collectionKeys = ["images", "photos", "vehicle_images", "vehicleImages"];

  for (const key of collectionKeys) {
    const collection = record[key];

    if (collection) {
      const found = findVehicleImage(collection);
      if (found) return found;
    }
  }

  return null;
}

function isImageUrl(value: string) {
  const normalized = value.trim().toLowerCase();

  return normalized.startsWith("https://") || normalized.startsWith("http://") || normalized.startsWith("data:image/");
}

function findVehicleTitle(vehicle: Record<string, unknown>) {
  const directTitleKeys = ["title", "vehicle_name", "vehicleName", "name", "year_make_model", "yearMakeModel"];

  for (const key of directTitleKeys) {
    const value = vehicle[key];

    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  const titleParts = [vehicle["year"], vehicle["make"], vehicle["model"], vehicle["trim"]]
    .filter((value) => value !== null && value !== undefined && value !== "")
    .map(String);

  return titleParts.join(" ") || "Selected Vehicle";
}

function removeImageFields(value: Record<string, unknown>) {
  const imageKeys = new Set([
    "image_url",
    "imageUrl",
    "image",
    "photo_url",
    "photoUrl",
    "photo",
    "featured_image",
    "featuredImage",
    "primary_image",
    "primaryImage",
    "thumbnail",
    "thumbnail_url",
    "thumbnailUrl",
    "main_image",
    "mainImage",
    "images",
    "photos",
    "vehicle_images",
    "vehicleImages",
  ]);

  return Object.fromEntries(Object.entries(value).filter(([key]) => !imageKeys.has(key)));
}

function ContactRow({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: typeof Mail;
  label: string;
  value?: string | null | undefined;
  href?: string | undefined;
}) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="size-4" />
      </div>

      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>

        {href && value ? (
          <a href={href} className="block truncate text-sm font-medium text-primary hover:underline">
            {value}
          </a>
        ) : (
          <p className="truncate text-sm font-medium">{value || "Not provided"}</p>
        )}
      </div>
    </div>
  );
}

function CompactValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium">{value}</span>
    </div>
  );
}

function MobileValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium text-foreground">{value}</p>
    </div>
  );
}

function ReadableValue({ value }: { value: unknown }) {
  const parsed = parsePossibleJson(value);

  if (parsed === null || parsed === undefined || parsed === "") {
    return <p className="text-sm text-muted-foreground">Not provided</p>;
  }

  if (typeof parsed === "boolean") {
    return <p className="text-sm">{parsed ? "Yes" : "No"}</p>;
  }

  if (typeof parsed === "string" || typeof parsed === "number") {
    return <p className="whitespace-pre-wrap break-words text-sm leading-6">{String(parsed)}</p>;
  }

  if (Array.isArray(parsed)) {
    if (parsed.length === 0) {
      return <p className="text-sm text-muted-foreground">None provided</p>;
    }

    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {parsed.map((item, index) => (
          <div key={index} className="rounded-lg border border-border bg-muted/10 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Item {index + 1}</p>

            <ReadableValue value={item} />
          </div>
        ))}
      </div>
    );
  }

  if (typeof parsed === "object") {
    return <ObjectValue value={parsed as Record<string, unknown>} />;
  }

  return <p className="text-sm">{String(parsed)}</p>;
}

function ObjectValue({ value }: { value: Record<string, unknown> }) {
  const entries = Object.entries(value).filter(([, item]) => item !== null && item !== undefined && item !== "");

  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">No information provided</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-x-5 gap-y-3 sm:grid-cols-2">
      {entries.map(([key, item]) => {
        const parsed = parsePossibleJson(item);
        const complex = parsed !== null && typeof parsed === "object";

        return (
          <div
            key={key}
            className={
              complex
                ? "rounded-lg border border-border bg-muted/10 p-3 sm:col-span-2"
                : "border-b border-border/70 pb-2 last:border-0"
            }
          >
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {formatFieldLabel(key)}
            </p>

            <div className="mt-1">
              <ReadableValue value={parsed} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RowsLoading() {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="h-16 animate-pulse rounded-lg bg-muted" />
      ))}
    </div>
  );
}

function parsePossibleJson(value: unknown): unknown {
  if (typeof value !== "string") return value;

  const trimmed = value.trim();

  if (!((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]")))) {
    return value;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function formatSimpleValue(value: unknown): string {
  const parsed = parsePossibleJson(value);

  if (parsed === null || parsed === undefined || parsed === "") {
    return "—";
  }

  if (typeof parsed === "boolean") {
    return parsed ? "Yes" : "No";
  }

  if (Array.isArray(parsed)) {
    return parsed.map((item) => formatSimpleValue(item)).join(", ");
  }

  if (typeof parsed === "object") {
    return Object.entries(parsed as Record<string, unknown>)
      .map(([key, item]) => `${formatFieldLabel(key)}: ${formatSimpleValue(item)}`)
      .join(" • ");
  }

  return String(parsed);
}

function formatLongDate(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const rawValue = String(value).trim();
  const dateOnlyMatch = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  let date: Date;

  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;

    date = new Date(Number(year), Number(month) - 1, Number(day));
  } else {
    date = new Date(rawValue);
  }

  if (Number.isNaN(date.getTime())) {
    return rawValue;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function capitalizeText(value: string) {
  return value
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function isSelectedVehicleKey(key: string) {
  const normalized = key.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();

  return normalized === "selected_vehicle" || normalized === "selected_vehicles";
}

function formatFieldLabel(key: string) {
  const labels: Record<string, string> = {
    vin: "VIN",
    trade_vin: "Trade-In VIN",
    stock_number: "Stock Number",
    full_name: "Full Name",
    preferred_contact_method: "Preferred Contact Method",
    preferred_date: "Preferred Date",
    preferred_time: "Preferred Time",
    preferred_make: "Preferred Make",
    preferred_model: "Preferred Model",
    preferred_year_min: "Minimum Year",
    preferred_year_max: "Maximum Year",
    preferred_body_style: "Body Style",
    maximum_budget: "Maximum Budget",
    financing_needed: "Financing Needed",
    must_have_features: "Must-Have Features",
    request_type: "Request Type",
    appointment_type: "Appointment Type",
    vehicle_of_interest: "Vehicle of Interest",
    selected_vehicle: "Selected Vehicle",
    selected_vehicles: "Selected Vehicles",
    selectedVehicles: "Selected Vehicles",
    vehicle_preferences: "Vehicle Preferences",
    customer_wish_list: "Customer Wish List",
    customer_wishlist: "Customer Wish List",
    customerWishList: "Customer Wish List",
    wishlist: "Customer Wish List",
    credit_band: "Credit Range",
    desired_payment: "Desired Payment",
    estimated_payoff: "Estimated Payoff",
    year_make_model: "Year, Make and Model",
    trade_year: "Trade-In Year",
    trade_make: "Trade-In Make",
    trade_model: "Trade-In Model",
    trade_trim: "Trade-In Trim",
    trade_mileage: "Trade-In Mileage",
    trade_condition: "Trade-In Condition",
    references: "References",
    reference: "Reference",
    current_address: "Current Address",
    currentAddress: "Current Address",
    mailing_address: "Mailing Address",
    mailingAddress: "Mailing Address",
    current_employer: "Current Employer",
    current_employer_1: "Current Employer 1",
    currentEmployer: "Current Employer",
    currentEmployer1: "Current Employer 1",
    employer_name: "Employer Name",
    employer_phone: "Employer Phone",
    employer_address: "Employer Address",
    employment_length: "Length of Employment",
    monthly_income: "Monthly Income",
    annual_income: "Annual Income",
    first_name: "First Name",
    last_name: "Last Name",
    postal_code: "Postal Code",
    zip_code: "ZIP Code",
    relationship: "Relationship",
    phone_number: "Phone Number",
    lead_source: "Lead Source",
    lead_medium: "Lead Medium",
    utm_source: "UTM Source",
    utm_medium: "UTM Medium",
    utm_campaign: "UTM Campaign",
    utm_content: "UTM Content",
    utm_term: "UTM Term",
    fbclid: "Facebook Click ID",
    gclid: "Google Click ID",
    gbraid: "Google GBRAID",
    wbraid: "Google WBRAID",
    ttclid: "TikTok Click ID",
    li_fat_id: "LinkedIn Click ID",
    rdt_cid: "Reddit Click ID",
    referrer: "Referrer",
    landing_page: "Landing Page",
    conversion_page: "Conversion Page",
  };

  if (labels[key]) return labels[key];

  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
