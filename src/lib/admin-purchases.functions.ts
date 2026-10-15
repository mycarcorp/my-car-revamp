import { createServerFn } from "@tanstack/react-start";
import { isPurchaseStatus, statusLabel, type Purchase, type PurchaseEvent } from "./purchase-flow";

const token = (input: unknown) => {
  const t = String((input as { accessToken?: string })?.accessToken ?? "");
  if (!t) throw new Error("Not signed in.");
  return t;
};

export const adminListPurchases = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string }) => ({ accessToken: token(input) }))
  .handler(async ({ data }): Promise<Purchase[]> => {
    const { requireStaffUser, rest } = await import("./purchases.server");
    await requireStaffUser(data.accessToken);
    return rest<Purchase[]>("mc_purchases?select=*&order=updated_at.desc&limit=1000");
  });

export const adminGetPurchase = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string; id: number }) => ({ accessToken: token(input), id: Number(input?.id) }))
  .handler(async ({ data }): Promise<{ purchase: Purchase; events: PurchaseEvent[] } | null> => {
    const { requireStaffUser, getPurchaseRow, listEvents } = await import("./purchases.server");
    await requireStaffUser(data.accessToken);
    const purchase = await getPurchaseRow(data.id);
    if (!purchase) return null;
    return { purchase, events: await listEvents(purchase.id, false) };
  });

export const adminUpdatePurchase = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { accessToken: string; id: number; status?: string; assignedTo?: string | null; customerMessage?: string }) => {
      if (input?.status !== undefined && !isPurchaseStatus(input.status)) throw new Error("Unknown status.");
      return {
        accessToken: token(input),
        id: Number(input?.id),
        status: input?.status,
        assignedTo: input?.assignedTo === undefined ? undefined : String(input.assignedTo ?? "").trim().slice(0, 255) || null,
        customerMessage: String(input?.customerMessage ?? "").trim().slice(0, 2000),
      };
    },
  )
  .handler(async ({ data }): Promise<Purchase> => {
    const { requireStaffUser, getPurchaseRow, rest, addEvent } = await import("./purchases.server");
    const staff = await requireStaffUser(data.accessToken);
    const p = await getPurchaseRow(data.id);
    if (!p) throw new Error("Purchase not found.");
    const body: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.status && data.status !== p.status) body["status"] = data.status;
    if (data.assignedTo !== undefined) body["assigned_to"] = data.assignedTo;
    const rows = await rest<Purchase[]>(`mc_purchases?id=eq.${p.id}`, {
      method: "PATCH",
      prefer: "return=representation",
      body,
    });
    if (body["status"]) {
      await addEvent({
        purchase_id: p.id,
        event_type: "status_change",
        message: `Status changed to ${statusLabel(String(body["status"]))}.${data.customerMessage ? ` ${data.customerMessage}` : ""}`,
        visible_to_customer: true,
        author: staff.email,
      });
    }
    if (data.assignedTo !== undefined && data.assignedTo !== p.assigned_to) {
      await addEvent({
        purchase_id: p.id,
        event_type: "note",
        message: data.assignedTo ? `Assigned to ${data.assignedTo}.` : "Unassigned.",
        visible_to_customer: false,
        author: staff.email,
      });
    }
    return rows[0]!;
  });

export const adminAddPurchaseNote = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string; id: number; message: string; visibleToCustomer: boolean }) => {
    const message = String(input?.message ?? "").trim().slice(0, 4000);
    if (!message) throw new Error("Write a note first.");
    return { accessToken: token(input), id: Number(input?.id), message, visible: Boolean(input?.visibleToCustomer) };
  })
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { requireStaffUser, getPurchaseRow, addEvent } = await import("./purchases.server");
    const staff = await requireStaffUser(data.accessToken);
    const p = await getPurchaseRow(data.id);
    if (!p) throw new Error("Purchase not found.");
    await addEvent({
      purchase_id: p.id,
      event_type: "note",
      message: data.message,
      visible_to_customer: data.visible,
      author: staff.email,
    });
    return { ok: true };
  });
