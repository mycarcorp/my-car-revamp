import {
  CalendarDays,
  CircleCheck,
  FileCheck2,
  HeartPulse,
  ShieldCheck,
  Trophy,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { PROGRAM_SUMMARY, SAFEGUARDS, SAFEGUARDS_INTRO } from "@/lib/lease-to-own-content";
import { ctaButtonClass } from "@/lib/ui";
import { ReviewNote, SectionHeading } from "./shared";

const ICONS = [ShieldCheck, CalendarDays, FileCheck2, Trophy, HeartPulse] as const;

export function SafeguardsSection() {
  return (
    <section
      id="why-smart-shield"
      aria-labelledby="safeguards-title"
      className="scroll-mt-36 py-16 md:py-20"
    >
      <div className="mx-auto max-w-7xl px-4">
        <SectionHeading
          id="safeguards-title"
          eyebrow={SAFEGUARDS_INTRO.eyebrow}
          title={SAFEGUARDS_INTRO.title}
          accent={SAFEGUARDS_INTRO.accent}
          body={SAFEGUARDS_INTRO.body}
        />

        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {SAFEGUARDS.map((item, index) => {
            const Icon = ICONS[index] ?? ShieldCheck;
            return (
              <article
                key={item.number}
                className="card-lift flex flex-col justify-between rounded-xl border border-border bg-card p-6"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-destructive/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-destructive">
                      Failure point #{item.number}
                    </span>
                    <span className="flex items-center gap-1 text-xs font-semibold text-positive-text">
                      <CircleCheck className="size-3.5" aria-hidden="true" /> Addressed
                    </span>
                  </div>
                  <h3 className="mt-4 text-xl font-bold text-foreground">“{item.trap}”</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{item.problem}</p>
                  <div className="mt-4 rounded-lg bg-surface p-4">
                    <p className="flex items-center gap-1.5 text-sm font-bold text-primary">
                      <Icon className="size-4 text-[#F7941D]" aria-hidden="true" />{" "}
                      {item.solutionTitle}
                    </p>
                    <ul className="mt-2 space-y-1.5 text-sm text-foreground">
                      {item.solutions.map((line) => (
                        <li key={line} className="flex gap-2">
                          <span
                            aria-hidden="true"
                            className="mt-2 size-1.5 shrink-0 rounded-full bg-[#F7941D]"
                          />
                          {line}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {item.claims && <ReviewNote ids={item.claims} className="mt-3" />}
                </div>
                <p className="mt-5 border-t border-border pt-4 text-xs italic text-muted-foreground">
                  “{item.quote}”
                </p>
              </article>
            );
          })}

          <article className="flex flex-col justify-between rounded-xl border-2 border-primary bg-primary p-6 text-primary-foreground">
            <div>
              <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider">
                The program
              </span>
              <h3 className="mt-4 text-2xl font-black">{PROGRAM_SUMMARY.title}</h3>
              <p className="mt-2 text-sm text-primary-foreground/85">{PROGRAM_SUMMARY.body}</p>
              <dl className="mt-5 space-y-2 text-sm">
                {PROGRAM_SUMMARY.rows.map((row) => (
                  <div
                    key={row.label}
                    className="flex justify-between gap-3 border-b border-white/15 py-1.5 last:border-0"
                  >
                    <dt className="text-primary-foreground/75">{row.label}</dt>
                    <dd className="font-semibold">{row.value}</dd>
                  </div>
                ))}
              </dl>
              <ReviewNote ids={PROGRAM_SUMMARY.claims} className="mt-4 bg-white" />
            </div>
            <Button asChild className={`${ctaButtonClass} mt-6 w-full`}>
              <a href="#packages">Pick your package</a>
            </Button>
          </article>
        </div>
      </div>
    </section>
  );
}
