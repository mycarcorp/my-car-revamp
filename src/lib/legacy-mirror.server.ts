// Server-only helpers that mirror app activity into the legacy `mycarco_db`
// schema of the same Supabase project. The service-role key never leaves the
// server, and the legacy schema is never exposed to the browser.

type Json = Record<string, unknown>;

function creds() {
  const url = process.env["LEGACY_SUPABASE_URL"];
  const key = process.env["LEGACY_SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) return null;
  return { url, key };
}

type Profile = "public" | "mycarco_db";

async function rest(
  path: string,
  init: { method?: string; body?: unknown; profile?: Profile; prefer?: string } = {},
): Promise<unknown> {
  const c = creds();
  if (!c) {
    throw new Error(
      "Legacy backend credentials are not configured. Add LEGACY_SUPABASE_URL and LEGACY_SUPABASE_SERVICE_ROLE_KEY for the old Supabase project that hosts mycarco_db.mc_blog (not the public blog_posts table).",
    );
  }

  const method = init.method ?? "GET";
  const headers: Record<string, string> = {
    apikey: c.key,
    Authorization: `Bearer ${c.key}`,
    "Content-Type": "application/json",
  };
  if (init.profile) {
    headers[method === "GET" ? "Accept-Profile" : "Content-Profile"] = init.profile;
  }
  if (init.prefer) headers["Prefer"] = init.prefer;

  const res = await fetch(`${c.url}/rest/v1/${path}`, {
    method,
    headers,
    body: init.body === undefined ? null : JSON.stringify(init.body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Legacy request failed (${res.status}): ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

const nz = (v: unknown, max: number): string | null => {
  const s = String(v ?? "").trim();
  if (!s) return null;
  return s.slice(0, max);
};

const num = (v: unknown): number | null => {
  const n = Number(String(v ?? "").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) && String(v ?? "").trim() !== "" ? n : null;
};

/** Verify a Supabase access token against the app project. Returns the user id. */
export async function verifyAppUser(
  token: string,
): Promise<{ id: string; email: string | null } | null> {
  const c = creds();
  if (!c || !token) return null;
  const res = await fetch(`${c.url}/auth/v1/user`, {
    headers: { apikey: c.key, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const user = (await res.json()) as { id?: string; email?: string };
  return user?.id ? { id: user.id, email: user.email ?? null } : null;
}

/**
 * Resolve the legacy `mc_users.id` for an app user or a bare email.
 * Order: profiles.legacy_user_id → mc_users matched by email → create a
 * minimal mc_users row so the legacy foreign keys stay valid.
 */
export async function resolveLegacyUserId(input: {
  userId?: string | null;
  email?: string | null;
  fullName?: string | null;
  phone?: string | null;
}): Promise<number | null> {
  const email = (input.email ?? "").trim().toLowerCase();

  if (input.userId) {
    const rows = (await rest(
      `profiles?select=legacy_user_id,email,full_name,phone&id=eq.${input.userId}&limit=1`,
      { profile: "public" },
    )) as Array<{
      legacy_user_id: number | null;
      email: string | null;
      full_name: string | null;
      phone: string | null;
    }>;
    const p = rows?.[0];
    if (p?.legacy_user_id) return p.legacy_user_id;
    if (!input.email && p?.email) input.email = p.email;
    if (!input.fullName && p?.full_name) input.fullName = p.full_name;
    if (!input.phone && p?.phone) input.phone = p.phone;
  }

  const lookupEmail = (input.email ?? "").trim().toLowerCase() || email;
  if (!lookupEmail) return null;

  const found = (await rest(
    `mc_users?select=id&email=ilike.${encodeURIComponent(lookupEmail)}&limit=1`,
    { profile: "mycarco_db" },
  )) as Array<{ id: number }>;
  let legacyId = found?.[0]?.id ?? null;

  if (!legacyId) {
    const created = (await rest("mc_users", {
      method: "POST",
      profile: "mycarco_db",
      prefer: "return=representation",
      body: {
        name: nz(input.fullName, 255) ?? lookupEmail.split("@")[0],
        email: lookupEmail.slice(0, 255),
        phone: nz(input.phone, 40),
        role: "customer",
      },
    })) as Array<{ id: number }>;
    legacyId = created?.[0]?.id ?? null;
  }

  // Keep the link on the modern profile so later mirrors reuse the same row.
  if (legacyId && input.userId) {
    await rest(`profiles?id=eq.${input.userId}`, {
      method: "PATCH",
      profile: "public",
      body: { legacy_user_id: legacyId },
    }).catch(() => null);
  }

  return legacyId;
}

/** mc_cars.id for an app vehicle. Legacy rows carry stock_number `LEGACY-<id>`. */
export async function resolveLegacyCarId(vehicleId: string): Promise<number | null> {
  const rows = (await rest(
    `vehicles?select=stock_number,year,make,model&id=eq.${vehicleId}&limit=1`,
    { profile: "public" },
  )) as Array<{ stock_number: string | null; year: number; make: string; model: string }>;
  const v = rows?.[0];
  if (!v) return null;

  const m = /^LEGACY-(\d+)$/i.exec(v.stock_number ?? "");
  if (m) {
    const id = Number(m[1]);
    const exists = (await rest(`mc_cars?select=id&id=eq.${id}&limit=1`, {
      profile: "mycarco_db",
    })) as Array<{ id: number }>;
    if (exists?.[0]) return exists[0].id;
  }

  const guess = (await rest(
    `mc_cars?select=id&year=eq.${v.year}&make=ilike.${encodeURIComponent(v.make)}&model=ilike.${encodeURIComponent(v.model)}&limit=1`,
    { profile: "mycarco_db" },
  )) as Array<{ id: number }>;
  return guess?.[0]?.id ?? null;
}

export type MirrorLeadInput = {
  leadType: "finance" | "trade" | "appointment" | "contact" | "availability";
  fullName: string;
  email: string;
  phone?: string | null;
  message?: string | null;
  vehicleId?: string | null;
  userId?: string | null;
  details?: Json;
};

/** Mirror a contact-style lead into mycarco_db.mc_contacts. */
export async function mirrorContactRow(input: MirrorLeadInput): Promise<void> {
  const d = input.details ?? {};
  const interest =
    nz(d["vehicle_of_interest"], 120) ??
    nz(d["year_make_model"], 120) ??
    (input.vehicleId ? await vehicleLabel(input.vehicleId) : null) ??
    nz(input.leadType, 120);

  await rest("mc_contacts", {
    method: "POST",
    profile: "mycarco_db",
    body: {
      type: input.leadType === "appointment" ? "appointment" : "contact",
      full_name: nz(input.fullName, 255) ?? "Website visitor",
      email: nz(input.email, 255),
      phone: nz(input.phone, 40),
      interest,
      preference: nz(d["contact_preference"] ?? d["preference"], 40),
      appt_date: nz(d["preferred_date"] ?? d["appt_date"], 40),
      appt_time: nz(d["preferred_time"] ?? d["appt_time"], 40),
      message: input.message ?? null,
    },
  });
}

async function vehicleLabel(vehicleId: string): Promise<string | null> {
  try {
    const rows = (await rest(`vehicles?select=year,make,model,trim&id=eq.${vehicleId}&limit=1`, {
      profile: "public",
    })) as Array<{ year: number; make: string; model: string; trim: string | null }>;
    const v = rows?.[0];
    if (!v) return null;
    return nz([v.year, v.make, v.model, v.trim].filter(Boolean).join(" "), 120);
  } catch {
    return null;
  }
}

const jsonField = (v: unknown): Json | null => {
  if (v == null) return null;
  if (typeof v === "object") return v as Json;
  const s = String(v).trim();
  if (!s) return null;
  try {
    const parsed = JSON.parse(s);
    return parsed && typeof parsed === "object" ? (parsed as Json) : null;
  } catch {
    return null;
  }
};

const dateField = (v: unknown): string | null => {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

const boolField = (v: unknown): boolean | null =>
  typeof v === "boolean" ? v : v === "true" ? true : v === "false" ? false : null;

/** Mirror a financing request into mycarco_db.mc_financing. */
export async function mirrorFinancingRow(input: MirrorLeadInput): Promise<void> {
  const d = input.details ?? {};
  const legacyUserId = await resolveLegacyUserId({
    userId: input.userId ?? null,
    email: input.email,
    fullName: input.fullName,
    phone: input.phone ?? null,
  });
  // user_id is NOT NULL in the legacy table; without it no row can be written.
  if (!legacyUserId) return;

  const extras: string[] = [];
  if (nz(d["desired_payment"], 200)) extras.push(`Target monthly payment: ${d["desired_payment"]}`);
  if (nz(d["vehicle_of_interest"], 200)) extras.push(`Vehicle of interest: ${d["vehicle_of_interest"]}`);
  if (nz(d["income_band"], 200)) extras.push(`Stated monthly income band: ${d["income_band"]}`);
  const notes = [input.message ?? "", extras.join("\n")].filter(Boolean).join("\n\n") || null;

  const employer1 = jsonField(d["current_employer_1"]) ?? {};
  const monthlyIncome = num(employer1["monthlyIncome"]);
  const employment =
    nz(d["employment"], 80) ?? nz(employer1["employmentStatus"], 80) ?? null;
  const annualIncome =
    num(d["annual_income"]) ?? (monthlyIncome != null ? Math.round(monthlyIncome * 12) : null);

  const base: Json = {
    user_id: legacyUserId,
    full_name: nz(input.fullName, 255) ?? "Website visitor",
    email: nz(input.email, 255) ?? "",
    phone: nz(input.phone, 40) ?? nz(d["cell_phone"], 40),
    vehicle_price: num(d["vehicle_price"]),
    down_payment: num(d["down_payment"]) ?? num(d["cash_down"]),
    loan_term: num(d["loan_term"]),
    credit_band: nz(d["credit_band"], 40),
    employment,
    annual_income: annualIncome,
    notes,
  };

  // Full credit-application payload. Written only when the extended columns
  // exist (see supabase/migrations_legacy/2026_mc_financing_application.sql);
  // otherwise we fall back to the base row so a submission is never lost.
  const extended: Json = {
    ...base,
    salutation: nz(d["salutation"], 20),
    first_name: nz(d["first_name"], 120),
    middle_name: nz(d["middle_name"], 120),
    last_name: nz(d["last_name"], 120),
    suffix: nz(d["suffix"], 20),
    nick_name: nz(d["nick_name"], 120),
    gender: nz(d["gender"], 40),
    cash_down: num(d["cash_down"]),
    ssn: nz(d["ssn"], 20),
    date_of_birth: dateField(d["date_of_birth"]),
    cell_phone: nz(d["cell_phone"], 40),
    home_phone: nz(d["home_phone"], 40),
    work_phone: nz(d["work_phone"], 40),
    id_type: nz(d["id_type"], 60),
    id_state: nz(d["id_state"], 10),
    id_number: nz(d["id_number"], 60),
    id_issued_date: dateField(d["issued_date"]),
    id_expiration_date: dateField(d["expiration_date"]),
    current_address: jsonField(d["current_address"]),
    mailing_address: jsonField(d["mailing_address"]),
    mailing_same_as_current: boolField(d["mailing_same_as_current"]),
    previous_address: jsonField(d["previous_address"]),
    current_employer_1: jsonField(d["current_employer_1"]),
    current_employer_2: jsonField(d["current_employer_2"]),
    previous_employer_1: jsonField(d["previous_employer_1"]),
    previous_employer_2: jsonField(d["previous_employer_2"]),
    other_income_amount: num(d["other_income_amount"]),
    other_income_source: nz(d["other_income_source"], 160),
    applicant_references: jsonField(d["references"]),
    apr: num(d["apr"]),
    estimated_payment: num(d["estimated_payment"]),
    application: d as Json,
  };

  try {
    await rest("mc_financing", { method: "POST", profile: "mycarco_db", body: extended });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    // PGRST204 = column not found: the extended migration has not been run yet.
    if (!/PGRST204|column .* does not exist/i.test(message)) throw err;
    await rest("mc_financing", { method: "POST", profile: "mycarco_db", body: base });
  }
}


/** Mirror a save/unsave into mycarco_db.mc_saved_cars. */
export async function mirrorSavedCar(
  userId: string,
  vehicleId: string,
  action: "save" | "unsave",
): Promise<{ mirrored: boolean }> {
  const [legacyUserId, legacyCarId] = await Promise.all([
    resolveLegacyUserId({ userId }),
    resolveLegacyCarId(vehicleId),
  ]);
  if (!legacyUserId || !legacyCarId) return { mirrored: false };

  if (action === "save") {
    await rest("mc_saved_cars", {
      method: "POST",
      profile: "mycarco_db",
      prefer: "resolution=ignore-duplicates",
      body: { user_id: legacyUserId, car_id: legacyCarId },
    });
  } else {
    await rest(`mc_saved_cars?user_id=eq.${legacyUserId}&car_id=eq.${legacyCarId}`, {
      method: "DELETE",
      profile: "mycarco_db",
    });
  }
  return { mirrored: true };
}
