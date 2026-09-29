import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CarFront, Clock3, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
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
      { property: "og:url", content: "https://mycarcorp.com/contact" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://mycarcorp.com/contact" }],
  }),
  component: ContactPage,
});

function ContactPage() {
  const { data: settings } = useQuery(siteSettingsQuery());
  const hours = (settings?.hours ?? {}) as Record<string, string>;
  const phone = settings?.phone ?? "(540) 426-3322";
  const email = settings?.email ?? "mycar@mycarcorp.com";
  const address = settings?.address_line ?? "Fredericksburg, VA";
  const phoneHref = phone.replace(/\D/g, "");
  const mapHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

  return (
    <main className="bg-slate-50/70">
      <section className="relative isolate overflow-hidden bg-[#07111b]">
        <img
          src="https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1800&q=85"
          alt="Vehicle ready for customers at MyCar"
          className="absolute inset-0 h-full w-full object-cover object-center opacity-55"
          width={1800}
          height={700}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#07111b] via-[#07111b]/90 to-[#07111b]/30" />

        <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-white backdrop-blur-sm">
              <CarFront className="size-4 text-[#F7941D]" />
              MyCar Fredericksburg
            </div>
            <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Let&apos;s talk about your next car
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-200 sm:text-base">
              Ask about a vehicle, financing, selling your car, or scheduling a visit. Our local team will point you in
              the right direction.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="grid items-stretch gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(480px,1.1fr)]">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="relative min-h-[190px] overflow-hidden sm:min-h-[220px]">
              <img
                src="https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=1200&q=85"
                alt="Cars available at MyCar in Fredericksburg"
                className="absolute inset-0 h-full w-full object-cover"
                width={1200}
                height={700}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#F9B45D]">Real people. Real help.</p>
                <h2 className="mt-1 font-display text-xl font-bold">Reach the team that works the lot</h2>
              </div>
            </div>

            <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <ContactAction
                icon={Phone}
                label="Call us"
                value={phone}
                href={`tel:${phoneHref}`}
                accent="bg-[#809C61]/15 text-[#61794A]"
              />
              <ContactAction
                icon={Mail}
                label="Email us"
                value={email}