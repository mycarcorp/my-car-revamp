import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CarFront, Clock3, Headphones, Mail, MapPin, Phone, ShieldCheck, type LucideIcon } from "lucide-react";
import { LeadForm } from "@/components/LeadForm";
import { siteSettingsQuery } from "@/lib/queries";
import contactAgent from "@/assets/contact-hero.jpg";

const DEFAULT_PHONE = "(540) 426-3322";
const DEFAULT_EMAIL = "mycar@mycarcorp.com";
const DEFAULT_ADDRESS = "Fredericksburg, VA";

/**
 * Prevent missing database/configuration values from being rendered
 * publicly as "undefined", "null", or other empty placeholders.
 */
function cleanSetting(value: unknown, fallback = ""): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const cleaned = value.trim();

  if (!cleaned || cleaned.toLowerCase() === "undefined" || cleaned.toLowerCase() === "null") {
    return fallback;
  }

  return cleaned;
}

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      {
        title: "Contact MyCar — Fredericksburg, VA Used Car Dealer",
      },
      {
        name: "description",
        content:
          "Call, email or message MyCar in Fredericksburg, Virginia. Ask about a vehicle, financing, or your trade — we answer every message.",
      },
      {
        property: "og:title",
        content: "Contact MyCar — Fredericksburg, VA",
      },
      {
        property: "og:description",
        content: "Call, email or message our Fredericksburg dealership team.",
      },
      {
        property: "og:url",
        content: "https://mycarcorp.com/contact",
      },
      {
        property: "og:type",
        content: "website",
      },
    ],
    links: [
      {
        rel: "canonical",
        href: "https://mycarcorp.com/contact",
      },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const { data: settings } = useQuery(siteSettingsQuery());

  const rawHours = (settings?.hours ?? {}) as Record<string, unknown>;

  const phone = cleanSetting(settings?.phone, DEFAULT_PHONE);
  const email = cleanSetting(settings?.email, DEFAULT_EMAIL);
  const address = cleanSetting(settings?.address_line, DEFAULT_ADDRESS);

  const hours = {
    mon_fri: cleanSetting(rawHours["mon_fri"], "—"),
    sat: cleanSetting(rawHours["sat"], "—"),
    sun: cleanSetting(rawHours["sun"], "—"),
  };

  const phoneHref = phone.replace(/\D/g, "");

  const mapHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

  return (
    <main className="min-h-[calc(100vh-72px)] bg-[#f7f8fa]">
      <section className="relative isolate overflow-hidden bg-[#07111b]">
        <img
          src={contactAgent}
          alt="MyCar team member answering a customer call on the dealership lot"
          width={1920}
          height={832}
          className="absolute inset-0 -z-10 h-full w-full object-cover object-[70%_center]"
        />

        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#07111b] via-[#07111b]/80 to-[#07111b]/10" />

        <div className="relative mx-auto flex min-h-[340px] max-w-7xl items-center px-4 py-12 sm:px-6 lg:min-h-[420px] lg:px-8">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white">
              <Headphones className="size-4 text-[#F7941D]" />
              Talk to the MyCar team
            </div>

            <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
              How can we help?
            </h1>

            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
              Questions about a vehicle, financing, selling your car, or planning a visit? Reach the people who actually
              work the lot.
            </p>

            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-slate-300">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="size-4 text-[#809C61]" />
                Local dealership team
              </span>

              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="size-4 text-[#809C61]" />
                No-pressure assistance
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.35fr)_360px]">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-start gap-3 border-b border-slate-200 px-5 py-4 sm:px-6">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#F7941D]/15 text-[#C96500]">
                <Mail className="size-5" />
              </div>

              <div>
                <h2 className="font-display text-xl font-bold text-slate-950">Send us a message</h2>

                <p className="mt-1 text-sm text-slate-600">Share your question and our team will follow up.</p>
              </div>
            </div>

            <div className="p-5 sm:p-6 [&_button[type=submit]]:h-11 [&_button[type=submit]]:w-full [&_button[type=submit]]:bg-[#F7941D] [&_button[type=submit]]:font-semibold [&_button[type=submit]]:text-black [&_button[type=submit]]:hover:bg-[#E88612] [&_input]:h-10 [&_textarea]:min-h-[96px]">
              <LeadForm
                leadType="contact"
                submitLabel="Send message"
                messageLabel="How can we help?"
                successTitle="Message sent"
                successBody="We reply during business hours, usually within a couple of hours."
              />
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-4 flex items-center gap-3 px-1">
                <div className="flex size-10 items-center justify-center rounded-xl bg-slate-900 text-white">
                  <Headphones className="size-5" />
                </div>

                <div>
                  <h2 className="font-semibold text-slate-950">Contact our team</h2>

                  <p className="text-xs text-slate-500">Choose the easiest way to reach us.</p>
                </div>
              </div>

              <div className="space-y-2.5">
                <ContactCard
                  icon={Phone}
                  label="Call us"
                  value={phone}
                  href={`tel:${phoneHref}`}
                  iconClass="bg-[#809C61]/15 text-[#61794A]"
                />

                <ContactCard
                  icon={Mail}
                  label="Email us"
                  value={email}
                  href={`mailto:${email}`}
                  iconClass="bg-[#EDBA2B]/15 text-[#A87500]"
                />

                <ContactCard
                  icon={MapPin}
                  label="Visit the dealership"
                  value={address}
                  href={mapHref}
                  external
                  iconClass="bg-[#D25B4C]/12 text-[#B44538]"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                <Clock3 className="size-4 text-[#F7941D]" />
                Business hours
              </div>

              <div className="mt-4 space-y-2 text-sm">
                <HoursRow label="Monday–Friday" value={hours.mon_fri} />

                <HoursRow label="Saturday" value={hours.sat} />

                <HoursRow label="Sunday" value={hours.sun} />
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl bg-[#07111b] p-5 text-white shadow-sm">
              <div className="flex items-center gap-4">
                <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-white/10">
                  <CarFront className="size-8 text-[#F7941D]" />
                </div>

                <div>
                  <p className="font-semibold">Looking for a specific car?</p>

                  <p className="mt-1 text-xs leading-5 text-slate-300">
                    Tell us the make and model in your message and we&apos;ll check the lot.
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}

function ContactCard({
  icon: Icon,
  label,
  value,
  href,
  iconClass,
  external = false,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  href: string;
  iconClass: string;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 transition-all hover:-translate-y-0.5 hover:border-[#F7941D]/60 hover:bg-white hover:shadow-sm"
    >
      <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${iconClass}`}>
        <Icon className="size-[18px]" />
      </span>

      <span className="min-w-0">
        <span className="block text-[11px] font-medium text-slate-500">{label}</span>

        <span className="mt-0.5 block truncate text-sm font-semibold text-slate-900 group-hover:text-[#C96500]">
          {value}
        </span>
      </span>
    </a>
  );
}

function HoursRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-2 last:border-0 last:pb-0">
      <span className="text-slate-500">{label}</span>

      <span className="text-right font-medium text-slate-800">{value}</span>
    </div>
  );
}
