/** Shared helpers for vehicle media (photos + videos). */

export const MAX_VIDEOS = 5;
/** Matches the storage bucket cap; videos upload straight to storage. */
export const MAX_VIDEO_BYTES = 5 * 1024 * 1024 * 1024;
export const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];

const VIDEO_EXT_RE = /\.(mp4|webm|mov|m4v)$/i;

/** True when a stored media URL points at a video rather than a photo. */
export function isVideoUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const path = url.split("?")[0] ?? "";
  return VIDEO_EXT_RE.test(path) || /\/video-\d+\./i.test(path);
}

/** Storage extension for an uploaded video content type. */
export function videoExtension(contentType: string | undefined): string {
  const t = (contentType ?? "").toLowerCase();
  if (t.includes("webm")) return "webm";
  if (t.includes("quicktime") || t.includes("mov")) return "mov";
  return "mp4";
}

export function videoContentType(ext: string): string {
  const e = ext.toLowerCase();
  if (e === "webm") return "video/webm";
  if (e === "mov" || e === "m4v") return "video/quicktime";
  return "video/mp4";
}

/** Admin-assignable video types. Stored in the media alt text as a `[video:<type>]` prefix. */
export const VIDEO_TYPES = [
  { value: "exterior", label: "Exterior Walkaround", publicLabel: "360° Exterior Walkaround" },
  { value: "interior", label: "Interior Walkthrough", publicLabel: "Interior Walkthrough" },
  { value: "overview", label: "Vehicle Overview", publicLabel: "Vehicle Overview" },
  { value: "other", label: "Other", publicLabel: "Vehicle Walkaround" },
] as const;
export type VideoType = (typeof VIDEO_TYPES)[number]["value"];

const VIDEO_META_RE = /^\[video:(exterior|interior|overview|other)\]\s*/i;

export function encodeVideoAlt(type: VideoType | null | undefined, title: string | null | undefined): string {
  const t = (title ?? "").trim().slice(0, 200);
  return type ? `[video:${type}] ${t}`.trim() : t;
}

export function parseVideoAlt(alt: string | null | undefined): { type: VideoType | null; title: string } {
  const raw = (alt ?? "").trim();
  const m = raw.match(VIDEO_META_RE);
  if (!m) return { type: null, title: raw };
  return { type: m[1]!.toLowerCase() as VideoType, title: raw.slice(m[0].length).trim() };
}

/** Public label: a specific label only when the admin assigned that type. */
export function videoPublicLabel(type: VideoType | null): string {
  return VIDEO_TYPES.find((t) => t.value === type)?.publicLabel ?? "Vehicle Walkaround";
}
