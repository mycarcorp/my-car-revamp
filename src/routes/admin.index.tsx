import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BookOpenText, CarFront, Users } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/app-client";
import { useAuth } from "@/hooks/useAuth";
import { formatDate, formatUsd } from "@/lib/format";
import { listLegacyPosts } from "@/lib/legacy-blog.functions";
import { listLegacyInventoryRows } from "@/lib/legacy-inventory.functions";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const { session } = useAuth();
  const accessToken = session?.access_token ?? "";

  const { data: vehicles = [], isLoading: vehiclesLoading } = useQuery({
    queryKey: ["admin", "dashboard", "vehicles"],
    enabled: Boolean(accessToken),
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
    queryFn: async () => {
      return listLegacyInventoryRows({ data: { accessToken } });
    },
  });

  const { data: leads = [], isLoading: leadsLoading } = useQuery({
    queryKey: ["admin", "dashboard", "leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("id, full_name, email, created_at, status")
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: blogPosts = [], isLoading: blogLoading } = useQuery({
    queryKey: ["admin", "dashboard", "blogPosts", accessToken],
    enabled: Boolean(accessToken),
    queryFn: () => listLegacyPosts({ data: { accessToken } }),
  });

  const activeVehicles = vehicles.filter((vehicle) => vehicle.status !== "sold" && vehicle.status !== "draft").length;
  const soldVehicles = vehicles.filter((vehicle) => vehicle.status === "sold").length;
  const publishedPosts = blogPosts.filter((post) => post.status === "published").length;
  const draftPosts = blogPosts.filter((post) => post.status !== "published").length;
  const newThisWeek = leads.filter((lead) => {
    const createdAt = new Date(lead.created_at).getTime();
    const diffDays = (Date.now() - createdAt) / (1000 * 60 * 60 * 24);
    return diffDays <= 7;
  }).length;

  const stats = [
    { label: "Active Cars", value: String(activeVehicles), accent: "text-emerald-600" },
    { label: "Sold", value: String(soldVehicles), accent: "text-slate-600" },
    { label: "Blog Posts", value: String(publishedPosts), accent: "text-blue-600" },
    { label: "Drafts", value: String(draftPosts), accent: "text-amber-600" },
    { label: "Customers", value: String(leads.length), accent: "text-violet-600" },
    { label: "New This Week", value: String(newThisWeek), accent: "text-rose-600" },
  ];

  const recentVehicles = vehicles.slice(0, 5);
  const recentBlogPosts = blogPosts.slice(0, 5);

  return (
    <div className="w-full">
      <AdminPageHeader
        title="Dashboard"
        actions={
          <>
            <Button asChild size="sm">
              <Link to="/admin/inventory">Add car</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/blog/new">New post</Link>
            </Button>
          </>
        }
      />

      <div className="p-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-border bg-background p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <div className={`rounded-full bg-muted p-2 ${stat.accent}`}>
                {stat.label.includes("Car") ? (
                  <CarFront className="size-4" />
                ) : stat.label.includes("Blog") || stat.label.includes("Draft") ? (
                  <BookOpenText className="size-4" />
                ) : (
                  <Users className="size-4" />
                )}
              </div>
            </div>
            <p className="mt-4 text-3xl font-bold text-foreground">{stat.value}</p>
          </div>
        ))}
      </div>

        <div className="mt-8 grid gap-6">
        <section className="rounded-xl border border-border bg-background p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Recent Car Listings</h2>
            <Button asChild variant="ghost" size="sm">
              <Link to="/admin/inventory" className="inline-flex items-center gap-1">
                View all <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>

          {vehiclesLoading ? (
            <div className="mt-4 space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-16 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : recentVehicles.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No listings have been added yet.</p>
          ) : (
            <div className="mt-4 overflow-hidden rounded-lg border border-border">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Vehicle</th>
                      <th className="px-4 py-3 font-medium">Price</th>
                      <th className="px-4 py-3 font-medium">Miles</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentVehicles.map((vehicle) => (
                      <tr key={vehicle.id} className="border-t border-border bg-background">
                        <td className="px-4 py-3 align-top">
                          <div className="font-medium text-foreground">
                            {vehicle.year} {vehicle.make} {vehicle.model}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {vehicle.trim ?? "No trim listed"}
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top font-medium text-foreground">
                          {formatUsd(vehicle.price_cents)}
                        </td>
                        <td className="px-4 py-3 align-top text-muted-foreground">
                          {vehicle.mileage ? `${vehicle.mileage.toLocaleString()} mi` : "—"}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <Badge
                            variant={vehicle.status === "sold" ? "secondary" : "default"}
                            className="capitalize"
                          >
                            {vehicle.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-border bg-background p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Recent Blog Posts</h2>
            <Button asChild variant="ghost" size="sm">
              <Link to="/admin/blog" className="inline-flex items-center gap-1">
                View all <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>

          {blogLoading || leadsLoading ? (
            <div className="mt-4 space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-14 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : recentBlogPosts.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No blog posts have been created yet.</p>
          ) : (
            <div className="mt-4 overflow-hidden rounded-lg border border-border">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Title</th>
                      <th className="px-4 py-3 font-medium">Category</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentBlogPosts.map((post) => (
                      <tr key={post.id} className="border-t border-border bg-background">
                        <td className="px-4 py-3 align-top font-medium text-foreground">
                          {post.title}
                        </td>
                        <td className="px-4 py-3 align-top text-muted-foreground">
                          {post.category || "—"}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <Badge
                            variant={post.status === "published" ? "default" : "secondary"}
                            className="capitalize"
                          >
                            {post.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 align-top text-muted-foreground">
                          {post.published_at ? formatDate(post.published_at) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
        </div>
      </div>
    </div>
  );
}
