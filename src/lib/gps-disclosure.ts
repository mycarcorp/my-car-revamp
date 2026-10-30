/**
 * Form 4 — Disclosure Statement and Agreement for GPS Installation: the eight
 * numbered provisions, their initials, statuses and signature locations.
 *
 * Structure follows the two-page reference (headings, numbering, blanks and
 * signature placement only). Its wording is NOT reproduced: every provision
 * shows "Approved GPS disclosure wording required" until counsel supplies the
 * authorized template. Provision titles below only organize the web form.
 *
 * This is a disclosure, not a telematics control panel: nothing here locates,
 * tracks, disables or otherwise acts on a vehicle or device.
 */
import type { SignatureRequirement, SignerRole } from "./bill-of-sale";
import { text, type Deal } from "./deal-model";

export const GPS_LEGAL_REVIEW =
  "GPS tracking, ignition interruption, default/reinstatement and privacy-waiver terms require qualified legal review for each state before use.";

export type GpsProvision = {
  number: number;
  /** Organizing title only — not replacement legal text. */
  title: string;
  /** Reference pages it spans. Provision 4 continues from page 1 to page 2. */
  pages: readonly number[];
  /** Flagged for qualified legal review. */
  legalReview?: boolean;
};

export const GPS_PROVISIONS: readonly GpsProvision[] = [
  {
    number: 1,
    title:
      "Installation and maintenance as a financing condition; the borrower's choice and consent",
    pages: [1],
  },
  {
    number: 2,
    title: "Device control, tracking-service payment, tampering or removal as a default",
    pages: [1],
    legalReview: true,
  },
  {
    number: 3,
    title: "Tampering or removal treated as concealment; effect on reinstatement",
    pages: [1],
    legalReview: true,
  },
  {
    number: 4,
    title:
      "Location tracking and ignition interruption after nonpayment; cure periods; privacy waiver; purpose of the device",
    pages: [1, 2],
    legalReview: true,
  },
  { number: 5, title: "Cost to replace or repair after tampering or removal", pages: [2] },
  { number: 6, title: "Assignment of the Contract and of this Agreement", pages: [2] },
  {
    number: 7,
    title: "Authorized maintenance, access for repairs and repair costs",
    pages: [2],
  },
  {
    number: 8,
    title: "Transfer of device control after all payments; optional anti-theft service",
    pages: [2],
  },
];

/**
 * Who initials each provision. The reference shows Borrower initials only;
 * whether a Co-Borrower also initials is decided by the approved template.
 * Change only with that approval.
 */
export const GPS_PROVISION_INITIAL_ROLES: readonly SignerRole[] = ["buyer"];

/** The creditor named in the provisions' blanks: the device controller when set, else the dealer. */
export function gpsCreditorName(deal: Deal): string {
  return text(deal, "gps.controller") || text(deal, "dealer.legalName");
}

export type GpsDeviceState = "not_assigned" | "pending_verification" | "verified";

export function gpsDeviceState(deal: Deal): GpsDeviceState {
  const status = text(deal, "gps.deviceStatus");
  if (status === "verified" && text(deal, "gps.deviceId")) return "verified";
  if (text(deal, "gps.deviceId")) return "pending_verification";
  return "not_assigned";
}

export type GpsIssue = { id: string; message: string };

export function gpsDisclosureIssues(deal: Deal): GpsIssue[] {
  const issues: GpsIssue[] = [];
  const status = text(deal, "gps.deviceStatus");
  const id = text(deal, "gps.deviceId");
  if (status === "verified" && !id)
    issues.push({
      id: "verified-without-id",
      message: "Marked verified, but no GPS Device ID is entered.",
    });
  if (status === "not_assigned" && id)
    issues.push({
      id: "id-but-unassigned",
      message: "A GPS Device ID is entered, but the device is marked not assigned.",
    });
  if (!text(deal, "vehicle.vin"))
    issues.push({
      id: "no-vin",
      message: "No vehicle VIN — the disclosure must identify the assigned vehicle.",
    });
  return issues;
}

// ------------------------------------------------------------
// Signatures (page 2). Provision initials are NOT signature locations: each is
// acknowledged on its own, never filled by adopting one signature.
// ------------------------------------------------------------

export const GPS_DISCLOSURE_SIGNATURES: readonly SignatureRequirement[] = [
  {
    id: "gps-p2-borrower",
    role: "buyer",
    page: 2,
    location: "BORROWER (Signature) / Date / BORROWER (Print Name)",
  },
  {
    id: "gps-p2-coborrower",
    role: "co_buyer",
    page: 2,
    location: "CO-BORROWER (Signature) / Date / CO-BORROWER (Print Name)",
    conditional: "co_buyer_included",
  },
];
