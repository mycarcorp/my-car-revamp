import { requireStaff } from "./legacy-blog.server";
import { videoExtension } from "./vehicle-media";

/**
 * Media binaries live in the storage account reachable with the server
 * credentials below (bucket `vehicle-photos`, keys `<vin>/photo-N.jpg` for
 * images and `<vin>/video-N.<ext>` for videos).
 * The legacy `mycarco_db.mc_cars.image_url` column stores the comma separated
 * `uploads/cars/<vin>/...` paths, which the public media proxy and the
 * inventory reader both understand.
 *
 * Photos are small enough to travel as base64 through the server function.
 * Videos can be hundreds of megabytes, so the browser uploads them straight to
 * storage with a short-lived signed URL and only sends the resulting key here;
 * nothing large ever passes through the server function body.
 */

export type IncomingPhoto = { dataUrl: string; contentType?: string };
export type PhotoOrderItem =
  | { kind: "keep"; url: string; media?: "photo" | "video" }
  | { kind: "new"; index: number; media?: "photo" | "video"; uploadedKey?: string };

type Creds = { url: string; key: string };

function storageCreds(): Creds {
  const candidates: Array<{ url: string | undefined; key: string | undefined }> = [
    { url: process.env["SUPABASE_URL"], key: process.env["SUPABASE_SERVICE_ROLE_KEY"] },
    { url: process.env["LEGACY_SUPABASE_URL"], key: process.env["LEGACY_SUPABASE_SERVICE_ROLE_KEY"] },
  ];
  const found = candidates.find((c): c is Creds => Boolean(c.url && c.key));
  if (!found) throw new Error("Photo storage is not configured.");
  return found;
}

function legacyCreds(): Creds {
  const url = process.env["LEGACY_SUPABASE_URL"];
  const key = process.env["LEGACY_SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) throw new Error("Inventory credentials are not configured.");
  return { url, key };
}

async function rest(
  path: string,
  init: { method?: string; body?: unknown; profile?: "public" | "mycarco_db"; prefer?: string } = {},
) {
  const c = legacyCreds();
  const method = init.method ?? "GET";
  const headers: Record<string, string> = {
    apikey: c.key,
    Authorization: `Bearer ${c.key}`,
    "Content-Type": "application/json",
  };
  if (init.profile) headers[method === "GET" ? "Accept-Profile" : "Content-Profile"] = init.profile;
  if (init.prefer) headers["Prefer"] = init.prefer;
  const requestInit: RequestInit = { method, headers };
  if (init.body !== undefined) requestInit.body = JSON.stringify(init.body);
  const res = await fetch(`${c.url}/rest/v1/${path}`, requestInit);
  const text = await res.text();
  if (!res.ok) throw new Error(`Inventory request failed (${res.status}): ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

function decodeDataUrl(dataUrl: string): { bytes: Uint8Array; contentType: string } {
  const match = dataUrl.match(/^data:([^;,]+);base64,(.*)$/s);
  if (!match) throw new Error("Unsupported media data.");
  const contentType = match[1] ?? "image/jpeg";
  const binary = atob(match[2] ?? "");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { bytes, contentType };
}

/**
 * `uploads/cars/<vin>/photo-3.jpg`, `/api/public/vehicle-photos/<vin>/video-1.mp4`
 * -> storage key
 */
function storageKeyFromUrl(url: string, vin: string): string | null {
  const path = url.split("?")[0] ?? "";
  const video = path.match(/video-(\d+)\.(mp4|webm|mov|m4v)$/i);
  if (video) return `${vin}/video-${video[1]}.${video[2]!.toLowerCase()}`;
  const photo = path.match(/photo-(\d+)\.(?:jpe?g|png|webp)$/i);
  if (photo) return `${vin}/photo-${photo[1]}.jpg`;
  return null;
}

async function uploadObject(key: string, bytes: Uint8Array, contentType: string) {
  const c = storageCreds();
  const res = await fetch(`${c.url}/storage/v1/object/vehicle-photos/${key}`, {
    method: "POST",
    headers: {
      apikey: c.key,
      Authorization: `Bearer ${c.key}`,
      "Content-Type": contentType,
      "x-upsert": "true",
    },
    body: bytes as unknown as BodyInit,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Media upload failed (${res.status}): ${text.slice(0, 200)}`);
  }
}

/** Server-side copy: never streams the file through this worker. */
async function copyObject(sourceKey: string, destinationKey: string): Promise<boolean> {
  const c = storageCreds();
  const res = await fetch(`${c.url}/storage/v1/object/copy`, {
    method: "POST",
    headers: {
      apikey: c.key,
      Authorization: `Bearer ${c.key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      bucketId: "vehicle-photos",
      sourceKey,
      destinationKey,
    }),
  });
  return res.ok;
}

async function removeObjects(keys: string[]) {
  if (keys.length === 0) return;
  const c = storageCreds();
  await fetch(`${c.url}/storage/v1/object/vehicle-photos`, {
    method: "DELETE",
    headers: {
      apikey: c.key,
      Authorization: `Bearer ${c.key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prefixes: keys }),
  }).catch(() => null);
}

/**
 * Signed, single-use upload URL so the browser can push a large video straight
 * into storage. The key lands in a staging folder; `saveVehiclePhotos` moves it
 * into its final slot.
 */
export async function createMediaUpload(input: {
  accessToken: string;
  vin: string;
  contentType: string;
}): Promise<{ uploadUrl: string; key: string }> {
  await requireStaff(input.accessToken);
  const vin = input.vin.trim().toLowerCase();
  if (!vin) throw new Error("A VIN is required to store media.");
  const ext = input.contentType.startsWith("video/") ? videoExtension(input.contentType) : "bin";
  const key = `${vin}/staging/${crypto.randomUUID()}.${ext}`;
  const c = storageCreds();
  const res = await fetch(`${c.url}/storage/v1/object/upload/sign/vehicle-photos/${key}`, {
    method: "POST",
    headers: {
      apikey: c.key,
      Authorization: `Bearer ${c.key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ expiresIn: 60 * 60 }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Could not start the upload (${res.status}): ${text.slice(0, 200)}`);
  const signed = JSON.parse(text) as { url?: string };
  if (!signed.url) throw new Error("Could not start the upload.");
  return { uploadUrl: `${c.url}/storage/v1${signed.url}`, key };
}

type Source = { isVideo: boolean; ext: string; storageKey?: string; bytes?: Uint8Array; contentType?: string };

/**
 * Stores the ordered media set for a vehicle: moves newly uploaded files into
 * their slots, drops removed ones, writes `mc_cars.image_url`, and mirrors
 * `public.vehicle_photos`.
 */
export async function saveVehiclePhotos(input: {
  accessToken: string;
  vin: string;
  altBase: string;
  order: PhotoOrderItem[];
  newPhotos: IncomingPhoto[];
}): Promise<{ urls: string[] }> {
  await requireStaff(input.accessToken);
  const vin = input.vin.trim().toLowerCase();
  if (!vin) throw new Error("A VIN is required to store media.");

  const legacyRows = (await rest(
    `mc_cars?select=id,image_url&source_id=eq.${encodeURIComponent(vin)}&limit=1`,
    { profile: "mycarco_db" },
  )) as Array<{ id: number; image_url: string | null }>;
  const legacy = legacyRows[0];

  const previousKeys = new Set(
    (legacy?.image_url ?? "")
      .split(/[,|\s]+/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => storageKeyFromUrl(p, vin))
      .filter((k): k is string => Boolean(k)),
  );

  // Describe every slot's source without moving bytes yet.
  const sources: Source[] = [];
  for (const item of input.order) {
    const customAlt = typeof item.alt === "string" ? item.alt.trim().slice(0, 250) : "";
    const before = sources.length;
    pushSource();
    if (sources.length > before && customAlt) sources[sources.length - 1]!.alt = customAlt;
    function pushSource() {
    if (item.kind === "new") {
      if (item.uploadedKey) {
        const ext = item.uploadedKey.split(".").pop()?.toLowerCase() ?? "mp4";
        sources.push({ isVideo: item.media === "video" || ext !== "bin", ext, storageKey: item.uploadedKey });
        continue;
      }
      const media = input.newPhotos[item.index];
      if (!media) continue;
      const decoded = decodeDataUrl(media.dataUrl);
      const contentType = media.contentType || decoded.contentType;
      const isVideo = item.media === "video" || contentType.startsWith("video/");
      sources.push({
        isVideo,
        ext: isVideo ? videoExtension(contentType) : "jpg",
        bytes: decoded.bytes,
        contentType,
      });
    } else {
      const sourceKey = storageKeyFromUrl(item.url, vin);
      if (!sourceKey) continue;
      const isVideo = /video-\d+\./i.test(sourceKey);
      sources.push({
        isVideo,
        ext: sourceKey.split(".").pop()?.toLowerCase() ?? (isVideo ? "mp4" : "jpg"),
        storageKey: sourceKey,
      });
    }
    }
  }

  // Stage everything first: final slot names are reused, so writing straight to
  // them would clobber a file that another slot still needs to read.
  const stagePrefix = `${vin}/staging/${crypto.randomUUID()}`;
  const staged: Array<{ key: string; isVideo: boolean; ext: string; alt: string | null }> = [];
  for (let i = 0; i < sources.length; i++) {
    const s = sources[i]!;
    const stageKey = `${stagePrefix}-${i}.${s.ext}`;
    if (s.bytes) {
      await uploadObject(stageKey, s.bytes, s.contentType ?? "image/jpeg");
    } else if (s.storageKey) {
      const ok = await copyObject(s.storageKey, stageKey);
      if (!ok) continue;
    } else {
      continue;
    }
    staged.push({ key: stageKey, isVideo: s.isVideo, ext: s.ext, alt: s.alt ?? null });
  }

  // Free the slot names, then place each staged file in its final slot.
  const uploadedKeys = input.order
    .filter((o): o is { kind: "new"; index: number; media?: "photo" | "video"; uploadedKey: string } =>
      o.kind === "new" && Boolean(o.uploadedKey),
    )
    .map((o) => o.uploadedKey);
  await removeObjects([...new Set(previousKeys)]);

  const finalKeys: string[] = [];
  const finalAlts: Array<string | null> = [];
  let photoSlot = 0;
  let videoSlot = 0;
  for (const item of staged) {
    const key = item.isVideo
      ? `${vin}/video-${++videoSlot}.${item.ext === "bin" ? "mp4" : item.ext}`
      : `${vin}/photo-${++photoSlot}.jpg`;
    const ok = await copyObject(item.key, key);
    if (!ok) continue;
    finalKeys.push(key);
    finalAlts.push(item.alt);
  }
  await removeObjects([...staged.map((s) => s.key), ...uploadedKeys]);

  const storedPaths = finalKeys.map((k) => `uploads/cars/${k}`);
  // Slot names are reused, so a version stamp keeps browsers and the edge cache
  // from serving the file that was just replaced.
  const stamp = Date.now();
  const appUrls = finalKeys.map((k) => `/api/public/vehicle-photos/${k}?v=${stamp}`);

  if (legacy) {
    await rest(`mc_cars?id=eq.${legacy.id}`, {
      method: "PATCH",
      profile: "mycarco_db",
      body: { image_url: storedPaths.length ? storedPaths.join(",") : null },
    });
  }

  const publicRows = (await rest(
    `vehicles?select=id&vin=eq.${encodeURIComponent(vin.toUpperCase())}&limit=1`,
    { profile: "public" },
  )) as Array<{ id: string }>;
  const publicId = publicRows[0]?.id;
  if (publicId) {
    await rest(`vehicle_photos?vehicle_id=eq.${publicId}`, { method: "DELETE", profile: "public" });
    if (appUrls.length) {
      await rest("vehicle_photos", {
        method: "POST",
        profile: "public",
        body: appUrls.map((url, i) => ({
          vehicle_id: publicId,
          url,
          position: i + 1,
          alt: finalAlts[i] || (/video-\d+\./i.test(url)
            ? `${input.altBase} — video`
            : `${input.altBase} — photo ${i + 1}`),
        })),
      });
    }
  }

  return { urls: appUrls };
}
