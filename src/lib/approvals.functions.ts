import { createServerFn } from "@tanstack/react-start";
import { TOKEN_RE, cleanDecisions, type ApprovalItem, type ApprovalMedia, type Decision } from "./approvals";

export type PublicApproval = {
  roNo: string;
  customerFirstName: string;
  vehicle: string;
  miles: number | null;
  advisor: string | null;
  shopPhone: string | null;
  notes: string | null;
  items: ApprovalItem[];
  media: (ApprovalMedia & { url: string })[];
  decisions: Record<string, Decision>;
  status: "sent" | "viewed" | "responded" | "cancelled";
  signedName: string | null;
  respondedAt: string | null;
  expired: boolean;
};

const token = (input: { token: string }) => {
  const t = String(input?.token ?? "").toLowerCase();
  if (!TOKEN_RE.test(t)) throw new Error("This approval link is not valid.");
  return t;
};

async function load(t: string) {
  const { appAdmin } = await import("./app-admin.server");
  const supabase = appAdmin();
  const { data } = await supabase.from("service_approvals").select("*").eq("token", t).maybeSingle();
  return { supabase, row: data as Record<string, unknown> | null };
}

function toPublic(row: Record<string, unknown>, t: string): PublicApproval {
  const media = (Array.isArray(row["media"]) ? row["media"] : []) as ApprovalMedia[];
  const ext = (type: string) => ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov" })[type] ?? "jpg";
  return {
    roNo: String(row["ro_no"]),
    // First name only: the link may be forwarded, so the page shows as little personal data as possible.
    customerFirstName: String(row["customer_name"] ?? "").split(/\s+/)[0] ?? "",
    vehicle: String(row["vehicle"]),
    miles: (row["miles"] as number | null) ?? null,
    advisor: (row["advisor"] as string | null) ?? null,
    shopPhone: (row["shop_phone"] as string | null) ?? null,
    notes: (row["notes"] as string | null) ?? null,
    items: (row["items"] as ApprovalItem[]) ?? [],
    media: media.map((m) => ({ ...m, url: `/api/public/approval-media/${t}/${m.n}.${ext(m.type)}` })),
    decisions: (row["decisions"] as Record<string, Decision>) ?? {},
    status: row["status"] as PublicApproval["status"],
    signedName: (row["signed_name"] as string | null) ?? null,
    respondedAt: (row["responded_at"] as string | null) ?? null,
    expired: new Date(String(row["expires_at"])).getTime() < Date.now(),
  };
}

export const getApproval = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string }) => ({ token: token(input) }))
  .handler(async ({ data }): Promise<PublicApproval | null> => {
    const { supabase, row } = await load(data.token);
    if (!row || row["status"] === "cancelled") return null;
    if (row["status"] === "sent") {
      await supabase.from("service_approvals").update({ status: "viewed", viewed_at: new Date().toISOString() }).eq("token", data.token);
      row["status"] = "viewed";
    }
    return toPublic(row, data.token);
  });

export const respondApproval = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string; decisions: Record<string, string>; signedName: string }) => ({
    token: token(input),
    decisions: input?.decisions ?? {},
    signedName: String(input?.signedName ?? "").trim().slice(0, 120),
  }))
  .handler(async ({ data }): Promise<PublicApproval> => {
    if (data.signedName.length < 2) throw new Error("Type your full name to sign.");
    const { supabase, row } = await load(data.token);
    if (!row || row["status"] === "cancelled") throw new Error("This approval is no longer available. Please call the shop.");
    if (row["status"] === "responded") throw new Error("You already responded. Call the shop to make a change.");
    if (new Date(String(row["expires_at"])).getTime() < Date.now()) throw new Error("This approval has expired. Please call the shop.");
    const items = (row["items"] as ApprovalItem[]) ?? [];
    const decisions = cleanDecisions(items, data.decisions);
    if (!decisions) throw new Error("Choose approve or decline for every item.");
    const patch = { decisions, signed_name: data.signedName, status: "responded", responded_at: new Date().toISOString() };
    // The status filter makes the first response win if two tabs submit at once.
    const { data: updated, error } = await supabase
      .from("service_approvals")
      .update(patch)
      .eq("token", data.token)
      .neq("status", "responded")
      .select("*")
      .maybeSingle();
    if (error || !updated) throw new Error("Your response could not be saved. Please call the shop.");
    return toPublic(updated as Record<string, unknown>, data.token);
  });
