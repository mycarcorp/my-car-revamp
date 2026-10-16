import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import storyImage from "@/assets/home-story.jpg";

/**
 * MyCar Brand Story
 *
 * Desktop and mobile scroll interaction:
 * - Image is visible immediately
 * - Headline is visible immediately
 * - Section pins during scrolling
 * - Headline follows scroll toward image center
 * - Section releases when headline reaches center
 * - No fading, scaling, or zooming
 */

export function BrandStory() {
  const sectionRef = useRef<HTMLElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const image = imageRef.current;
    const headline = textRef.current;

    if (!section || !image || !headline) return;

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");

    let frame = 0;

    const update = () => {
      frame = 0;

      if (motion.matches) {
        section.style.setProperty("--p", "1");
        headline.style.transform = "none";
        return;
      }

      const sectionRect = section.getBoundingClientRect();

      const viewportHeight = window.innerHeight;

      const scrollDistance = Math.max(1, sectionRect.height - viewportHeight);

      const progress = Math.max(0, Math.min(1, -sectionRect.top / scrollDistance));

      const imageHeight = image.offsetHeight;
      const headlineHeight = headline.offsetHeight;

      // Begin near the image's upper edge.
      // Finish with the headline exactly centered.
      const travelDistance = Math.max(0, (imageHeight - headlineHeight) / 2 - 20);

      const remainingDistance = travelDistance * (1 - progress);

      // Use calculated pixels rather than complex CSS math.
      headline.style.transform = `translate3d(0, calc(-50% - ${remainingDistance}px), 0)`;

      section.style.setProperty("--p", progress.toFixed(4));
    };

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    update();

    window.addEventListener("scroll", onScroll, {
      passive: true,
    });

    window.addEventListener("resize", onScroll);

    motion.addEventListener("change", onScroll);

    const observer = new ResizeObserver(onScroll);
    observer.observe(section);
    observer.observe(image);
    observer.observe(headline);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      motion.removeEventListener("change", onScroll);

      observer.disconnect();

      if (frame) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      aria-label="The MyCar experience"
      className="brand-story relative h-[180vh] bg-background md:h-[200vh] motion-reduce:h-auto"
      style={{ "--p": 0 } as CSSProperties}
    >
      <div className="brand-story-stage sticky top-0 flex h-screen items-center justify-center overflow-hidden px-4 motion-reduce:relative motion-reduce:h-auto motion-reduce:py-20">
        <div className="brand-story-content relative mx-auto w-full max-w-6xl">
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

          <div
            ref={textRef}
            className="brand-story-text absolute inset-x-0 z-10 px-5 text-center"
            style={{
              top: "50%",
              opacity: 1,
            }}
          >
            <h2 className="mx-auto max-w-4xl font-display text-[clamp(1.8rem,5vw,4.5rem)] font-black leading-[1.05] tracking-[-0.045em] text-white">
              We’ll Make Every Drive Feel Like a Dream Come True.
            </h2>
          </div>
        </div>
      </div>
    </section>
  );
}
