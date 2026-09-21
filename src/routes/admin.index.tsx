import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
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
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { listLegacyInventoryRows } from "@/lib/legacy-inventory.functions";
import { listCustomers } from "@/lib/admin-customers.functions";
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
  trade: "Sell / Trade",
  appointment: "Appointments",
  availability: "Vehicle inquiries",
  contact: "Contact",
};

function AdminDashboard() {
  const { session } = useAuth();
  const accessToken = session?.access_token ?? "";

  const { data: inventoryRows, isLoading: inventoryLoading } = useQuery({
    queryKey: ["admin", "inventory", "dashboard"],
    enabled: Boolean(accessToken),
    queryFn: () => listLegacyInventoryRows({ data: { accessToken } }),
  });

  const { data: customers, isLoading: customersLoading } = useQuery({
    queryKey: ["admin", "customers", "dashboard"],
    enabled: Boolean(accessToken),
    queryFn: () => listCustomers({ data: { accessToken } }),
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

  const vehicles = inventoryRows ?? [];
  const accounts = customers ?? [];
  const leads = leadRows ?? [];
  const posts = blogPosts ?? [];

  const activeVehicles = vehicles.filter((v) => v.status === "available" || v.status === "pending").length;
  const soldVehicles = vehicles.filter((v) => v.status === "sold").length;
  const publishedPosts = posts.filter((p) => p.status === "published").length;
  const draftPosts = posts.filter((p) => p.status !== "published").length;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const newLeadsThisWeek = leads.filter((lead) => lead.created_at && new Date(lead.created_at) >= sevenDaysAgo).length;

  const leadsByType = (type: string) => leads.filter((lead) => lead.lead_type === type).length;

  const stats = [
    {
      label: "Active cars",
      value: activeVehicles,
      icon: CheckCircle2,
      iconClassName: "text-emerald-600",
      iconBackgroundClassName: "bg-emerald-100",
      to: "/admin/inventory" as const,
      actionLabel: "View inventory",
    },
    {
      label: "Sold",
      value: soldVehicles,
      icon: ShieldCheck,
      iconClassName: "text-blue-600",
      iconBackgroundClassName: "bg-blue-100",
      to: "/admin/inventory" as const,
      actionLabel: "View sold vehicles",
    },
    {
      label: "Total leads",
      value: leads.length,
      icon: Sparkles,
      iconClassName: "text-pink-600",
      iconBackgroundClassName: "bg-pink-100",
      to: "/admin/customers" as const,
      actionLabel: "View opportunities",
    },
    {
      label: "New this week",
      value: newLeadsThisWeek,
      icon: Clock3,
      iconClassName: "text-amber-600",
      iconBackgroundClassName: "bg-amber-100",
      to: "/admin/customers" as const,
      actionLabel: "View recent leads",
    },
    {
      label: "Customers",
      value: accounts.length,
      icon: Users,
      iconClassName: "text-cyan-600",
      iconBackgroundClassName: "bg-cyan-100",
      to: "/admin/customers" as const,
      actionLabel: "View customers",
    },
    {
      label: "Blog posts",
      value: publishedPosts,
      icon: FileText,
      iconClassName: "text-violet-600",
      iconBackgroundClassName: "bg-violet-100",
      to: "/admin/blog" as const,
      actionLabel: `View blog (${draftPosts} draft${draftPosts === 1 ? "" : "s"})`,
    },
  ];

  const leadOverview = [
    { type: "finance", icon: HandCoins, className: "text-emerald-600 bg-emerald-100" },
    { type: "trade", icon: Repeat2, className: "text-amber-600 bg-amber-100" },
    { type: "appointment", icon: CalendarCheck, className: "text-blue-600 bg-blue-100" },
    { type: "availability", icon: Car, className: "text-violet-600 bg-violet-100" },
    { type: "contact", icon: MessageSquare, className: "text-cyan-600 bg-cyan-100" },
  ];

  const isLoading = inventoryLoading || customersLoading || leadsLoading || blogLoading;
  const recentLeads = leads.slice(0, 8);

  return (
    <div className="w-full">
      <AdminPageHeader title="Dashboard" />

      <main className="space-y-6 p-4 sm:p-6">
        <section>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 2xl:grid-cols-6">
            {stats.map((stat) => {
              const Icon = stat.icon;

              return (
                <Link
                  key={stat.label}
                  to={stat.to}
                  aria-label={stat.actionLabel}
                  className="group min-w-0 rounded-xl border border-border bg-background p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:translate-y-0"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-muted-foreground">{stat.label}</p>
                      <p className="mt-2 text-2xl font-semibold text-foreground">{isLoading ? "—" : stat.value}</p>
                    </div>

                    <div
                      className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${stat.iconBackgroundClassName}`}
                    >
                      <Icon className={`size-5 ${stat.iconClassName}`} aria-hidden="true" />
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors group-hover:text-primary">
                    <span className="truncate">{stat.actionLabel}</span>
                    <ArrowRight className="size-3.5 shrink-0 transition-transform group-hover:translate-x-1" />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-border bg-background">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
            <div>
              <h2 className="font-semibold text-foreground">Leads overview</h2>
            </div>

            <Button asChild variant="outline" size="sm">
              <Link to="/admin/customers">
                Open opportunities
                <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-5 sm:p-5">
            {leadOverview.map((item) => {
              const Icon = item.icon;

              return (
                <Link
                  key={item.type}
                  to="/admin/customers"
                  className="group rounded-lg border border-border p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <div className={`flex size-9 items-center justify-center rounded-lg ${item.className}`}>
                    <Icon className="size-4.5" aria-hidden="true" />
                  </div>

                  <p className="mt-3 text-2xl font-semibold text-foreground">
                    {leadsLoading ? "—" : leadsByType(item.type)}
                  </p>

                  <p className="mt-1 text-sm text-muted-foreground">{LEAD_LABELS[item.type] ?? item.type}</p>
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
              <p className="mt-1 text-sm text-muted-foreground">Common administration tasks.</p>
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
