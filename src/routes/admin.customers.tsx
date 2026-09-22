import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  CalendarDays,
  CalendarCheck,
  Car,
  Check,
  ChevronRight,
  ClipboardList,
  Clock3,
  HandCoins,
  Mail,
  MessageSquare,
  Phone,
  Repeat2,
  Search,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTeamSection } from "@/components/admin/AdminTeamSection";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { listCustomers } from "@/lib/admin-customers.functions";
import { listLeads, type AdminLeadRow } from "@/lib/admin-leads.functions";

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
  { key: "contact", label: "Contact" },
] as const;

type LeadFilterType = (typeof LEAD_TYPES)[number]["key"];

const DATE_FILTERS = [
  { key: "all", label: "All time" },
  { key: "today", label: "Today" },
  { key: "last_7_days", label: "Last 7 days" },
  { key: "this_month", label: "This month" },
  { key: "last_30_days", label: "Last 30 days" },
  { key: "this_year", label: "This year" },
] as const;

type DateFilterType = (typeof DATE_FILTERS)[number]["key"];

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

function getLeadTypeLabel(lead: AdminLeadRow) {
  if (lead.lead_type === "trade") {
    return getTradeIntent(lead).includes("sell") ? "Sell" : "Trade";
  }

  return LEAD_LABELS[lead.lead_type] ?? lead.lead_type;
}

function matchesLeadType(lead: AdminLeadRow, selectedType: LeadFilterType) {
  if (selectedType === "all") return true;

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

function matchesDateFilter(lead: AdminLeadRow, selectedDate: DateFilterType, now = new Date()) {
  if (selectedDate === "all") return true;

  const createdAt = getLeadCreatedDate(lead);

  if (!createdAt) return false;

  const today = startOfLocalDay(now);

  if (selectedDate === "today") {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return createdAt >= today && createdAt < tomorrow;
  }

  if (selectedDate === "last_7_days") {
    const start = new Date(today);
    start.setDate(start.getDate() - 6);

    return createdAt >= start;
  }

  if (selectedDate === "this_month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    return createdAt >= start && createdAt < end;
  }

  if (selectedDate === "last_30_days") {
    const start = new Date(today);
    start.setDate(start.getDate() - 29);

    return createdAt >= start;
  }

  const start = new Date(now.getFullYear(), 0, 1);
  const end = new Date(now.getFullYear() + 1, 0, 1);

  return createdAt >= start && createdAt < end;
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

function LeadsSection({ accessToken, accounts }: { accessToken: string; accounts: AccountProfile[] }) {
  const [type, setType] = useState<LeadFilterType>("all");
  const [dateFilter, setDateFilter] = useState<DateFilterType>("all");
  const [search, setSearch] = useState("");
  const [selectedLead, setSelectedLead] = useState<AdminLeadRow | null>(null);

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

  const leadsToday = useMemo(() => {
    const now = new Date();

    return leads.filter((lead) => matchesDateFilter(lead, "today", now)).length;
  }, [leads]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return leads.filter((lead) => {
      if (!matchesLeadType(lead, type)) return false;
      if (!matchesDateFilter(lead, dateFilter)) return false;
      if (!needle) return true;

      return [
        lead.full_name,
        getLeadTypeLabel(lead),
        getPreferredDate(lead),
        getPreferredTime(lead),
        lead.status || "new",
        lead.created_at ? formatLongDate(lead.created_at) : "—",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [leads, type, dateFilter, search]);

  const countFor = (key: LeadFilterType) => leads.filter((lead) => matchesLeadType(lead, key)).length;

  const activeOverviewKey =
    type === "all" && dateFilter === "today" ? "today" : dateFilter === "all" && type !== "all" ? type : null;

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
      return;
    }

    const isAlreadyActive = activeOverviewKey === key;

    setType(isAlreadyActive ? "all" : key);
    setDateFilter("all");
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
            <div className="relative w-full sm:w-48">
              <CalendarDays className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />

              <select
                aria-label="Filter leads by date"
                value={dateFilter}
                onChange={(event) => setDateFilter(event.target.value as DateFilterType)}
                className="h-10 w-full cursor-pointer appearance-none rounded-md border border-input bg-background pl-9 pr-8 text-sm text-foreground shadow-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
              >
                {DATE_FILTERS.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>

              <ChevronRight className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 rotate-90 text-muted-foreground" />
            </div>

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

            {activeOverviewKey ? (
              <button
                type="button"
                onClick={() => {
                  setType("all");
                  setDateFilter("all");
                }}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Clear filter
              </button>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
            {overviewFilters.map((item) => {
              const Icon = item.icon;
              const active = activeOverviewKey === item.key;

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => selectOverviewFilter(item.key)}
                  aria-pressed={active}
                  className={`group rounded-lg border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    active
                      ? "border-primary bg-primary/[0.04] ring-1 ring-primary"
                      : "border-border bg-background hover:border-primary/40"
                  }`}
                >
                  <div className={`flex size-9 items-center justify-center rounded-lg ${item.className}`}>
                    <Icon className="size-[18px]" aria-hidden="true" />
                  </div>

                  <p className="mt-3 text-2xl font-semibold text-foreground">
                    {isLoading ? "—" : item.value.toLocaleString()}
                  </p>

                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.label}</p>
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
              Try changing the request type, calendar filter, or search term.
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
                        </div>
                      </div>
                    </div>

                    <ChevronRight className="mt-1 size-5 shrink-0 text-muted-foreground" />
                  </button>
                );
              })}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[1050px] table-fixed text-left text-sm">
                <colgroup>
                  <col className="w-[25%]" />
                  <col className="w-[15%]" />
                  <col className="w-[18%]" />
                  <col className="w-[12%]" />
                  <col className="w-[12%]" />
                  <col className="w-[14%]" />
                  <col className="w-[4%]" />
                </colgroup>

                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Request</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Time</th>
                    <th className="px-4 py-3 font-medium">Status</th>
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

      <LeadDetailsDialog
        lead={selectedLead}
        account={selectedLead ? findAccountForLead(selectedLead, accounts) : undefined}
        open={Boolean(selectedLead)}
        onOpenChange={(open) => {
          if (!open) setSelectedLead(null);
        }}
      />
    </>
  );
}

function LeadDetailsDialog({
  lead,
  account,
  open,
  onOpenChange,
}: {
  lead: AdminLeadRow | null;
  account?: AccountProfile | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!lead) return null;

  const details = Object.entries(lead.details ?? {}).filter(
    ([, value]) => value !== null && value !== undefined && value !== "",
  );

  const selectedVehicleEntries = details.filter(([key]) => isSelectedVehicleKey(key));

  const otherDetails = details.filter(([key]) => !isSelectedVehicleKey(key));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[calc(100%-1.5rem)] max-w-5xl flex-col overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-border bg-background px-5 py-4 pr-12 sm:px-6">
          <div className="flex items-center gap-3">
            <ProfileAvatar
              avatarUrl={account?.avatar_url}
              name={account?.full_name ?? lead.full_name ?? "Customer"}
              verified={Boolean(account)}
              size="lg"
            />

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <DialogTitle className="truncate text-lg sm:text-xl">
                  {lead.full_name || "Customer submission"}
                </DialogTitle>

                {account && (
                  <span className="rounded-full bg-[#809c61]/15 px-2 py-0.5 text-[11px] font-medium text-[#61794a]">
                    Registered
                  </span>
                )}
              </div>

              <div className="mt-1.5 flex flex-wrap gap-2">
                <Badge variant="secondary">{getLeadTypeLabel(lead)}</Badge>

                <Badge variant={lead.status === "won" ? "default" : "outline"} className="capitalize">
                  {lead.status || "new"}
                </Badge>

                <span className="self-center text-xs text-muted-foreground">
                  {lead.created_at ? formatLongDate(lead.created_at) : "Date unavailable"}
                </span>
              </div>
            </div>
          </div>

          <DialogDescription className="sr-only">Customer submission details</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto bg-muted/20">
          <div className="grid grid-cols-1 gap-5 p-4 sm:p-6 lg:grid-cols-[280px_minmax(0,1fr)]">
            <aside className="space-y-4 lg:sticky lg:top-0 lg:self-start">
              <CompactPanel title="Contact" icon={UserRound}>
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
              </CompactPanel>

              <CompactPanel title="Schedule" icon={CalendarDays}>
                <CompactValue label="Preferred date" value={getPreferredDate(lead)} />

                <CompactValue label="Preferred time" value={getPreferredTime(lead)} />
              </CompactPanel>

              <CompactPanel title="Submission" icon={ClipboardList}>
                <CompactValue label="Status" value={capitalizeText(lead.status || "new")} />

                <CompactValue label="Submitted" value={lead.created_at ? formatLongDate(lead.created_at) : "—"} />

                <CompactValue label="Submission ID" value={String(lead.id)} />
              </CompactPanel>
            </aside>

            <div className="min-w-0 space-y-5">
              {selectedVehicleEntries.length > 0 && (
                <ProfessionalSection title="Selected Vehicles">
                  <div className="space-y-3">
                    {selectedVehicleEntries.map(([key, value]) => (
                      <SelectedVehiclesDisplay key={key} value={value} />
                    ))}
                  </div>
                </ProfessionalSection>
              )}

              {lead.message && (
                <ProfessionalSection title="Customer Message">
                  <div className="rounded-lg border border-border bg-background p-4">
                    <p className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground">{lead.message}</p>
                  </div>
                </ProfessionalSection>
              )}

              <ProfessionalSection title="Form Information">
                {otherDetails.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                    {otherDetails.map(([key, value]) => (
                      <StructuredDetail key={key} label={formatFieldLabel(key)} value={value} />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border bg-background p-6 text-center text-sm text-muted-foreground">
                    No additional form information was submitted.
                  </div>
                )}
              </ProfessionalSection>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
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
  size?: "sm" | "md" | "lg" | undefined;
}) {
  const sizeClass = size === "lg" ? "size-12" : size === "md" ? "size-11" : "size-9";

  const badgeSize = size === "lg" ? "size-[17px]" : size === "md" ? "size-4" : "size-[14px]";

  const checkSize = size === "lg" ? "size-3" : "size-2.5";

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

function CompactPanel({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof UserRound;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
      <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-4 py-3">
        <Icon className="size-4 text-primary" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>

      <div className="space-y-3 p-4">{children}</div>
    </section>
  );
}

function ProfessionalSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3">
        <h3 className="font-semibold text-foreground">{title}</h3>

        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>

      {children}
    </section>
  );
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

function StructuredDetail({ label, value }: { label: string; value: unknown }) {
  const parsed = parsePossibleJson(value);
  const complex = parsed !== null && typeof parsed === "object";

  return (
    <div className={`overflow-hidden rounded-xl border border-border bg-background ${complex ? "xl:col-span-2" : ""}`}>
      <div className="border-b border-border bg-muted/30 px-4 py-2.5">
        <p className="text-sm font-semibold">{label}</p>
      </div>

      <div className="p-4">
        <ReadableValue value={parsed} />
      </div>
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
  };

  if (labels[key]) return labels[key];

  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
