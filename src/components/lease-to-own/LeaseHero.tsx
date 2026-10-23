import { Link } from "@tanstack/react-router";
import { ArrowRight, CalendarCheck, Calculator, Flag, ShieldCheck, Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DEFAULT_TIER, VEHICLE_VALUE } from "@/lib/lease-to-own";
import { HERO } from "@/lib/lease-to-own-content";
import { ctaButtonClass, outlineButtonClass } from "@/lib/ui";
import { ReviewNote } from "./shared";

const SAFEGUARD_ICONS = [ShieldCheck, CalendarCheck, Wrench, Flag] as const;

/** Matches the site's dark PageHero treatment, with the program's two-part headline. */
export function LeaseHero() {
  return (
    <section
      aria-labelledby="lease-hero-title"
      className="relative isolate overflow-hidden bg-[#07111b]"
    >
      <div
        className="absolute inset-0 z-0"
        style={{
          background:
            "linear-gradient(90deg, rgba(4,9,15,0.96) 0%, rgba(7,17,27,0.9) 45%, rgba(12,26,40,0.86) 100%)",
        }}
      />
      <div className="absolute inset-y-0 right-0 z-0 hidden w-[40%] bg-[radial-gradient(circle_at_center,_rgba(247,148,29,0.18),_transparent_65%)] md:block" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-14 md:py-20">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-200/80 backdrop-blur-sm">
          <ShieldCheck className="size-3.5 text-[#F7941D]" aria-hidden="true" />
          {HERO.eyebrow}
        </div>

        <h1
          id="lease-hero-title"
          className="mt-5 max-w-4xl font-display text-4xl font-black leading-[1.03] tracking-[-0.04em] text-white sm:text-5xl md:text-6xl"
        >
          {HERO.headlineLead} <span className="block text-[#F7941D]">{HERO.headlineAccent}</span>
        </h1>
        <p className="mt-5 max-w-2xl font-display text-lg font-bold text-white sm:text-xl">
          {HERO.secondary}
        </p>
        <p className="mt-4 max-w-2xl text-base text-slate-200/90">{HERO.pitch}</p>
        <p className="mt-3 max-w-2xl text-xs text-slate-300/80">{HERO.qualifier}</p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild className={ctaButtonClass}>
            <Link
              to="/lease-to-own/apply"
              search={{ tier: DEFAULT_TIER, value: VEHICLE_VALUE.default }}
            >
              Get pre-approved <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" className={outlineButtonClass}>
            <a href="#packages">Explore the 3 packages ($1K–$3K down)</a>
          </Button>
          <Button
            asChild
            variant="link"
            className="h-11 px-1 text-sm font-semibold text-slate-200 hover:text-white"
          >
            <a href="#uber-vs-own">
              <Calculator className="size-4" /> Uber vs. Own calculator
            </a>
          </Button>
        </div>

        <ul className="mt-12 grid gap-3 border-t border-white/10 pt-8 sm:grid-cols-2 lg:grid-cols-4">
          {HERO.safeguards.map((item, index) => {
            const Icon = SAFEGUARD_ICONS[index] ?? ShieldCheck;
            return (
              <li
                key={item.title}
                className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm"
              >
                <p className="flex items-center gap-2 text-sm font-bold text-white">
                  <Icon className="size-4 text-[#F7941D]" aria-hidden="true" />
                  {item.title}
                </p>
                <p className="mt-1 text-xs text-slate-300">{item.body}</p>
              </li>
            );
          })}
        </ul>

        <ReviewNote
          ids={["headline", "heroPitch", "paydayTiming", "ownershipTerm"]}
          className="mt-6 bg-white text-foreground"
        />
      </div>
      <div className="accent-bar h-1 w-full" />
    </section>
  );
}
