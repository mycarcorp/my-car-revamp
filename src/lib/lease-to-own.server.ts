// Server-only data access for Lease to Own (mycarco_db.mc_lease_*).
// Driver's license numbers are encrypted here before they are stored and are
// never returned to any browser. SSN/ITIN is never handled by this app: it is
// reserved for an approved identity provider that returns only a reference. Documents live in a
// private bucket and are reached only through short-lived signed URLs issued
// after an ownership or staff check.
import { appAdminCreds } from "./app-admin.server";
import { PURCHASE_SETUP_PENDING } from "./purchase-flow";
import { rest, requireStaffUser, requireUser } from "./purchases.server";
import { LEASE_SECURE_COLLECTION_UNAVAILABLE, LEASE_SETUP_PENDING } from "./lease-to-own";

export { requireStaffUser, requireUser };

export const LEASE_DOCUMENT_BUCKET = "lease-documents";

/**
 * mycarco_db REST call that reports missing tables/columns as LEASE_SETUP_PENDING.
 * Database error text is never passed on: Postgres can echo the failing row
 * ("Failing row contains (...)"), which would include applicant data.
 */
export async function leaseRest<T = unknown>(
  path: string,
  init: Parameters<typeof rest>[1] = {},
): Promise<T> {
  try {
    return await rest<T>(path, init);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (
      message === PURCHASE_SETUP_PENDING ||
      /PGRST204|Could not find the '.*' column/.test(message)
    )
      throw new Error(LEASE_SETUP_PENDING);
    const status = /Request failed \((\d+)\)/.exec(message)?.[1] ?? "unknown";
    const code = /"code":"([A-Z0-9]+)"/.exec(message)?.[1] ?? "";
    console.error(`[lease-to-own] database request failed (${status}${code ? ` ${code}` : ""})`);
    throw new Error("We couldn't save that right now. Please try again or call (540) 426-3322.");
  }
}

// ------------------------------------------------------------
// Field-level encryption (AES-256-GCM)
// ------------------------------------------------------------

function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function piiKey(): Promise<CryptoKey> {
  const raw = process.env["LEASE_PII_ENCRYPTION_KEY"];
  if (!raw) throw new Error(LEASE_SECURE_COLLECTION_UNAVAILABLE);
  let bytes: Uint8Array<ArrayBuffer>;
  try {
    bytes = base64ToBytes(raw.trim());
  } catch {
    throw new Error(LEASE_SECURE_COLLECTION_UNAVAILABLE);
  }
  if (bytes.length !== 32) throw new Error(LEASE_SECURE_COLLECTION_UNAVAILABLE);
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt"]);
}

export function secureCollectionConfigured(): boolean {
  const raw = process.env["LEASE_PII_ENCRYPTION_KEY"];
  if (!raw) return false;
  try {
    return base64ToBytes(raw.trim()).length === 32;
  } catch {
    return false;
  }
}

/** Returns `v1:<iv>:<ciphertext>`; decryption is intentionally not exposed by this app. */
export async function encryptPii(plain: string): Promise<string> {
  const key = await piiKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plain)),
  );
  return `v1:${bytesToBase64(iv)}:${bytesToBase64(cipher)}`;
}

// ------------------------------------------------------------
// Private document storage
// ------------------------------------------------------------

function storageHeaders(json = true): Record<string, string> {
  const { key } = appAdminCreds();
  return {
    apikey: key,
    ...(key.split(".").length === 3 ? { Authorization: `Bearer ${key}` } : {}),
    ...(json ? { "Content-Type": "application/json" } : {}),
  };
}

async function storage(path: string, init: RequestInit = {}): Promise<Response> {
  const { url } = appAdminCreds();
  return fetch(`${url}/storage/v1/${path}`, {
    ...init,
    headers: { ...storageHeaders(), ...(init.headers as Record<string, string> | undefined) },
    signal: AbortSignal.timeout(25000),
  });
}

let bucketReady = false;

export async function ensureDocumentBucket(): Promise<void> {
  if (bucketReady) return;
  const found = await storage(`bucket/${LEASE_DOCUMENT_BUCKET}`);
  if (found.ok) {
    const bucket = (await found.json()) as { public?: boolean };
    if (bucket.public) throw new Error("Lease document storage must be private.");
    bucketReady = true;
    return;
  }
  if (found.status !== 404 && found.status !== 400)
    throw new Error(`Document storage unavailable (${found.status}).`);
  const created = await storage("bucket", {
    method: "POST",
    body: JSON.stringify({
      id: LEASE_DOCUMENT_BUCKET,
      name: LEASE_DOCUMENT_BUCKET,
      public: false,
      file_size_limit: 10 * 1024 * 1024,
      allowed_mime_types: [
        "application/pdf",
        "image/jpeg",
        "image/png",
        "image/heic",
        "image/heif",
        "image/webp",
      ],
    }),
  });
  if (!created.ok)
    throw new Error(`Could not prepare private document storage (${created.status}).`);
  bucketReady = true;
}

/** One-time upload URL for a single object path. */
export async function createSignedUploadUrl(path: string): Promise<string> {
  await ensureDocumentBucket();
  const response = await storage(`object/upload/sign/${LEASE_DOCUMENT_BUCKET}/${path}`, {
    method: "POST",
    body: "{}",
  });
  if (!response.ok) throw new Error(`Could not start the upload (${response.status}).`);
  const body = (await response.json()) as { url?: string };
  if (!body.url) throw new Error("Could not start the upload.");
  return `${appAdminCreds().url}/storage/v1${body.url}`;
}

/** Confirms the object exists with the expected size and type. */
export async function verifyStoredObject(
  path: string,
  expected: { size: number; mime: string },
): Promise<boolean> {
  const slash = path.lastIndexOf("/");
  const prefix = path.slice(0, slash);
  const name = path.slice(slash + 1);
  const response = await storage(`object/list/${LEASE_DOCUMENT_BUCKET}`, {
    method: "POST",
    body: JSON.stringify({ prefix, search: name, limit: 5 }),
  });
  if (!response.ok) return false;
  const objects = (await response.json()) as Array<{
    name: string;
    metadata?: { size?: number; mimetype?: string };
  }>;
  const found = objects.find((o) => o.name === name);
  if (!found) return false;
  const size = Number(found.metadata?.size ?? -1);
  return (
    size === expected.size &&
    (!found.metadata?.mimetype || found.metadata.mimetype === expected.mime)
  );
}

/** Short-lived download link. Callers must authorize first. */
export async function createSignedDownloadUrl(path: string, expiresIn = 60): Promise<string> {
  const response = await storage(`object/sign/${LEASE_DOCUMENT_BUCKET}/${path}`, {
    method: "POST",
    body: JSON.stringify({ expiresIn }),
  });
  if (!response.ok) throw new Error(`Could not open the document (${response.status}).`);
  const body = (await response.json()) as { signedURL?: string; signedUrl?: string };
  const signed = body.signedURL ?? body.signedUrl;
  if (!signed) throw new Error("Could not open the document.");
  return `${appAdminCreds().url}/storage/v1${signed}`;
}

// ------------------------------------------------------------
// Audit log
// ------------------------------------------------------------

export type LeaseAuditEntry = {
  actor_user_id: string | null;
  actor_email: string | null;
  actor_role: "customer" | "staff" | "system";
  action: string;
  entity: string;
  entity_id: string | null;
  /** Never put SSN, license numbers, DOB, bank data or file contents here. */
  details?: Record<string, string | number | boolean | null>;
};

export async function audit(entry: LeaseAuditEntry): Promise<void> {
  try {
    await leaseRest("mc_lease_audit_log", {
      method: "POST",
      body: { ...entry, details: entry.details ?? {} },
    });
  } catch (error) {
    console.error(
      "[lease-to-own] audit write failed",
      entry.action,
      error instanceof Error ? error.message : error,
    );
  }
}
