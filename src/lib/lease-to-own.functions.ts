import { createServerFn } from "@tanstack/react-start";
import {
  LEASE_DOC_STATUSES,
  MAINTENANCE_TIME_WINDOWS,
  clampVehicleValue,
  digitsOnly,
  documentsReadyForSigning,
  estimatePackage,
  getLeaseTier,
  isLeaseApplicationStatus,
  isLeaseDocType,
  isLeaseTierKey,
  normalizeLicenseNumber,
  normalizeApplicantInput,
  validateApplicant,
  validateDocumentFile,
  type ApplicantInput,
  type LeaseDocStatus,
  type LeaseDocType,
  type LeaseTierKey,
  type LeaseVaultDocType,
  type PaymentFrequency,
} from "./lease-to-own";

// ============================================================
// Shared input helpers
// ============================================================

const token = (input: unknown) => {
  const t = String((input as { accessToken?: string })?.accessToken ?? "");
  if (!t) throw new Error("Please sign in.");
  return t;
};
const clip = (v: unknown, max: number) => {
  const s = String(v ?? "").trim();
  return s ? s.slice(0, max) : null;
};
const validId = (v: unknown) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new Error("Invalid record.");
  return n;
};
const isoDate = (v: unknown) => {
  const s = String(v ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};
const cents = (dollars: number) => Math.round(dollars * 100);

/** Same attribution allowlist the GoHighLevel webhook uses. */
function safeAttribution(input: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!input || typeof input !== "object") return out;
  for (const [k, v] of Object.entries(input as Record<string, unknown>).slice(0, 80)) {
    if (
      /^(lead_source|lead_medium|utm_(source|medium|campaign|content|term)|referrer|landing_page|conversion_page|first_touch_\w+|last_touch_\w+)$/.test(
        k,
      ) ||
      ["fbclid", "gclid", "gbraid", "wbraid", "ttclid", "li_fat_id", "rdt_cid"].includes(k)
    ) {
      out[k.slice(0, 60)] = String(v ?? "").slice(0, 500);
    }
  }
  return out;
}

// ============================================================
// Types returned to the browser (never include encrypted fields)
// ============================================================

export type LeaseApplicationSummary = {
  id: number;
  status: string;
  tier: LeaseTierKey;
  vehicle_value_cents: number | null;
  down_payment_cents: number | null;
  payment_cents: number | null;
  payment_frequency: PaymentFrequency | null;
  installments: number | null;
  full_legal_name: string;
  email: string;
  cell_phone: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  vehicle_title: string | null;
  vehicle_vin: string | null;
  submitted_at: string;
  updated_at: string;
};

export type LeaseDocumentRow = {
  id: number;
  application_id: number;
  doc_type: LeaseVaultDocType;
  source: "customer" | "staff";
  status: LeaseDocStatus;
  mime_type: string;
  size_bytes: number;
  review_note: string | null;
  created_at: string;
  reviewed_at: string | null;
};

export type LeaseAgreementRow = {
  id: number;
  agreement_key: string;
  template_version: string;
  status: string;
  executed_at: string | null;
};

export type LeaseAccountRow = {
  id: number;
  account_number: string;
  status: string;
  payment_status: string;
  vehicle_title: string | null;
  vehicle_vin: string | null;
  tier: string | null;
  payment_cents: number | null;
  payment_frequency: PaymentFrequency | null;
  total_installments: number | null;
  completed_installments: number;
  current_balance_cents: number | null;
  next_payment_date: string | null;
  annual_mileage_allowance: number;
  start_odometer: number | null;
  verified_odometer: number | null;
  odometer_verified_at: string | null;
  lease_start_date: string | null;
};

export type LeasePaymentRow = {
  id: number;
  account_id: number;
  amount_cents: number;
  status: string;
  method: string | null;
  due_date: string | null;
  paid_at: string | null;
  receipt_document_id: number | null;
};

export type LeaseServiceRequestRow = {
  id: number;
  account_id: number | null;
  kind: "maintenance" | "emergency";
  requested_date: string | null;
  time_window: string | null;
  notes: string | null;
  status: string;
  staff_note: string | null;
  confirmed_at: string | null;
  created_at: string;
};

const APP_COLUMNS =
  "id,status,tier,vehicle_value_cents,down_payment_cents,payment_cents,payment_frequency,installments,full_legal_name,email,cell_phone,street,city,state,zip,vehicle_title,vehicle_vin,submitted_at,updated_at";
const DOC_COLUMNS =
  "id,application_id,doc_type,source,status,mime_type,size_bytes,review_note,created_at,reviewed_at";
const ACCOUNT_COLUMNS =
  "id,account_number,status,payment_status,vehicle_title,vehicle_vin,tier,payment_cents,payment_frequency,total_installments,completed_installments,current_balance_cents,next_payment_date,annual_mileage_allowance,start_odometer,verified_odometer,odometer_verified_at,lease_start_date";
const PAYMENT_COLUMNS =
  "id,account_id,amount_cents,status,method,due_date,paid_at,receipt_document_id";
const REQUEST_COLUMNS =
  "id,account_id,kind,requested_date,time_window,notes,status,staff_note,confirmed_at,created_at";

const OPEN_APPLICATION_STATUSES = "submitted,documents_pending,under_review,approved";

// ============================================================
// Integration status (no customer data)
// ============================================================

export type LeaseIntegrationStatus = {
  /** Server-side encryption for the driver's license number is configured. */
  secureCollection: boolean;
  /** An approved hosted SSN/ITIN collection provider is integrated. None is today. */
  ssnProvider: false;
  /** Each of these stays false until a real, approved provider is integrated. */
  esignProvider: false;
  approvedTemplates: false;
  paymentProcessor: false;
  schedulingBackend: false;
  telematicsProvider: false;
  dmsIntegration: false;
};

export const getLeaseIntegrationStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<LeaseIntegrationStatus> => {
    const { secureCollectionConfigured } = await import("./lease-to-own.server");
    return {
      secureCollection: secureCollectionConfigured(),
      ssnProvider: false,
      esignProvider: false,
      approvedTemplates: false,
      paymentProcessor: false,
      schedulingBackend: false,
      telematicsProvider: false,
      dmsIntegration: false,
    };
  },
);

// ============================================================
// Customer: application (Step 1)
// ============================================================

export type LeaseVehicleSnapshot = {
  id?: string | null;
  slug?: string | null;
  vin?: string | null;
  title?: string | null;
  price?: number | null;
};

export const submitLeaseApplication = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      accessToken: string;
      tier: string;
      vehicleValue: number;
      applicant: ApplicantInput;
      vehicle?: LeaseVehicleSnapshot | null;
      attribution?: Record<string, unknown>;
    }) => {
      if (!isLeaseTierKey(input?.tier)) throw new Error("Choose a package.");
      // Drops unknown keys, so an `ssn` sent by any client is discarded here.
      const applicant = normalizeApplicantInput(input?.applicant);
      const errors = validateApplicant(applicant);
      const first = Object.values(errors)[0];
      if (first) throw new Error(first);
      const v = input?.vehicle ?? null;
      const price = Number(v?.price);
      return {
        accessToken: token(input),
        tier: input.tier as LeaseTierKey,
        vehicleValue: clampVehicleValue(input?.vehicleValue),
        applicant,
        vehicle: v
          ? {
              id: clip(v.id, 80),
              slug: clip(v.slug, 200),
              vin: clip(v.vin, 40),
              title: clip(v.title, 255),
              price_cents: Number.isFinite(price) && price > 0 ? cents(price) : null,
            }
          : null,
        attribution: safeAttribution(input?.attribution),
      };
    },
  )
  .handler(async ({ data }): Promise<{ id: number; resumed: boolean }> => {
    const { requireUser, leaseRest, encryptPii, audit } = await import("./lease-to-own.server");
    const user = await requireUser(data.accessToken);

    const open = await leaseRest<Array<{ id: number }>>(
      `mc_lease_applications?select=id&user_id=eq.${user.id}&status=in.(${OPEN_APPLICATION_STATUSES})&order=created_at.desc&limit=1`,
    );
    if (open?.[0]) return { id: open[0].id, resumed: true };

    // Encrypt before anything is written; fails closed if no key is configured.
    const dlEncrypted = await encryptPii(data.applicant.driversLicenseNumber);
    // Recompute server-side; never trust client-supplied amounts.
    const estimate = estimatePackage(data.tier, data.vehicleValue);
    const now = new Date().toISOString();
    const created = await leaseRest<Array<{ id: number }>>("mc_lease_applications", {
      method: "POST",
      prefer: "return=representation",
      body: {
        user_id: user.id,
        status: "documents_pending",
        tier: data.tier,
        vehicle_value_cents: cents(estimate.vehicleValue),
        down_payment_cents: cents(estimate.downPayment),
        payment_cents: cents(estimate.payment),
        payment_frequency: estimate.frequency,
        installments: estimate.installments,
        estimate_basis: estimate.basis,
        full_legal_name: data.applicant.fullLegalName,
        date_of_birth: data.applicant.dateOfBirth,
        email: data.applicant.email,
        cell_phone: data.applicant.cellPhone,
        // SSN/ITIN is never accepted here; an approved identity provider will collect it
        // through its own hosted field and record only its reference and status.
        ssn_collection_status: "not_collected",
        dl_number_encrypted: dlEncrypted,
        dl_last4: data.applicant.driversLicenseNumber.slice(-4),
        dl_state: data.applicant.driversLicenseState,
        // No identity-verification provider is connected; staff verify against the uploaded ID.
        dl_verification_status: "not_verified",
        street: data.applicant.street,
        city: data.applicant.city,
        state: data.applicant.state,
        zip: data.applicant.zip,
        vehicle_id: data.vehicle?.id ?? null,
        vehicle_slug: data.vehicle?.slug ?? null,
        vehicle_vin: data.vehicle?.vin ?? null,
        vehicle_title: data.vehicle?.title ?? null,
        vehicle_price_cents: data.vehicle?.price_cents ?? null,
        attribution: data.attribution,
        submitted_at: now,
        updated_at: now,
      },
    });
    const id = created[0]!.id;
    await audit({
      actor_user_id: user.id,
      actor_email: user.email,
      actor_role: "customer",
      action: "application_submitted",
      entity: "application",
      entity_id: String(id),
      details: { tier: data.tier },
    });

    // Non-sensitive lead for the CRM — no SSN, DOB, license, bank or document data.
    const tier = getLeaseTier(data.tier);
    const leadDetails = {
      request_kind: "lease_to_own",
      lead_source_detail: "MyCar Website — Lease to Own",
      application_id: id,
      application_stage: "application_submitted",
      financing_tier: tier.name,
      down_payment: estimate.downPayment,
      payment_amount: estimate.payment,
      payment_frequency: estimate.frequency,
      installments: estimate.installments,
      vehicle_value: estimate.vehicleValue,
      vehicle_of_interest: data.vehicle?.title ?? "",
      vehicle_vin: data.vehicle?.vin ?? "",
      estimate_basis: estimate.basis,
      ...data.attribution,
    };
    let leadId: string | null = null;
    const isUuid = /^[0-9a-f-]{36}$/i.test(data.vehicle?.id ?? "");
    for (const lead_type of ["lease_to_own", "finance"]) {
      try {
        const rows = await leaseRest<Array<{ id: string }>>("leads", {
          method: "POST",
          profile: "public",
          prefer: "return=representation",
          body: {
            lead_type,
            status: "new",
            full_name: data.applicant.fullLegalName,
            email: data.applicant.email,
            phone: data.applicant.cellPhone,
            message: `Lease to Own application: ${tier.name}`,
            user_id: user.id,
            vehicle_id: isUuid ? data.vehicle?.id : null,
            details: leadDetails,
          },
        });
        leadId = rows?.[0]?.id ?? null;
        break;
      } catch (e) {
        console.error(
          "[lease-to-own] lead insert failed",
          lead_type,
          e instanceof Error ? e.message : e,
        );
      }
    }
    if (leadId) {
      await leaseRest(`mc_lease_applications?id=eq.${id}`, {
        method: "PATCH",
        body: { lead_id: leadId },
      }).catch(() => undefined);
    }
    try {
      const { postToGhl } = await import("./ghl-webhook.server");
      const [firstName, ...rest] = data.applicant.fullLegalName.split(" ");
      await postToGhl({
        event_type: "lease_to_own_application",
        source: "MyCar Website — Lease to Own",
        full_name: data.applicant.fullLegalName,
        first_name: firstName ?? "",
        last_name: rest.join(" "),
        email: data.applicant.email,
        phone: data.applicant.cellPhone,
        financing_tier: tier.name,
        down_payment: String(estimate.downPayment),
        payment_amount: String(estimate.payment),
        payment_frequency: estimate.frequency,
        vehicle_of_interest: data.vehicle?.title ?? "",
        vin: data.vehicle?.vin ?? "",
        application_stage: "application_submitted",
        submitted_at: now,
        ...data.attribution,
      });
    } catch (e) {
      console.error("[lease-to-own] GHL delivery failed", e instanceof Error ? e.message : e);
    }
    return { id, resumed: false };
  });

export type MyLeaseApplication = {
  application: LeaseApplicationSummary;
  documents: LeaseDocumentRow[];
  agreements: LeaseAgreementRow[];
} | null;

async function loadMyApplication(userId: string): Promise<MyLeaseApplication> {
  const { leaseRest } = await import("./lease-to-own.server");
  const apps = await leaseRest<LeaseApplicationSummary[]>(
    `mc_lease_applications?select=${APP_COLUMNS}&user_id=eq.${userId}&order=created_at.desc&limit=1`,
  );
  const application = apps?.[0];
  if (!application) return null;
  const [documents, agreements] = await Promise.all([
    leaseRest<LeaseDocumentRow[]>(
      `mc_lease_documents?select=${DOC_COLUMNS}&application_id=eq.${application.id}&user_id=eq.${userId}&superseded_at=is.null&order=created_at.desc`,
    ),
    leaseRest<LeaseAgreementRow[]>(
      `mc_lease_agreements?select=id,agreement_key,template_version,status,executed_at&application_id=eq.${application.id}`,
    ),
  ]);
  return { application, documents: documents ?? [], agreements: agreements ?? [] };
}

export const getMyLeaseApplication = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string }) => ({ accessToken: token(input) }))
  .handler(async ({ data }): Promise<MyLeaseApplication> => {
    const { requireUser } = await import("./lease-to-own.server");
    const user = await requireUser(data.accessToken);
    return loadMyApplication(user.id);
  });

// ============================================================
// Customer: documents (Step 2)
// ============================================================

const EXTENSIONS: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/webp": "webp",
};

export const startLeaseDocumentUpload = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      accessToken: string;
      applicationId: number;
      docType: string;
      mime: string;
      size: number;
    }) => {
      if (!isLeaseDocType(input?.docType)) throw new Error("Unknown document type.");
      const mime = String(input?.mime ?? "");
      const size = Number(input?.size);
      const problem = validateDocumentFile({ type: mime, size });
      if (problem) throw new Error(problem);
      return {
        accessToken: token(input),
        applicationId: validId(input.applicationId),
        docType: input.docType as LeaseDocType,
        mime,
        size,
      };
    },
  )
  .handler(async ({ data }): Promise<{ documentId: number; uploadUrl: string }> => {
    const { requireUser, leaseRest, createSignedUploadUrl } = await import("./lease-to-own.server");
    const user = await requireUser(data.accessToken);
    const apps = await leaseRest<Array<{ id: number; status: string }>>(
      `mc_lease_applications?select=id,status&id=eq.${data.applicationId}&user_id=eq.${user.id}&limit=1`,
    );
    const app = apps?.[0];
    if (!app) throw new Error("Application not found.");
    if (["declined", "withdrawn"].includes(app.status))
      throw new Error("This application is closed.");
    const path = `${user.id}/${app.id}/${data.docType}/${crypto.randomUUID()}.${EXTENSIONS[data.mime] ?? "bin"}`;
    const uploadUrl = await createSignedUploadUrl(path);
    const rows = await leaseRest<Array<{ id: number }>>("mc_lease_documents", {
      method: "POST",
      prefer: "return=representation",
      body: {
        application_id: app.id,
        user_id: user.id,
        doc_type: data.docType,
        source: "customer",
        status: "pending",
        storage_path: path,
        mime_type: data.mime,
        size_bytes: data.size,
      },
    });
    return { documentId: rows[0]!.id, uploadUrl };
  });

export const completeLeaseDocumentUpload = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string; documentId: number }) => ({
    accessToken: token(input),
    documentId: validId(input?.documentId),
  }))
  .handler(async ({ data }): Promise<MyLeaseApplication> => {
    const { requireUser, leaseRest, verifyStoredObject, audit } =
      await import("./lease-to-own.server");
    const user = await requireUser(data.accessToken);
    const docs = await leaseRest<
      Array<{
        id: number;
        application_id: number;
        doc_type: string;
        status: string;
        storage_path: string;
        mime_type: string;
        size_bytes: number;
      }>
    >(
      `mc_lease_documents?select=id,application_id,doc_type,status,storage_path,mime_type,size_bytes&id=eq.${data.documentId}&user_id=eq.${user.id}&source=eq.customer&limit=1`,
    );
    const doc = docs?.[0];
    if (!doc) throw new Error("Document not found.");
    if (doc.status === "pending") {
      const stored = await verifyStoredObject(doc.storage_path, {
        size: doc.size_bytes,
        mime: doc.mime_type,
      });
      if (!stored) throw new Error("We couldn't confirm the upload. Please try again.");
      const now = new Date().toISOString();
      // Supersede earlier copies of this document type, then mark this one uploaded.
      await leaseRest(
        `mc_lease_documents?application_id=eq.${doc.application_id}&user_id=eq.${user.id}&doc_type=eq.${doc.doc_type}&source=eq.customer&id=neq.${doc.id}&superseded_at=is.null`,
        { method: "PATCH", body: { superseded_at: now, updated_at: now } },
      );
      await leaseRest(`mc_lease_documents?id=eq.${doc.id}`, {
        method: "PATCH",
        body: { status: "uploaded", updated_at: now },
      });
      await audit({
        actor_user_id: user.id,
        actor_email: user.email,
        actor_role: "customer",
        action: "document_uploaded",
        entity: "document",
        entity_id: String(doc.id),
        details: { doc_type: doc.doc_type, application_id: doc.application_id },
      });
    }
    const result = await loadMyApplication(user.id);
    if (result && result.application.status === "documents_pending") {
      const statuses = Object.fromEntries(
        result.documents.map((d) => [d.doc_type, d.status]),
      ) as Partial<Record<LeaseDocType, LeaseDocStatus>>;
      if (documentsReadyForSigning(statuses)) {
        await leaseRest(`mc_lease_applications?id=eq.${result.application.id}`, {
          method: "PATCH",
          body: { status: "under_review", updated_at: new Date().toISOString() },
        });
        result.application.status = "under_review";
      }
    }
    return result;
  });

export const getMyLeaseDocumentUrl = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string; documentId: number }) => ({
    accessToken: token(input),
    documentId: validId(input?.documentId),
  }))
  .handler(async ({ data }): Promise<{ url: string }> => {
    const { requireUser, leaseRest, createSignedDownloadUrl, audit } =
      await import("./lease-to-own.server");
    const user = await requireUser(data.accessToken);
    const docs = await leaseRest<Array<{ id: number; storage_path: string; status: string }>>(
      `mc_lease_documents?select=id,storage_path,status&id=eq.${data.documentId}&user_id=eq.${user.id}&limit=1`,
    );
    const doc = docs?.[0];
    if (!doc || doc.status === "pending") throw new Error("Document not found.");
    const url = await createSignedDownloadUrl(doc.storage_path);
    await audit({
      actor_user_id: user.id,
      actor_email: user.email,
      actor_role: "customer",
      action: "document_downloaded",
      entity: "document",
      entity_id: String(doc.id),
    });
    return { url };
  });

// ============================================================
// Customer: portal
// ============================================================

export type MyLeasePortal = {
  application: LeaseApplicationSummary | null;
  account: LeaseAccountRow | null;
  payments: LeasePaymentRow[];
  requests: LeaseServiceRequestRow[];
  documents: LeaseDocumentRow[];
};

export const getMyLeasePortal = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string }) => ({ accessToken: token(input) }))
  .handler(async ({ data }): Promise<MyLeasePortal> => {
    const { requireUser, leaseRest } = await import("./lease-to-own.server");
    const user = await requireUser(data.accessToken);
    const [apps, accounts, requests, documents] = await Promise.all([
      leaseRest<LeaseApplicationSummary[]>(
        `mc_lease_applications?select=${APP_COLUMNS}&user_id=eq.${user.id}&order=created_at.desc&limit=1`,
      ),
      leaseRest<LeaseAccountRow[]>(
        `mc_lease_accounts?select=${ACCOUNT_COLUMNS}&user_id=eq.${user.id}&order=created_at.desc&limit=1`,
      ),
      leaseRest<LeaseServiceRequestRow[]>(
        `mc_lease_service_requests?select=${REQUEST_COLUMNS}&user_id=eq.${user.id}&order=created_at.desc&limit=50`,
      ),
      leaseRest<LeaseDocumentRow[]>(
        `mc_lease_documents?select=${DOC_COLUMNS}&user_id=eq.${user.id}&superseded_at=is.null&status=neq.pending&order=created_at.desc&limit=200`,
      ),
    ]);
    const account = accounts?.[0] ?? null;
    const payments = account
      ? await leaseRest<LeasePaymentRow[]>(
          `mc_lease_payments?select=${PAYMENT_COLUMNS}&account_id=eq.${account.id}&order=due_date.desc.nullslast&limit=200`,
        )
      : [];
    return {
      application: apps?.[0] ?? null,
      account,
      payments: payments ?? [],
      requests: requests ?? [],
      documents: documents ?? [],
    };
  });

async function requireOwnAccount(userId: string): Promise<{ id: number }> {
  const { leaseRest } = await import("./lease-to-own.server");
  const accounts = await leaseRest<Array<{ id: number; status: string }>>(
    `mc_lease_accounts?select=id,status&user_id=eq.${userId}&order=created_at.desc&limit=1`,
  );
  const account = accounts?.[0];
  if (!account || account.status === "closed")
    throw new Error("This is available once your lease account is active.");
  return account;
}

/** A request only — staff confirm availability. Nothing here books a slot. */
export const requestLeaseMaintenance = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { accessToken: string; date: string; timeWindow: string; notes?: string }) => {
      const date = isoDate(input?.date);
      if (!date) throw new Error("Choose a valid date.");
      if (date <= new Date().toISOString().slice(0, 10)) throw new Error("Choose a future date.");
      if (!(MAINTENANCE_TIME_WINDOWS as readonly string[]).includes(input?.timeWindow))
        throw new Error("Choose a time window.");
      return {
        accessToken: token(input),
        date,
        timeWindow: input.timeWindow,
        notes: clip(input?.notes, 1000),
      };
    },
  )
  .handler(async ({ data }): Promise<LeaseServiceRequestRow> => {
    const { requireUser, leaseRest, audit } = await import("./lease-to-own.server");
    const user = await requireUser(data.accessToken);
    const account = await requireOwnAccount(user.id);
    const rows = await leaseRest<LeaseServiceRequestRow[]>(
      `mc_lease_service_requests?select=${REQUEST_COLUMNS}`,
      {
        method: "POST",
        prefer: "return=representation",
        body: {
          user_id: user.id,
          account_id: account.id,
          kind: "maintenance",
          requested_date: data.date,
          time_window: data.timeWindow,
          notes: data.notes,
          status: "requested",
        },
      },
    );
    await audit({
      actor_user_id: user.id,
      actor_email: user.email,
      actor_role: "customer",
      action: "maintenance_requested",
      entity: "service_request",
      entity_id: String(rows[0]!.id),
    });
    return rows[0]!;
  });

export const requestLeaseEmergencyAssistance = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string; notes: string }) => {
    const notes = clip(input?.notes, 1000);
    if (!notes || notes.length < 10)
      throw new Error("Tell us briefly what's happening so we can help.");
    return { accessToken: token(input), notes };
  })
  .handler(async ({ data }): Promise<LeaseServiceRequestRow> => {
    const { requireUser, leaseRest, audit } = await import("./lease-to-own.server");
    const user = await requireUser(data.accessToken);
    const account = await requireOwnAccount(user.id);
    const rows = await leaseRest<LeaseServiceRequestRow[]>(
      `mc_lease_service_requests?select=${REQUEST_COLUMNS}`,
      {
        method: "POST",
        prefer: "return=representation",
        body: {
          user_id: user.id,
          account_id: account.id,
          kind: "emergency",
          notes: data.notes,
          status: "under_review",
        },
      },
    );
    await audit({
      actor_user_id: user.id,
      actor_email: user.email,
      actor_role: "customer",
      action: "emergency_requested",
      entity: "service_request",
      entity_id: String(rows[0]!.id),
    });
    return rows[0]!;
  });

// ============================================================
// Staff DMS
// ============================================================

export type StaffLeaseApplication = LeaseApplicationSummary & {
  ssn_last4: string | null;
  ssn_collection_status: string;
  dl_last4: string;
  dl_state: string;
  date_of_birth: string;
  staff_note: string | null;
  reviewed_by: string | null;
};
export type StaffLeaseDocument = LeaseDocumentRow & { reviewed_by: string | null };
export type StaffLeaseAccount = LeaseAccountRow & {
  user_id: string;
  dms_source: string | null;
  dms_external_id: string | null;
};
export type StaffServiceRequest = LeaseServiceRequestRow & {
  user_id: string;
  handled_by: string | null;
};
export type LeaseAuditRow = {
  id: number;
  actor_email: string | null;
  actor_role: string;
  action: string;
  entity: string;
  entity_id: string | null;
  details: Record<string, string | number | boolean | null>;
  created_at: string;
};

export type StaffLeaseOverview = {
  applications: StaffLeaseApplication[];
  documents: StaffLeaseDocument[];
  accounts: StaffLeaseAccount[];
  payments: LeasePaymentRow[];
  requests: StaffServiceRequest[];
  audit: LeaseAuditRow[];
};

export const staffLeaseOverview = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string }) => ({ accessToken: token(input) }))
  .handler(async ({ data }): Promise<StaffLeaseOverview> => {
    const { requireStaffUser, leaseRest } = await import("./lease-to-own.server");
    await requireStaffUser(data.accessToken);
    const [applications, documents, accounts, payments, requests, auditRows] = await Promise.all([
      leaseRest<StaffLeaseApplication[]>(
        `mc_lease_applications?select=${APP_COLUMNS},ssn_last4,ssn_collection_status,dl_last4,dl_state,date_of_birth,staff_note,reviewed_by&order=created_at.desc&limit=500`,
      ),
      leaseRest<StaffLeaseDocument[]>(
        `mc_lease_documents?select=${DOC_COLUMNS},reviewed_by&superseded_at=is.null&status=neq.pending&order=created_at.desc&limit=1000`,
      ),
      leaseRest<StaffLeaseAccount[]>(
        `mc_lease_accounts?select=${ACCOUNT_COLUMNS},user_id,dms_source,dms_external_id&order=updated_at.desc&limit=500`,
      ),
      leaseRest<LeasePaymentRow[]>(
        `mc_lease_payments?select=${PAYMENT_COLUMNS}&order=created_at.desc&limit=500`,
      ),
      leaseRest<StaffServiceRequest[]>(
        `mc_lease_service_requests?select=${REQUEST_COLUMNS},user_id,handled_by&order=created_at.desc&limit=500`,
      ),
      leaseRest<LeaseAuditRow[]>(
        "mc_lease_audit_log?select=id,actor_email,actor_role,action,entity,entity_id,details,created_at&order=created_at.desc&limit=200",
      ),
    ]);
    return {
      applications: applications ?? [],
      documents: documents ?? [],
      accounts: accounts ?? [],
      payments: payments ?? [],
      requests: requests ?? [],
      audit: auditRows ?? [],
    };
  });

export const staffUpdateLeaseApplication = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string; id: number; status: string; note?: string }) => {
    if (!isLeaseApplicationStatus(input?.status)) throw new Error("Unknown status.");
    return {
      accessToken: token(input),
      id: validId(input.id),
      status: input.status,
      note: clip(input?.note, 2000),
    };
  })
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { requireStaffUser, leaseRest, audit } = await import("./lease-to-own.server");
    const staff = await requireStaffUser(data.accessToken);
    const now = new Date().toISOString();
    const body: Record<string, unknown> = {
      status: data.status,
      reviewed_by: staff.email,
      updated_at: now,
    };
    if (data.note) body["staff_note"] = data.note;
    await leaseRest(`mc_lease_applications?id=eq.${data.id}`, { method: "PATCH", body });
    await audit({
      actor_user_id: staff.id,
      actor_email: staff.email,
      actor_role: "staff",
      action: "application_status_changed",
      entity: "application",
      entity_id: String(data.id),
      details: { status: data.status },
    });
    return { ok: true };
  });

export const staffReviewLeaseDocument = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { accessToken: string; documentId: number; status: string; note?: string }) => {
      const status = input?.status;
      if (
        !(LEASE_DOC_STATUSES as readonly string[]).includes(status) ||
        status === "pending" ||
        status === "uploaded"
      ) {
        throw new Error("Choose under review, verified or rejected.");
      }
      const note = clip(input?.note, 1000);
      if (status === "rejected" && !note)
        throw new Error("Tell the customer why the document was rejected.");
      return {
        accessToken: token(input),
        documentId: validId(input.documentId),
        status: status as LeaseDocStatus,
        note,
      };
    },
  )
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { requireStaffUser, leaseRest, audit } = await import("./lease-to-own.server");
    const staff = await requireStaffUser(data.accessToken);
    const now = new Date().toISOString();
    await leaseRest(`mc_lease_documents?id=eq.${data.documentId}&status=neq.pending`, {
      method: "PATCH",
      body: {
        status: data.status,
        review_note: data.note,
        reviewed_by: staff.email,
        reviewed_at: now,
        updated_at: now,
      },
    });
    await audit({
      actor_user_id: staff.id,
      actor_email: staff.email,
      actor_role: "staff",
      action: "document_reviewed",
      entity: "document",
      entity_id: String(data.documentId),
      details: { status: data.status },
    });
    return { ok: true };
  });

export const staffGetLeaseDocumentUrl = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string; documentId: number }) => ({
    accessToken: token(input),
    documentId: validId(input?.documentId),
  }))
  .handler(async ({ data }): Promise<{ url: string }> => {
    const { requireStaffUser, leaseRest, createSignedDownloadUrl, audit } =
      await import("./lease-to-own.server");
    const staff = await requireStaffUser(data.accessToken);
    const docs = await leaseRest<Array<{ storage_path: string }>>(
      `mc_lease_documents?select=storage_path&id=eq.${data.documentId}&limit=1`,
    );
    const doc = docs?.[0];
    if (!doc) throw new Error("Document not found.");
    const url = await createSignedDownloadUrl(doc.storage_path);
    await audit({
      actor_user_id: staff.id,
      actor_email: staff.email,
      actor_role: "staff",
      action: "document_viewed",
      entity: "document",
      entity_id: String(data.documentId),
    });
    return { url };
  });

const REQUEST_STATUSES = {
  maintenance: ["requested", "confirmed", "completed", "cancelled"],
  emergency: ["under_review", "resolved", "declined"],
} as const;

export const staffUpdateServiceRequest = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { accessToken: string; id: number; kind: string; status: string; note?: string }) => {
      const kind =
        input?.kind === "emergency"
          ? "emergency"
          : input?.kind === "maintenance"
            ? "maintenance"
            : null;
      if (!kind) throw new Error("Unknown request type.");
      if (!(REQUEST_STATUSES[kind] as readonly string[]).includes(input?.status))
        throw new Error("Unknown status.");
      return {
        accessToken: token(input),
        id: validId(input.id),
        kind,
        status: input.status,
        note: clip(input?.note, 1000),
      };
    },
  )
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { requireStaffUser, leaseRest, audit } = await import("./lease-to-own.server");
    const staff = await requireStaffUser(data.accessToken);
    const now = new Date().toISOString();
    const body: Record<string, unknown> = {
      status: data.status,
      handled_by: staff.email,
      updated_at: now,
    };
    if (data.note) body["staff_note"] = data.note;
    if (data.status === "confirmed") body["confirmed_at"] = now;
    await leaseRest(`mc_lease_service_requests?id=eq.${data.id}&kind=eq.${data.kind}`, {
      method: "PATCH",
      body,
    });
    await audit({
      actor_user_id: staff.id,
      actor_email: staff.email,
      actor_role: "staff",
      action: `${data.kind}_request_${data.status}`,
      entity: "service_request",
      entity_id: String(data.id),
    });
    return { ok: true };
  });

/** Exposed so the staff console can offer only valid status changes. */
export const LEASE_REQUEST_STATUSES = REQUEST_STATUSES;
