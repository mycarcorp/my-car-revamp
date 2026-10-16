import { useState } from "react";
import { MapPin, Navigation, Phone } from "lucide-react";

const ADDRESS = "4720 Harrison Rd, Fredericksburg, VA 22408";
const Q = encodeURIComponent(`My Car, ${ADDRESS}`);

/** Interactive dealership map: pan/zoom embed, loads on demand, directions link. */
export function DealershipMap({ phone }: { phone?: string | null }) {
  const [active, setActive] = useState(false);
  return (
    <section className="mx-auto max-w-7xl px-4 pb-20 pt-8">
      <div className="grid overflow-hidden rounded-3xl border border-border bg-card shadow-[var(--shadow-card)] md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="flex flex-col justify-center gap-5 p-7 md:p-10">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-accent-text">Visit the lot</p>
          <h2 className="font-display text-3xl font-black tracking-tight md:text-4xl">Come see us in Fredericksburg</h2>
          <p className="flex items-start gap-2 text-muted-foreground">
            <MapPin className="mt-0.5 size-5 shrink-0 text-accent" /> {ADDRESS}
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${Q}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground transition hover:brightness-110"
            >
              <Navigation className="size-4" /> Get Directions
            </a>
            {phone && (
              <a href={`tel:${phone.replace(/[^0-9+]/g, "")}`} className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-3 text-sm font-bold transition hover:border-accent">
                <Phone className="size-4" /> {phone}
              </a>
            )}
          </div>
        </div>
        <div className="relative min-h-[320px] md:min-h-[420px]">
          <iframe
            title="My Car location map"
            src={`https://maps.google.com/maps?q=${Q}&z=15&output=embed`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className={`absolute inset-0 h-full w-full border-0 transition ${active ? "" : "pointer-events-none"}`}
          />
          {!active && (
            <button
              type="button"
              onClick={() => setActive(true)}
              className="absolute inset-0 flex items-end justify-center bg-transparent pb-5"
              aria-label="Interact with the map"
            >
              <span className="rounded-full bg-card/95 px-4 py-2 text-xs font-semibold shadow">Click to explore the map</span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
