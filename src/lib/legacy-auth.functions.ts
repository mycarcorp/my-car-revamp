import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type LegacyUser = {
  id: number;
  name: string | null;
  email: string;
  phone: string | null;
  password: string | null;
  google_id: string | null;
  avatar: string | null;
  role: string | null;
};

type AppRole = "owner" | "editor" | "shopper";

/** Map a legacy role string onto this app's role enum. Never trust client input here. */
function mapLegacyRole(role: string | null): AppRole {
  const r = (role ?? "").trim().toLowerCase();
  if (r === "admin" || r === "owner" || r === "superadmin") return "owner";
  if (r === "editor" || r === "staff" || r === "manager") return "editor";
  return "shopper";
}

/** Read one legacy user by email (case-insensitive) from the old project, server-side only. */
async function fetchLegacyUser(email: string): Promise<LegacyUser | null> {
  const url = process.env["LEGACY_SUPABASE_URL"];
  const key = process.env["LEGACY_SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) return null;

  const res = await fetch(
    `${url}/rest/v1/mc_users?select=id,name,email,phone,password,google_id,avatar,role&email=ilike.${encodeURIComponent(email)}&limit=1`,
    {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Accept-Profile": "mycarco_db",
      },
    },
  );
  if (!res.ok) return null;
  const rows = (await res.json()) as LegacyUser[];
  return rows[0] ?? null;
}

/** Copy approved legacy details onto the profile the signup trigger already created. */
async function applyLegacyProfile(userId: string, legacy: LegacyUser) {
  const { appAdmin } = await import("./app-admin.server");
  const supabaseAdmin = appAdmin();

  const patch: Record<string, unknown> = { legacy_user_id: legacy.id };
  if (legacy.name) patch["full_name"] = legacy.name;
  if (legacy.phone) patch["phone"] = legacy.phone;
  if (legacy.avatar) patch["avatar_url"] = legacy.avatar;
  patch["email"] = legacy.email.trim().toLowerCase();

  // The handle_new_user trigger already inserted the row; update it, never insert a second one.
  await supabaseAdmin.from("profiles").update(patch as never).eq("id", userId);

  const role = mapLegacyRole(legacy.role);
  const { data: existing } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const have = new Set((existing ?? []).map((r) => r.role as string));
  if (!have.has(role)) {
    await supabaseAdmin.from("user_roles").insert({ user_id: userId, role } as never);
  }
}

export type LegacyLoginResult =
  | { status: "migrated" }
  | { status: "google_only" }
  | { status: "no_legacy" }
  | { status: "invalid_password" }
  | { status: "already_current" }
  | { status: "unavailable" };

/**
 * Fallback used only when Supabase Auth sign-in fails. Verifies the submitted
 * password against the legacy bcrypt hash server-side, then creates the matching
 * account in this project's Supabase Auth. Never returns the hash.
 */
export const legacyMigrateLogin = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string; password: string }) => {
    const email = String(input?.email ?? "").trim().toLowerCase();
    const password = String(input?.password ?? "");
    if (!email.includes("@") || password.length < 1) throw new Error("Invalid input");
    return { email, password };
  })
  .handler(async ({ data }): Promise<LegacyLoginResult> => {
    const legacy = await fetchLegacyUser(data.email);
    if (!legacy) return { status: "no_legacy" };

    const hash = (legacy.password ?? "").trim();
    if (!hash) return legacy.google_id ? { status: "google_only" } : { status: "no_legacy" };

    const bcrypt = (await import("bcryptjs")).default;
    let ok = false;
    try {
      ok = await bcrypt.compare(data.password, hash);
    } catch {
      ok = false;
    }
    if (!ok) return { status: "invalid_password" };

    const { appAdmin } = await import("./app-admin.server");
    const supabaseAdmin = appAdmin();
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: legacy.email.trim().toLowerCase(),
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: legacy.name ?? "" },
    });

    if (error) {
      const m = error.message.toLowerCase();
      // An Auth account already exists for this email: never overwrite its password.
      if (m.includes("already") || m.includes("registered") || m.includes("exists")) {
        return { status: "already_current" };
      }
      return { status: "unavailable" };
    }
    if (!created.user) return { status: "unavailable" };

    await applyLegacyProfile(created.user.id, legacy);
    return { status: "migrated" };
  });

/**
 * Called after a successful sign-in (including Google) to attach legacy profile
 * details to the current Auth user, matched by email. Idempotent.
 */
export const linkLegacyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ linked: boolean }> => {
    const email = String((context.claims as { email?: string })?.email ?? "")
      .trim()
      .toLowerCase();
    if (!email) return { linked: false };

    const { appAdmin } = await import("./app-admin.server");
    const supabaseAdmin = appAdmin();
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("legacy_user_id")
      .eq("id", context.userId)
      .maybeSingle();
    if (profile && (profile as { legacy_user_id: number | null }).legacy_user_id) {
      return { linked: true };
    }

    const legacy = await fetchLegacyUser(email);
    if (!legacy) return { linked: false };

    await applyLegacyProfile(context.userId, legacy);
    return { linked: true };
  });
