// Server-only CRUD helpers for the legacy `mycarco_db.mc_blog` table.
// The service-role key never leaves the server and the legacy schema is never
// exposed to the browser.

function creds() {
  const url = process.env["LEGACY_SUPABASE_URL"];
  const key = process.env["LEGACY_SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) throw new Error("Legacy backend credentials are not configured.");
  return { url, key };
}

type Profile = "public" | "mycarco_db";

async function rest(
  path: string,
  init: { method?: string; body?: unknown; profile?: Profile; prefer?: string } = {},
): Promise<unknown> {
  const c = creds();
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
  if (!res.ok) throw new Error(`Blog request failed (${res.status}): ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

export type LegacyBlogPost = {
  id: number;
  title: string;
  slug: string;
  category: string | null;
  excerpt: string | null;
  body: string | null;
  image_url: string | null;
  author_name: string | null;
  author_initials: string | null;
  author_color: string | null;
  read_time: number | null;
  status: string | null;
  published_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

/** Confirm the caller is signed in and has the owner/editor role. */
export async function requireStaff(token: string): Promise<string> {
  const c = creds();
  if (!token) throw new Error("Not signed in.");
  const res = await fetch(`${c.url}/auth/v1/user`, {
    headers: { apikey: c.key, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Not signed in.");
  const user = (await res.json()) as { id?: string };
  if (!user?.id) throw new Error("Not signed in.");

  const roles = (await rest(`user_roles?select=role&user_id=eq.${user.id}`, {
    profile: "public",
  })) as Array<{ role: string }>;
  const staff = (roles ?? []).some((r) => r.role === "owner" || r.role === "editor");
  if (!staff) throw new Error("Staff access required.");
  return user.id;
}

export type BlogInput = {
  title: string;
  slug: string;
  category: string | null;
  excerpt: string | null;
  body: string | null;
  image_url: string | null;
  author_name: string | null;
  author_initials: string | null;
  author_color: string | null;
  read_time: number | null;
  status: string;
};

export async function listPosts(): Promise<LegacyBlogPost[]> {
  return (await rest("mc_blog?select=*&order=created_at.desc", {
    profile: "mycarco_db",
  })) as LegacyBlogPost[];
}

export async function createPost(input: BlogInput): Promise<LegacyBlogPost> {
  const rows = (await rest("mc_blog", {
    method: "POST",
    profile: "mycarco_db",
    prefer: "return=representation",
    body: {
      ...input,
      published_at: input.status === "published" ? new Date().toISOString() : null,
    },
  })) as LegacyBlogPost[];
  return rows[0]!;
}

export async function updatePost(id: number, input: BlogInput): Promise<LegacyBlogPost> {
  const current = (await rest(`mc_blog?select=published_at,status&id=eq.${id}&limit=1`, {
    profile: "mycarco_db",
  })) as Array<{ published_at: string | null; status: string | null }>;
  const prev = current?.[0];
  const published_at =
    input.status === "published"
      ? (prev?.published_at ?? new Date().toISOString())
      : null;

  const rows = (await rest(`mc_blog?id=eq.${id}`, {
    method: "PATCH",
    profile: "mycarco_db",
    prefer: "return=representation",
    body: { ...input, published_at, updated_at: new Date().toISOString() },
  })) as LegacyBlogPost[];
  return rows[0]!;
}

export async function deletePost(id: number): Promise<void> {
  await rest(`mc_blog?id=eq.${id}`, { method: "DELETE", profile: "mycarco_db" });
}
