// Non-component helpers shared by the Lease to Own pages.
import { toast } from "sonner";

import type { LeaseDocStatus, PackageEstimate } from "@/lib/lease-to-own";
import type { AgreementContext } from "@/lib/lease-to-own-content";
import { getMyLeaseDocumentUrl } from "@/lib/lease-to-own.functions";
import { leaseErrorMessage } from "@/lib/lease-to-own-client";
import { usd } from "@/lib/lease-to-own";

export const STATUS_TONES: Record<
  LeaseDocStatus,
  "neutral" | "info" | "success" | "warning" | "danger"
> = {
  pending: "neutral",
  uploaded: "info",
  under_review: "warning",
  verified: "success",
  rejected: "danger",
};

export const formatCents = (cents: number | null | undefined) =>
  cents == null ? "—" : usd(cents / 100, true);

export const humanize = (value: string) =>
  value.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

export function draftContext(input: {
  name: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  vehicleTitle: string | null;
  vehicleVin: string | null;
  estimate: PackageEstimate;
}): AgreementContext {
  return {
    customerName: input.name,
    customerAddress: [input.street, input.city, `${input.state} ${input.zip}`.trim()]
      .filter(Boolean)
      .join(", "),
    vehicleTitle: input.vehicleTitle,
    vehicleVin: input.vehicleVin,
    estimate: input.estimate,
  };
}

export async function openLeaseDocument(accessToken: string, documentId: number) {
  // Open the tab synchronously so pop-up blockers allow it, then point it at the signed URL.
  const win = window.open("about:blank", "_blank");
  try {
    const { url } = await getMyLeaseDocumentUrl({ data: { accessToken, documentId } });
    if (win) win.location.href = url;
    else window.location.href = url;
  } catch (error) {
    win?.close();
    toast.error(leaseErrorMessage(error));
  }
}
