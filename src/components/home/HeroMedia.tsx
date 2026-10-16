import type { CSSProperties } from "react";
import type { HeroDevice, HeroFrame, HeroSettings } from "@/lib/home-gallery.functions";

export const DEFAULT_FRAME: HeroFrame = { x: 70, y: 50, zoom: 1, fit: "cover" };
export const DEFAULT_OVERLAY: HeroSettings["overlay"] = { left: 45, bottom: 30, shadow: 0, direction: "both" };

const vars = (f: HeroFrame, p: string) => ({
  [`--hp-${p}`]: `${f.x}% ${f.y}%`,
  [`--hz-${p}`]: String(f.zoom),
  [`--hf-${p}`]: f.fit,
  [`--ho-${p}`]: `${f.x}% ${f.y}%`,
});

/**
 * Hero background image + overlays. Without `device`, uses per-breakpoint settings
 * (mobile < md <= tablet < lg <= desktop). With `device`, renders that one frame (admin preview).
 */
export function HeroMedia({
  src,
  alt,
  frames,
  overlay = DEFAULT_OVERLAY,
  device,
}: {
  src: string;
  alt: string;
  frames?: Partial<Record<HeroDevice, HeroFrame>>;
  overlay?: HeroSettings["overlay"];
  device?: HeroDevice;
}) {
  const d = frames?.desktop ?? DEFAULT_FRAME;
  const t = frames?.tablet ?? d;
  const m = frames?.mobile ?? t;
  const style = { ...vars(m, "m"), ...vars(t, "t"), ...vars(d, "d") } as CSSProperties;
  const one = device ? (device === "desktop" ? d : device === "tablet" ? t : m) : null;
  const showLeft = overlay.direction === "left" || overlay.direction === "both";
  const showBottom = overlay.direction === "bottom" || overlay.direction === "both";
  const imgClass = one
    ? "h-full w-full"
    : "h-full w-full [object-fit:var(--hf-m)] [object-position:var(--hp-m)] [transform:scale(var(--hz-m))] [transform-origin:var(--ho-m)] md:[object-fit:var(--hf-t)] md:[object-position:var(--hp-t)] md:[transform:scale(var(--hz-t))] md:[transform-origin:var(--ho-t)] lg:[object-fit:var(--hf-d)] lg:[object-position:var(--hp-d)] lg:[transform:scale(var(--hz-d))] lg:[transform-origin:var(--ho-d)]";
  const imgStyle: CSSProperties | undefined = one
    ? { objectFit: one.fit, objectPosition: `${one.x}% ${one.y}%`, transform: `scale(${one.zoom})`, transformOrigin: `${one.x}% ${one.y}%` }
    : undefined;
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden" style={style}>
      <img src={src} alt={alt} fetchPriority="high" draggable={false} className={imgClass} style={imgStyle} />
      {showLeft && overlay.left > 0 && (
        <div
          className="absolute inset-y-0 left-0 w-3/5 bg-gradient-to-r from-primary to-transparent"
          style={{ opacity: overlay.left / 100 }}
        />
      )}
      {showBottom && overlay.bottom > 0 && (
        <div
          className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-primary to-transparent"
          style={{ opacity: overlay.bottom / 100 }}
        />
      )}
      {overlay.shadow > 0 && (
        <div className="absolute inset-0 bg-primary" style={{ opacity: overlay.shadow / 250 }} />
      )}
    </div>
  );
}
