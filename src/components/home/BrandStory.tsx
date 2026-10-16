import { useEffect, useRef } from "react";
import storyImage from "@/assets/home-story.jpg";

export function BrandStory() {
  const wrapRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");

    let frame = 0;

    const update = () => {
      frame = 0;

      const rect = el.getBoundingClientRect();
      const distance = Math.max(1, el.offsetHeight - window.innerHeight);

      const progress = media.matches ? 1 : Math.max(0, Math.min(1, -rect.top / distance));

      el.style.setProperty("--p", progress.toFixed(4));
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();

    window.addEventListener("scroll", onScroll, {
      passive: true,
    });

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
    <section
      ref={wrapRef}
      className="brand-story relative h-[180vh] bg-background md:h-[200vh] motion-reduce:h-auto"
      style={{ "--p": 0 } as React.CSSProperties}
    >
      <div className="brand-story-stage sticky top-0 flex h-screen items-center justify-center overflow-hidden px-4 motion-reduce:relative motion-reduce:h-auto motion-reduce:py-20">
        <div className="brand-story-content relative mx-auto w-full max-w-6xl">
          <div className="brand-story-image relative w-full overflow-hidden rounded-3xl shadow-[var(--shadow-lift)]">
            <img
              src={storyImage}
              alt="A family receiving the keys to their new vehicle"
              width={1920}
              height={1088}
              loading="lazy"
              className="block h-full w-full object-cover"
            />
          </div>

          <div className="brand-story-text absolute inset-x-0 z-10 px-5 text-center">
            <h2 className="mx-auto max-w-4xl font-display text-[clamp(1.8rem,5vw,4.5rem)] font-black leading-[1.05] tracking-[-0.045em] text-white">
              We’ll Make Every Drive Feel Like a Dream Come True.
            </h2>
          </div>
        </div>
      </div>
    </section>
  );
}
