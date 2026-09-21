import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { CalendarDays, Mail, Phone, Search, ShieldCheck, UserRound, Users } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { listCustomers } from "@/lib/admin-customers.functions";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/admin/customers")({
  component: AdminCustomers,
});

function AdminCustomers() {
  const { session } = useAuth();
  const accessToken = session?.access_token ?? "";
  const [q, setQ] = useState("");

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
    const needle = q.trim().toLowerCase();

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
  }, [accounts, q]);

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

  const totalAdministrators = useMemo(() => {
    return accounts.filter((account) => (account.roles ?? []).some((role) => role.toLowerCase().includes("admin")))
      .length;
  }, [accounts]);

  const totalCustomers = accounts.length - totalAdministrators;

  return (
    <div className="w-full">
      <AdminPageHeader title="Users" />

      <main className="p-4 sm:p-6">
        <div className="mb-6 rounded-xl border border-border bg-background p-4 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">Administrators and Customers</h2>

              <p className="mt-1 text-sm text-muted-foreground">
                Administrator accounts are separated from registered customer accounts.
              </p>
            </div>

            <div className="relative w-full lg:max-w-md">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />

              <Input
                id="account-search"
                type="search"
                className="pl-9"
                placeholder="Search name, email, phone or role"
                value={q}
                onChange={(event) => setQ(event.target.value)}
                aria-label="Search administrators and customers"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Badge variant="secondary" className="gap-1.5 px-3 py-1">
              <ShieldCheck className="size-3.5" />
              {totalAdministrators} {totalAdministrators === 1 ? "Administrator" : "Administrators"}
            </Badge>

            <Badge variant="outline" className="gap-1.5 px-3 py-1">
              <Users className="size-3.5" />
              {totalCustomers} {totalCustomers === 1 ? "Customer" : "Customers"}
            </Badge>
          </div>
        </div>

        <LeadsSection accessToken={accessToken} />

        {isLoading ? (
          <LoadingState />
        ) : error ? (
          <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-6">
            <p className="font-medium text-destructive">Couldn&apos;t load users</p>

            <p className="mt-1 text-sm text-muted-foreground">
              {(error as Error).message || "An unexpected error occurred while loading the accounts."}
            </p>
          </div>
        ) : (
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
                    {q.trim() ? "No matching administrators" : "No administrators found"}
                  </p>

                  <p className="mt-1 text-xs text-muted-foreground">
                    {q.trim() ? "Try using a different search term." : "Accounts with an admin role will appear here."}
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
                    <h2 className="font-semibold text-foreground">Customers</h2>

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
                    {q.trim() ? "No matching customers" : "No customers found"}
                  </p>

                  <p className="mt-1 text-sm text-muted-foreground">
                    {q.trim()
                      ? "Try using a different name, email, phone number or role."
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
                          <tr key={customer.id} className="border-t border-border transition-colors hover:bg-muted/30">
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
                                    {customer.legacy_user_id ? `Legacy ID: ${customer.legacy_user_id}` : "Auth account"}
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
        )}
      </main>
    </div>
  );
}

const LEAD_TYPES = [
  { key: "all", label: "All opportunities" },
  { key: "finance", label: "Financing" },
  { key: "trade", label: "Sell / Trade" },
  { key: "appointment", label: "Appointments" },
  { key: "availability", label: "Vehicle inquiries" },
  { key: "contact", label: "Contact" },
] as const;

const LEAD_LABELS: Record<string, string> = {
  finance: "Financing",
  trade: "Sell / Trade",
  appointment: "Appointment",
  availability: "Vehicle inquiry",
  contact: "Contact",
};

function leadSummary(lead: AdminLeadRow): string {
  const d = lead.details ?? {};
  const pick = (key: string) => {
    const value = d[key];
    return value == null || value === "" ? null : String(value);
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
    const parts = [pick("intent"), pick("year_make_model"), pick("vin")].filter(Boolean);
    return parts.join(" · ") || "Sell / trade request";
  }
  if (lead.lead_type === "availability") {
    return pick("vehicle_of_interest") ?? pick("year_make_model") ?? "Vehicle availability check";
  }
  return lead.message?.slice(0, 120) || "Website message";
}

function LeadsSection({ accessToken }: { accessToken: string }) {
  const [type, setType] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "leads", "customers-page"],
    enabled: Boolean(accessToken),
    queryFn: () => listLeads({ data: { accessToken, limit: 1000 } }),
  });

  const leads = data ?? [];

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return leads.filter((lead) => {
      if (type !== "all" && lead.lead_type !== type) return false;
      if (!needle) return true;
      const haystack = [lead.full_name, lead.email, lead.phone, lead.message, leadSummary(lead)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [leads, type, search]);

  const countFor = (key: string) => (key === "all" ? leads.length : leads.filter((l) => l.lead_type === key).length);

  return (
    <section className="mb-6 overflow-hidden rounded-xl border border-border bg-background shadow-sm">
      <div className="flex flex-col gap-4 border-b border-border bg-muted/30 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Opportunities</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Everyone who submitted a form: financing, sell or trade, appointments and inquiries.
          </p>
        </div>

        <div className="relative w-full lg:max-w-sm">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            className="pl-9"
            placeholder="Search leads"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search opportunities"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border p-4">
        {LEAD_TYPES.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setType(item.key)}
            aria-pressed={type === item.key}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              type === item.key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
            }`}
          >
            {item.label} ({isLoading ? "…" : countFor(item.key)})
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3 p-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-16 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : error ? (
        <div role="alert" className="p-6">
          <p className="font-medium text-destructive">Couldn&apos;t load opportunities</p>
          <p className="mt-1 text-sm text-muted-foreground">{(error as Error).message}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-10 text-center">
          <Users className="mx-auto size-8 text-muted-foreground/60" />
          <p className="mt-3 font-medium text-foreground">No submissions here yet</p>
          <p className="mt-1 text-sm text-muted-foreground">New form submissions appear in this list automatically.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="whitespace-nowrap px-4 py-3 font-medium">Customer</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">Request</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">Details</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">Status</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">Submitted</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((lead) => (
                <tr key={lead.id} className="border-t border-border transition-colors hover:bg-muted/30">
                  <td className="px-4 py-3 align-top">
                    <div className="min-w-[190px]">
                      <p className="font-medium text-foreground">{lead.full_name || "Unnamed customer"}</p>
                      <p className="truncate text-xs text-muted-foreground">{lead.email || "No email"}</p>
                      <p className="text-xs text-muted-foreground">{lead.phone || "No phone"}</p>
                    </div>
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 align-top">
                    <Badge variant="secondary" className="capitalize">
                      {LEAD_LABELS[lead.lead_type] ?? lead.lead_type}
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
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
