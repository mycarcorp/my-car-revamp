import { useEffect, useRef } from "react";
import storyImage from "@/assets/home-story.jpg";

/**
 * Scroll-driven brand moment: reveal → sticky hold with image expanding → release.
 * Progress is written to CSS variables (no React re-renders). Static when reduced motion is on.
 */
export function BrandStory() {
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    const update = () => {
      frame = 0;
      if (media.matches) {
        el.style.setProperty("--p", "1");
        return;
      }
      const rect = el.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      const p = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 1;
      el.style.setProperty("--p", p.toFixed(4));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    media.addEventListener("change", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      media.removeEventListener("change", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={wrapRef} className="brand-story relative h-[170vh] bg-background motion-reduce:h-auto md:h-[240vh]" style={{ ["--p" as string]: 0 }}>
      <div className="sticky top-0 flex h-screen flex-col items-center justify-center overflow-hidden px-4 motion-reduce:static motion-reduce:h-auto motion-reduce:py-20">
        <div className="brand-story-text relative z-10 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-accent">The My Car promise</p>
          <h2 className="mt-4 font-display text-[clamp(2.2rem,6vw,5rem)] font-black leading-[0.95] tracking-[-0.045em] text-primary">
            We’ll make every drive
            <span className="block">feel like a dream come true.</span>
          </h2>
        </div>
        <div className="brand-story-image relative mt-8 w-full max-w-6xl overflow-hidden rounded-3xl shadow-[var(--shadow-lift)]">
          <img
            src={storyImage}
            alt="A family receiving the keys to their newly chosen SUV"
            width={1920}
            height={1088}
            loading="lazy"
            className="aspect-[16/8] w-full object-cover"
          />
        </div>
      </div>
    </div>
  );
}
