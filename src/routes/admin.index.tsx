import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowRight,
  CalendarCheck,
  Car,
  CheckCircle2,
  Clock3,
  Eye,
  FileText,
  HandCoins,
  MessageSquare,
  Repeat2,
  Users,
} from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { listLegacyInventoryRows } from "@/lib/legacy-inventory.functions";
import { listLeads } from "@/lib/admin-leads.functions";
import { listLegacyPosts } from "@/lib/legacy-blog.functions";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Dashboard — MyCar Admin" },
      { name: "description", content: "Inventory, leads and content at a glance." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminDashboard,
});

const LEAD_LABELS: Record<string, string> = {
  finance: "Financing",
  financing: "Financing",
  sell: "Sell",
  trade: "Trade",
  appointment: "Appointments",
  visit: "Appointments",
  availability: "Vehicle inquiries",
  check_availability: "Check Availability",
  contact: "Contact",
};

function normalizeLeadType(value: unknown) {
  const type = String(value || "other")
    .trim()
    .toLowerCase();
  if (type === "financing") return "finance";
  if (type === "visit") return "appointment";
  if (type === "check_availability") return "availability";
  return type;
}

type DashboardVehicle = {
  id: string | number;
  year?: number | string | null;
  make?: string | null;
  model?: string | null;
  trim?: string | null;
  status?: string | null;
  price_cents?: number | string | null;
  mileage?: number | string | null;
  stock_number?: string | null;
  vehicle_photos?: Array<{ url?: string | null; position?: number | null }> | null;
};

function formatVehiclePrice(value: DashboardVehicle["price_cents"]) {
  const cents = Number(value);

  if (!Number.isFinite(cents) || cents <= 0) return "Call for price";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatVehicleMileage(value: DashboardVehicle["mileage"]) {
  const mileage = Number(value);

  if (!Number.isFinite(mileage) || mileage < 0) return "Mileage unavailable";

  return `${new Intl.NumberFormat("en-US").format(mileage)} mi`;
}

function getVehicleTitle(vehicle: DashboardVehicle) {
  return [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(" ") || "Untitled vehicle";
}

function getVehicleImage(vehicle: DashboardVehicle) {
  return [...(vehicle.vehicle_photos ?? [])]
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .find((photo) => Boolean(photo.url))?.url;
}

function getValidDate(value: string | null | undefined) {
  if (!value) return null;

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function AdminDashboard() {
  const { session } = useAuth();
  const accessToken = session?.access_token ?? "";
  const [showTodayCounts, setShowTodayCounts] = useState(false);

  const { data: inventoryRows, isLoading: inventoryLoading } = useQuery({
    queryKey: ["admin", "inventory", "dashboard"],
    enabled: Boolean(accessToken),
    queryFn: () => listLegacyInventoryRows({ data: { accessToken } }),
  });

  const { data: leadRows, isLoading: leadsLoading } = useQuery({
    queryKey: ["admin", "leads", "dashboard"],
    enabled: Boolean(accessToken),
    queryFn: () => listLeads({ data: { accessToken, limit: 500 } }),
  });

  const { data: blogPosts, isLoading: blogLoading } = useQuery({
    queryKey: ["admin", "blog", "dashboard"],
    enabled: Boolean(accessToken),
    queryFn: () => listLegacyPosts({ data: { accessToken } }),
  });

  const vehicles = (inventoryRows ?? []) as DashboardVehicle[];
  const leads = leadRows ?? [];
  const posts = blogPosts ?? [];

  const recentActiveVehicles = vehicles
    .filter((vehicle) => vehicle.status === "available" || vehicle.status === "pending")
    .slice(0, 6);

  const now = new Date();
  const todayStart = startOfDay(now);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  const todayLeads = leads.filter((lead) => {
    const createdAt = getValidDate(lead.created_at);

    return createdAt && createdAt >= todayStart && createdAt < tomorrowStart;
  });

  const leadsToday = todayLeads.length;

  const leadsByType = (type: string) => {
    const source = showTodayCounts ? todayLeads : leads;
    return source.filter((lead) => normalizeLeadType(lead.lead_type) === type).length;
  };

  const leadOverview = [
    {
      key: "today",
      label: showTodayCounts ? "Back to totals" : "Leads today",
      value: leadsToday,
      icon: Clock3,
      className: "text-[#D25B4C] bg-[#D25B4C]/12",
    },
    {
      key: "finance",
      label: LEAD_LABELS["finance"],
      value: leadsByType("finance"),
      icon: HandCoins,
      className: "text-[#809C61] bg-[#809C61]/12",
    },
    {
      key: "trade",
      label: LEAD_LABELS["trade"],
      value: leadsByType("trade"),
      icon: Repeat2,
      className: "text-[#EDBA2B] bg-[#EDBA2B]/12",
    },
    {
      key: "appointment",
      label: LEAD_LABELS["appointment"],
      value: leadsByType("appointment"),
      icon: CalendarCheck,
      className: "text-[#D25B4C] bg-[#D25B4C]/12",
    },
    {
      key: "availability",
      label: LEAD_LABELS["availability"],
      value: leadsByType("availability"),
      icon: Car,
      className: "text-[#809C61] bg-[#809C61]/12",
    },
    {
      key: "contact",
      label: LEAD_LABELS["contact"],
      value: leadsByType("contact"),
      icon: MessageSquare,
      className: "text-[#EDBA2B] bg-[#EDBA2B]/12",
    },
  ];

  const recentLeads = leads.slice(0, 8);

  return (
    <div className="w-full">
      <AdminPageHeader title="Dashboard" />

      <main className="space-y-6 p-4 sm:p-6">
        <section className="overflow-hidden rounded-xl border border-border bg-background">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
            <div>
              <h2 className="font-semibold text-foreground">Leads overview</h2>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <span
                  className={`size-1.5 rounded-full transition-colors duration-300 ${
                    showTodayCounts ? "bg-[#F49923]" : "bg-muted-foreground/40"
                  }`}
                />
                <span className="transition-colors duration-300">
                  {showTodayCounts ? "Showing today’s activity" : "Showing overall totals"}
                </span>
              </div>
            </div>

            <Button asChild variant="outline" size="sm">
              <Link to="/admin/customers">
                Open opportunities
                <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-6 sm:p-5">
            {leadOverview.map((item) => {
              const Icon = item.icon;
              const hasTodayLeads = showTodayCounts && item.value > 0;

              if (item.key === "today") {
                return (
                  <button
                    key={item.key}
                    type="button"
                    aria-pressed={showTodayCounts}
                    onClick={() => setShowTodayCounts((current) => !current)}
                    className={`group rounded-lg border p-4 text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F49923]/40 ${
                      showTodayCounts
                        ? hasTodayLeads
                          ? "border-[#F49923]/60 bg-[#F49923]/[0.07] shadow-sm"
                          : "border-[#F49923]/35 bg-[#F49923]/[0.03]"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <div
                      className={`flex size-9 items-center justify-center rounded-lg transition-colors duration-300 ${
                        hasTodayLeads ? "bg-[#F49923]/15 text-[#F49923]" : item.className
                      }`}
                    >
                      <Icon className="size-4.5" aria-hidden="true" />
                    </div>

                    <p
                      className={`mt-3 text-2xl font-semibold transition-colors duration-300 ${
                        hasTodayLeads ? "text-[#F49923]" : "text-foreground"
                      }`}
                    >
                      <span
                        key={`${showTodayCounts}-${item.value}`}
                        className="inline-block animate-in fade-in zoom-in-95 duration-300"
                      >
                        {leadsLoading ? "—" : item.value}
                      </span>
                    </p>

                    <div className="mt-1 flex items-center justify-between gap-2">
                      <p
                        className={`text-sm transition-colors duration-300 ${
                          hasTodayLeads ? "font-medium text-[#F49923]" : "text-muted-foreground"
                        }`}
                      >
                        {item.label}
                      </p>
                      <span
                        className={`text-xs font-medium transition-colors duration-300 ${
                          showTodayCounts ? "text-[#F49923]" : "text-primary"
                        }`}
                      >
                        {showTodayCounts ? "Back" : "View today"}
                      </span>
                    </div>
                  </button>
                );
              }

              return (
                <Link
                  key={item.key}
                  to="/admin/customers"
                  className={`group rounded-lg border p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 ${
                    hasTodayLeads
                      ? "border-[#F49923]/60 bg-[#F49923]/[0.07] shadow-sm focus-visible:ring-[#F49923]/40"
                      : "border-border hover:border-primary/40 focus-visible:ring-primary"
                  }`}
                >
                  <div
                    className={`flex size-9 items-center justify-center rounded-lg transition-colors duration-300 ${
                      hasTodayLeads ? "bg-[#F49923]/15 text-[#F49923]" : item.className
                    }`}
                  >
                    <Icon className="size-4.5" aria-hidden="true" />
                  </div>

                  <p
                    className={`mt-3 text-2xl font-semibold transition-colors duration-300 ${
                      hasTodayLeads ? "text-[#F49923]" : "text-foreground"
                    }`}
                  >
                    <span
                      key={`${showTodayCounts}-${item.value}`}
                      className="inline-block animate-in fade-in zoom-in-95 duration-300"
                    >
                      {leadsLoading ? "—" : item.value}
                    </span>
                  </p>

                  <p
                    className={`mt-1 text-sm transition-colors duration-300 ${
                      hasTodayLeads ? "font-medium text-[#F49923]" : "text-muted-foreground"
                    }`}
                  >
                    {item.label}
                  </p>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
          <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-background">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
              <div>
                <h2 className="font-semibold text-foreground">Recent leads</h2>
              </div>

              <Button asChild variant="outline" size="sm">
                <Link to="/admin/customers">
                  View all
                  <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
            </div>

            {leadsLoading ? (
              <div className="space-y-3 p-4 sm:p-5">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="h-16 animate-pulse rounded-lg bg-muted" />
                ))}
              </div>
            ) : recentLeads.length === 0 ? (
              <div className="p-8 text-center sm:p-10">
                <Users className="mx-auto size-8 text-muted-foreground" />
                <p className="mt-3 font-medium text-foreground">No leads yet</p>
                <p className="mt-1 text-sm text-muted-foreground">New form submissions will appear here.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="whitespace-nowrap px-4 py-3 font-medium sm:px-5">Customer</th>
                      <th className="whitespace-nowrap px-4 py-3 font-medium">Type</th>
                      <th className="whitespace-nowrap px-4 py-3 font-medium">Status</th>
                      <th className="whitespace-nowrap px-4 py-3 font-medium">Date</th>
                    </tr>
                  </thead>

                  <tbody>
                    {recentLeads.map((lead) => (
                      <tr key={lead.id} className="border-t border-border">
                        <td className="px-4 py-3 sm:px-5">
                          <div className="min-w-[180px]">
                            <p className="font-medium text-foreground">{lead.full_name || "Unnamed customer"}</p>
                            <p className="truncate text-xs text-muted-foreground">{lead.email || "No email"}</p>
                          </div>
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                          {LEAD_LABELS[lead.lead_type] ?? lead.lead_type}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3">
                          <Badge variant={lead.status === "won" ? "default" : "secondary"} className="capitalize">
                            {lead.status || "new"}
                          </Badge>
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                          {lead.created_at ? formatDate(lead.created_at) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="min-w-0 rounded-xl border border-border bg-background">
            <div className="border-b border-border px-4 py-4 sm:px-5">
              <h2 className="font-semibold text-foreground">Quick actions</h2>
            </div>

            <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-1 sm:p-5">
              <Button asChild className="h-auto justify-between gap-4 px-4 py-3">
                <Link to="/admin/inventory">
                  <span className="flex items-center gap-3">
                    <CheckCircle2 className="size-5" />
                    Manage inventory
                  </span>
                  <ArrowRight className="size-4" />
                </Link>
              </Button>

              <Button asChild variant="outline" className="h-auto justify-between gap-4 px-4 py-3">
                <Link to="/admin/blog">
                  <span className="flex items-center gap-3">
                    <FileText className="size-5" />
                    Manage blog
                  </span>
                  <ArrowRight className="size-4" />
                </Link>
              </Button>

              <Button asChild variant="outline" className="h-auto justify-between gap-4 px-4 py-3">
                <Link to="/admin/customers">
                  <span className="flex items-center gap-3">
                    <Users className="size-5" />
                    Customers &amp; leads
                  </span>
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-border bg-background">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
            <div>
              <h2 className="font-semibold text-foreground">Recent active cars</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Recently added vehicles that are available or pending.
              </p>
            </div>

            <Button asChild variant="outline" size="sm">
              <Link to="/admin/inventory">
                View inventory
                <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
          </div>

          {inventoryLoading ? (
            <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 sm:p-5">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-64 animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          ) : recentActiveVehicles.length === 0 ? (
            <div className="p-8 text-center sm:p-10">
              <Car className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-3 font-medium text-foreground">No active cars found</p>
              <p className="mt-1 text-sm text-muted-foreground">Available and pending inventory will appear here.</p>
            </div>
          ) : (
            <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 sm:p-5">
              {recentActiveVehicles.map((vehicle) => {
                const imageUrl = getVehicleImage(vehicle);

                return (
                  <Link
                    key={vehicle.id}
                    to="/admin/inventory"
                    className="group min-w-0 overflow-hidden rounded-xl border border-border bg-background transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <div className="relative aspect-[16/9] overflow-hidden bg-muted">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={getVehicleTitle(vehicle)}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                          onError={(event) => {
                            event.currentTarget.style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <Car className="size-9 text-muted-foreground/60" aria-hidden="true" />
                        </div>
                      )}

                      <Badge
                        variant="secondary"
                        className="absolute left-3 top-3 bg-background/90 capitalize backdrop-blur-sm"
                      >
                        {vehicle.status || "available"}
                      </Badge>
                    </div>

                    <div className="p-4">
                      <h3 className="truncate font-semibold text-foreground">{getVehicleTitle(vehicle)}</h3>

                      <div className="mt-2 flex items-center justify-between gap-3">
                        <p className="font-semibold text-[#809C61]">{formatVehiclePrice(vehicle.price_cents)}</p>
                        <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
                      </div>

                      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>{formatVehicleMileage(vehicle.mileage)}</span>
                        {vehicle.stock_number ? <span>Stock #{vehicle.stock_number}</span> : null}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-xl border border-border bg-background">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
            <div>
              <h2 className="font-semibold text-foreground">Recent blog posts</h2>
              <p className="mt-1 text-sm text-muted-foreground">Latest articles published or saved as drafts.</p>
            </div>

            <Button asChild variant="outline" size="sm">
              <Link to="/admin/blog">
                View all
                <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
          </div>

          {blogLoading ? (
            <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 sm:p-5">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-32 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className="p-8 text-center sm:p-10">
              <FileText className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-3 font-medium text-foreground">No blog posts yet</p>
              <p className="mt-1 text-sm text-muted-foreground">AutoSEO and manually created posts will appear here.</p>
            </div>
          ) : (
            <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 sm:p-5">
              {posts.slice(0, 6).map((post) => (
                <Link
                  key={post.id}
                  to="/admin/blog"
                  className="group min-w-0 rounded-lg border border-border p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <div className="flex items-start justify-between gap-3">
                    <Badge variant={post.status === "published" ? "default" : "secondary"} className="capitalize">
                      {post.status || "draft"}
                    </Badge>

                    <Eye className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                  </div>

                  <h3 className="mt-3 line-clamp-2 font-medium text-foreground">{post.title || "Untitled post"}</h3>

                  <p className="mt-3 text-xs text-muted-foreground">
                    {post.published_at ? formatDate(post.published_at) : "Not published"}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
