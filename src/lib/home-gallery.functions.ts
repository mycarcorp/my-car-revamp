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
