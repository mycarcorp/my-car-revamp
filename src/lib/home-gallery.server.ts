import { requireStaff } from "./legacy-blog.server";

/**
 * Customer experience gallery: media files and an ordered manifest.json live in
 * the public `customer-gallery` storage bucket. No database table is needed.
 */
export type GalleryCta = "value" | "learn" | "offer" | "shop" | "finance" | "none";
export type GalleryItem = {
  id: string;
  type: "photo" | "video";
  url: string;
  key: string;
  title: string;
  caption: string;
  cta: GalleryCta;
};

const BUCKET = "customer-gallery";
type Creds = { url: string; key: string };

function creds(): Creds {
  const list = [
    { url: process.env["SUPABASE_URL"], key: process.env["SUPABASE_SERVICE_ROLE_KEY"] },
    { url: process.env["LEGACY_SUPABASE_URL"], key: process.env["LEGACY_SUPABASE_SERVICE_ROLE_KEY"] },
  ];
  const found = list.find((c): c is Creds => Boolean(c.url && c.key));
  if (!found) throw new Error("Gallery storage is not configured.");
  return found;
}

const headers = (c: Creds, json = true): Record<string, string> => ({
  apikey: c.key,
  Authorization: `Bearer ${c.key}`,
  ...(json ? { "Content-Type": "application/json" } : {}),
});

async function ensureBucket(c: Creds) {
  await fetch(`${c.url}/storage/v1/bucket`, {
    method: "POST",
    headers: headers(c),
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true }),
  }).catch(() => null);
}

const publicUrl = (c: Creds, key: string) => `${c.url}/storage/v1/object/public/${BUCKET}/${key}`;

export async function listGallery(): Promise<GalleryItem[]> {
  let c: Creds;
  try {
    c = creds();
  } catch {
    return [];
  }
  const res = await fetch(`${publicUrl(c, "manifest.json")}?t=${Date.now()}`).catch(() => null);
  if (!res || !res.ok) return [];
  const data = (await res.json().catch(() => [])) as GalleryItem[];
  return Array.isArray(data) ? data.map((i) => ({ ...i, url: publicUrl(c, i.key) })) : [];
}

const CTAS: GalleryCta[] = ["value", "learn", "offer", "shop", "finance", "none"];

export async function saveGallery(token: string, items: GalleryItem[]): Promise<GalleryItem[]> {
  await requireStaff(token);
  const c = creds();
  await ensureBucket(c);
  const previous = await listGallery();
  const clean = items.slice(0, 40).map((i) => ({
    id: String(i.id).slice(0, 64),
    type: i.type === "video" ? "video" : "photo",
    key: String(i.key).replace(/[^a-z0-9/._-]/gi, "").slice(0, 200),
    url: "",
    title: String(i.title ?? "").slice(0, 120),
    caption: String(i.caption ?? "").slice(0, 300),
    cta: CTAS.includes(i.cta) ? i.cta : "none",
  })) as GalleryItem[];
  const res = await fetch(`${c.url}/storage/v1/object/${BUCKET}/manifest.json`, {
    method: "POST",
    headers: { ...headers(c, false), "Content-Type": "application/json", "x-upsert": "true", "Cache-Control": "no-cache" },
    body: JSON.stringify(clean),
  });
  if (!res.ok) throw new Error(`Could not save the gallery (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const kept = new Set(clean.map((i) => i.key));
  const removed = previous.map((p) => p.key).filter((k) => k && !kept.has(k));
  if (removed.length) {
    await fetch(`${c.url}/storage/v1/object/${BUCKET}`, {
      method: "DELETE",
      headers: headers(c),
      body: JSON.stringify({ prefixes: removed }),
    }).catch(() => null);
  }
  return clean.map((i) => ({ ...i, url: publicUrl(c, i.key) }));
}

export async function createGalleryUpload(token: string, contentType: string) {
  await requireStaff(token);
  const c = creds();
  await ensureBucket(c);
  const t = contentType.toLowerCase();
  const ext = t.includes("webm") ? "webm" : t.includes("quicktime") ? "mov" : t.startsWith("video/") ? "mp4" : t.includes("png") ? "png" : t.includes("webp") ? "webp" : "jpg";
  const key = `media/${crypto.randomUUID()}.${ext}`;
  const res = await fetch(`${c.url}/storage/v1/object/upload/sign/${BUCKET}/${key}`, {
    method: "POST",
    headers: headers(c),
    body: JSON.stringify({ expiresIn: 3600 }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Could not start the upload (${res.status}): ${text.slice(0, 200)}`);
  const signed = JSON.parse(text) as { url?: string };
  if (!signed.url) throw new Error("Could not start the upload.");
  return { uploadUrl: `${c.url}/storage/v1${signed.url}`, key, url: publicUrl(c, key) };
}

/* ---------------- Homepage hero editor (hero.json in the same bucket) ---------------- */
export type HeroDevice = "desktop" | "tablet" | "mobile";
export type HeroFrame = { x: number; y: number; zoom: number; fit: "cover" | "contain" };
export type HeroSettings = {
  imageKey: string;
  imageUrl: string;
  frames: Record<HeroDevice, HeroFrame>;
  overlay: { left: number; bottom: number; shadow: number; direction: "left" | "bottom" | "both" | "none" };
};
export type HeroImage = { id: string; key: string; url: string; name: string };
export type HeroConfig = { images: HeroImage[]; draft: HeroSettings | null; published: HeroSettings | null };

const num = (v: unknown, min: number, max: number, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d;
};
const cleanKey = (k: unknown) => String(k ?? "").replace(/[^a-z0-9/._-]/gi, "").slice(0, 200);

function cleanSettings(c: Creds, s: HeroSettings | null | undefined): HeroSettings | null {
  if (!s || !s.imageKey) return null;
  const frame = (f?: Partial<HeroFrame>): HeroFrame => ({
    x: num(f?.x, 0, 100, 50),
    y: num(f?.y, 0, 100, 50),
    zoom: num(f?.zoom, 1, 3, 1),
    fit: f?.fit === "contain" ? "contain" : "cover",
  });
  const dirs = ["left", "bottom", "both", "none"] as const;
  const key = cleanKey(s.imageKey);
  return {
    imageKey: key,
    imageUrl: publicUrl(c, key),
    frames: { desktop: frame(s.frames?.desktop), tablet: frame(s.frames?.tablet), mobile: frame(s.frames?.mobile) },
    overlay: {
      left: num(s.overlay?.left, 0, 100, 45),
      bottom: num(s.overlay?.bottom, 0, 100, 30),
      shadow: num(s.overlay?.shadow, 0, 100, 0),
      direction: dirs.includes(s.overlay?.direction as never) ? s.overlay.direction : "both",
    },
  };
}

export async function getHeroConfig(): Promise<HeroConfig> {
  const empty: HeroConfig = { images: [], draft: null, published: null };
  let c: Creds;
  try { c = creds(); } catch { return empty; }
  const res = await fetch(`${publicUrl(c, "hero.json")}?t=${Date.now()}`).catch(() => null);
  if (!res || !res.ok) return empty;
  const d = (await res.json().catch(() => null)) as HeroConfig | null;
  if (!d) return empty;
  return {
    images: (d.images ?? []).map((i) => ({ ...i, url: publicUrl(c, i.key) })),
    draft: cleanSettings(c, d.draft),
    published: cleanSettings(c, d.published),
  };
}

export async function getPublishedHero(): Promise<HeroSettings | null> {
  return (await getHeroConfig()).published;
}

export async function saveHeroConfig(token: string, input: HeroConfig): Promise<HeroConfig> {
  await requireStaff(token);
  const c = creds();
  await ensureBucket(c);
  const previous = await getHeroConfig();
  const images = (input.images ?? []).slice(0, 30).map((i) => ({
    id: String(i.id).slice(0, 64), key: cleanKey(i.key), url: "", name: String(i.name ?? "").slice(0, 120),
  })).filter((i) => i.key.startsWith("hero/"));
  const out = { images, draft: cleanSettings(c, input.draft), published: cleanSettings(c, input.published) };
  const res = await fetch(`${c.url}/storage/v1/object/${BUCKET}/hero.json`, {
    method: "POST",
    headers: { ...headers(c, false), "Content-Type": "application/json", "x-upsert": "true", "Cache-Control": "no-cache" },
    body: JSON.stringify(out),
  });
  if (!res.ok) throw new Error(`Could not save the hero (${res.status}).`);
  const kept = new Set([...images.map((i) => i.key), out.draft?.imageKey, out.published?.imageKey]);
  const removed = previous.images.map((i) => i.key).filter((k) => k && !kept.has(k));
  if (removed.length) {
    await fetch(`${c.url}/storage/v1/object/${BUCKET}`, { method: "DELETE", headers: headers(c), body: JSON.stringify({ prefixes: removed }) }).catch(() => null);
  }
  return getHeroConfig();
}

export async function createHeroUpload(token: string, contentType: string) {
  await requireStaff(token);
  const c = creds();
  await ensureBucket(c);
  const t = contentType.toLowerCase();
  const ext = t.includes("png") ? "png" : t.includes("webp") ? "webp" : "jpg";
  const key = `hero/${crypto.randomUUID()}.${ext}`;
  const res = await fetch(`${c.url}/storage/v1/object/upload/sign/${BUCKET}/${key}`, {
    method: "POST", headers: headers(c), body: JSON.stringify({ expiresIn: 3600 }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Could not start the upload (${res.status}).`);
  const signed = JSON.parse(text) as { url?: string };
  if (!signed.url) throw new Error("Could not start the upload.");
  return { uploadUrl: `${c.url}/storage/v1${signed.url}`, key, url: publicUrl(c, key) };
}
