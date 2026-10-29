import { createServerFn } from "@tanstack/react-start";
import {
  APPLICANT_ROLE_LABELS,
  LEASE_CONSENTS_PENDING_APPROVAL,
  LEASE_CONSENT_TYPES,
  LEASE_DOC_STATUSES,
  LEASE_SECURE_COLLECTION_UNAVAILABLE,
  MAINTENANCE_TIME_WINDOWS,
  applicantDocumentStatuses,
  clampVehicleValue,
  coBuyerErrors,
  documentsReadyForSigning,
  estimatePackage,
  getLeaseTier,
  isApplicantRole,
  isLeaseApplicationStatus,
  isLeaseDocType,
  isLeaseTierKey,
  missingRequiredConsents,
  normalizeApplicantProfile,
  normalizeConsents,
  normalizeTradeIn,
  normalizeVehiclePreferences,
  parseMoney,
  validateApplicantProfile,
  validateDocumentFile,
  validateTradeIn,
  validateVehiclePreferences,
  type ApplicantProfile,
  type ApplicantRole,
  type ConsentChoices,
  type LeaseConsentType,
  type LeaseDocStatus,
  type LeaseDocType,
  type LeaseTierKey,
  type LeaseVaultDocType,
  type PaymentFrequency,
  type TradeIn,
  type VehiclePreferences,
  PREQUAL_FORM_VERSION,
} from "./lease-to-own";
import { LEASE_CONSENT_WORDING, consentWordingApproved } from "./lease-to-own-content";

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
  vehicle_stock_number: string | null;
  has_co_buyer: boolean;
  submitted_at: string;
  updated_at: string;
};

export type LeaseDocumentRow = {
  id: number;
  application_id: number;
  /** Buyer or Co-Buyer row; null for application-level documents. */
  applicant_id: number | null;
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
  "id,status,tier,vehicle_value_cents,down_payment_cents,payment_cents,payment_frequency,installments,full_legal_name,email,cell_phone,street,city,state,zip,vehicle_title,vehicle_vin,vehicle_stock_number,has_co_buyer,submitted_at,updated_at";
const DOC_COLUMNS =
  "id,application_id,applicant_id,doc_type,source,status,mime_type,size_bytes,review_note,created_at,reviewed_at";
const ACCOUNT_COLUMNS =
  "id,account_number,status,payment_status,vehicle_title,vehicle_vin,tier,payment_cents,payment_frequency,total_installments,completed_installments,current_balance_cents,next_payment_date,annual_mileage_allowance,start_odometer,verified_odometer,odometer_verified_at,lease_start_date";
const PAYMENT_COLUMNS =
  "id,account_id,amount_cents,status,method,due_date,paid_at,receipt_document_id";
const REQUEST_COLUMNS =
  "id,account_id,kind,requested_date,time_window,notes,status,staff_note,confirmed_at,created_at";

// ============================================================
// Integration status (no customer data)
// ============================================================

export type LeaseIntegrationStatus = {
  /** Server-side encryption for the driver's license number is configured. */
  secureCollection: boolean;
  /** An approved hosted SSN/ITIN collection provider is integrated. None is today. */
  ssnProvider: false;
  /** Counsel has approved the required consent wording (credit authorization, certification). */
  consentWordingApproved: boolean;
  /** Production refuses submissions with unapproved consent wording; development records them as drafts. */
  draftConsentsAllowed: boolean;
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
      consentWordingApproved: consentWordingApproved(),
      draftConsentsAllowed: process.env.NODE_ENV !== "production",
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

/** Inventory vehicle as shown in the form. The server re-reads it from inventory on submit. */
export type LeaseVehicleSnapshot = {
  id?: string | null;
  slug?: string | null;
  vin?: string | null;
  title?: string | null;
  price?: number | null;
  stockNumber?: string | null;
  year?: number | null;
  make?: string | null;
  model?: string | null;
  exteriorColor?: string | null;
  interiorColor?: string | null;
};

export type LeasePrequalInput = {
  accessToken: string;
  tier: string;
  vehicleValue: number;
  buyer: ApplicantProfile;
  /** Null when no Co-Buyer was added. */
  coBuyer: ApplicantProfile | null;
  consents: { buyer: ConsentChoices; coBuyer: ConsentChoices | null };
  /** Inventory slug of the chosen vehicle, if any. Price and details come from inventory. */
  vehicleSlug: string | null;
  vehiclePreferences: VehiclePreferences;
  tradeIn: TradeIn | null;
  attribution?: Record<string, unknown>;
};

const roleLabel = (role: ApplicantRole) => APPLICANT_ROLE_LABELS[role];
const moneyCents = (value: string) => {
  const amount = parseMoney(value);
  return amount === null ? null : cents(amount);
};
const wholeOrNull = (value: string) => (value.trim() ? Number(value) : null);

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Row for mycarco_db.mc_lease_applicants. The license number is encrypted before this is called. */
function applicantRow(role: ApplicantRole, p: ApplicantProfile, dlEncrypted: string | null) {
  return {
    role,
    participation_status: role === "buyer" ? "account_holder" : "pending_confirmation",
    first_name: p.firstName,
    last_name: p.lastName,
    email: p.email,
    cell_phone: p.cellPhone,
    home_phone: p.homePhone || null,
    date_of_birth: p.dateOfBirth,
    dl_number_encrypted: dlEncrypted,
    dl_last4: p.driversLicenseNumber ? p.driversLicenseNumber.slice(-4) : null,
    dl_state: p.driversLicenseState || null,
    dl_issue_date: p.driversLicenseIssueDate || null,
    dl_expiry_date: p.driversLicenseExpiryDate || null,
    street: p.street,
    unit: p.unit || null,
    city: p.city,
    state: p.state,
    zip: p.zip,
    housing_type: p.housingType,
    monthly_housing_cents: moneyCents(p.monthlyHousingPayment),
    previous_address: p.hasPreviousAddress
      ? {
          street: p.previousStreet,
          city: p.previousCity,
          state: p.previousState,
          zip: p.previousZip,
        }
      : null,
    employment_status: p.employmentStatus,
    employer_name: p.employerName || null,
    job_title: p.jobTitle || null,
    employer_phone: p.employerPhone || null,
    monthly_income_cents: moneyCents(p.monthlyIncome),
    years_at_job: wholeOrNull(p.yearsAtJob),
    months_at_job: wholeOrNull(p.monthsAtJob),
    income_source: p.incomeSource || null,
    previous_employment: p.hasPreviousEmployment
      ? {
          employer_name: p.previousEmployerName,
          job_title: p.previousJobTitle,
          employer_phone: p.previousEmployerPhone || null,
          years: wholeOrNull(p.previousYearsAtJob),
          months: wholeOrNull(p.previousMonthsAtJob),
        }
      : null,
  };
}

export const submitLeaseApplication = createServerFn({ method: "POST" })
  .inputValidator((input: LeasePrequalInput) => {
    if (!isLeaseTierKey(input?.tier)) throw new Error("Choose a package.");
    // Drops unknown keys, so an `ssn` sent by any client is discarded here.
    const buyer = normalizeApplicantProfile(input?.buyer);
    const coBuyer = input?.coBuyer ? normalizeApplicantProfile(input.coBuyer) : null;
    const checks: Array<[ApplicantRole, ApplicantProfile]> = [["buyer", buyer]];
    if (coBuyer) checks.push(["co_buyer", coBuyer]);
    for (const [role, profile] of checks) {
      const errors = {
        ...validateApplicantProfile(profile),
        ...(role === "co_buyer" ? coBuyerErrors(buyer, profile) : {}),
      };
      const first = Object.values(errors)[0];
      if (first) throw new Error(`${roleLabel(role)}: ${first}`);
    }
    const consents = {
      buyer: normalizeConsents(input?.consents?.buyer),
      coBuyer: coBuyer ? normalizeConsents(input?.consents?.coBuyer) : null,
    };
    if (missingRequiredConsents(consents.buyer).length)
      throw new Error("Buyer: please review and accept the required authorizations.");
    if (consents.coBuyer && missingRequiredConsents(consents.coBuyer).length)
      throw new Error("Co-Buyer: please review and accept the required authorizations.");
    const vehiclePreferences = normalizeVehiclePreferences(input?.vehiclePreferences);
    const prefError = Object.values(validateVehiclePreferences(vehiclePreferences))[0];
    if (prefError) throw new Error(prefError);
    const tradeIn = input?.tradeIn ? normalizeTradeIn(input.tradeIn) : null;
    if (tradeIn) {
      const tradeError = Object.values(validateTradeIn(tradeIn))[0];
      if (tradeError) throw new Error(`Trade-in: ${tradeError}`);
    }
    const slug =
      typeof input?.vehicleSlug === "string" && /^[a-z0-9-]{1,200}$/i.test(input.vehicleSlug)
        ? input.vehicleSlug
        : null;
    return {
      accessToken: token(input),
      tier: input.tier as LeaseTierKey,
      vehicleValue: clampVehicleValue(input?.vehicleValue),
      buyer,
      coBuyer,
      consents,
      vehicleSlug: slug,
      vehiclePreferences,
      tradeIn,
      attribution: safeAttribution(input?.attribution),
    };
  })
  .handler(async ({ data }): Promise<{ id: number; resumed: boolean }> => {
    const { requireUser, leaseRest, encryptPii, secureCollectionConfigured, audit } =
      await import("./lease-to-own.server");
    const user = await requireUser(data.accessToken);

    // Fail closed before anything is written.
    if (!secureCollectionConfigured()) throw new Error(LEASE_SECURE_COLLECTION_UNAVAILABLE);
    if (!consentWordingApproved() && process.env.NODE_ENV === "production")
      throw new Error(LEASE_CONSENTS_PENDING_APPROVAL);

    // The vehicle, its price and availability come from inventory, never the browser.
    let vehicle: {
      id: string;
      slug: string;
      vin: string;
      title: string;
      price_cents: number;
      stock_number: string | null;
      exterior_color: string | null;
      interior_color: string | null;
    } | null = null;
    if (data.vehicleSlug) {
      const { listPublicLegacyInventory } = await import("./legacy-inventory.server");
      let found;
      try {
        found = (await listPublicLegacyInventory({ slug: data.vehicleSlug, page: 1, pageSize: 1 }))
          .vehicles[0];
      } catch (error) {
        console.error(
          "[lease-to-own] inventory check failed",
          error instanceof Error ? error.message.slice(0, 120) : "",
        );
        throw new Error("We couldn't confirm that vehicle right now. Please try again shortly.");
      }
      if (!found)
        throw new Error(
          "That vehicle is no longer available. Choose another vehicle or continue without one.",
        );
      vehicle = {
        id: found.id,
        slug: found.slug,
        vin: found.vin,
        title: [found.year, found.make, found.model, found.trim].filter(Boolean).join(" "),
        price_cents: Number(found.price_cents),
        stock_number: found.stock_number ?? null,
        exterior_color: found.exterior_color ?? null,
        interior_color: (found.interior_color as string | null | undefined) ?? null,
      };
    }

    // Recompute server-side; never trust client-supplied amounts.
    const estimate = estimatePackage(
      data.tier,
      vehicle ? vehicle.price_cents / 100 : data.vehicleValue,
    );

    // Encrypt before anything is written; fails closed if no key is configured.
    const encryptLicense = (p: ApplicantProfile) =>
      p.driversLicenseNumber ? encryptPii(p.driversLicenseNumber) : Promise.resolve(null);
    const applicants = [applicantRow("buyer", data.buyer, await encryptLicense(data.buyer))];
    if (data.coBuyer)
      applicants.push(applicantRow("co_buyer", data.coBuyer, await encryptLicense(data.coBuyer)));

    const consentRows: Array<Record<string, string | boolean>> = [];
    const addConsents = async (
      role: ApplicantRole,
      choices: ConsentChoices,
      captureMethod: string,
    ) => {
      for (const type of LEASE_CONSENT_TYPES as readonly LeaseConsentType[]) {
        const wording = LEASE_CONSENT_WORDING[type];
        consentRows.push({
          role,
          consent_type: type,
          wording_version: wording.version,
          wording_sha256: await sha256Hex(wording.text),
          accepted: choices[type],
          capture_method: captureMethod,
        });
      }
    };
    await addConsents("buyer", data.consents.buyer, "applicant_session");
    if (data.coBuyer && data.consents.coBuyer)
      await addConsents("co_buyer", data.consents.coBuyer, "buyer_session_for_co_buyer");

    const b = data.buyer;
    const created = await leaseRest<{ id: number; resumed: boolean }>(
      "rpc/mc_lease_create_application",
      {
        method: "POST",
        body: {
          p_user_id: user.id,
          p_application: {
            status: "documents_pending",
            tier: data.tier,
            vehicle_value_cents: cents(estimate.vehicleValue),
            down_payment_cents: cents(estimate.downPayment),
            payment_cents: cents(estimate.payment),
            payment_frequency: estimate.frequency,
            installments: estimate.installments,
            estimate_basis: estimate.basis,
            // The Buyer's contact snapshot; identity details live on the applicant rows.
            full_legal_name: `${b.firstName} ${b.lastName}`,
            email: b.email,
            cell_phone: b.cellPhone,
            street: b.street,
            city: b.city,
            state: b.state,
            zip: b.zip,
            vehicle_id: vehicle?.id ?? null,
            vehicle_slug: vehicle?.slug ?? null,
            vehicle_vin: vehicle?.vin ?? null,
            vehicle_title: vehicle?.title ?? null,
            vehicle_price_cents: vehicle?.price_cents ?? null,
            vehicle_stock_number: vehicle?.stock_number ?? null,
            vehicle_exterior_color: vehicle?.exterior_color ?? null,
            vehicle_interior_color: vehicle?.interior_color ?? null,
            vehicle_preferences: vehicle ? {} : data.vehiclePreferences,
            trade_in: data.tradeIn
              ? {
                  year: data.tradeIn.year,
                  make: data.tradeIn.make,
                  model: data.tradeIn.model,
                  mileage: data.tradeIn.mileage ? Number(data.tradeIn.mileage) : null,
                  payoff_cents: data.tradeIn.payoff ? moneyCents(data.tradeIn.payoff) : null,
                }
              : null,
            has_co_buyer: Boolean(data.coBuyer),
            prequal_form_version: PREQUAL_FORM_VERSION,
            attribution: data.attribution,
          },
          p_applicants: applicants,
          p_consents: consentRows,
        },
      },
    );
    const id = Number(created?.id);
    if (!Number.isInteger(id) || id <= 0) throw new Error("We couldn't save that right now.");
    if (created.resumed) return { id, resumed: true };

    await audit({
      actor_user_id: user.id,
      actor_email: user.email,
      actor_role: "customer",
      action: "application_submitted",
      entity: "application",
      entity_id: String(id),
      details: {
        tier: data.tier,
        co_buyer: Boolean(data.coBuyer),
        consent_version: LEASE_CONSENT_WORDING.credit_authorization.version,
      },
    });

    // Non-sensitive lead for the CRM — no SSN, DOB, license, income, bank or document data.
    const tier = getLeaseTier(data.tier);
    const fullName = `${b.firstName} ${b.lastName}`;
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
      vehicle_of_interest: vehicle?.title ?? "",
      vehicle_vin: vehicle?.vin ?? "",
      estimate_basis: estimate.basis,
      ...data.attribution,
    };
    let leadId: string | null = null;
    const isUuid = /^[0-9a-f-]{36}$/i.test(vehicle?.id ?? "");
    for (const lead_type of ["lease_to_own", "finance"]) {
      try {
        const rows = await leaseRest<Array<{ id: string }>>("leads", {
          method: "POST",
          profile: "public",
          prefer: "return=representation",
          body: {
            lead_type,
            status: "new",
            full_name: fullName,
            email: b.email,
            phone: b.cellPhone,
            message: `Lease to Own application: ${tier.name}`,
            user_id: user.id,
            vehicle_id: isUuid ? vehicle?.id : null,
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
      await postToGhl({
        event_type: "lease_to_own_application",
        source: "MyCar Website — Lease to Own",
        full_name: fullName,
        first_name: b.firstName,
        last_name: b.lastName,
        email: b.email,
        phone: b.cellPhone,
        financing_tier: tier.name,
        down_payment: String(estimate.downPayment),
        payment_amount: String(estimate.payment),
        payment_frequency: estimate.frequency,
        vehicle_of_interest: vehicle?.title ?? "",
        vin: vehicle?.vin ?? "",
        application_stage: "application_submitted",
        submitted_at: new Date().toISOString(),
        ...data.attribution,
      });
    } catch (e) {
      console.error("[lease-to-own] GHL delivery failed", e instanceof Error ? e.message : e);
    }
    return { id, resumed: false };
  });

/** Non-sensitive applicant details for the receipt and portal. */
export type LeaseApplicantSummary = {
  id: number;
  role: ApplicantRole;
  participation_status: string;
  first_name: string;
  last_name: string;
  email: string;
  ssn_collection_status: string;
};

export type LeaseConsentSummary = {
  applicant_id: number;
  consent_type: LeaseConsentType;
  accepted: boolean;
  wording_version: string;
  capture_method: string;
  recorded_at: string;
};

export type MyLeaseApplication = {
  application: LeaseApplicationSummary;
  applicants: LeaseApplicantSummary[];
  consents: LeaseConsentSummary[];
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
  const [applicants, consents, documents, agreements] = await Promise.all([
    leaseRest<LeaseApplicantSummary[]>(
      `mc_lease_applicants?select=id,role,participation_status,first_name,last_name,email,ssn_collection_status&application_id=eq.${application.id}&user_id=eq.${userId}&order=id.asc`,
    ),
    leaseRest<LeaseConsentSummary[]>(
      `mc_lease_consents?select=applicant_id,consent_type,accepted,wording_version,capture_method,recorded_at&application_id=eq.${application.id}&order=recorded_at.desc`,
    ),
    leaseRest<LeaseDocumentRow[]>(
      `mc_lease_documents?select=${DOC_COLUMNS}&application_id=eq.${application.id}&user_id=eq.${userId}&superseded_at=is.null&order=created_at.desc`,
    ),
    leaseRest<LeaseAgreementRow[]>(
      `mc_lease_agreements?select=id,agreement_key,template_version,status,executed_at&application_id=eq.${application.id}`,
    ),
  ]);
  return {
    application,
    applicants: applicants ?? [],
    consents: consents ?? [],
    documents: documents ?? [],
    agreements: agreements ?? [],
  };
}

/** The Buyer's applicant id (null for applications created before Co-Buyers existed). */
export function buyerApplicantId(app: NonNullable<MyLeaseApplication>): number | null {
  return app.applicants.find((a) => a.role === "buyer")?.id ?? null;
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
      /** Whose document this is; defaults to the Buyer. */
      applicantRole?: ApplicantRole;
      docType: string;
      mime: string;
      size: number;
    }) => {
      if (!isLeaseDocType(input?.docType)) throw new Error("Unknown document type.");
      const applicantRole = input?.applicantRole ?? "buyer";
      if (!isApplicantRole(applicantRole)) throw new Error("Unknown applicant.");
      const mime = String(input?.mime ?? "");
      const size = Number(input?.size);
      const problem = validateDocumentFile({ type: mime, size });
      if (problem) throw new Error(problem);
      return {
        accessToken: token(input),
        applicationId: validId(input.applicationId),
        applicantRole,
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
    const applicants = await leaseRest<Array<{ id: number }>>(
      `mc_lease_applicants?select=id&application_id=eq.${app.id}&user_id=eq.${user.id}&role=eq.${data.applicantRole}&limit=1`,
    );
    const applicantId = applicants?.[0]?.id ?? null;
    if (data.applicantRole === "co_buyer" && !applicantId)
      throw new Error("This application has no Co-Buyer.");
    const path = `${user.id}/${app.id}/${data.applicantRole}/${data.docType}/${crypto.randomUUID()}.${EXTENSIONS[data.mime] ?? "bin"}`;
    const uploadUrl = await createSignedUploadUrl(path);
    const rows = await leaseRest<Array<{ id: number }>>("mc_lease_documents", {
      method: "POST",
      prefer: "return=representation",
      body: {
        application_id: app.id,
        applicant_id: applicantId,
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
        applicant_id: number | null;
        doc_type: string;
        status: string;
        storage_path: string;
        mime_type: string;
        size_bytes: number;
      }>
    >(
      `mc_lease_documents?select=id,application_id,applicant_id,doc_type,status,storage_path,mime_type,size_bytes&id=eq.${data.documentId}&user_id=eq.${user.id}&source=eq.customer&limit=1`,
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
      // Supersede this applicant's earlier copies of this document type, then mark this one uploaded.
      const owner =
        doc.applicant_id === null ? "applicant_id=is.null" : `applicant_id=eq.${doc.applicant_id}`;
      await leaseRest(
        `mc_lease_documents?application_id=eq.${doc.application_id}&user_id=eq.${user.id}&${owner}&doc_type=eq.${doc.doc_type}&source=eq.customer&id=neq.${doc.id}&superseded_at=is.null`,
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
        details: {
          doc_type: doc.doc_type,
          application_id: doc.application_id,
          applicant_id: doc.applicant_id,
        },
      });
    }
    const result = await loadMyApplication(user.id);
    if (result && result.application.status === "documents_pending") {
      // The Buyer's required documents move the application to review.
      const statuses = applicantDocumentStatuses(result.documents, buyerApplicantId(result), true);
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
    // Identity details for new applications live on the Buyer's applicant row; show
    // them where the console already expects them. Never includes encrypted values.
    const ids = (applications ?? []).map((a) => a.id);
    const buyers = ids.length
      ? await leaseRest<
          Array<{
            application_id: number;
            date_of_birth: string;
            dl_last4: string | null;
            dl_state: string | null;
            ssn_last4: string | null;
            ssn_collection_status: string;
          }>
        >(
          `mc_lease_applicants?select=application_id,date_of_birth,dl_last4,dl_state,ssn_last4,ssn_collection_status&role=eq.buyer&application_id=in.(${ids.join(",")})`,
        )
      : [];
    const buyerByApp = new Map((buyers ?? []).map((row) => [row.application_id, row]));
    for (const app of applications ?? []) {
      const buyer = buyerByApp.get(app.id);
      if (!buyer) continue;
      app.date_of_birth = app.date_of_birth ?? buyer.date_of_birth;
      app.dl_last4 = app.dl_last4 ?? buyer.dl_last4 ?? "";
      app.dl_state = app.dl_state ?? buyer.dl_state ?? "";
      app.ssn_last4 = app.ssn_last4 ?? buyer.ssn_last4;
      app.ssn_collection_status = buyer.ssn_collection_status;
    }
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
