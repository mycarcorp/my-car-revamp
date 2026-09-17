import { createServerFn } from "@tanstack/react-start";

export type PhotoOrderInput =
  | { kind: "keep"; url: string; media?: "photo" | "video" }
  | { kind: "new"; index: number; media?: "photo" | "video" };

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
