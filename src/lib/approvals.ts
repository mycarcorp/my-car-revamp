// Customer repair approvals: shared types and pure validation used by the
// recon webhook, the server functions and the customer page.

export type Priority = "safety" | "recommended" | "later";
export type Decision = "approved" | "declined";

export type ApprovalItem = {
  id: string;
  title: string;
  detail: string;
  priority: Priority;
  price_cents: number;
};

export type ApprovalMedia = { n: number; type: string; item: string | null };

export const PRIORITY_LABEL: Record<Priority, string> = {
  safety: "Needs attention now",
  recommended: "Recommended",
  later: "Can wait",
};

export const MAX_ITEMS = 40;
export const MAX_MEDIA = 30;
export const MEDIA_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

const clip = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

export function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export const TOKEN_RE = /^[a-f0-9]{48}$/;

export function cleanItems(raw: unknown): { items: ApprovalItem[]; errors: string[] } {
  const errors: string[] = [];
  const list = Array.isArray(raw) ? raw.slice(0, MAX_ITEMS) : [];
  const seen = new Set<string>();
  const items: ApprovalItem[] = [];
  for (const r of list as Record<string, unknown>[]) {
    const id = clip(r?.id, 40).replace(/[^\w-]/g, "");
    const title = clip(r?.title, 140);
    const priceRaw = String(r?.price ?? r?.price_cents ?? "").replace(/[$,\s]/g, "");
    const price = priceRaw === "" ? NaN : Number(priceRaw);
    if (!id || seen.has(id)) { errors.push("Each item needs a unique id"); continue; }
    if (!title) { errors.push("Each item needs a title"); continue; }
    if (!Number.isFinite(price) || price < 0) { errors.push(`"${title}" needs a price`); continue; }
    seen.add(id);
    const p = String(r?.priority ?? "recommended") as Priority;
    items.push({
      id,
      title,
      detail: clip(r?.detail, 1200),
      priority: p in PRIORITY_LABEL ? p : "recommended",
      // Recon sends dollars as `price`; `price_cents` is accepted as-is.
      price_cents: r?.price_cents != null && r?.price == null ? Math.round(price) : Math.round(price * 100),
    });
  }
  if (!items.length && !errors.length) errors.push("Add at least one item for the customer to approve");
  return { items, errors };
}

export function cleanDecisions(items: ApprovalItem[], raw: unknown): Record<string, Decision> | null {
  if (!raw || typeof raw !== "object") return null;
  const out: Record<string, Decision> = {};
  for (const it of items) {
    const d = (raw as Record<string, unknown>)[it.id];
    if (d !== "approved" && d !== "declined") return null;
    out[it.id] = d;
  }
  return out;
}

export function approvedTotal(items: ApprovalItem[], decisions: Record<string, Decision | undefined>): number {
  return items.reduce((sum, it) => sum + (decisions[it.id] === "approved" ? it.price_cents : 0), 0);
}
