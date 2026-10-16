import { useEffect, useRef, useState, type ReactNode } from "react";

/** Keep secondary interactive code out of the initial render; load before it enters view. */
export function DeferredContent({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (!("IntersectionObserver" in window)) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: "400px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref}>{visible ? children : fallback}</div>;
}