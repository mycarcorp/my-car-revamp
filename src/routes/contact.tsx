import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Mail, MapPin, Phone } from "lucide-react";
import { LeadForm } from "@/components/LeadForm";
import { siteSettingsQuery } from "@/lib/queries";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact MyCar — Fredericksburg, VA Used Car Dealer" },
      {
        name: "description",
        content:
          "Call, email or message MyCar in Fredericksburg, Virginia. Ask about a vehicle, financing, or your trade — we answer every message.",
      },
      { property: "og:title", content: "Contact MyCar — Fredericksburg, VA" },
      {
        property: "og:description",
        content: "Call, email or message our Fredericksburg dealership team.",
      },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const { data: settings } = useQuery(siteSettingsQuery());
  const hours = (settings?.hours ?? {}) as Record<string, string>;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="font-display text-4xl font-bold">Contact us</h1>
      <p className="mt-3 text-muted-foreground">
        Questions about a vehicle, a trade, or financing? Reach the people who actually work the lot.
      </p>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="rounded-xl border border-border bg-card p-6">
          <LeadForm
            leadType="contact"
            submitLabel="Send message"
            messageLabel="How can we help?"
            successTitle="Message sent"
            successBody="We reply during business hours, usually within a couple of hours."
          />
        </div>

        <aside className="space-y-4 rounded-xl border border-border bg-surface p-6 text-sm">
          <div className="flex items-start gap-3">
            <Phone className="mt-0.5 size-4 text-accent" />
            <a href={`tel:${(settings?.phone ?? "").replace(/\D/g, "")}`} className="font-semibold">
              {settings?.phone}
            </a>
          </div>
          <div className="flex items-start gap-3">
            <Mail className="mt-0.5 size-4 text-accent" />
            <a href={`mailto:${settings?.email ?? ""}`}>{settings?.email}</a>
          </div>
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 size-4 text-accent" />
            <span>{settings?.address_line}</span>
          </div>
          <div className="border-t border-border pt-4 text-muted-foreground">
            <p>Mon–Fri: {hours["mon_fri"] ?? "—"}</p>
            <p>Saturday: {hours["sat"] ?? "—"}</p>
            <p>Sunday: {hours["sun"] ?? "—"}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}