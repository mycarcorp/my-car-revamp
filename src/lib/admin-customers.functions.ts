import { createServerFn } from "@tanstack/react-start";

export type AdminCustomerRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: string | null;
  updated_at: string | null;
  legacy_user_id: number | null;
  roles: string[];
};

export const listCustomers = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string }) => {
    const accessToken = String(input?.accessToken ?? "");
    if (!accessToken) throw new Error("Not signed in.");
    return { accessToken };
  })
  .handler(async ({ data }): Promise<AdminCustomerRow[]> => {
    const { requireStaff } = await import("./legacy-blog.server");
    await requireStaff(data.accessToken);

    const url = process.env["LEGACY_SUPABASE_URL"];
    const key = process.env["LEGACY_SUPABASE_SERVICE_ROLE_KEY"];
    if (!url || !key) throw new Error("Legacy customer database credentials are not configured.");

    const response = await fetch(
      `${url}/rest/v1/mc_users?select=id,name,email,phone,avatar,role,created_at,updated_at&order=created_at.desc`,
      {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Accept-Profile": "mycarco_db",
        },
      },
    );
    if (!response.ok) {
      throw new Error(`Could not load legacy customers (${response.status}).`);
    }

    const users = (await response.json()) as Array<{
      id: number;
      name: string | null;
      email: string | null;
      phone: string | null;
      avatar: string | null;
      role: string | null;
      created_at: string | null;
      updated_at: string | null;
    }>;

    return users.map((user) => ({
      id: String(user.id),
      full_name: user.name,
      email: user.email,
      phone: user.phone,
      avatar_url: user.avatar,
      created_at: user.created_at,
      updated_at: user.updated_at,
      legacy_user_id: user.id,
      roles: user.role ? [user.role] : [],
    }));
  });
