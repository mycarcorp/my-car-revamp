-- Lease to Own, Phase 2: Buyer / Co-Buyer pre-qualification.
-- PROPOSED — not executed. Run only after approval, AFTER 2026_mc_lease_to_own.sql.
-- Additive only and safe to run more than once. Paste into the SQL editor and run.
--
-- One application (mc_lease_applications) now has one Buyer and an optional
-- Co-Buyer (mc_lease_applicants), consent evidence per applicant
-- (mc_lease_consents) and documents that can belong to a specific applicant.
--
-- Security model (unchanged): RLS on with NO policies, nothing granted to anon or
-- authenticated, so the browser can never read or write these tables. Only server
-- functions using the service role do, after verifying the signed-in customer or
-- staff role. Driver's license numbers are AES-256-GCM ciphertext made server-side;
-- SSN/ITIN is never stored (provider reference, status and masked last 4 only).

-- ------------------------------------------------------------
-- Applicants
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mycarco_db.mc_lease_applicants (
  id                        bigserial PRIMARY KEY,
  application_id            bigint NOT NULL REFERENCES mycarco_db.mc_lease_applications(id) ON DELETE CASCADE,
  user_id                   uuid NOT NULL,          -- the Buyer's MyCar account that owns the application
  role                      varchar(20) NOT NULL CHECK (role IN ('buyer', 'co_buyer')),
  -- Buyer: 'account_holder'. Co-Buyer: 'pending_confirmation' until they confirm
  -- their own participation, consents and identity separately (later phase).
  participation_status      varchar(30) NOT NULL DEFAULT 'pending_confirmation',
  participation_confirmed_at timestamptz,
  -- Personal and contact
  first_name                varchar(80) NOT NULL,
  last_name                 varchar(80) NOT NULL,
  email                     varchar(255) NOT NULL,
  cell_phone                varchar(20) NOT NULL,
  home_phone                varchar(20),
  date_of_birth             date NOT NULL,
  -- SSN/ITIN: provider metadata only
  ssn_collection_status     varchar(20) NOT NULL DEFAULT 'not_collected'
                            CHECK (ssn_collection_status IN ('not_collected', 'pending', 'collected', 'verified', 'failed')),
  ssn_provider              varchar(60),
  ssn_provider_reference    varchar(255),
  ssn_last4                 varchar(4),
  ssn_collected_at          timestamptz,
  -- Driver's license (number encrypted server-side; only last 4 in clear)
  dl_number_encrypted       text,
  dl_last4                  varchar(4),
  dl_state                  varchar(2),
  dl_issue_date             date,
  dl_expiry_date            date,
  dl_verification_status    varchar(20) NOT NULL DEFAULT 'not_verified',
  dl_verification_provider  varchar(60),
  dl_verification_reference varchar(255),
  dl_verified_at            timestamptz,
  CHECK (dl_expiry_date IS NULL OR dl_issue_date IS NULL OR dl_expiry_date >= dl_issue_date),
  -- Residence
  street                    varchar(255) NOT NULL,
  unit                      varchar(40),
  city                      varchar(120) NOT NULL,
  state                     varchar(2) NOT NULL,
  zip                       varchar(10) NOT NULL,
  housing_type              varchar(20) NOT NULL,
  monthly_housing_cents     bigint NOT NULL CHECK (monthly_housing_cents >= 0),
  previous_address          jsonb,                  -- {street, city, state, zip} or null
  -- Employment / income
  employment_status         varchar(60) NOT NULL,
  employer_name             varchar(160),
  job_title                 varchar(120),
  employer_phone            varchar(20),
  monthly_income_cents      bigint NOT NULL CHECK (monthly_income_cents >= 0),
  years_at_job              smallint CHECK (years_at_job BETWEEN 0 AND 60),
  months_at_job             smallint CHECK (months_at_job BETWEEN 0 AND 11),
  income_source             varchar(120),
  previous_employment       jsonb,                  -- {employer_name, job_title, employer_phone, years, months} or null
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  UNIQUE (application_id, role)
);
CREATE INDEX IF NOT EXISTS mc_lease_applicants_user_idx ON mycarco_db.mc_lease_applicants (user_id);

-- ------------------------------------------------------------
-- Consent evidence (append-only)
-- ------------------------------------------------------------
-- One row per applicant per consent type per submission. A later change of mind
-- is a new row; rows are never updated or deleted.
CREATE TABLE IF NOT EXISTS mycarco_db.mc_lease_consents (
  id                  bigserial PRIMARY KEY,
  application_id      bigint NOT NULL REFERENCES mycarco_db.mc_lease_applications(id) ON DELETE CASCADE,
  applicant_id        bigint NOT NULL REFERENCES mycarco_db.mc_lease_applicants(id) ON DELETE CASCADE,
  consent_type        varchar(40) NOT NULL
                      CHECK (consent_type IN ('marketing_sms', 'transactional_sms', 'credit_authorization', 'application_certification')),
  wording_version     varchar(60) NOT NULL,
  wording_sha256      char(64) NOT NULL,      -- hash of the exact text shown
  accepted            boolean NOT NULL,
  -- 'applicant_session': the Buyer, signed in to their own account.
  -- 'buyer_session_for_co_buyer': entered on the Buyer's device. Not relied on until
  --   the Co-Buyer confirms separately, which a later phase records as a new row.
  capture_method      varchar(40) NOT NULL,
  recorded_by_user_id uuid NOT NULL,
  recorded_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mc_lease_consents_app_idx ON mycarco_db.mc_lease_consents (application_id);
CREATE INDEX IF NOT EXISTS mc_lease_consents_applicant_idx ON mycarco_db.mc_lease_consents (applicant_id, consent_type);

-- ------------------------------------------------------------
-- Existing tables
-- ------------------------------------------------------------
-- Applicant identity now lives in mc_lease_applicants. The application keeps the
-- Buyer's name, email, phone and address as its contact snapshot; new rows no
-- longer copy date of birth or license data onto it. No data is deleted.
ALTER TABLE mycarco_db.mc_lease_applications ALTER COLUMN date_of_birth DROP NOT NULL;
ALTER TABLE mycarco_db.mc_lease_applications ALTER COLUMN dl_number_encrypted DROP NOT NULL;
ALTER TABLE mycarco_db.mc_lease_applications ALTER COLUMN dl_last4 DROP NOT NULL;
ALTER TABLE mycarco_db.mc_lease_applications ALTER COLUMN dl_state DROP NOT NULL;
ALTER TABLE mycarco_db.mc_lease_applications
  ADD COLUMN IF NOT EXISTS has_co_buyer           boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS vehicle_stock_number   varchar(40),
  ADD COLUMN IF NOT EXISTS vehicle_exterior_color varchar(60),
  ADD COLUMN IF NOT EXISTS vehicle_interior_color varchar(60),
  ADD COLUMN IF NOT EXISTS vehicle_preferences    jsonb NOT NULL DEFAULT '{}'::jsonb, -- wanted year/make/model/colors when no stock vehicle was chosen
  ADD COLUMN IF NOT EXISTS trade_in               jsonb,                              -- {year, make, model, mileage, payoff_cents} or null
  ADD COLUMN IF NOT EXISTS prequal_form_version   varchar(40);

-- Documents can belong to the Buyer or the Co-Buyer. NULL = application-level
-- (rows created before this migration, and staff-issued vault documents).
ALTER TABLE mycarco_db.mc_lease_documents
  ADD COLUMN IF NOT EXISTS applicant_id bigint REFERENCES mycarco_db.mc_lease_applicants(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS mc_lease_documents_applicant_idx ON mycarco_db.mc_lease_documents (applicant_id);

-- ------------------------------------------------------------
-- Atomic submission
-- ------------------------------------------------------------
-- Creates the application, its applicants and their consents in one transaction,
-- or returns the account's existing open application. The advisory lock makes
-- concurrent double-submits from one account resolve to a single application.
-- Inputs are already validated, normalized and encrypted by the server function.
CREATE OR REPLACE FUNCTION mycarco_db.mc_lease_create_application(
  p_user_id     uuid,
  p_application jsonb,
  p_applicants  jsonb,
  p_consents    jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = mycarco_db, pg_temp
AS $fn$
DECLARE
  v_app_id       bigint;
  v_existing     bigint;
  v_applicant    jsonb;
  v_applicant_id bigint;
  v_ids          jsonb := '{}'::jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('mc_lease_application:' || p_user_id::text, 0));

  SELECT id INTO v_existing
    FROM mc_lease_applications
   WHERE user_id = p_user_id
     AND status IN ('submitted', 'documents_pending', 'under_review', 'approved')
   ORDER BY created_at DESC
   LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('id', v_existing, 'resumed', true);
  END IF;

  INSERT INTO mc_lease_applications (
    user_id, status, tier, vehicle_value_cents, down_payment_cents, payment_cents,
    payment_frequency, installments, estimate_basis, full_legal_name, email, cell_phone,
    street, city, state, zip, vehicle_id, vehicle_slug, vehicle_vin, vehicle_title,
    vehicle_price_cents, vehicle_stock_number, vehicle_exterior_color, vehicle_interior_color,
    vehicle_preferences, trade_in, has_co_buyer, prequal_form_version, attribution,
    submitted_at, updated_at
  )
  SELECT
    p_user_id, r.status, r.tier, r.vehicle_value_cents, r.down_payment_cents, r.payment_cents,
    r.payment_frequency, r.installments, r.estimate_basis, r.full_legal_name, r.email, r.cell_phone,
    r.street, r.city, r.state, r.zip, r.vehicle_id, r.vehicle_slug, r.vehicle_vin, r.vehicle_title,
    r.vehicle_price_cents, r.vehicle_stock_number, r.vehicle_exterior_color, r.vehicle_interior_color,
    COALESCE(r.vehicle_preferences, '{}'::jsonb), r.trade_in, COALESCE(r.has_co_buyer, false),
    r.prequal_form_version, COALESCE(r.attribution, '{}'::jsonb), now(), now()
  FROM jsonb_populate_record(NULL::mycarco_db.mc_lease_applications, p_application) r
  RETURNING id INTO v_app_id;

  FOR v_applicant IN SELECT value FROM jsonb_array_elements(p_applicants) LOOP
    INSERT INTO mc_lease_applicants (
      application_id, user_id, role, participation_status, first_name, last_name, email,
      cell_phone, home_phone, date_of_birth, ssn_collection_status, dl_number_encrypted,
      dl_last4, dl_state, dl_issue_date, dl_expiry_date, dl_verification_status, street, unit,
      city, state, zip, housing_type, monthly_housing_cents, previous_address, employment_status,
      employer_name, job_title, employer_phone, monthly_income_cents, years_at_job, months_at_job,
      income_source, previous_employment
    )
    SELECT
      v_app_id, p_user_id, a.role, a.participation_status, a.first_name, a.last_name, a.email,
      a.cell_phone, a.home_phone, a.date_of_birth, 'not_collected', a.dl_number_encrypted,
      a.dl_last4, a.dl_state, a.dl_issue_date, a.dl_expiry_date, 'not_verified', a.street, a.unit,
      a.city, a.state, a.zip, a.housing_type, a.monthly_housing_cents, a.previous_address,
      a.employment_status, a.employer_name, a.job_title, a.employer_phone, a.monthly_income_cents,
      a.years_at_job, a.months_at_job, a.income_source, a.previous_employment
    FROM jsonb_populate_record(NULL::mycarco_db.mc_lease_applicants, v_applicant) a
    RETURNING id INTO v_applicant_id;
    v_ids := v_ids || jsonb_build_object(v_applicant->>'role', v_applicant_id);
  END LOOP;

  -- applicant_id is NOT NULL, so a consent for a missing applicant aborts everything.
  INSERT INTO mc_lease_consents (
    application_id, applicant_id, consent_type, wording_version, wording_sha256, accepted,
    capture_method, recorded_by_user_id
  )
  SELECT
    v_app_id, (v_ids->>(c->>'role'))::bigint, c->>'consent_type', c->>'wording_version',
    c->>'wording_sha256', (c->>'accepted')::boolean, c->>'capture_method', p_user_id
  FROM jsonb_array_elements(p_consents) c;

  RETURN jsonb_build_object('id', v_app_id, 'resumed', false, 'applicants', v_ids);
END;
$fn$;

-- ------------------------------------------------------------
-- Access
-- ------------------------------------------------------------
ALTER TABLE mycarco_db.mc_lease_applicants ENABLE ROW LEVEL SECURITY;
ALTER TABLE mycarco_db.mc_lease_consents   ENABLE ROW LEVEL SECURITY;

-- Functions are executable by PUBLIC by default; only the server may call this one.
REVOKE ALL ON FUNCTION mycarco_db.mc_lease_create_application(uuid, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION mycarco_db.mc_lease_create_application(uuid, jsonb, jsonb, jsonb) TO service_role;

-- Schema default privileges may hand new tables to anon/authenticated (see the
-- mc_financing audit finding). Remove any such grant from every Lease to Own table.
REVOKE ALL ON
  mycarco_db.mc_lease_applications, mycarco_db.mc_lease_applicants, mycarco_db.mc_lease_consents,
  mycarco_db.mc_lease_documents, mycarco_db.mc_lease_agreements, mycarco_db.mc_lease_accounts,
  mycarco_db.mc_lease_payments, mycarco_db.mc_lease_service_requests, mycarco_db.mc_lease_audit_log
  FROM anon, authenticated;

GRANT ALL ON mycarco_db.mc_lease_applicants TO service_role;
-- Consent evidence is insert/select only, even for the server.
GRANT SELECT, INSERT ON mycarco_db.mc_lease_consents TO service_role;
REVOKE UPDATE, DELETE, TRUNCATE ON mycarco_db.mc_lease_consents FROM service_role;
GRANT USAGE, SELECT ON SEQUENCE
  mycarco_db.mc_lease_applicants_id_seq, mycarco_db.mc_lease_consents_id_seq
  TO service_role;
