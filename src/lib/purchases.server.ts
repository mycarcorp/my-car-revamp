// Server-only data access for customer purchases in mycarco_db.
import { PURCHASE_SETUP_PENDING, type Purchase, type PurchaseEvent } from "./purchase-flow";

function creds() {
  const url = process.env["LEGACY_SUPABASE_URL"] ?? process.env["SUPABASE_URL"];
  const key = process.env["LEGACY_SUPABASE_SERVICE_ROLE_KEY"] ?? process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) throw new Error("Backend credentials are not configured.");
  return { url, key };
}

export async function rest<T = unknown>(
  path: string,
  init: { method?: string; body?: unknown; profile?: "public" | "mycarco_db"; prefer?: string } = {},
): Promise<T> {
  const c = creds();
  const method = init.method ?? "GET";
  const profile = init.profile ?? "mycarco_db";
  const headers: Record<string, string> = {
    apikey: c.key,
    "Content-Type": "application/json",
    [method === "GET" ? "Accept-Profile" : "Content-Profile"]: profile,
  };
  if (c.key.split(".").length === 3) headers["Authorization"] = `Bearer ${c.key}`;
  if (init.prefer) headers["Prefer"] = init.prefer;
  const res = await fetch(`${c.url}/rest/v1/${path}`, {
    method,
    headers,
    body: init.body === undefined ? null : JSON.stringify(init.body),
  });
  const text = await res.text();
  if (!res.ok) {
    if (/42P01|PGRST205|PGRST106|does not exist|Could not find the table/i.test(text)) {
      throw new Error(PURCHASE_SETUP_PENDING);
    }
    throw new Error(`Request failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return (text ? JSON.parse(text) : null) as T;
}

export async function requireUser(token: string): Promise<{ id: string; email: string | null }> {
  const c = creds();
  if (!token) throw new Error("Please sign in.");
  const res = await fetch(`${c.url}/auth/v1/user`, {
    headers: { apikey: c.key, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Please sign in.");
  const u = (await res.json()) as { id?: string; email?: string };
  if (!u?.id) throw new Error("Please sign in.");
  return { id: u.id, email: u.email ?? null };
}

export async function requireStaffUser(token: string) {
  const user = await requireUser(token);
  const roles = await rest<Array<{ role: string }>>(`user_roles?select=role&user_id=eq.${user.id}`, {
    profile: "public",
  });
  if (!(roles ?? []).some((r) => r.role === "owner" || r.role === "editor")) {
    throw new Error("Staff access required.");
  }
  return user;
}

export async function getPurchaseRow(id: number): Promise<Purchase | null> {
  const rows = await rest<Purchase[]>(`mc_purchases?select=*&id=eq.${id}&limit=1`);
  return rows?.[0] ?? null;
}

export async function listEvents(id: number, customerOnly: boolean): Promise<PurchaseEvent[]> {
  const filter = customerOnly ? "&visible_to_customer=eq.true" : "";
  return rest<PurchaseEvent[]>(
    `mc_purchase_events?select=*&purchase_id=eq.${id}${filter}&order=created_at.desc`,
  );
}

export async function addEvent(e: {
  purchase_id: number;
  event_type: string;
  message: string;
  visible_to_customer: boolean;
  author: string | null;
}) {
  await rest("mc_purchase_events", { method: "POST", body: e });
}
