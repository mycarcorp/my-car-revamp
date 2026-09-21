import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, Clock3, Eye, FileText, ShieldCheck, Sparkles, Users } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { listLegacyInventoryRows } from "@/lib/legacy-inventory.functions";
import { listCustomers } from "@/lib/admin-customers.functions";
import { listLegacyPosts } from "@/lib/legacy-blog.functions";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const { session } = useAuth();
  const accessToken = session?.access_token ?? "";

  const { data: inventoryRows, isLoading: inventoryLoading } = useQuery({
    queryKey: ["admin", "inventory", "dashboard"],
    enabled: Boolean(accessToken),
    queryFn: () => listLegacyInventoryRows({ data: { accessToken } }),
  });

  const { data: customers, isLoading: leadsLoading } = useQuery({
    queryKey: ["admin", "customers", "dashboard"],
    enabled: Boolean(accessToken),
    queryFn: () => listCustomers({ data: { accessToken } }),
  });

  const { data: blogPosts, isLoading: blogLoading } = useQuery({
    queryKey: ["admin", "blog", "dashboard"],
    enabled: Boolean(accessToken),
    queryFn: () => listLegacyPosts({ data: { accessToken } }),
  });

  const vehicles = inventoryRows ?? [];
  const leads = (customers ?? []).slice(0, 8);
  const posts = blogPosts ?? [];

  const activeVehicles = vehicles.filter(
    (vehicle) => vehicle.status === "available" || vehicle.status === "pending",
  ).length;

  const soldVehicles = vehicles.filter((vehicle) => vehicle.status === "sold").length;

  const publishedPosts = posts.filter((post) => post.status === "published").length;

  const draftPosts = posts.filter((post) => post.status === "draft").length;

  const newThisWeek = (customers ?? []).filter((lead) => {
    if (!lead.created_at) return false;

    const createdAt = new Date(lead.created_at);
    const sevenDaysAgo = new Date();

    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    return createdAt >= sevenDaysAgo;
  }).length;

  const stats = [
    {
      label: "Active Cars",
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
      label: "Blog Posts",
      value: publishedPosts,
      icon: FileText,
      iconClassName: "text-violet-600",
      iconBackgroundClassName: "bg-violet-100",
      to: "/admin/blog" as const,
      actionLabel: "View blog posts",
    },
    {
      label: "Drafts",
      value: draftPosts,
      icon: Clock3,
      iconClassName: "text-amber-600",
      iconBackgroundClassName: "bg-amber-100",
      to: "/admin/blog" as const,
      actionLabel: "View blog drafts",
    },
    {
      label: "Customers",
      value: (customers ?? []).length,
      icon: Users,
      iconClassName: "text-cyan-600",
      iconBackgroundClassName: "bg-cyan-100",
      to: "/admin/customers" as const,
      actionLabel: "View customers",
    },
    {
      label: "New This Week",
      value: newThisWeek,
      icon: Sparkles,
      iconClassName: "text-pink-600",
      iconBackgroundClassName: "bg-pink-100",
      to: "/admin/customers" as const,
      actionLabel: "View new customers",
    },
  ];

  const isLoading = inventoryLoading || leadsLoading || blogLoading;

  return (
    <div className="w-full">
      <AdminPageHeader title="Dashboard" />

      <main className="space-y-6 p-4 sm:p-6">
        <section>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
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
                    <span>{stat.actionLabel}</span>
                    <ArrowRight
                      className="size-3.5 transition-transform group-hover:translate-x-1"
                      aria-hidden="true"
                    />
                  </div>
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
                <p className="mt-1 text-sm text-muted-foreground">Your latest customer inquiries.</p>
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
            ) : leads.length === 0 ? (
              <div className="p-8 text-center sm:p-10">
                <Users className="mx-auto size-8 text-muted-foreground" />
                <p className="mt-3 font-medium text-foreground">No recent leads</p>
                <p className="mt-1 text-sm text-muted-foreground">New customer inquiries will appear here.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="whitespace-nowrap px-4 py-3 font-medium sm:px-5">Customer</th>
                      <th className="whitespace-nowrap px-4 py-3 font-medium">Phone</th>
                      <th className="whitespace-nowrap px-4 py-3 font-medium">Role</th>
                      <th className="whitespace-nowrap px-4 py-3 font-medium">Date</th>
                    </tr>
                  </thead>

                  <tbody>
                    {leads.map((lead) => (
                      <tr key={lead.id} className="border-t border-border">
                        <td className="px-4 py-3 sm:px-5">
                          <div className="min-w-[180px]">
                            <p className="font-medium text-foreground">{lead.name || "Unnamed customer"}</p>
                            <p className="truncate text-xs text-muted-foreground">{lead.email || "No email"}</p>
                          </div>
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{lead.phone || "—"}</td>

                        <td className="whitespace-nowrap px-4 py-3">
                          <Badge variant={lead.role === "owner" ? "default" : "secondary"} className="capitalize">
                            {lead.role || "customer"}
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
                    View customers
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

                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                    {post.meta_description || "No description available."}
                  </p>

                  <p className="mt-3 text-xs text-muted-foreground">
                    {post.published_at
                      ? formatDate(post.published_at)
                      : post.created_at
                        ? formatDate(post.created_at)
                        : "No date"}
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
