import { createServerFn } from "@tanstack/react-start";
import type { GalleryItem } from "./home-gallery.server";

export type { GalleryItem, GalleryCta } from "./home-gallery.server";

export const listGalleryFn = createServerFn({ method: "GET" }).handler(async () => {
  const { listGallery } = await import("./home-gallery.server");
  return listGallery();
});

export const saveGalleryFn = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string; items: GalleryItem[] }) => {
    if (!input?.accessToken) throw new Error("Not signed in.");
    if (!Array.isArray(input.items)) throw new Error("Invalid gallery.");
    return input;
  })
  .handler(async ({ data }) => {
    const { saveGallery } = await import("./home-gallery.server");
    return saveGallery(data.accessToken, data.items);
  });

export const createGalleryUploadFn = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string; contentType: string }) => {
    if (!input?.accessToken) throw new Error("Not signed in.");
    if (!/^(image|video)\//.test(input?.contentType ?? "")) throw new Error("Only photos and videos are allowed.");
    return input;
  })
  .handler(async ({ data }) => {
    const { createGalleryUpload } = await import("./home-gallery.server");
    return createGalleryUpload(data.accessToken, data.contentType);
  });

export type { HeroConfig, HeroSettings, HeroFrame, HeroDevice, HeroImage } from "./home-gallery.server";
import type { HeroConfig } from "./home-gallery.server";

export const getPublishedHeroFn = createServerFn({ method: "GET" }).handler(async () => {
  const { getPublishedHero } = await import("./home-gallery.server");
  return getPublishedHero();
});

export const getHeroConfigFn = createServerFn({ method: "GET" }).handler(async () => {
  const { getHeroConfig } = await import("./home-gallery.server");
  return getHeroConfig();
});

export const saveHeroConfigFn = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string; config: HeroConfig }) => {
    if (!input?.accessToken) throw new Error("Not signed in.");
    return input;
  })
  .handler(async ({ data }) => {
    const { saveHeroConfig } = await import("./home-gallery.server");
    return saveHeroConfig(data.accessToken, data.config);
  });

export const createHeroUploadFn = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string; contentType: string }) => {
    if (!input?.accessToken) throw new Error("Not signed in.");
    if (!/^image\//.test(input?.contentType ?? "")) throw new Error("Only photos are allowed.");
    return input;
  })
  .handler(async ({ data }) => {
    const { createHeroUpload } = await import("./home-gallery.server");
    return createHeroUpload(data.accessToken, data.contentType);
  });
