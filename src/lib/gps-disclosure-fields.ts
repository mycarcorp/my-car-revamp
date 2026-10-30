/**
 * Form 4 — Disclosure Statement and Agreement for GPS Installation: the deal
 * fields only this form uses ("gps.*"). Borrower, Co-Borrower, vehicle, dealer
 * and the document date are the shared deal fields and are NOT repeated here.
 *
 * Nothing here controls a device. A device ID is a record only; it stays
 * "not assigned" until authorized staff (in production, a verified backend
 * record) assign and verify one.
 *
 * Kept free of runtime imports so deal-model.ts can include these definitions.
 */
import type { FieldDef } from "./deal-model";

export const GPS_DEVICE_STATUSES = [
  { value: "not_assigned", label: "GPS device not assigned" },
  { value: "pending_verification", label: "Assigned — verification pending" },
  { value: "verified", label: "Verified by authorized staff" },
] as const;

export const GPS_DISCLOSURE_FIELD_DEFS: readonly FieldDef[] = [
  { key: "gps.deviceId", label: "GPS Device ID Number", kind: "text" },
  {
    key: "gps.deviceStatus",
    label: "GPS device assignment",
    kind: "choice",
    options: GPS_DEVICE_STATUSES,
  },
  {
    key: "gps.controller",
    label: "Device controller (only if different from the dealership)",
    kind: "text",
  },
  {
    key: "gps.assignee",
    label: "Designated assignee or representative (if applicable)",
    kind: "text",
  },
];
