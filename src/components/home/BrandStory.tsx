import { useEffect, useRef } from "react";
import storyImage from "@/assets/home-story.jpg";

/** The page scrolls normally. Only the headline temporarily follows
 * the viewport center, stopping when it reaches the image midpoint. */
export function BrandStory() {
  const anchorRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const anchor = anchorRef.current;
    const headline = headlineRef.current;
    const image = imageRef.current;
    if (!anchor || !headline || !image) return;

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;

    const update = () => {
      frame = 0;
      if (motion.matches) {
        headline.style.transform = "none";
        return;
      }

      // Anchor and image never move independently of the normal page.
      // Measure against those, not the animated headline's bounding box.
      const anchorTop = anchor.getBoundingClientRect().top;
      const headingCenter = anchorTop + headline.offsetHeight / 2;
      const imageBox = image.getBoundingClientRect();
      const imageCenter = imageBox.top + imageBox.height / 2;
      const screenCenter = window.innerHeight / 2;

      // At first, travel = 0: the heading scrolls normally.
      // Then it follows screen center. Finally it follows the image.
      const follow = Math.max(0, screenCenter - headingCenter);
      const limit = Math.max(0, imageCenter - headingCenter);
      const travel = Math.min(follow, limit);
      headline.style.transform = `translate3d(0, ${travel.toFixed(2)}px, 0)`;
    };

    const requestUpdate = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    motion.addEventListener("change", requestUpdate);
    const resizeObserver = new ResizeObserver(requestUpdate);
    resizeObserver.observe(anchor);
    resizeObserver.observe(image);

    return () => {
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
      motion.removeEventListener("change", requestUpdate);
      resizeObserver.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <section aria-label="The MyCar experience" className="brand-story bg-background py-16 md:py-24">
      <div className="brand-story-content mx-auto w-full max-w-6xl px-4">
        <div ref={anchorRef} className="brand-story-anchor mb-10 md:mb-16">
          <div ref={headlineRef} className="brand-story-text mx-auto max-w-5xl text-center">
            <h2 className="px-4 py-4 font-display text-[clamp(2rem,5vw,4.5rem)] font-black leading-[1.05] tracking-[-0.045em] text-primary md:px-8">
              We’ll Make Every Drive Feel Like a Dream Come True.
            </h2>
          </div>
        </div>
        <div
          ref={imageRef}
          className="brand-story-image w-full overflow-hidden rounded-3xl shadow-[var(--shadow-lift)]"
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
