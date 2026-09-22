import { createServerFn } from "@tanstack/react-start";

export type AdminPosition = {
  id: number;
  name: string;
  description: string | null;
  responsibilities: string[];
  created_at: string | null;
  updated_at: string | null;
};

function token(input: { accessToken?: string }): string {
  const accessToken = String(input?.accessToken ?? "");
  if (!accessToken) throw new Error("Not signed in.");
  return accessToken;
}

function cleanResponsibilities(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item ?? "").trim())
    .filter(Boolean)
    .slice(0, 50);
}

export const listPositions = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string }) => ({ accessToken: token(input) }))
  .handler(async ({ data }): Promise<AdminPosition[]> => {
    const { requireStaff } = await import("./legacy-blog.server");
    await requireStaff(data.accessToken);
    const { listPositionRows } = await import("./admin-team.server");
    return listPositionRows();
  });

export const savePosition = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      accessToken: string;
      id?: number | null;
      name: string;
      description?: string | null;
      responsibilities?: string[];
    }) => {
      const name = String(input?.name ?? "").trim();
      if (!name) throw new Error("A position name is required.");
      const description = String(input?.description ?? "").trim();
      return {
        accessToken: token(input),
        id: input?.id ?? null,
        name,
        description: description ? description : null,
        responsibilities: cleanResponsibilities(input?.responsibilities),
      };
    },
  )
  .handler(async ({ data }): Promise<AdminPosition> => {
    const { requireStaff } = await import("./legacy-blog.server");
    await requireStaff(data.accessToken);
    const { createPositionRow, updatePositionRow } = await import("./admin-team.server");
    const payload = {
      name: data.name,
      description: data.description,
      responsibilities: data.responsibilities,
    };
    return data.id ? updatePositionRow(Number(data.id), payload) : createPositionRow(payload);
  });

export const deletePosition = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string; id: number }) => {
    const id = Number(input?.id);
    if (!Number.isFinite(id)) throw new Error("Unknown position.");
    return { accessToken: token(input), id };
  })
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { requireStaff } = await import("./legacy-blog.server");
    await requireStaff(data.accessToken);
    const { deletePositionRow } = await import("./admin-team.server");
    await deletePositionRow(data.id);
    return { ok: true };
  });

export const setUserRole = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string; userId: number; role: "admin" | "customer" }) => {
    const userId = Number(input?.userId);
    if (!Number.isFinite(userId)) throw new Error("Unknown account.");
    const role = input?.role === "admin" ? "admin" : "customer";
    return { accessToken: token(input), userId, role: role as "admin" | "customer" };
  })
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { requireStaff } = await import("./legacy-blog.server");
    await requireStaff(data.accessToken);
    const { setUserRoleRow } = await import("./admin-team.server");
    await setUserRoleRow(data.userId, data.role);
    return { ok: true };
  });

export const setUserPosition = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string; userId: number; positionId: number | null }) => {
    const userId = Number(input?.userId);
    if (!Number.isFinite(userId)) throw new Error("Unknown account.");
    const raw = input?.positionId;
    const positionId = raw === null || raw === undefined || raw === 0 ? null : Number(raw);
    if (positionId !== null && !Number.isFinite(positionId)) throw new Error("Unknown position.");
    return { accessToken: token(input), userId, positionId };
  })
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { requireStaff } = await import("./legacy-blog.server");
    await requireStaff(data.accessToken);
    const { setUserPositionRow } = await import("./admin-team.server");
    await setUserPositionRow(data.userId, data.positionId);
    return { ok: true };
  });
