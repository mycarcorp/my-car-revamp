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
        data: {
          accessToken,
        },
      }),
  });

  const accounts = data ?? [];

  const filteredAccounts = useMemo(() => {
    const needle = accountSearch.trim().toLowerCase();

    if (!needle) {
      return accounts;
    }

    return accounts.filter((account) => {
      const roles = Array.isArray(account.roles) ? account.roles.join(" ") : "";

      const haystack = [account.full_name, account.email, account.phone, roles, account.legacy_user_id]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(needle);
    });
  }, [accounts, accountSearch]);

  const administrators = useMemo(() => {
    return filteredAccounts.filter((account) =>
      (account.roles ?? []).some((role) => role.toLowerCase().includes("admin")),
    );
  }, [filteredAccounts]);

  const customers = useMemo(() => {
    return filteredAccounts.filter(
      (account) => !(account.roles ?? []).some((role) => role.toLowerCase().includes("admin")),
    );
  }, [filteredAccounts]);

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
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />

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
                <div className="border-b border-border bg-muted/30 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <ShieldCheck className="size-5" />
                    </div>

                    <div className="min-w-0">
                      <h2 className="font-semibold text-foreground">Administrators</h2>

                      <p className="text-xs text-muted-foreground">
                        {administrators.length} {administrators.length === 1 ? "account" : "accounts"}
                      </p>
                    </div>
                  </div>
                </div>

                {administrators.length === 0 ? (
                  <div className="p-6 text-center">
                    <ShieldCheck className="mx-auto size-8 text-muted-foreground/60" />

                    <p className="mt-3 text-sm font-medium text-foreground">
                      {accountSearch.trim() ? "No matching administrators" : "No administrators found"}
                    </p>

                    <p className="mt-1 text-xs text-muted-foreground">
                      {accountSearch.trim()
                        ? "Try using a different search term."
                        : "Accounts with an administrator role appear here."}
                    </p>
                  </div>
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

                        {administrator.legacy_user_id && (
                          <p className="mt-3 truncate rounded-md bg-muted px-2.5 py-2 text-xs text-muted-foreground">
                            Legacy ID: {administrator.legacy_user_id}
                          </p>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </aside>

              <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-background shadow-sm">
                <div className="border-b border-border bg-muted/30 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Users className="size-5" />
                    </div>

                    <div className="min-w-0">
                      <h2 className="font-semibold text-foreground">Registered Customers</h2>

                      <p className="text-xs text-muted-foreground">
                        {customers.length} {customers.length === 1 ? "customer" : "customers"}
                      </p>
                    </div>
                  </div>
                </div>

                {customers.length === 0 ? (
                  <div className="p-10 text-center">
                    <UserRound className="mx-auto size-10 text-muted-foreground/60" />

                    <p className="mt-4 font-medium text-foreground">
                      {accountSearch.trim() ? "No matching customers" : "No registered customers"}
                    </p>

                    <p className="mt-1 text-sm text-muted-foreground">
                      {accountSearch.trim()
                        ? "Try using a different search term."
                        : "Registered customer accounts will appear here."}
                    </p>
                  </div>
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
                              <p className="truncate font-medium text-foreground">
                                {customer.full_name || "Unnamed customer"}
                              </p>

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

                          {(customer.roles ?? []).length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {customer.roles.map((role) => (
                                <Badge key={role} variant="secondary" className="capitalize">
                                  {role.replaceAll("_", " ")}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </article>
                      ))}
                    </div>

                    <div className="hidden overflow-x-auto md:block">
                      <table className="min-w-full text-left text-sm">
                        <thead className="bg-muted/40 text-muted-foreground">
                          <tr>
                            <th className="whitespace-nowrap px-4 py-3 font-medium">Customer</th>

                            <th className="whitespace-nowrap px-4 py-3 font-medium">Email</th>

                            <th className="whitespace-nowrap px-4 py-3 font-medium">Phone</th>

                            <th className="whitespace-nowrap px-4 py-3 font-medium">Roles</th>

                            <th className="whitespace-nowrap px-4 py-3 font-medium">Joined</th>
                          </tr>
                        </thead>

                        <tbody>
                          {customers.map((customer) => (
                            <tr
                              key={customer.id}
                              className="border-t border-border transition-colors hover:bg-muted/30"
                            >
                              <td className="px-4 py-3 align-middle">
                                <div className="flex min-w-[190px] items-center gap-3">
                                  <AccountAvatar
                                    avatarUrl={customer.avatar_url}
                                    name={customer.full_name ?? customer.email ?? "Customer"}
                                    fallbackLetter="C"
                                    small
                                  />

                                  <div className="min-w-0">
                                    <p className="truncate font-medium text-foreground">
                                      {customer.full_name || "Unnamed customer"}
                                    </p>

                                    <p className="truncate text-xs text-muted-foreground">
                                      {customer.legacy_user_id
                                        ? `Legacy ID: ${customer.legacy_user_id}`
                                        : "Auth account"}
                                    </p>
                                  </div>
                                </div>
                              </td>

                              <td className="max-w-[220px] px-4 py-3 align-middle text-muted-foreground">
                                <span className="block truncate" title={customer.email || undefined}>
                                  {customer.email || "—"}
                                </span>
                              </td>

                              <td className="whitespace-nowrap px-4 py-3 align-middle text-muted-foreground">
                                {customer.phone || "—"}
                              </td>

                              <td className="px-4 py-3 align-middle">
                                {(customer.roles ?? []).length > 0 ? (
                                  <div className="flex max-w-[180px] flex-wrap gap-1.5">
                                    {customer.roles.map((role) => (
                                      <Badge key={role} variant="secondary" className="capitalize">
                                        {role.replaceAll("_", " ")}
                                      </Badge>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </td>

                              <td className="whitespace-nowrap px-4 py-3 align-middle text-muted-foreground">
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
  {
    key: "all",
    label: "All Customers",
  },
  {
    key: "finance",
    label: "Financing",
  },
  {
    key: "sell",
    label: "Sell",
  },
  {
    key: "trade",
    label: "Trade",
  },
  {
    key: "appointment",
    label: "Appointments",
  },
  {
    key: "availability",
    label: "Check Availability",
  },
  {
    key: "contact",
    label: "Contact",
  },
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

  if (typeof intent !== "string") {
    return "";
  }

  return intent.trim().toLowerCase();
}

function getLeadTypeLabel(lead: AdminLeadRow) {
  if (lead.lead_type === "trade") {
    const intent = getTradeIntent(lead);

    if (intent.includes("sell")) {
      return "Sell";
    }

    return "Trade";
  }

  return LEAD_LABELS[lead.lead_type] ?? lead.lead_type;
}

function matchesLeadType(lead: AdminLeadRow, selectedType: LeadFilterType) {
  if (selectedType === "all") {
    return true;
  }

  if (selectedType === "sell") {
    return lead.lead_type === "trade" && getTradeIntent(lead).includes("sell");
  }

  if (selectedType === "trade") {
    return lead.lead_type === "trade" && !getTradeIntent(lead).includes("sell");
  }

  return lead.lead_type === selectedType;
}

function leadSummary(lead: AdminLeadRow): string {
  const details = lead.details ?? {};

  const pick = (key: string) => {
    const value = details[key];

    return value == null || value === "" ? null : formatDetailValue(value);
  };

  if (lead.lead_type === "appointment") {
    const parts = [pick("appointment_type"), pick("preferred_date"), pick("preferred_time")].filter(Boolean);

    return parts.join(" · ") || "Appointment request";
  }

  if (lead.lead_type === "finance") {
    const parts = [pick("vehicle_of_interest"), pick("credit_band"), pick("desired_payment")].filter(Boolean);

    return parts.join(" · ") || "Financing application";
  }

  if (lead.lead_type === "trade") {
    const parts = [
      pick("year_make_model"),
      pick("trade_year"),
      pick("trade_make"),
      pick("trade_model"),
      pick("vin"),
      pick("trade_vin"),
    ].filter(Boolean);

    return parts.join(" · ") || `${getLeadTypeLabel(lead)} request`;
  }

  if (lead.lead_type === "availability") {
    return (
      pick("vehicle_of_interest") ?? pick("selected_vehicle") ?? pick("year_make_model") ?? "Vehicle availability check"
    );
  }

  return lead.message?.slice(0, 120) || "Website message";
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
      if (!matchesLeadType(lead, type)) {
        return false;
      }

      if (!needle) {
        return true;
      }

      const detailsText = Object.entries(lead.details ?? {})
        .map(([key, value]) => `${key} ${formatDetailValue(value)}`)
        .join(" ");

      const haystack = [
        lead.full_name,
        lead.email,
        lead.phone,
        lead.message,
        lead.status,
        getLeadTypeLabel(lead),
        leadSummary(lead),
        detailsText,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(needle);
    });
  }, [leads, type, search]);

  const countFor = (key: LeadFilterType) => {
    return leads.filter((lead) => matchesLeadType(lead, key)).length;
  };

  const openLead = (lead: AdminLeadRow) => {
    setSelectedLead(lead);
  };

  return (
    <>
      <section className="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
        <div className="flex flex-col gap-4 border-b border-border bg-muted/30 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Users className="size-5" />
            </div>

            <div>
              <h2 className="text-base font-semibold text-foreground">Customers</h2>

              <p className="mt-0.5 text-sm text-muted-foreground">Customer requests submitted through the website.</p>
            </div>
          </div>

          <div className="relative w-full lg:max-w-sm">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />

            <Input
              type="search"
              className="pl-9"
              placeholder="Search customer submissions"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search customers"
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
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                  type === item.key
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
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

            <p className="mt-1 text-sm text-muted-foreground">
              {(error as Error).message || "An unexpected error occurred."}
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <Users className="mx-auto size-8 text-muted-foreground/60" />

            <p className="mt-3 font-medium text-foreground">No customer submissions found</p>

            <p className="mt-1 text-sm text-muted-foreground">
              {search.trim()
                ? "Try using another search term."
                : "New form submissions will appear here automatically."}
            </p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-border md:hidden">
              {filtered.map((lead) => (
                <button
                  key={lead.id}
                  type="button"
                  onClick={() => openLead(lead)}
                  className="flex w-full items-start justify-between gap-4 p-4 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-foreground">{lead.full_name || "Unnamed customer"}</p>

                      <Badge variant="secondary">{getLeadTypeLabel(lead)}</Badge>
                    </div>

                    <p className="mt-1 truncate text-sm text-muted-foreground">{leadSummary(lead)}</p>

                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{lead.email || "No email"}</span>
                      <span aria-hidden="true">•</span>
                      <span>{lead.created_at ? formatDate(lead.created_at) : "No date"}</span>
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
                    <th className="whitespace-nowrap px-4 py-3 font-medium">Customer</th>

                    <th className="whitespace-nowrap px-4 py-3 font-medium">Request</th>

                    <th className="whitespace-nowrap px-4 py-3 font-medium">Details</th>

                    <th className="whitespace-nowrap px-4 py-3 font-medium">Status</th>

                    <th className="whitespace-nowrap px-4 py-3 font-medium">Submitted</th>

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
                      aria-label={`View details for ${lead.full_name || "customer"}`}
                      onClick={() => openLead(lead)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openLead(lead);
                        }
                      }}
                      className="cursor-pointer border-t border-border transition-colors hover:bg-muted/40 focus:bg-muted/40 focus:outline-none"
                    >
                      <td className="px-4 py-3 align-top">
                        <div className="min-w-[190px]">
                          <p className="font-medium text-foreground">{lead.full_name || "Unnamed customer"}</p>

                          <p className="truncate text-xs text-muted-foreground">{lead.email || "No email"}</p>

                          <p className="text-xs text-muted-foreground">{lead.phone || "No phone"}</p>
                        </div>
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 align-top">
                        <Badge variant="secondary" className="capitalize">
                          {getLeadTypeLabel(lead)}
                        </Badge>
                      </td>

                      <td className="max-w-[340px] px-4 py-3 align-top text-muted-foreground">
                        <span className="block truncate" title={leadSummary(lead)}>
                          {leadSummary(lead)}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 align-top">
                        <Badge variant={lead.status === "won" ? "default" : "outline"} className="capitalize">
                          {lead.status || "new"}
                        </Badge>
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 align-top text-muted-foreground">
                        {lead.created_at ? formatDate(lead.created_at) : "—"}
                      </td>

                      <td className="px-4 py-3 align-middle">
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
          if (!open) {
            setSelectedLead(null);
          }
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
  if (!lead) {
    return null;
  }

  const details = Object.entries(lead.details ?? {}).filter(
    ([, value]) => value !== null && value !== undefined && value !== "",
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] max-w-3xl overflow-hidden p-0">
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
                <DetailItem label="Full Name" value={lead.full_name} />

                <DetailItem label="Email" value={lead.email} type="email" />

                <DetailItem label="Phone" value={lead.phone} type="phone" />

                <DetailItem label="Request Type" value={getLeadTypeLabel(lead)} />
              </DetailGrid>
            </ModalSection>

            <ModalSection title="Submission Information" icon={CalendarDays}>
              <DetailGrid>
                <DetailItem label="Status" value={lead.status || "new"} />

                <DetailItem label="Submitted" value={lead.created_at ? formatDate(lead.created_at) : null} />

                <DetailItem label="Submission ID" value={String(lead.id)} />
              </DetailGrid>
            </ModalSection>

            {lead.message && (
              <ModalSection title="Customer Message" icon={Mail}>
                <div className="rounded-lg border border-border bg-muted/20 p-4">
                  <p className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground">{lead.message}</p>
                </div>
              </ModalSection>
            )}

            <ModalSection title="Form Details" icon={ClipboardList}>
              {details.length > 0 ? (
                <DetailGrid>
                  {details.map(([key, value]) => (
                    <DetailItem key={key} label={formatFieldLabel(key)} value={formatDetailValue(value)} />
                  ))}
                </DetailGrid>
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

        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>

      {children}
    </section>
  );
}

function DetailGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>;
}

function DetailItem({ label, value, type }: { label: string; value?: string | null; type?: "email" | "phone" }) {
  const displayValue = value && value.trim() ? value.trim() : "Not provided";

  let content: React.ReactNode = displayValue;

  if (value && type === "email") {
    content = (
      <a href={`mailto:${value}`} className="break-words text-primary hover:underline">
        {value}
      </a>
    );
  }

  if (value && type === "phone") {
    content = (
      <a href={`tel:${value}`} className="break-words text-primary hover:underline">
        {value}
      </a>
    );
  }

  return (
    <div className="min-w-0 rounded-lg border border-border bg-background p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>

      <div className={`mt-1 break-words text-sm ${value ? "text-foreground" : "text-muted-foreground"}`}>{content}</div>
    </div>
  );
}

function formatFieldLabel(key: string) {
  const specialLabels: Record<string, string> = {
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
    vehicle_preferences: "Vehicle Preferences",
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
  };

  if (specialLabels[key]) {
    return specialLabels[key];
  }

  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatDetailValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "Not provided";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (Array.isArray(value)) {
    return value.map((item) => formatDetailValue(item)).join(", ");
  }

  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, nestedValue]) => `${formatFieldLabel(key)}: ${formatDetailValue(nestedValue)}`)
      .join(" • ");
  }

  return String(value);
}

function LoadingState() {
  return (
    <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(250px,0.7fr)_minmax(0,2.3fr)]">
      <div className="overflow-hidden rounded-xl border border-border bg-background">
        <div className="h-20 animate-pulse border-b border-border bg-muted/60" />

        <div className="space-y-4 p-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="size-11 animate-pulse rounded-full bg-muted" />

                <div className="flex-1 space-y-2">
                  <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
                </div>
              </div>

              <div className="h-10 animate-pulse rounded bg-muted/70" />
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-background">
        <div className="h-20 animate-pulse border-b border-border bg-muted/60" />

        <div className="space-y-3 p-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-16 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
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
  const sizeClassName = small ? "size-10" : "size-11";

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={`${sizeClassName} shrink-0 rounded-full border border-border object-cover`}
        loading="lazy"
      />
    );
  }

  const initial = (name.slice(0, 1) || fallbackLetter).toUpperCase();

  return (
    <div
      className={`flex ${sizeClassName} shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
        admin ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
      }`}
      aria-hidden="true"
    >
      {initial}
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
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />

      <span className="truncate" title={value || undefined}>
        {value || fallback}
      </span>
    </div>
  );
}
