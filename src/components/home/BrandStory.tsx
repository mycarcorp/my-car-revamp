import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import storyImage from "@/assets/home-story.jpg";

/**
 * MyCar Brand Story
 *
 * Scroll behavior:
 * 1. Image and headline are visible immediately.
 * 2. Section pins when it reaches the viewport.
 * 3. Headline travels toward the image center.
 * 4. At progress 1, headline reaches center.
 * 5. Sticky section releases naturally.
 *
 * No opacity animation.
 * No image zooming.
 * No React re-renders during scrolling.
 */

export function BrandStory() {
  const wrapRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const section = wrapRef.current;

    if (!section) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    let animationFrame = 0;

    const updateProgress = () => {
      animationFrame = 0;

      if (reducedMotion.matches) {
        section.style.setProperty("--p", "1");
        return;
      }

      const rect = section.getBoundingClientRect();

      const viewportHeight = window.innerHeight;

      const scrollDistance = Math.max(1, rect.height - viewportHeight);

      const rawProgress = -rect.top / scrollDistance;

      const progress = Math.min(1, Math.max(0, rawProgress));

      section.style.setProperty("--p", progress.toFixed(4));
    };

    const handleScroll = () => {
      if (animationFrame) return;

      animationFrame = window.requestAnimationFrame(updateProgress);
    };

    updateProgress();

    window.addEventListener("scroll", handleScroll, {
      passive: true,
    });

    window.addEventListener("resize", handleScroll);

    reducedMotion.addEventListener("change", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);

      window.removeEventListener("resize", handleScroll);

      reducedMotion.removeEventListener("change", handleScroll);

      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
      }
    };
  }, []);

  return (
    <section
      ref={wrapRef}
      aria-label="The MyCar experience"
      className="
        brand-story
        relative
        h-[180vh]
        bg-background
        md:h-[200vh]
        motion-reduce:h-auto
      "
      style={
        {
          "--p": 0,
        } as CSSProperties
      }
    >
      {/* Sticky scroll container */}
      <div
        className="
          brand-story-stage
          sticky
          top-0
          flex
          h-screen
          items-center
          justify-center
          overflow-hidden
          px-4
          motion-reduce:relative
          motion-reduce:h-auto
          motion-reduce:py-20
        "
      >
        {/* Image and headline wrapper */}
        <div
          className="
            brand-story-content
            relative
            mx-auto
            w-full
            max-w-6xl
          "
        >
          {/* Image always visible */}
          <div
            className="
              brand-story-image
              relative
              w-full
              overflow-hidden
              rounded-3xl
              shadow-[var(--shadow-lift)]
            "
          >
            <img
              src={storyImage}
              alt="A family receiving the keys to their new vehicle"
              width={1920}
              height={1088}
              loading="lazy"
              decoding="async"
              className="
                block
                h-full
                w-full
                object-cover
              "
            />
          </div>

          {/* Scroll-controlled headline */}
          <div
            className="
              brand-story-text
              absolute
              inset-x-0
              z-10
              px-5
              text-center
            "
          >
            <h2
              className="
                mx-auto
                max-w-4xl
                font-display
                text-[clamp(1.8rem,5vw,4.5rem)]
                font-black
                leading-[1.05]
                tracking-[-0.045em]
                text-white
              "
            >
              We’ll Make Every Drive Feel Like a Dream Come True.
            </h2>
          </div>
        </div>
      </div>
    </section>
  );
}
