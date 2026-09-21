import { createServerFn } from "@tanstack/react-start";

export type AdminLeadRow = {
  id: string;
  lead_type: string;
  status: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  message: string | null;
  vehicle_id: string | null;
  details: Record<string, unknown>;
  created_at: string | null;
};

/** All website form submissions (finance, trade/sell, appointment, contact, availability). */
export const listLeads = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string; limit?: number }) => {
    const accessToken = String(input?.accessToken ?? "");
    if (!accessToken) throw new Error("Not signed in.");
    const limit = Number(input?.limit ?? 500);
    return { accessToken, limit: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 2000) : 500 };
  })
  .handler(async ({ data }): Promise<AdminLeadRow[]> => {
    const { requireStaff } = await import("./legacy-blog.server");
    await requireStaff(data.accessToken);

    const url = process.env["LEGACY_SUPABASE_URL"];
    const key = process.env["LEGACY_SUPABASE_SERVICE_ROLE_KEY"];
    if (!url || !key) throw new Error("Lead database credentials are not configured.");

    const headers: Record<string, string> = { apikey: key, "Accept-Profile": "public" };
    if (key.split(".").length === 3) headers["Authorization"] = `Bearer ${key}`;

    const path =
      `leads?select=id,lead_type,status,full_name,email,phone,message,vehicle_id,details,created_at` +
      `&order=created_at.desc&limit=${data.limit}`;

    const response = await fetch(`${url}/rest/v1/${path}`, { headers });
    const text = await response.text();
    if (!response.ok) throw new Error(`Could not load leads (${response.status}): ${text.slice(0, 200)}`);

    const rows = (text ? JSON.parse(text) : []) as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      id: String(row["id"]),
      lead_type: String(row["lead_type"] ?? "contact"),
      status: (row["status"] as string | null) ?? null,
      full_name: (row["full_name"] as string | null) ?? null,
      email: (row["email"] as string | null) ?? null,
      phone: (row["phone"] as string | null) ?? null,
      message: (row["message"] as string | null) ?? null,
      vehicle_id: (row["vehicle_id"] as string | null) ?? null,
      details: (row["details"] as Record<string, unknown>) ?? {},
      created_at: (row["created_at"] as string | null) ?? null,
    }));
  });
