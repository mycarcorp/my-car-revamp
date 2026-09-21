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
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/admin/customers")({
  component: AdminCustomers,
});

function AdminCustomers() {
  const { session } = useAuth();
  const accessToken = session?.access_token ?? "";
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

  const filteredAccounts = useMemo(() => {
    const needle = accountSearch.trim().toLowerCase();

    if (!needle) return accounts;

    return accounts.filter((account) => {
      const roles = Array.isArray(account.roles) ? account.roles.join(" ") : "";

      return [account.full_name, account.email, account.phone, roles, account.legacy_user_id]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [accounts, accountSearch]);

  const administrators = useMemo(
    () =>
      filteredAccounts.filter((account) => (account.roles ?? []).some((role) => role.toLowerCase().includes("admin"))),
    [filteredAccounts],
  );

  const customers = useMemo(
    () =>
      filteredAccounts.filter((account) => !(account.roles ?? []).some((role) => role.toLowerCase().includes("admin"))),
    [filteredAccounts],
  );

  return (
    <div className="w-full">
      <AdminPageHeader title="Customers" />

      <main className="space-y-6 p-4 sm:p-6">
        <LeadsSection accessToken={accessToken} />

        {isLoading ? (
          <LoadingState />
        ) : error ? (
          <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-6">
            <p className="font-medium text-destructive">Couldn&apos;t load user accounts</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {(error as Error).message || "An unexpected error occurred while loading the accounts."}
            </p>
          </div>
        ) : (
          <section>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-foreground">Website Accounts</h2>
                <p className="mt-1 text-sm text-muted-foreground">Administrator and registered customer accounts.</p>
              </div>

              <div className="relative w-full sm:max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="account-search"
                  type="search"
                  className="pl-9"
                  placeholder="Search website accounts"
                  value={accountSearch}
                  onChange={(event) => setAccountSearch(event.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(250px,0.7fr)_minmax(0,2.3fr)]">
              <aside className="min-w-0 overflow-hidden rounded-xl border border-border bg-background shadow-sm">
                <SectionHeader title="Administrators" count={administrators.length} icon={ShieldCheck} />

                {administrators.length === 0 ? (
                  <EmptyAccounts
                    icon={ShieldCheck}
                    title={accountSearch.trim() ? "No matching administrators" : "No administrators found"}
                    description={
                      accountSearch.trim()
                        ? "Try using a different search term."
                        : "Accounts with an administrator role appear here."
                    }
                  />
                ) : (
                  <div className="divide-y divide-border">
                    {administrators.map((administrator) => (
                      <article key={administrator.id} className="p-4 transition-colors hover:bg-muted/30">
                        <div className="flex items-start gap-3">
                          <AccountAvatar
                            avatarUrl={administrator.avatar_url}
                            name={administrator.full_name ?? administrator.email ?? "Administrator"}
                            fallbackLetter="A"
                            admin
                          />

                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-foreground">
                              {administrator.full_name || "Unnamed administrator"}
                            </p>

                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {(administrator.roles ?? []).map((role) => (
                                <Badge
                                  key={role}
                                  className="capitalize"
                                  variant={role.toLowerCase().includes("admin") ? "default" : "secondary"}
                                >
                                  {role.replaceAll("_", " ")}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 space-y-2">
                          <AccountDetail icon={Mail} value={administrator.email} fallback="No email" />
                          <AccountDetail icon={Phone} value={administrator.phone} fallback="No phone" />
                          <AccountDetail
                            icon={CalendarDays}
                            value={administrator.created_at ? `Joined ${formatDate(administrator.created_at)}` : null}
                            fallback="Join date unavailable"
                          />
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </aside>

              <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-background shadow-sm">
                <SectionHeader title="Registered Customers" count={customers.length} icon={Users} />

                {customers.length === 0 ? (
                  <EmptyAccounts
                    icon={UserRound}
                    title={accountSearch.trim() ? "No matching customers" : "No registered customers"}
                    description={
                      accountSearch.trim()
                        ? "Try using a different search term."
                        : "Registered customer accounts will appear here."
                    }
                  />
                ) : (
                  <>
                    <div className="divide-y divide-border md:hidden">
                      {customers.map((customer) => (
                        <article key={customer.id} className="p-4">
                          <div className="flex items-start gap-3">
                            <AccountAvatar
                              avatarUrl={customer.avatar_url}
                              name={customer.full_name ?? customer.email ?? "Customer"}
                              fallbackLetter="C"
                            />

                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium">{customer.full_name || "Unnamed customer"}</p>
                              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                {customer.legacy_user_id ? `Legacy ID: ${customer.legacy_user_id}` : "Auth account"}
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 space-y-2">
                            <AccountDetail icon={Mail} value={customer.email} fallback="No email" />
                            <AccountDetail icon={Phone} value={customer.phone} fallback="No phone" />
                            <AccountDetail
                              icon={CalendarDays}
                              value={customer.created_at ? `Joined ${formatDate(customer.created_at)}` : null}
                              fallback="Join date unavailable"
                            />
                          </div>
                        </article>
                      ))}
                    </div>

                    <div className="hidden overflow-x-auto md:block">
                      <table className="min-w-full text-left text-sm">
                        <thead className="bg-muted/40 text-muted-foreground">
                          <tr>
                            <th className="px-4 py-3 font-medium">Customer</th>
                            <th className="px-4 py-3 font-medium">Email</th>
                            <th className="px-4 py-3 font-medium">Phone</th>
                            <th className="px-4 py-3 font-medium">Roles</th>
                            <th className="px-4 py-3 font-medium">Joined</th>
                          </tr>
                        </thead>

                        <tbody>
                          {customers.map((customer) => (
                            <tr key={customer.id} className="border-t border-border hover:bg-muted/30">
                              <td className="px-4 py-3">
                                <div className="flex min-w-[190px] items-center gap-3">
                                  <AccountAvatar
                                    avatarUrl={customer.avatar_url}
                                    name={customer.full_name ?? customer.email ?? "Customer"}
                                    fallbackLetter="C"
                                    small
                                  />

                                  <div className="min-w-0">
                                    <p className="truncate font-medium">{customer.full_name || "Unnamed customer"}</p>
                                    <p className="truncate text-xs text-muted-foreground">
                                      {customer.legacy_user_id
                                        ? `Legacy ID: ${customer.legacy_user_id}`
                                        : "Auth account"}
                                    </p>
                                  </div>
                                </div>
                              </td>

                              <td className="max-w-[220px] px-4 py-3 text-muted-foreground">
                                <span className="block truncate">{customer.email || "—"}</span>
                              </td>

                              <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                                {customer.phone || "—"}
                              </td>

                              <td className="px-4 py-3">
                                {(customer.roles ?? []).length > 0 ? (
                                  <div className="flex flex-wrap gap-1.5">
                                    {customer.roles.map((role) => (
                                      <Badge key={role} variant="secondary" className="capitalize">
                                        {role.replaceAll("_", " ")}
                                      </Badge>
                                    ))}
                                  </div>
                                ) : (
                                  "—"
                                )}
                              </td>

                              <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                                {customer.created_at ? formatDate(customer.created_at) : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </section>
            </div>
          </section>
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

  return value == null ? "—" : formatSimpleValue(value);
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

      const detailsText = Object.entries(lead.details ?? {})
        .map(([key, value]) => `${key} ${formatSimpleValue(value)}`)
        .join(" ");

      return [lead.full_name, lead.email, lead.phone, lead.message, lead.status, getLeadTypeLabel(lead), detailsText]
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
            <h2 className="font-semibold">Customers</h2>
          </div>

          <div className="relative w-full lg:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              className="pl-9"
              placeholder="Search customer submissions"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
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
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  type === item.key
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:border-primary/40"
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
          </div>
        ) : (
          <>
            <div className="divide-y divide-border md:hidden">
              {filtered.map((lead) => (
                <button
                  key={lead.id}
                  type="button"
                  onClick={() => setSelectedLead(lead)}
                  className="flex w-full items-start justify-between gap-4 p-4 text-left hover:bg-muted/40"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{lead.full_name || "Unnamed customer"}</p>
                      <Badge variant="secondary">{getLeadTypeLabel(lead)}</Badge>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-muted-foreground">Date</p>
                        <p className="mt-0.5 font-medium text-foreground">{getPreferredDate(lead)}</p>
                      </div>

                      <div>
                        <p className="text-muted-foreground">Time</p>
                        <p className="mt-0.5 font-medium text-foreground">{getPreferredTime(lead)}</p>
                      </div>

                      <div>
                        <p className="text-muted-foreground">Status</p>
                        <Badge variant={lead.status === "won" ? "default" : "outline"} className="mt-1 capitalize">
                          {lead.status || "new"}
                        </Badge>
                      </div>

                      <div>
                        <p className="text-muted-foreground">Submitted</p>
                        <p className="mt-0.5 font-medium text-foreground">
                          {lead.created_at ? formatDate(lead.created_at) : "—"}
                        </p>
                      </div>
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
                      onClick={() => setSelectedLead(lead)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedLead(lead);
                        }
                      }}
                      className="cursor-pointer border-t border-border hover:bg-muted/40 focus:bg-muted/40 focus:outline-none"
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
                        {lead.created_at ? formatDate(lead.created_at) : "—"}
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
                <SimpleDetailItem label="Submitted" value={lead.created_at ? formatDate(lead.created_at) : null} />
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
  const parsedValue = parsePossibleJson(value);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background">
      <div className="border-b border-border bg-muted/30 px-4 py-3">
        <p className="text-sm font-semibold text-foreground">{label}</p>
      </div>

      <div className="p-4">
        <ReadableValue value={parsedValue} />
      </div>
    </div>
  );
}

function ReadableValue({ value }: { value: unknown }) {
  const parsedValue = parsePossibleJson(value);

  if (parsedValue === null || parsedValue === undefined || parsedValue === "") {
    return <p className="text-sm text-muted-foreground">Not provided</p>;
  }

  if (typeof parsedValue === "boolean") {
    return <p className="text-sm text-foreground">{parsedValue ? "Yes" : "No"}</p>;
  }

  if (typeof parsedValue === "string" || typeof parsedValue === "number") {
    return <p className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground">{String(parsedValue)}</p>;
  }

  if (Array.isArray(parsedValue)) {
    if (parsedValue.length === 0) {
      return <p className="text-sm text-muted-foreground">None provided</p>;
    }

    return (
      <div className="space-y-3">
        {parsedValue.map((item, index) => {
          const parsedItem = parsePossibleJson(item);
          const isObject = parsedItem !== null && typeof parsedItem === "object" && !Array.isArray(parsedItem);

          return (
            <div key={index} className="rounded-lg border border-border bg-muted/10 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Item {index + 1}
              </p>

              {isObject ? (
                <ObjectValue value={parsedItem as Record<string, unknown>} />
              ) : (
                <ReadableValue value={parsedItem} />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  if (typeof parsedValue === "object") {
    return <ObjectValue value={parsedValue as Record<string, unknown>} />;
  }

  return <p className="text-sm text-foreground">{String(parsedValue)}</p>;
}

function ObjectValue({ value }: { value: Record<string, unknown> }) {
  const entries = Object.entries(value).filter(
    ([, nestedValue]) => nestedValue !== null && nestedValue !== undefined && nestedValue !== "",
  );

  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">No information provided</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {entries.map(([key, nestedValue]) => {
        const parsedNestedValue = parsePossibleJson(nestedValue);

        const isComplex = parsedNestedValue !== null && typeof parsedNestedValue === "object";

        return (
          <div
            key={key}
            className={`min-w-0 rounded-lg border border-border bg-background p-3 ${isComplex ? "sm:col-span-2" : ""}`}
          >
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{formatFieldLabel(key)}</p>

            <div className="mt-1.5">
              <ReadableValue value={parsedNestedValue} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function parsePossibleJson(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

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
      .map(([key, nestedValue]) => `${formatFieldLabel(key)}: ${formatSimpleValue(nestedValue)}`)
      .join(" • ");
  }

  return String(parsed);
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

function SectionHeader({ title, count, icon: Icon }: { title: string; count: number; icon: typeof Users }) {
  return (
    <div className="border-b border-border bg-muted/30 p-4">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-5" />
        </div>
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground">
            {count} {count === 1 ? "account" : "accounts"}
          </p>
        </div>
      </div>
    </div>
  );
}

function EmptyAccounts({ icon: Icon, title, description }: { icon: typeof Users; title: string; description: string }) {
  return (
    <div className="p-8 text-center">
      <Icon className="mx-auto size-9 text-muted-foreground/60" />
      <p className="mt-3 font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(250px,0.7fr)_minmax(0,2.3fr)]">
      {[3, 6].map((count) => (
        <div key={count} className="rounded-xl border border-border p-4">
          <div className="space-y-3">
            {Array.from({ length: count }).map((_, index) => (
              <div key={index} className="h-16 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        </div>
      ))}
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

function AccountDetail({
  icon: Icon,
  value,
  fallback,
}: {
  icon: typeof Mail;
  value?: string | null;
  fallback: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
      <Icon className="size-3.5 shrink-0" />
      <span className="truncate">{value || fallback}</span>
    </div>
  );
}
