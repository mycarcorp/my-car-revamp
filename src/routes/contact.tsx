import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  CarFront,
  Clock3,
  Headphones,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { LeadForm } from "@/components/LeadForm";
import { siteSettingsQuery } from "@/lib/queries";
import contactAgent from "@/assets/contact-hero.jpg";

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
    <main className="min-h-[calc(100vh-72px)] bg-[#f7f8fa]">
      <section className="relative isolate overflow-hidden bg-[#07111b]">
        <div className="absolute inset-0 -z-10 flex justify-end bg-[#07111b]">
          <img
            src={contactAgent}
            alt="MyCar team member answering a customer call on the dealership lot"
            width={1920}
            height={832}
            className="h-full w-full object-contain object-right"
          />
        </div>
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#07111b] via-[#07111b]/90 via-[55%] to-[#07111b]/20" />

        <div className="relative mx-auto flex min-h-[340px] max-w-7xl items-center px-4 py-12 sm:px-6 lg:min-h-[420px] lg:px-8">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white">
              <Headphones className="size-4 text-[#F7941D]" />
              Your next car starts with a conversation
            </div>

            <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
              The right answer is one conversation away.
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
              Whether you found a vehicle, need financing guidance, want to sell your car, or are still searching,
              talk directly with the team that can help you move forward.
            </p>

            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-slate-300">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="size-4 text-[#809C61]" /> Local dealership team
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="size-4 text-[#809C61]" /> No-pressure assistance
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