import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronRight,
  ClipboardList,
  Mail,
  Phone,
  Search,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
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

function AdminCustomers() {
  const { session } = useAuth();
  const accessToken = session?.access_token ?? "";
  const [pageTab, setPageTab] = useState<PageTab>("customers");
  const [accountSearch, setAccountSearch] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "customers"],
    enabled: Boolean(accessToken),
    queryFn: () =>
      listCustomers({
        data: { accessToken },
      }),
  });

  const accounts = data ?? [];

  const customerAccounts = useMemo(() => {
    const needle = accountSearch.trim().toLowerCase();

    return accounts.filter((account) => {
      const roles = account.roles ?? [];

      const hasCustomerRole = roles.some((role) => role.trim().toLowerCase() === "customer");

      if (!hasCustomerRole) return false;
      if (!needle) return true;

      return [
        account.full_name,
        account.email,
        account.phone,
        account.legacy_user_id,
        roles.join(" "),
        account.created_at ? formatLongDate(account.created_at) : "",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [accounts, accountSearch]);

  const administrators = useMemo(() => {
    const needle = accountSearch.trim().toLowerCase();

    return accounts.filter((account) => {
      const roles = account.roles ?? [];

      const hasAdminRole = roles.some((role) => role.trim().toLowerCase().includes("admin"));

      if (!hasAdminRole) return false;
      if (!needle) return true;

      return [
        account.full_name,
        account.email,
        account.phone,
        account.legacy_user_id,
        roles.join(" "),
        account.created_at ? formatLongDate(account.created_at) : "",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [accounts, accountSearch]);

  const totalCustomers = accounts.filter((account) =>
    (account.roles ?? []).some((role) => role.trim().toLowerCase() === "customer"),
  ).length;

  const totalAdministrators = accounts.filter((account) =>
    (account.roles ?? []).some((role) => role.trim().toLowerCase().includes("admin")),
  ).length;

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
            <Badge variant={pageTab === "customers" ? "default" : "secondary"}>{totalCustomers}</Badge>
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
            <Badge variant={pageTab === "admins" ? "default" : "secondary"}>{totalAdministrators}</Badge>
          </button>
        </div>

        {pageTab === "customers" ? (
          <>
            <LeadsSection accessToken={accessToken} />

            <AccountsSection
              title="Registered Customers"
              description="Website accounts assigned the customer role."
              accounts={customerAccounts}
              search={accountSearch}
              onSearchChange={setAccountSearch}
              isLoading={isLoading}
              error={error}
              admin={false}
            />
          </>
        ) : (
          <AccountsSection
            title="Administrators"
            description="Website accounts assigned an administrator role."
            accounts={administrators}
            search={accountSearch}
            onSearchChange={setAccountSearch}
            isLoading={isLoading}
            error={error}
            admin
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

const LEAD_LABELS: Record<string, string> = {
  finance: "Financing",
  appointment: "Appointment",
  availability: "Check Availability",
  contact: "Contact",
};

function getTradeIntent(lead: AdminLeadRow) {
  const intent = lead.details?.intent;

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

  if (value === null || value === undefined) return "—";

  return formatLongDate(value);
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

  return value === null || value === undefined ? "—" : formatSimpleValue(value);
}

function LeadsSection({ accessToken }: { accessToken: string }) {
  const [type, setType] = useState<LeadFilterType>("all");
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

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return leads.filter((lead) => {
      if (!matchesLeadType(lead, type)) return false;
      if (!needle) return true;

      const request = getLeadTypeLabel(lead);
      const preferredDate = getPreferredDate(lead);
      const preferredTime = getPreferredTime(lead);
      const status = lead.status || "new";
      const submitted = lead.created_at ? formatLongDate(lead.created_at) : "—";

      return [lead.full_name, request, preferredDate, preferredTime, status, submitted]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [leads, type, search]);

  const countFor = (key: LeadFilterType) => leads.filter((lead) => matchesLeadType(lead, key)).length;

  return (
    <>
      <section className="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
        <div className="flex flex-col gap-4 border-b border-border bg-muted/30 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Users className="size-5" />
            </div>

            <div>
              <h2 className="font-semibold">Customer Submissions</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">Requests submitted through the website forms.</p>
            </div>
          </div>

          <div className="relative w-full lg:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

            <Input
              type="search"
              className="pl-9"
              placeholder="Search name, request, date, time or status"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search customer submissions"
            />
          </div>
        </div>

        <div className="overflow-x-auto border-b border-border">
          <div className="flex min-w-max gap-2 p-4">
            {LEAD_TYPES.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setType(item.key)}
                aria-pressed={type === item.key}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  type === item.key
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
              >
                {item.label} ({isLoading ? "…" : countFor(item.key)})
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-16 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : error ? (
          <div role="alert" className="p-6">
            <p className="font-medium text-destructive">Couldn&apos;t load customer submissions</p>
            <p className="mt-1 text-sm text-muted-foreground">{(error as Error).message}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <Users className="mx-auto size-8 text-muted-foreground/60" />
            <p className="mt-3 font-medium">No customer submissions found</p>
            <p className="mt-1 text-sm text-muted-foreground">Try changing the selected tab or search term.</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-border md:hidden">
              {filtered.map((lead) => (
                <button
                  key={lead.id}
                  type="button"
                  onClick={() => setSelectedLead(lead)}
                  className="flex w-full items-start justify-between gap-4 p-4 text-left transition-colors hover:bg-muted/40"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{lead.full_name || "Unnamed customer"}</p>
                      <Badge variant="secondary">{getLeadTypeLabel(lead)}</Badge>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                      <MobileColumn label="Date" value={getPreferredDate(lead)} />
                      <MobileColumn label="Time" value={getPreferredTime(lead)} />

                      <div>
                        <p className="text-muted-foreground">Status</p>
                        <Badge variant={lead.status === "won" ? "default" : "outline"} className="mt-1 capitalize">
                          {lead.status || "new"}
                        </Badge>
                      </div>

                      <MobileColumn label="Submitted" value={lead.created_at ? formatLongDate(lead.created_at) : "—"} />
                    </div>
                  </div>

                  <ChevronRight className="mt-1 size-5 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Request</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Time</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Submitted</th>
                    <th className="w-12 px-4 py-3">
                      <span className="sr-only">Open</span>
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filtered.map((lead) => (
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
                      <td className="px-4 py-3 font-medium">{lead.full_name || "Unnamed customer"}</td>

                      <td className="whitespace-nowrap px-4 py-3">
                        <Badge variant="secondary">{getLeadTypeLabel(lead)}</Badge>
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{getPreferredDate(lead)}</td>

                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{getPreferredTime(lead)}</td>

                      <td className="whitespace-nowrap px-4 py-3">
                        <Badge variant={lead.status === "won" ? "default" : "outline"} className="capitalize">
                          {lead.status || "new"}
                        </Badge>
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {lead.created_at ? formatLongDate(lead.created_at) : "—"}
                      </td>

                      <td className="px-4 py-3">
                        <ChevronRight className="size-4 text-muted-foreground" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <LeadDetailsDialog
        lead={selectedLead}
        open={Boolean(selectedLead)}
        onOpenChange={(open) => {
          if (!open) setSelectedLead(null);
        }}
      />
    </>
  );
}

function MobileColumn({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium text-foreground">{value}</p>
    </div>
  );
}

function AccountsSection({
  title,
  description,
  accounts,
  search,
  onSearchChange,
  isLoading,
  error,
  admin,
}: {
  title: string;
  description: string;
  accounts: Array<{
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    avatar_url: string | null;
    legacy_user_id: string | null;
    created_at: string | null;
    roles: string[];
  }>;
  search: string;
  onSearchChange: (value: string) => void;
  isLoading: boolean;
  error: unknown;
  admin: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
      <div className="flex flex-col gap-4 border-b border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {admin ? <ShieldCheck className="size-5" /> : <Users className="size-5" />}
          </div>

          <div>
            <h2 className="font-semibold">{title}</h2>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>

        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            className="pl-9"
            placeholder={admin ? "Search administrators" : "Search registered customers"}
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3 p-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-16 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : error ? (
        <div role="alert" className="p-6">
          <p className="font-medium text-destructive">Couldn&apos;t load accounts</p>
          <p className="mt-1 text-sm text-muted-foreground">{(error as Error).message}</p>
        </div>
      ) : accounts.length === 0 ? (
        <div className="p-10 text-center">
          {admin ? (
            <ShieldCheck className="mx-auto size-9 text-muted-foreground/60" />
          ) : (
            <UserRound className="mx-auto size-9 text-muted-foreground/60" />
          )}

          <p className="mt-3 font-medium">
            {search.trim()
              ? `No matching ${admin ? "administrators" : "customers"}`
              : `No ${admin ? "administrators" : "customers"} found`}
          </p>
        </div>
      ) : (
        <>
          <div className="divide-y divide-border md:hidden">
            {accounts.map((account) => (
              <article key={account.id} className="p-4">
                <div className="flex items-start gap-3">
                  <AccountAvatar
                    avatarUrl={account.avatar_url}
                    name={account.full_name ?? account.email ?? (admin ? "Administrator" : "Customer")}
                    fallbackLetter={admin ? "A" : "C"}
                    admin={admin}
                  />

                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {account.full_name || (admin ? "Unnamed administrator" : "Unnamed customer")}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">{account.email || "No email"}</p>
                    <p className="text-sm text-muted-foreground">{account.phone || "No phone"}</p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(account.roles ?? []).map((role) => (
                    <Badge key={role} variant={admin ? "default" : "secondary"} className="capitalize">
                      {role.replaceAll("_", " ")}
                    </Badge>
                  ))}
                </div>

                <p className="mt-3 text-xs text-muted-foreground">
                  Joined: {account.created_at ? formatLongDate(account.created_at) : "—"}
                </p>
              </article>
            ))}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Phone</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Joined</th>
                </tr>
              </thead>

              <tbody>
                {accounts.map((account) => (
                  <tr key={account.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="flex min-w-[180px] items-center gap-3">
                        <AccountAvatar
                          avatarUrl={account.avatar_url}
                          name={account.full_name ?? account.email ?? (admin ? "Administrator" : "Customer")}
                          fallbackLetter={admin ? "A" : "C"}
                          admin={admin}
                          small
                        />

                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {account.full_name || (admin ? "Unnamed administrator" : "Unnamed customer")}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {account.legacy_user_id ? `Legacy ID: ${account.legacy_user_id}` : "Auth account"}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="max-w-[220px] px-4 py-3 text-muted-foreground">
                      <span className="block truncate">{account.email || "—"}</span>
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{account.phone || "—"}</td>

                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {(account.roles ?? []).map((role) => (
                          <Badge key={role} variant={admin ? "default" : "secondary"} className="capitalize">
                            {role.replaceAll("_", " ")}
                          </Badge>
                        ))}
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {account.created_at ? formatLongDate(account.created_at) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function LeadDetailsDialog({
  lead,
  open,
  onOpenChange,
}: {
  lead: AdminLeadRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!lead) return null;

  const details = Object.entries(lead.details ?? {}).filter(
    ([, value]) => value !== null && value !== undefined && value !== "",
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] max-w-4xl overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-5 py-4 pr-12">
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle className="text-xl">{lead.full_name || "Customer submission"}</DialogTitle>

            <Badge variant="secondary">{getLeadTypeLabel(lead)}</Badge>

            <Badge variant={lead.status === "won" ? "default" : "outline"} className="capitalize">
              {lead.status || "new"}
            </Badge>
          </div>

          <DialogDescription>Complete information submitted through the website form.</DialogDescription>
        </DialogHeader>

        <div className="max-h-[calc(90vh-110px)] overflow-y-auto p-5">
          <div className="space-y-6">
            <ModalSection title="Customer Information" icon={UserRound}>
              <DetailGrid>
                <SimpleDetailItem label="Full Name" value={lead.full_name} />
                <SimpleDetailItem label="Email" value={lead.email} type="email" />
                <SimpleDetailItem label="Phone" value={lead.phone} type="phone" />
                <SimpleDetailItem label="Request Type" value={getLeadTypeLabel(lead)} />
              </DetailGrid>
            </ModalSection>

            <ModalSection title="Appointment Preference" icon={CalendarDays}>
              <DetailGrid>
                <SimpleDetailItem label="Preferred Date" value={getPreferredDate(lead)} />
                <SimpleDetailItem label="Preferred Time" value={getPreferredTime(lead)} />
              </DetailGrid>
            </ModalSection>

            <ModalSection title="Submission Information" icon={CalendarDays}>
              <DetailGrid>
                <SimpleDetailItem label="Status" value={lead.status || "new"} />
                <SimpleDetailItem label="Submitted" value={lead.created_at ? formatLongDate(lead.created_at) : null} />
                <SimpleDetailItem label="Submission ID" value={String(lead.id)} />
              </DetailGrid>
            </ModalSection>

            {lead.message && (
              <ModalSection title="Customer Message" icon={Mail}>
                <div className="rounded-lg border border-border bg-muted/20 p-4">
                  <p className="whitespace-pre-wrap break-words text-sm leading-6">{lead.message}</p>
                </div>
              </ModalSection>
            )}

            <ModalSection title="Form Details" icon={ClipboardList}>
              {details.length > 0 ? (
                <div className="grid grid-cols-1 gap-4">
                  {details.map(([key, value]) => (
                    <StructuredDetail key={key} label={formatFieldLabel(key)} value={value} />
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  No additional form details were submitted.
                </div>
              )}
            </ModalSection>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StructuredDetail({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background">
      <div className="border-b border-border bg-muted/30 px-4 py-3">
        <p className="text-sm font-semibold">{label}</p>
      </div>
      <div className="p-4">
        <ReadableValue value={parsePossibleJson(value)} />
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
      <div className="space-y-3">
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

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {entries.map(([key, item]) => {
        const parsed = parsePossibleJson(item);
        const complex = parsed !== null && typeof parsed === "object";

        return (
          <div key={key} className={`rounded-lg border border-border p-3 ${complex ? "sm:col-span-2" : ""}`}>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{formatFieldLabel(key)}</p>
            <div className="mt-1.5">
              <ReadableValue value={parsed} />
            </div>
          </div>
        );
      })}
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

function ModalSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof UserRound;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <Icon className="size-4 text-primary" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function DetailGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>;
}

function SimpleDetailItem({ label, value, type }: { label: string; value?: string | null; type?: "email" | "phone" }) {
  const hasValue = Boolean(value) && value !== "—" && value !== "Not provided";

  let content: React.ReactNode = value || "Not provided";

  if (value && type === "email") {
    content = (
      <a href={`mailto:${value}`} className="text-primary hover:underline">
        {value}
      </a>
    );
  }

  if (value && type === "phone") {
    content = (
      <a href={`tel:${value}`} className="text-primary hover:underline">
        {value}
      </a>
    );
  }

  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className={`mt-1 break-words text-sm ${hasValue ? "text-foreground" : "text-muted-foreground"}`}>
        {content}
      </div>
    </div>
  );
}

function AccountAvatar({
  avatarUrl,
  name,
  fallbackLetter,
  admin = false,
  small = false,
}: {
  avatarUrl?: string | null;
  name: string;
  fallbackLetter: string;
  admin?: boolean;
  small?: boolean;
}) {
  const size = small ? "size-10" : "size-11";

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={`${size} shrink-0 rounded-full border border-border object-cover`}
        loading="lazy"
      />
    );
  }

  return (
    <div
      className={`flex ${size} shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
        admin ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
      }`}
    >
      {(name.slice(0, 1) || fallbackLetter).toUpperCase()}
    </div>
  );
}
