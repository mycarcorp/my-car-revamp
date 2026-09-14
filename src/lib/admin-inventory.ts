import { supabase } from "@/integrations/supabase/app-client";
import type { Database } from "@/integrations/supabase/types";

export type Vehicle = Database["public"]["Tables"]["vehicles"]["Row"];
export type VehiclePhoto = Database["public"]["Tables"]["vehicle_photos"]["Row"];
export type VehicleInsert = Database["public"]["Tables"]["vehicles"]["Insert"];
export type VehicleUpdate = Database["public"]["Tables"]["vehicles"]["Update"];

export const PHOTO_BUCKET = "vehicle-photos";
export const MAX_PHOTOS = 30;
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const storagePathFromUrl = (url: string): string | null => {
  const m = url.match(/vehicle-photos\/([a-z0-9-]+\/photo-\d+\.jpg)/i);
  return m ? m[1]!.toLowerCase() : null;
};

export function photoStoragePath(vin: string, index: number): string {
  return `${vin.toLowerCase()}/photo-${index}.jpg`;
}

export function photoPublicUrl(vin: string, index: number): string {
  return `/api/public/vehicle-photos/${photoStoragePath(vin, index)}`;
}

/** Uploads a file to vehicle-photos/<vin>/photo-<n>.jpg and returns the app URL. */
export async function uploadVehiclePhoto(vin: string, index: number, file: File): Promise<string> {
  if (!ALLOWED_PHOTO_TYPES.has(file.type)) {
    throw new Error("Photos must be JPG, PNG, or WebP images.");
  }
  if (file.size > MAX_PHOTO_BYTES) {
    throw new Error("Each vehicle photo must be 10 MB or smaller.");
  }
  const path = photoStoragePath(vin, index);
  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type || "image/jpeg" });
  if (error) throw new Error(`Photo upload failed (${path}): ${error.message}`);
  return photoPublicUrl(vin, index);
}

export async function removeStorageObjectForUrl(url: string): Promise<void> {
  const path = storagePathFromUrl(url);
  if (!path) return; // externally hosted image — nothing of ours to delete
  await supabase.storage.from(PHOTO_BUCKET).remove([path]);
}

export type PhotoDraft =
  | { kind: "existing"; id: string; url: string; alt: string | null }
  | { kind: "new"; file: File; previewUrl: string };

/** Replaces the photo set for a vehicle with `drafts`, in the given order. */
export async function syncVehiclePhotos(
  vehicle: { id: string; vin: string },
  drafts: PhotoDraft[],
  existing: VehiclePhoto[],
  altBase: string,
): Promise<void> {
  const keptIds = new Set(drafts.filter((d) => d.kind === "existing").map((d) => d.id));
  const removed = existing.filter((p) => !keptIds.has(p.id));

  if (removed.length > 0) {
    const { error } = await supabase
      .from("vehicle_photos")
      .delete()
      .in("id", removed.map((p) => p.id));
    if (error) throw new Error(error.message);
    await Promise.all(removed.map((p) => removeStorageObjectForUrl(p.url)));
  }

  const usedIndices = new Set<number>();
  for (const d of drafts) {
    if (d.kind === "existing") {
      const path = storagePathFromUrl(d.url);
      const n = path ? Number(path.match(/photo-(\d+)\.jpg$/)?.[1]) : NaN;
      if (Number.isFinite(n)) usedIndices.add(n);
    }
  }
  let next = 1;
  const freeIndex = () => {
    while (usedIndices.has(next)) next++;
    usedIndices.add(next);
    return next;
  };

  for (let i = 0; i < drafts.length; i++) {
    const d = drafts[i]!;
    const position = i + 1;
    const alt = `${altBase} — photo ${position}`;
    if (d.kind === "existing") {
      const { error } = await supabase
        .from("vehicle_photos")
        .update({ position, alt })
        .eq("id", d.id);
      if (error) throw new Error(error.message);
    } else {
      const url = await uploadVehiclePhoto(vehicle.vin, freeIndex(), d.file);
      const { error } = await supabase
        .from("vehicle_photos")
        .insert({ vehicle_id: vehicle.id, url, alt, position });
      if (error) throw new Error(error.message);
    }
  }
}

/**
 * Deletes a vehicle plus its photos and storage objects. Leads and appointments
 * are preserved (their vehicle reference is cleared); saved-vehicle bookmarks are removed.
 */
export async function deleteVehicleDeep(vehicle: Vehicle): Promise<void> {
  const { data: photos } = await supabase
    .from("vehicle_photos")
    .select("*")
    .eq("vehicle_id", vehicle.id);

  await supabase.from("leads").update({ vehicle_id: null }).eq("vehicle_id", vehicle.id);
  await supabase.from("appointments").update({ vehicle_id: null }).eq("vehicle_id", vehicle.id);
  await supabase.from("saved_vehicles").delete().eq("vehicle_id", vehicle.id);

  const { error: photoError } = await supabase
    .from("vehicle_photos")
    .delete()
    .eq("vehicle_id", vehicle.id);
  if (photoError) throw new Error(photoError.message);

  await Promise.all((photos ?? []).map((p) => removeStorageObjectForUrl(p.url)));

  const { error } = await supabase.from("vehicles").delete().eq("id", vehicle.id);
  if (error) throw new Error(error.message);
}
