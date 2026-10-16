import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import useEmblaCarousel from "embla-carousel-react";
import { ArrowLeft, ArrowRight, Play } from "lucide-react";
import { listGalleryFn, type GalleryCta, type GalleryItem } from "@/lib/home-gallery.functions";

export const GALLERY_CTAS: Record<GalleryCta, { label: string; to: string } | null> = {
  value: { label: "Get Your Value", to: "/sell" },
  learn: { label: "Learn More", to: "/contact" },
  offer: { label: "Get Your Offer", to: "/sell" },
  shop: { label: "Shop Inventory", to: "/search" },
  finance: { label: "Explore Financing", to: "/finance" },
  none: null,
};

/** Homepage slider of real customer photos/videos managed in Admin → Gallery. */
export function CustomerGallery() {
  const { data: items = [] } = useQuery({ queryKey: ["home-gallery"], queryFn: () => listGalleryFn(), staleTime: 60_000 });
  const [ref, api] = useEmblaCarousel({ loop: items.length > 2, align: "center", duration: 30 });
  const [selected, setSelected] = useState(0);

  const sync = useCallback(() => api && setSelected(api.selectedScrollSnap()), [api]);
  useEffect(() => {
    if (!api) return;
    sync();
    api.on("select", sync).on("reInit", sync);
    return () => {
      api.off("select", sync).off("reInit", sync);
    };
  }, [api, sync]);

  if (!items.length) return null;

  return (
    <section className="py-12 md:py-16" aria-roledescription="carousel" aria-label="Customer experiences">
      <div className="mx-auto mb-6 max-w-7xl px-4">
        <h2 className="font-display text-2xl font-black tracking-tight md:text-3xl">Real customers. Real keys.</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">Moments from drivers who found their car at My Car.</p>
      </div>
      <div className="relative">
        <div ref={ref} className="overflow-hidden">
          <div className="flex">
            {items.map((item, i) => (
              <div key={item.id} className="min-w-0 shrink-0 grow-0 basis-[88%] px-2 md:basis-[62%] md:px-3">
                <Slide item={item} active={i === selected} />
              </div>
            ))}
          </div>
        </div>
        {items.length > 1 && (
          <>
            <NavButton side="left" onClick={() => api?.scrollPrev()} />
            <NavButton side="right" onClick={() => api?.scrollNext()} />
          </>
        )}
      </div>
    </section>
  );
}

function NavButton({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  const Icon = side === "left" ? ArrowLeft : ArrowRight;
  return (
    <button
      type="button"
      aria-label={side === "left" ? "Previous" : "Next"}
      onClick={onClick}
      className={`absolute top-1/2 z-10 flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-card text-foreground shadow-[var(--shadow-lift)] transition hover:scale-105 ${
        side === "left" ? "left-3 md:left-[15%]" : "right-3 md:right-[15%]"
      }`}
    >
      <Icon className="size-5" />
    </button>
  );
}

function Slide({ item, active }: { item: GalleryItem; active: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const cta = GALLERY_CTAS[item.cta];

  useEffect(() => {
    if (!active && video.current) {
      video.current.pause();
      setPlaying(false);
    }
  }, [active]);

  const play = () => {
    void video.current?.play();
    setPlaying(true);
  };

  return (
    <div
      className={`relative aspect-[16/10] overflow-hidden rounded-2xl bg-foreground transition duration-500 md:aspect-[16/9] ${
        active ? "opacity-100" : "opacity-40"
      }`}
    >
      {item.type === "video" ? (
        <video
          ref={video}
          src={item.url}
          preload="metadata"
          playsInline
          controls={playing}
          onEnded={() => setPlaying(false)}
          className="h-full w-full object-contain"
        />
      ) : (
        <img src={item.url} alt={item.title || "My Car customer"} loading="lazy" className="h-full w-full object-contain" />
      )}
      {!playing && (
        <>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-foreground/85 to-transparent" />
          {item.type === "video" && active && (
            <button
              type="button"
              aria-label="Play video"
              onClick={play}
              className="absolute left-1/2 top-1/2 flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-card text-foreground shadow-lg transition hover:scale-110"
            >
              <Play className="ml-1 size-7 fill-current" />
            </button>
          )}
          {(item.title || item.caption || cta) && (
            <div className="absolute inset-x-0 bottom-0 p-5 text-background md:p-7">
              {item.title && <h3 className="font-display text-xl font-bold md:text-2xl">{item.title}</h3>}
              {item.caption && <p className="mt-1 max-w-2xl text-sm text-background/85">{item.caption}</p>}
              <div className="mt-4 flex gap-2">
                {item.type === "video" && (
                  <button type="button" onClick={play} className="rounded-full border-2 border-background px-5 py-2 text-sm font-semibold transition hover:bg-background hover:text-foreground">
                    Play
                  </button>
                )}
                {cta && (
                  <Link to={cta.to} className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-foreground transition hover:brightness-110">
                    {cta.label}
                  </Link>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
