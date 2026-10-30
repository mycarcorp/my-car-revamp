-- Lease to Own, Form 3: Retail Motor Vehicle Credit Application.
-- PROPOSED — not executed. Run only after approval, AFTER 2026_mc_lease_applicants.sql,
-- 2026_mc_lease_deals.sql and 2026_mc_lease_retail_installment.sql. Additive only;
-- safe to run more than once.
--
-- No second credit application is created. Form 3 is a view of the existing
-- application (mc_lease_applications) and its Buyer / Co-Buyer applicants
-- (mc_lease_applicants). This adds only the details the pre-qualification did
-- not collect (src/lib/credit-application-fields.ts).
--
-- Sensitive data: unchanged. SSN/ITIN is never stored (provider status,
-- reference and last 4 only); the license number stays AES-256-GCM ciphertext
-- with last 4 in clear. No bank account numbers are collected. Reference contact
-- details are personal data of third parties: never sent to analytics or CRM.
--
-- Security model (unchanged): RLS on with NO policies, nothing granted to anon or
-- authenticated. Only server functions using the service role read or write, after
-- verifying the staff role (edit) or the signed-in customer (own application,
-- read-only). Nothing here is in the public schema.

-- Per-applicant details (Applicant A = Buyer, Joint Applicant B = Co-Buyer).
ALTER TABLE mycarco_db.mc_lease_applicants
  ADD COLUMN IF NOT EXISTS middle_name            varchar(80),
  ADD COLUMN IF NOT EXISTS gov_id_type            varchar(20)
                          CHECK (gov_id_type IN ('drivers_license', 'state_id', 'passport', 'other')),
  ADD COLUMN IF NOT EXISTS primary_phone_is_cell  boolean,
  ADD COLUMN IF NOT EXISTS second_phone_is_cell   boolean,
  ADD COLUMN IF NOT EXISTS years_at_address       smallint CHECK (years_at_address BETWEEN 0 AND 99),
  ADD COLUMN IF NOT EXISTS months_at_address      smallint CHECK (months_at_address BETWEEN 0 AND 11),
  ADD COLUMN IF NOT EXISTS mailing_address        jsonb,   -- {street, unit, city, state, zip} or null
  ADD COLUMN IF NOT EXISTS residential_status     varchar(20)
                          CHECK (residential_status IN ('own', 'rent', 'relatives', 'friends', 'other')),
  ADD COLUMN IF NOT EXISTS landlord_name          varchar(160),
  ADD COLUMN IF NOT EXISTS landlord_phone         varchar(20),
  -- previous_address (existing jsonb) may also hold {unit, years, months}.
  ADD COLUMN IF NOT EXISTS employer_address       jsonb,   -- {street, city, state, zip}
  -- previous_employment (existing jsonb) may also hold {monthly_income_cents, full_address}.
  ADD COLUMN IF NOT EXISTS secondary_employment   jsonb,   -- {employer_name, address, city, state, zip, monthly_income_cents, phone, years, months, job_title}
  ADD COLUMN IF NOT EXISTS personal_reference     jsonb,   -- {name, phone, address, relationship}
  ADD COLUMN IF NOT EXISTS bank_reference         jsonb,   -- {bank_name, checking, savings} — never an account number
  ADD COLUMN IF NOT EXISTS credit_app_field_sources jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Application-level choices (one row per application).
CREATE TABLE IF NOT EXISTS mycarco_db.mc_lease_credit_application_terms (
  id                      bigserial PRIMARY KEY,
  application_id          bigint NOT NULL UNIQUE REFERENCES mycarco_db.mc_lease_applications(id) ON DELETE CASCADE,
  sale_or_lease           varchar(12) CHECK (sale_or_lease IN ('credit_sale', 'lease')),
  credit_type             varchar(12) CHECK (credit_type IN ('business', 'individual', 'joint')),  -- never defaulted
  submit_to               varchar(255),
  other_income            jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{party: 'a'|'b', monthly_cents, source}]
  wi_marital_status       varchar(12) CHECK (wi_marital_status IN ('married', 'unmarried', 'separated')),
  wi_spouse_name          varchar(160),
  wi_spouse_address       varchar(255),
  -- For Dealer Use Only values no other form holds
  book_value_cents        bigint CHECK (book_value_cents >= 0),
  cash_selling_price_cents bigint CHECK (cash_selling_price_cents >= 0),
  products_and_fees_cents bigint CHECK (products_and_fees_cents >= 0),
  updated_by              varchar(255),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- Signatures: add the Wisconsin non-joint applicant spouse (Form 3, page 2).
ALTER TABLE mycarco_db.mc_lease_agreement_signatures
  DROP CONSTRAINT IF EXISTS mc_lease_agreement_signatures_signer_role_check;
ALTER TABLE mycarco_db.mc_lease_agreement_signatures
  ADD CONSTRAINT mc_lease_agreement_signatures_signer_role_check
  CHECK (signer_role IN ('buyer', 'co_buyer', 'third_party_owner', 'non_joint_spouse', 'dealer'));

-- Access
ALTER TABLE mycarco_db.mc_lease_credit_application_terms ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON mycarco_db.mc_lease_credit_application_terms FROM anon, authenticated;
GRANT ALL ON mycarco_db.mc_lease_credit_application_terms TO service_role;
GRANT USAGE, SELECT ON SEQUENCE mycarco_db.mc_lease_credit_application_terms_id_seq TO service_role;
