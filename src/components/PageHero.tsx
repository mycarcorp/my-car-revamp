import type { ReactNode } from "react";

export type PageHeroProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children?: ReactNode;
};

/**
 * Compact version of the home page hero, reused across pages for a consistent look.
 */
export function PageHero({ eyebrow, title, subtitle, children }: PageHeroProps) {
  return (
    <section className="relative isolate overflow-hidden bg-[#07111b]">
      <div
        className="absolute inset-0 z-0"
        style={{
          background:
            "linear-gradient(90deg, rgba(4,9,15,0.96) 0%, rgba(7,17,27,0.9) 45%, rgba(12,26,40,0.86) 100%)",
        }}
      />
      <div className="absolute inset-y-0 right-0 z-0 hidden w-[32%] bg-[radial-gradient(circle_at_center,_rgba(247,148,29,0.18),_transparent_65%)] md:block" />
      <div className="relative z-10 mx-auto max-w-7xl px-4 py-12 md:py-16">
        {eyebrow && (
          <div className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-200/80 backdrop-blur-sm">
            {eyebrow}
          </div>
        )}
        <h1 className="mt-4 max-w-2xl font-display text-3xl font-black leading-[1.03] tracking-[-0.04em] text-white sm:text-4xl md:text-5xl">
          {title}
        </h1>
        {subtitle && <p className="mt-4 max-w-xl text-base text-slate-200/90">{subtitle}</p>}
        {children && <div className="mt-6 flex flex-wrap gap-3">{children}</div>}
      </div>
      <div className="accent-bar h-1 w-full" />
    </section>
  );
}
