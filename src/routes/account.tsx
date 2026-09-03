import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { siteSettingsQuery, type VehicleWithPhotos } from "@/lib/queries";
import { VehicleCard } from "@/components/VehicleCard";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "Your MyCar Account" },
      {
        name: "description",
        content: "Saved vehicles, saved searches and the status of every request you've sent MyCar.",
      },
      { property: "og:title", content: "Your MyCar Account" },
      { property: "og:description", content: "Saved vehicles, saved searches and request status." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: settings } = useQuery(siteSettingsQuery());

  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  const saved = useQuery({
    queryKey: ["saved-vehicles", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saved_vehicles")
        .select("id, vehicle:vehicles(*, vehicle_photos(*))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const searches = useQuery({
    queryKey: ["saved-searches", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saved_searches")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const requests = useQuery({
    queryKey: ["my-leads", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (!user) return null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Your account</h1>
          <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
        </div>
        <Button
          variant="outline"
          onClick={async () => {
            await signOut();
            void navigate({ to: "/" });
          }}
        >
          Sign out
        </Button>
      </div>

      <Tabs defaultValue="saved" className="mt-8">
        <TabsList>
          <TabsTrigger value="saved">Saved vehicles</TabsTrigger>
          <TabsTrigger value="searches">Saved searches</TabsTrigger>
          <TabsTrigger value="requests">My requests</TabsTrigger>
        </TabsList>

        <TabsContent value="saved" className="mt-6">
          {(saved.data?.length ?? 0) === 0 ? (
            <EmptyState text="You haven't saved any vehicles yet." />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {saved.data?.map((row) => {
                const vehicle = row.vehicle as unknown as VehicleWithPhotos | null;
                return vehicle ? (
                  <VehicleCard key={row.id} vehicle={vehicle} settings={settings} />
                ) : null;
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="searches" className="mt-6">
          {(searches.data?.length ?? 0) === 0 ? (
            <EmptyState text="No saved searches yet. Filter the inventory and save the result." />
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border bg-card">
              {searches.data?.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-4 p-4">
                  <div>
                    <p className="font-medium">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.query || "All inventory"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button asChild size="sm" variant="outline">
                      <a href={`/search${s.query}`}>Open</a>
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={async () => {
                        await supabase.from("saved_searches").delete().eq("id", s.id);
                        void queryClient.invalidateQueries({ queryKey: ["saved-searches"] });
                        toast.success("Search removed.");
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="requests" className="mt-6">
          {(requests.data?.length ?? 0) === 0 ? (
            <EmptyState text="No requests yet." />
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border bg-card">
              {requests.data?.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-4 p-4 text-sm">
                  <div>
                    <p className="font-medium capitalize">{l.lead_type} request</p>
                    <p className="text-xs text-muted-foreground">{formatDate(l.created_at)}</p>
                  </div>
                  <span className="rounded-full bg-surface px-3 py-1 text-xs font-medium capitalize">
                    {l.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border p-10 text-center">
      <p className="text-sm text-muted-foreground">{text}</p>
      <Button asChild className="mt-4" variant="outline">
        <Link to="/search">Browse inventory</Link>
      </Button>
    </div>
  );
}
