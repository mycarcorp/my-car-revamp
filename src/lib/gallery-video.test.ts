import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

/* -------------------------------------------------------------------------- */

describe("gallery video display", () => {
  const gallery = read("src/components/home/CustomerGallery.tsx");

  it("labels each video for screen readers and loads only the visible slide", () => {
    expect(gallery).toContain('aria-label={item.title ? `Video: ${item.title}` : "Customer video"}');
    expect(gallery).toContain('preload={active ? "metadata" : "none"}');
    expect(gallery).toContain("playsInline");
    expect(gallery).toContain('aria-label="Play video"');
  });

  it("photos keep alt text and playback pauses when a slide is left", () => {
    expect(gallery).toContain('alt={item.title || "My Car customer"}');
    expect(gallery).toMatch(/if \(!active && video\.current\) \{\s*video\.current\.pause\(\)/);
  });

  it("media still comes only from the existing storage bucket and no third-party embed is added", () => {
    const server = read("src/lib/home-gallery.server.ts");
    expect(server).toContain("customer-gallery");
    expect(server).toContain("await requireStaff(token);");
    expect(gallery).not.toMatch(/tiktok\.com|<iframe|embed\.js/i);
  });
});

/* -------------------------------------------------------------------------- */
/* Marketing Hub wiring and regression                                         */
