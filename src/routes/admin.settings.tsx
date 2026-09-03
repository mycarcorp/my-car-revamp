import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { siteSettingsQuery } from "@/lib/queries";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/admin/settings")({
  component: AdminSettings,
});

type Badge = { label: string; enabled: boolean };

function AdminSettings() {
  const queryClient = useQueryClient();
  const { isOwner } = useAuth();
  const { data, isLoading, error } = useQuery(siteSettingsQuery());
  const [form, setForm] = useState<Record<string, string>>({});
  const [badges, setBadges] = useState<Badge[]>([]);
  const [hours, setHours] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!data) return;
    setForm({
      dealership_name: data.dealership_name,
      phone: data.phone,
      email: data.email,
      address_line: data.address_line,
      finance_apr: String(data.finance_apr),
      finance_term_months: String(data.finance_term_months),
      finance_down_percent: String(data.finance_down_percent),
      finance_disclosure: data.finance_disclosure,
    });
    setBadges((data.trust_badges ?? []) as Badge[]);
    setHours((data.hours ?? {}) as Record<string, string>);
  }, [data]);

  async function save() {
    const { error } = await supabase
      .from("site_settings")
      .update({
        dealership_name: form["dealership_name"],
        phone: form["phone"],
        email: form["email"],
        address_line: form["address_line"],
        finance_apr: Number(form["finance_apr"]),
        finance_term_months: Number(form["finance_term_months"]),
        finance_down_percent: Number(form["finance_down_percent"]),
        finance_disclosure: form["finance_disclosure"],
        trust_badges: badges as never,
        hours: hours as never,
      })
      .eq("id", 1);
    if (error) { toast.error("Only an owner can change site settings."); return; }
    void queryClient.invalidateQueries({ queryKey: ["site-settings"] });
    toast.success("Settings saved.");
  }

  const field = (key: string, label: string, type = "text") => (
    <div className="space-y-2">
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        type={type}
        value={form[key] ?? ""}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
      />
    </div>
  );

  if (isLoading) return <div className="p-6"><div className="h-40 animate-pulse rounded-lg bg-muted" /></div>;
  if (error) return <div className="p-6 text-sm">Couldn't load settings.</div>;

  return (
    <div className="p-6">
      <h1 className="font-display text-2xl font-bold">Site settings</h1>
      <p className="text-sm text-muted-foreground">
        {isOwner
          ? "Contact details, hours, trust badges and payment-estimator assumptions."
          : "View only — ask an owner to change these."}
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="space-y-4 rounded-lg border border-border bg-background p-5">
          <h2 className="font-display text-lg font-semibold">Dealership</h2>
          {field("dealership_name", "Name")}
          {field("phone", "Phone")}
          {field("email", "Email", "email")}
          {field("address_line", "Address")}
          <div className="grid gap-3 sm:grid-cols-3">
            {(["mon_fri", "sat", "sun"] as const).map((k) => (
              <div key={k} className="space-y-2">
                <Label htmlFor={k}>{k === "mon_fri" ? "Mon–Fri" : k === "sat" ? "Saturday" : "Sunday"}</Label>
                <Input
                  id={k}
                  value={hours[k] ?? ""}
                  onChange={(e) => setHours((h) => ({ ...h, [k]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4 rounded-lg border border-border bg-background p-5">
          <h2 className="font-display text-lg font-semibold">Payment estimator</h2>
          {field("finance_apr", "Default APR (%)", "number")}
          {field("finance_term_months", "Default term (months)", "number")}
          {field("finance_down_percent", "Default down payment (%)", "number")}
          <div className="space-y-2">
            <Label htmlFor="finance_disclosure">Disclosure text</Label>
            <Textarea
              id="finance_disclosure"
              rows={4}
              value={form["finance_disclosure"] ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, finance_disclosure: e.target.value }))}
            />
          </div>
        </section>

        <section className="space-y-4 rounded-lg border border-border bg-background p-5 lg:col-span-2">
          <h2 className="font-display text-lg font-semibold">Trust badges</h2>
          <p className="text-sm text-muted-foreground">
            Only enable a badge when the underlying policy is real and documented.
          </p>
          {badges.map((b, i) => (
            <div key={i} className="flex items-center gap-3">
              <Input
                value={b.label}
                onChange={(e) =>
                  setBadges((list) =>
                    list.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)),
                  )
                }
              />
              <Switch
                checked={b.enabled}
                onCheckedChange={(v) =>
                  setBadges((list) => list.map((x, j) => (j === i ? { ...x, enabled: v } : x)))
                }
              />
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setBadges((l) => [...l, { label: "", enabled: false }])}
          >
            Add badge
          </Button>
        </section>
      </div>

      <Button className="mt-6" onClick={save} disabled={!isOwner}>
        Save settings
      </Button>
    </div>
  );
}
