// Server-only helpers for positions, responsibilities and account roles
// stored in the legacy `mycarco_db` schema.

function creds() {
  const url = process.env["LEGACY_SUPABASE_URL"] ?? process.env["SUPABASE_URL"];
  const key =
    process.env["LEGACY_SUPABASE_SERVICE_ROLE_KEY"] ?? process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) throw new Error("Team management credentials are not configured.");
  return { url, key };
}

export async function rest(
  path: string,
  init: { method?: string; body?: unknown; profile?: "public" | "mycarco_db"; prefer?: string } = {},
): Promise<unknown> {
  const c = creds();
  const method = init.method ?? "GET";
  const headers: Record<string, string> = {
    apikey: c.key,
    "Content-Type": "application/json",
  };
  // New-format keys (sb_secret_…) are opaque, not JWTs — only send a bearer
  // header for real 3-part JWT keys.
  if (c.key.split(".").length === 3) headers["Authorization"] = `Bearer ${c.key}`;
  if (init.profile) headers[method === "GET" ? "Accept-Profile" : "Content-Profile"] = init.profile;
  if (init.prefer) headers["Prefer"] = init.prefer;

  const requestInit: RequestInit = { method, headers };
  if (init.body !== undefined) requestInit.body = JSON.stringify(init.body);

  let response = await fetch(`${c.url}/rest/v1/${path}`, requestInit);
  let text = await response.text();
  if (response.status === 401 && text.includes("PGRST303")) {
    const { Authorization: _drop, ...withoutBearer } = headers;
    response = await fetch(`${c.url}/rest/v1/${path}`, { ...requestInit, headers: withoutBearer });
    text = await response.text();
  }
  if (!response.ok) {
    throw new Error(`Team request failed (${response.status}): ${text.slice(0, 300)}`);
  }
  return text ? JSON.parse(text) : null;
}

export type PositionRow = {
  id: number;
  name: string;
  description: string | null;
  responsibilities: string[];
  created_at: string | null;
  updated_at: string | null;
};

const MISSING_TABLE = "mc_positions";

function friendlyMissing(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes(MISSING_TABLE) || message.includes("42P01") || message.includes("PGRST205")) {
    throw new Error(
      "Positions aren't set up in the database yet. Run the positions SQL in your SQL editor, then reload.",
    );
  }
  throw error instanceof Error ? error : new Error(message);
}

export async function listPositionRows(): Promise<PositionRow[]> {
  try {
    const rows = (await rest("mc_positions?select=*&order=name.asc", {
      profile: "mycarco_db",
    })) as PositionRow[] | null;
    return (rows ?? []).map((row) => ({ ...row, responsibilities: row.responsibilities ?? [] }));
  } catch (error) {
    return friendlyMissing(error);
  }
}

export async function createPositionRow(input: {
  name: string;
  description: string | null;
  responsibilities: string[];
}): Promise<PositionRow> {
  try {
    const rows = (await rest("mc_positions", {
      method: "POST",
      profile: "mycarco_db",
      prefer: "return=representation",
      body: [input],
    })) as PositionRow[];
    return rows[0]!;
  } catch (error) {
    return friendlyMissing(error);
  }
}

export async function updatePositionRow(
  id: number,
  input: { name: string; description: string | null; responsibilities: string[] },
): Promise<PositionRow> {
  try {
    const rows = (await rest(`mc_positions?id=eq.${id}`, {
      method: "PATCH",
      profile: "mycarco_db",
      prefer: "return=representation",
      body: { ...input, updated_at: new Date().toISOString() },
    })) as PositionRow[];
    return rows[0]!;
  } catch (error) {
    return friendlyMissing(error);
  }
}

export async function deletePositionRow(id: number): Promise<void> {
  try {
    await rest(`mc_users?position_id=eq.${id}`, {
      method: "PATCH",
      profile: "mycarco_db",
      body: { position_id: null },
    });
    await rest(`mc_positions?id=eq.${id}`, { method: "DELETE", profile: "mycarco_db" });
  } catch (error) {
    friendlyMissing(error);
  }
}

export async function setUserRoleRow(userId: number, role: "admin" | "customer"): Promise<void> {
  const body: Record<string, unknown> = { role, updated_at: new Date().toISOString() };
  // Customers keep no position.
  if (role === "customer") body["position_id"] = null;
  try {
    await rest(`mc_users?id=eq.${userId}`, { method: "PATCH", profile: "mycarco_db", body });
  } catch (error) {
    friendlyMissing(error);
  }
}

export async function setUserPositionRow(userId: number, positionId: number | null): Promise<void> {
  try {
    await rest(`mc_users?id=eq.${userId}`, {
      method: "PATCH",
      profile: "mycarco_db",
      body: { position_id: positionId, updated_at: new Date().toISOString() },
    });
  } catch (error) {
    friendlyMissing(error);
  }
}
