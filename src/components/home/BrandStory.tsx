import { useEffect, useRef } from "react";
import storyImage from "@/assets/home-story.jpg";

/**
 * MyCar Brand Story
 *
 * - Headline starts above the image
 * - Page scrolls normally
 * - Headline follows the viewport center
 * - Image continues scrolling normally
 * - Headline releases at the image center
 * - No fade, zoom, or section pinning
 */

export function BrandStory() {
  const sectionRef = useRef<HTMLElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const anchor = anchorRef.current;
    const headline = headlineRef.current;
    const image = imageRef.current;

    if (!section || !anchor || !headline || !image) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    let frame = 0;

    const update = () => {
      frame = 0;

      if (reducedMotion.matches) {
        headline.style.transform = "translate3d(0, 0, 0)";
        return;
      }

      // The anchor does not move with the headline.
      const anchorRect = anchor.getBoundingClientRect();
      const imageRect = image.getBoundingClientRect();

      const headlineHeight = headline.offsetHeight;
      const viewportCenter = window.innerHeight / 2;

      // Where the headline would be without movement.
      const startingCenter = anchorRect.top + headlineHeight / 2;

      // Maximum movement: headline meets image center.
      const imageCenter = imageRect.top + imageRect.height / 2;

      const maxTravel = Math.max(0, imageCenter - startingCenter);

      // Follow the scroll only after reaching screen center.
      const desiredTravel = Math.max(0, viewportCenter - startingCenter);

      // Stop following when headline reaches image center.
      const travel = Math.min(desiredTravel, maxTravel);

      headline.style.transform = `translate3d(0, ${travel.toFixed(2)}px, 0)`;
    };

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(update);
    };

    update();

    window.addEventListener("scroll", onScroll, {
      passive: true,
    });

    window.addEventListener("resize", onScroll);
    reducedMotion.addEventListener("change", onScroll);

    const observer = new ResizeObserver(onScroll);
    observer.observe(anchor);
    observer.observe(image);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      reducedMotion.removeEventListener("change", onScroll);

      observer.disconnect();

      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      aria-label="The MyCar experience"
      className="brand-story relative bg-background py-16 md:py-24"
    >
      <div className="brand-story-content relative mx-auto w-full max-w-6xl px-4">
        {/* Headline begins above the image */}
        <div ref={anchorRef} className="brand-story-anchor relative z-20 mb-10 md:mb-16">
          <div ref={headlineRef} className="brand-story-text relative mx-auto max-w-5xl text-center">
            <h2 className="rounded-2xl bg-background/90 px-4 py-4 font-display text-[clamp(2rem,5vw,4.5rem)] font-black leading-[1.05] tracking-[-0.045em] text-primary shadow-sm backdrop-blur-sm md:px-8">
              We’ll Make Every Drive Feel Like a Dream Come True.
            </h2>
          </div>
        </div>

        {/* Image scrolls normally with the page */}
        <div
          ref={imageRef}
          className="brand-story-image relative w-full overflow-hidden rounded-3xl shadow-[var(--shadow-lift)]"
        >
          <img
            src={storyImage}
            alt="A family receiving the keys to their new vehicle"
            width={1920}
            height={1088}
            loading="lazy"
            decoding="async"
            className="block h-full w-full object-cover"
          />
        </div>
      </div>
    </section>
  );
}
