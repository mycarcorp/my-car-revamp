import { useEffect, useRef, type ReactNode } from "react";

/**
 * Follows scroll: content glides in from the side and settles once the section
 * reaches the middle of the viewport. Written to a CSS variable, no re-renders.
 */
export function ScrollReveal({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    const update = () => {
      frame = 0;
      if (reduce.matches) return el.style.setProperty("--r", "1");
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const center = rect.top + rect.height / 2;
      // 0 when the section enters at the bottom, 1 when its center hits the viewport center.
      const p = Math.min(1, Math.max(0, (vh - center) / (vh / 2)));
      el.style.setProperty("--r", p.toFixed(4));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
  return (
    <div ref={ref} className="scroll-reveal" style={{ ["--r" as string]: 0 }}>
      {children}
    </div>
  );
}
