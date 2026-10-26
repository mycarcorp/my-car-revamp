-- Lease to Own: applications, documents, agreements, accounts, payments,
-- service/emergency requests and an audit log (portal at /lease-to-own/portal,
-- staff console at /staff/dms).
-- Additive only — no existing table, column, row or policy is changed.
-- Safe to run more than once. Paste into the SQL editor and run.
--
-- Security model (same as mc_purchases): RLS is enabled with NO policies, so
-- the browser can never read or write these tables. Only server functions using
-- the service role do, after verifying the signed-in customer or staff role.
-- Driver's license numbers are stored only as AES-256-GCM ciphertext produced
-- server-side (LEASE_PII_ENCRYPTION_KEY); only the last 4 are clear.
-- SSN/ITIN is NEVER stored by this app: an approved identity provider collects it
-- in its own hosted field and only its reference, status and masked last 4 are kept.

CREATE TABLE IF NOT EXISTS mycarco_db.mc_lease_applications (
  id                     bigserial PRIMARY KEY,
  user_id                uuid NOT NULL,                 -- auth user id
  status                 varchar(40) NOT NULL DEFAULT 'submitted',
  -- Package selection (reference estimate at time of application)
  tier                   varchar(40) NOT NULL,
  vehicle_value_cents    bigint,
  down_payment_cents     bigint,
  payment_cents          bigint,
  payment_frequency      varchar(20),
  installments           integer,
  estimate_basis         varchar(40) NOT NULL DEFAULT 'reference_assumption',
  -- Applicant
  full_legal_name        varchar(160) NOT NULL,
  date_of_birth          date NOT NULL,
  email                  varchar(255) NOT NULL,
  cell_phone             varchar(20) NOT NULL,
  -- SSN/ITIN: provider metadata only (see header)
  ssn_collection_status  varchar(20) NOT NULL DEFAULT 'not_collected', -- not_collected | pending | collected | verified | failed
  ssn_provider           varchar(60),
  ssn_provider_reference varchar(255),
  ssn_last4              varchar(4),          -- masked digits returned by the provider, never typed into this app
  ssn_collected_at       timestamptz,
  dl_number_encrypted    text NOT NULL,
  dl_last4               varchar(4) NOT NULL,
  dl_state               varchar(2) NOT NULL,
  street                 varchar(255) NOT NULL,
  city                   varchar(120) NOT NULL,
  state                  varchar(2) NOT NULL,
  zip                    varchar(10) NOT NULL,
  -- Vehicle snapshot (optional — may be assigned by staff later)
  vehicle_id             text,
  vehicle_slug           text,
  vehicle_vin            varchar(40),
  vehicle_title          varchar(255),
  vehicle_price_cents    bigint,
  -- Tracking
  lead_id                uuid,
  attribution            jsonb NOT NULL DEFAULT '{}'::jsonb,
  staff_note             text,
  reviewed_by            varchar(255),
  submitted_at           timestamptz NOT NULL DEFAULT now(),
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);
-- Driver's license identity verification. The license number itself is kept only
-- as ciphertext (dl_number_encrypted) plus the last 4 and issuing state. When an
-- identity-verification provider is connected, it records its reference and result
-- here. ADD COLUMN IF NOT EXISTS keeps this safe if the table already exists.
ALTER TABLE mycarco_db.mc_lease_applications
  ADD COLUMN IF NOT EXISTS dl_verification_status    varchar(20) NOT NULL DEFAULT 'not_verified', -- not_verified | pending | verified | failed
  ADD COLUMN IF NOT EXISTS dl_verification_provider  varchar(60),
  ADD COLUMN IF NOT EXISTS dl_verification_reference varchar(255),
  ADD COLUMN IF NOT EXISTS dl_verified_at            timestamptz;

-- If the table was created from an earlier draft of this file, bring it in line:
-- add the provider columns and stop requiring the old SSN columns. No data is deleted.
ALTER TABLE mycarco_db.mc_lease_applications
  ADD COLUMN IF NOT EXISTS ssn_collection_status  varchar(20) NOT NULL DEFAULT 'not_collected',
  ADD COLUMN IF NOT EXISTS ssn_provider           varchar(60),
  ADD COLUMN IF NOT EXISTS ssn_provider_reference varchar(255),
  ADD COLUMN IF NOT EXISTS ssn_collected_at       timestamptz;
ALTER TABLE mycarco_db.mc_lease_applications ALTER COLUMN ssn_last4 DROP NOT NULL;
DO $
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'mycarco_db' AND table_name = 'mc_lease_applications' AND column_name = 'ssn_encrypted'
  ) THEN
    ALTER TABLE mycarco_db.mc_lease_applications ALTER COLUMN ssn_encrypted DROP NOT NULL;
  END IF;
END $;

CREATE INDEX IF NOT EXISTS mc_lease_applications_user_idx ON mycarco_db.mc_lease_applications (user_id);
CREATE INDEX IF NOT EXISTS mc_lease_applications_status_idx ON mycarco_db.mc_lease_applications (status);

-- Customer uploads (application stips) and staff-issued vault documents.
CREATE TABLE IF NOT EXISTS mycarco_db.mc_lease_documents (
  id                bigserial PRIMARY KEY,
  application_id    bigint NOT NULL REFERENCES mycarco_db.mc_lease_applications(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL,
  doc_type          varchar(40) NOT NULL,   -- government_id | paystub | bank_statement | insurance_declaration | ach_authorization | executed_agreement | receipt | warranty | inspection_record
  source            varchar(20) NOT NULL DEFAULT 'customer',  -- customer | staff
  status            varchar(20) NOT NULL DEFAULT 'pending',   -- pending | uploaded | under_review | verified | rejected
  storage_path      text NOT NULL,          -- private bucket "lease-documents"
  mime_type         varchar(80) NOT NULL,
  size_bytes        integer NOT NULL,
  review_note       text,
  reviewed_by       varchar(255),
  reviewed_at       timestamptz,
  superseded_at     timestamptz,            -- set when the customer replaces the file
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mc_lease_documents_app_idx ON mycarco_db.mc_lease_documents (application_id);
CREATE INDEX IF NOT EXISTS mc_lease_documents_status_idx ON mycarco_db.mc_lease_documents (status);

-- Agreement execution records. Written only by a future approved e-signature
-- provider integration; nothing in the app executes agreements today.
CREATE TABLE IF NOT EXISTS mycarco_db.mc_lease_agreements (
  id                    bigserial PRIMARY KEY,
  application_id        bigint NOT NULL REFERENCES mycarco_db.mc_lease_applications(id) ON DELETE CASCADE,
  agreement_key         varchar(40) NOT NULL,  -- master_lease | mileage_covenant | service_agreement | gps_disclosure | ach_authorization
  template_version      varchar(80) NOT NULL,
  status                varchar(20) NOT NULL DEFAULT 'draft',  -- draft | sent | executed | voided
  provider              varchar(60),
  provider_envelope_id  varchar(255),
  consent_recorded_at   timestamptz,
  executed_at           timestamptz,
  executed_pdf_path     text,
  audit                 jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mc_lease_agreements_app_idx ON mycarco_db.mc_lease_agreements (application_id);

-- Active lease accounts. Populated by staff / DMS (DealerCenter) sync only.
CREATE TABLE IF NOT EXISTS mycarco_db.mc_lease_accounts (
  id                          bigserial PRIMARY KEY,
  application_id              bigint REFERENCES mycarco_db.mc_lease_applications(id) ON DELETE SET NULL,
  user_id                     uuid NOT NULL,
  account_number              varchar(40) NOT NULL UNIQUE,
  status                      varchar(40) NOT NULL DEFAULT 'active',
  payment_status              varchar(40) NOT NULL DEFAULT 'current',
  vehicle_title               varchar(255),
  vehicle_vin                 varchar(40),
  tier                        varchar(40),
  payment_cents               bigint,
  payment_frequency           varchar(20),
  total_installments          integer,
  completed_installments      integer NOT NULL DEFAULT 0,
  current_balance_cents       bigint,
  next_payment_date           date,
  annual_mileage_allowance    integer NOT NULL DEFAULT 14000,
  start_odometer              integer,
  verified_odometer           integer,
  odometer_verified_at        timestamptz,
  lease_start_date            date,
  dms_source                  varchar(60),
  dms_external_id             varchar(120),
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mc_lease_accounts_user_idx ON mycarco_db.mc_lease_accounts (user_id);

-- Ledger. Rows are confirmed by the payment processor or DMS, never by a browser click.
CREATE TABLE IF NOT EXISTS mycarco_db.mc_lease_payments (
  id                bigserial PRIMARY KEY,
  account_id        bigint NOT NULL REFERENCES mycarco_db.mc_lease_accounts(id) ON DELETE CASCADE,
  amount_cents      bigint NOT NULL,
  status            varchar(20) NOT NULL,   -- scheduled | pending | confirmed | failed | refunded
  method            varchar(20),            -- ach | card | cash | check
  processor         varchar(60),
  processor_ref     varchar(255),
  due_date          date,
  paid_at           timestamptz,
  receipt_document_id bigint REFERENCES mycarco_db.mc_lease_documents(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mc_lease_payments_account_idx ON mycarco_db.mc_lease_payments (account_id);

-- 90-day maintenance requests and emergency mobility assistance requests.
CREATE TABLE IF NOT EXISTS mycarco_db.mc_lease_service_requests (
  id                bigserial PRIMARY KEY,
  user_id           uuid NOT NULL,
  account_id        bigint REFERENCES mycarco_db.mc_lease_accounts(id) ON DELETE SET NULL,
  kind              varchar(20) NOT NULL,   -- maintenance | emergency
  requested_date    date,
  time_window       varchar(80),
  notes             text,
  status            varchar(30) NOT NULL DEFAULT 'requested',  -- requested | confirmed | completed | cancelled | under_review | resolved | declined
  confirmed_at      timestamptz,
  staff_note        text,
  handled_by        varchar(255),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mc_lease_service_requests_user_idx ON mycarco_db.mc_lease_service_requests (user_id);
CREATE INDEX IF NOT EXISTS mc_lease_service_requests_status_idx ON mycarco_db.mc_lease_service_requests (kind, status);

-- Append-only audit trail. Details never contain SSN, license, DOB, bank data or file contents.
CREATE TABLE IF NOT EXISTS mycarco_db.mc_lease_audit_log (
  id                bigserial PRIMARY KEY,
  actor_user_id     uuid,
  actor_email       varchar(255),
  actor_role        varchar(20) NOT NULL,   -- customer | staff | system
  action            varchar(80) NOT NULL,
  entity            varchar(60) NOT NULL,
  entity_id         varchar(80),
  details           jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mc_lease_audit_log_created_idx ON mycarco_db.mc_lease_audit_log (created_at DESC);

ALTER TABLE mycarco_db.mc_lease_applications     ENABLE ROW LEVEL SECURITY;
ALTER TABLE mycarco_db.mc_lease_documents        ENABLE ROW LEVEL SECURITY;
ALTER TABLE mycarco_db.mc_lease_agreements       ENABLE ROW LEVEL SECURITY;
ALTER TABLE mycarco_db.mc_lease_accounts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE mycarco_db.mc_lease_payments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE mycarco_db.mc_lease_service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE mycarco_db.mc_lease_audit_log        ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA mycarco_db TO service_role;
GRANT ALL ON
  mycarco_db.mc_lease_applications, mycarco_db.mc_lease_documents, mycarco_db.mc_lease_agreements,
  mycarco_db.mc_lease_accounts, mycarco_db.mc_lease_payments, mycarco_db.mc_lease_service_requests
  TO service_role;
-- The audit log is insert/select only, even for the server.
GRANT SELECT, INSERT ON mycarco_db.mc_lease_audit_log TO service_role;
REVOKE UPDATE, DELETE, TRUNCATE ON mycarco_db.mc_lease_audit_log FROM service_role;
GRANT USAGE, SELECT ON SEQUENCE
  mycarco_db.mc_lease_applications_id_seq, mycarco_db.mc_lease_documents_id_seq, mycarco_db.mc_lease_agreements_id_seq,
  mycarco_db.mc_lease_accounts_id_seq, mycarco_db.mc_lease_payments_id_seq, mycarco_db.mc_lease_service_requests_id_seq,
  mycarco_db.mc_lease_audit_log_id_seq
  TO service_role;

-- Lets submitted applications appear as their own lead type in Customers.
ALTER TYPE public.lead_type ADD VALUE IF NOT EXISTS 'lease_to_own';
