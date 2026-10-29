// Browser-only helpers for the Lease to Own flow.
import {
  APP_SUPABASE_PUBLISHABLE_KEY,
  APP_SUPABASE_URL,
} from "@/integrations/supabase/runtime-config";
import {
  LEASE_CONSENTS_PENDING_APPROVAL,
  LEASE_SECURE_COLLECTION_UNAVAILABLE,
  LEASE_SETUP_PENDING,
  clampVehicleValue,
  isLeaseTierKey,
  type ApplicantRole,
  type LeaseDocType,
  type LeaseTierKey,
} from "./lease-to-own";
import {
  completeLeaseDocumentUpload,
  startLeaseDocumentUpload,
  type MyLeaseApplication,
} from "./lease-to-own.functions";

export function isLeaseSetupPending(error: unknown): boolean {
  return error instanceof Error && error.message.includes(LEASE_SETUP_PENDING);
}

export function leaseErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return "Something went wrong. Please call us at (540) 426-3322.";
  if (error.message.includes(LEASE_SETUP_PENDING)) {
    return "Online Lease to Own applications are still being set up. Please call us at (540) 426-3322 to apply.";
  }
  if (error.message.includes(LEASE_SECURE_COLLECTION_UNAVAILABLE)) {
    return "Secure collection of SSNs and license numbers isn't available yet, so nothing was submitted. Please call us at (540) 426-3322.";
  }
  if (error.message.includes(LEASE_CONSENTS_PENDING_APPROVAL)) {
    return "Online pre-qualification opens once our application disclosures are finalized. Nothing was submitted. Please call us at (540) 426-3322.";
  }
  return error.message;
}

/** PUTs a file to a one-time signed storage URL, reporting progress 0–100. */
export function uploadToSignedUrl(
  url: string,
  file: File,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const body = new FormData();
    body.append("cacheControl", "3600");
    body.append("", file);
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("x-upsert", "false");
    // Only send the app's publishable key to the app's own project.
    if (url.startsWith(`${APP_SUPABASE_URL}/`))
      xhr.setRequestHeader("apikey", APP_SUPABASE_PUBLISHABLE_KEY);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error("Upload failed. Please try again."));
    xhr.onerror = () => reject(new Error("Upload failed. Check your connection and try again."));
    xhr.send(body);
  });
}

/**
 * Uploads one document through the existing private flow: the server issues a
 * one-time signed URL for the caller's own application, the file goes straight
 * to private storage, and the server confirms the stored object before the
 * document counts as uploaded. Returns the server's view of the application.
 */
export async function uploadLeaseDocument(input: {
  accessToken: string;
  applicationId: number;
  applicantRole: ApplicantRole;
  docType: LeaseDocType;
  file: File;
  onProgress: (percent: number) => void;
}): Promise<MyLeaseApplication> {
  const { accessToken, applicationId, applicantRole, docType, file } = input;
  const { documentId, uploadUrl } = await startLeaseDocumentUpload({
    data: { accessToken, applicationId, applicantRole, docType, mime: file.type, size: file.size },
  });
  await uploadToSignedUrl(uploadUrl, file, input.onProgress);
  return completeLeaseDocumentUpload({ data: { accessToken, documentId } });
}

// ------------------------------------------------------------
// Return to the application after the existing sign-in flow
// ------------------------------------------------------------

const RETURN_KEY = "mycar.leaseApplyReturn";
const RETURN_TTL_MS = 30 * 60 * 1000;

export type LeaseApplyReturn = { tier: LeaseTierKey; value: number; vehicle?: string };

/**
 * Remembers ONLY the non-sensitive package choice so a Google sign-in redirect can
 * bring the applicant back. Applicant details are never written to storage.
 */
export function rememberLeaseApplyReturn(input: LeaseApplyReturn): void {
  try {
    sessionStorage.setItem(
      RETURN_KEY,
      JSON.stringify({
        tier: input.tier,
        value: input.value,
        vehicle: input.vehicle,
        at: Date.now(),
      }),
    );
  } catch {
    // Storage unavailable: email/password sign-in still works in place.
  }
}

export function clearLeaseApplyReturn(): void {
  try {
    sessionStorage.removeItem(RETURN_KEY);
  } catch {
    // Nothing to clear.
  }
}

/** Reads and clears the pending return, validating every field. */
export function consumeLeaseApplyReturn(): LeaseApplyReturn | null {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(RETURN_KEY);
    sessionStorage.removeItem(RETURN_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as {
      tier?: unknown;
      value?: unknown;
      vehicle?: unknown;
      at?: unknown;
    };
    if (typeof parsed.at !== "number" || Date.now() - parsed.at > RETURN_TTL_MS) return null;
    if (!isLeaseTierKey(parsed.tier)) return null;
    const vehicle =
      typeof parsed.vehicle === "string" && /^[a-z0-9-]{1,200}$/i.test(parsed.vehicle)
        ? parsed.vehicle
        : undefined;
    return {
      tier: parsed.tier,
      value: clampVehicleValue(parsed.value),
      ...(vehicle ? { vehicle } : {}),
    };
  } catch {
    return null;
  }
}
