import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Car, ClipboardList, KeyRound, Mail, Settings, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/app-client";
import { siteSettingsQuery, type VehicleWithPhotos } from "@/lib/queries";
import { VehicleCard } from "@/components/VehicleCard";
import { VerifyEmailGate } from "@/components/VerifyEmailGate";
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
  const { user, loading, emailVerified } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: settings } = useQuery(siteSettingsQuery());
  const [activeTab, setActiveTab] = useState("saved");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/" });
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

  if (!emailVerified) return <VerifyEmailGate email={user.email ?? ""} />;

  const displayName = String(
    user.user_metadata?.["full_name"] ?? user.user_metadata?.["name"] ?? "",
  ).trim();
  const firstName = displayName.split(/\s+/)[0] || user.email?.split("@")[0] || "there";
  const requestCount = requests.data?.length ?? 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="border-b border-border pb-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Customer dashboard</p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">Welcome back, {firstName}.</h1>
          <p className="mt-2 text-sm text-muted-foreground">Keep track of your saved vehicles and requests in one place.</p>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard icon={Car} label="Saved vehicles" value={saved.data?.length ?? 0} onClick={() => setActiveTab("saved")} />
        <SummaryCard icon={ArrowRight} label="Saved searches" value={searches.data?.length ?? 0} onClick={() => setActiveTab("searches")} />
        <SummaryCard icon={ClipboardList} label="My requests" value={requestCount} onClick={() => setActiveTab("requests")} />
        <SummaryCard icon={Settings} label="Settings" onClick={() => setActiveTab("settings")} />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-8">
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

        <TabsContent value="settings" className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-start gap-3">
              <Mail className="mt-1 size-5 text-primary" />
              <div>
                <h2 className="font-display text-xl font-semibold">Email address</h2>
                <p className="mt-1 text-sm text-muted-foreground">Current email: {user.email}</p>
              </div>
            </div>
            <form className="mt-5 space-y-4" onSubmit={async (event) => {
              event.preventDefault();
              const email = newEmail.trim().toLowerCase();
              if (!email) return;
              const { error } = await supabase.auth.updateUser({ email });
              if (error) toast.error(error.message);
              else { setNewEmail(""); toast.success("Check your email to confirm the new address."); }
            }}>
              <div className="space-y-2">
                <Label htmlFor="new-email">New email</Label>
                <Input id="new-email" type="email" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} placeholder="you@example.com" required />
              </div>
              <Button type="submit" variant="outline">Change email</Button>
            </form>
          </section>

          <section className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-start gap-3">
              <KeyRound className="mt-1 size-5 text-primary" />
              <div>
                <h2 className="font-display text-xl font-semibold">Password</h2>
                <p className="mt-1 text-sm text-muted-foreground">Choose a new password for your account.</p>
              </div>
            </div>
            <form className="mt-5 space-y-4" onSubmit={async (event) => {
              event.preventDefault();
              if (newPassword.length < 8) { toast.error("Use at least 8 characters."); return; }
              const { error } = await supabase.auth.updateUser({ password: newPassword });
              if (error) toast.error(error.message);
              else { setNewPassword(""); toast.success("Password updated."); }
            }}>
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <Input id="new-password" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={8} required />
              </div>
              <Button type="submit" variant="outline">Change password</Button>
            </form>
          </section>

          <section className="rounded-xl border border-border bg-surface p-6 lg:col-span-2">
            <h2 className="font-display text-xl font-semibold">Need to update a request?</h2>
            <p className="mt-1 text-sm text-muted-foreground">Start a new financing, sell/trade, or visit request and our team will connect it to your account.</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button asChild variant="outline"><Link to="/finance">Financing</Link></Button>
              <Button asChild variant="outline"><Link to="/sell">Sell or trade</Link></Button>
              <Button asChild variant="outline"><Link to="/schedule">Book a visit</Link></Button>
            </div>
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, onClick }: { icon: typeof Car; label: string; value?: number; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 text-left transition hover:border-primary/50 hover:bg-muted/30">
      <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary"><Icon className="size-5" /></span>
      <span>{value !== undefined && <span className="block text-2xl font-bold">{value}</span>}<span className="text-sm text-muted-foreground">{label}</span></span>
    </button>
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
