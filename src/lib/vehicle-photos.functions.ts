import { createServerFn } from "@tanstack/react-start";

export type PhotoOrderInput =
  | { kind: "keep"; url: string; media?: "photo" | "video"; alt?: string | null }
  | { kind: "new"; index: number; media?: "photo" | "video"; uploadedKey?: string; alt?: string | null };

export const saveVehiclePhotosFn = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      accessToken: string;
      vin: string;
      altBase: string;
      order: PhotoOrderInput[];
      newPhotos: Array<{ dataUrl: string; contentType?: string }>;
    }) => {
      if (!input?.accessToken) throw new Error("Not signed in.");
      if (!input?.vin) throw new Error("A VIN is required to store media.");
      return input;
    },
  )
  .handler(async ({ data }) => {
    const { saveVehiclePhotos } = await import("./vehicle-photos.server");
    return saveVehiclePhotos(data);
  });

/** Signed URL so the browser can upload a large video straight to storage. */
export const createMediaUploadFn = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string; vin: string; contentType: string }) => {
    if (!input?.accessToken) throw new Error("Not signed in.");
    if (!input?.vin) throw new Error("A VIN is required to store media.");
    if (!input?.contentType) throw new Error("Unknown file type.");
    return input;
  })
  .handler(async ({ data }) => {
    const { createMediaUpload } = await import("./vehicle-photos.server");
    return createMediaUpload(data);
  });
