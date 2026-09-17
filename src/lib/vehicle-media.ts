/** Shared helpers for vehicle media (photos + videos). */

export const MAX_VIDEOS = 5;
export const MAX_VIDEO_BYTES = 25 * 1024 * 1024;
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
