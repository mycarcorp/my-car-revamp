-- Lease to Own, Form 6: Agreement to Provide Insurance.
-- PROPOSED — not executed. Run only after approval, AFTER 2026_mc_lease_deals.sql.
-- Additive only; safe to run more than once.
--
-- Reuses mc_lease_deals.insurance_company / insurance_policy_number /
-- insurance_status / insurance_document_id (Form 1). Adds only what the
-- agreement needs beyond that: the confirmed creditor / loss payee, the agent,
-- the policy period, coverages and deductibles. Coverage defaults to unknown;
-- "verified" may be set only by authorized staff or a verified provider.
--
-- Security model (unchanged): RLS on with NO policies, nothing granted to anon or
-- authenticated. Only server functions using the service role read or write, after
-- verifying the staff role (edit/verify) or the signed-in customer (own deal,
-- read-only). Policy details are never sent to analytics or CRM. Nothing here is
-- in the public schema.

-- Wider verification states (existing values stay valid).
ALTER TABLE mycarco_db.mc_lease_deals DROP CONSTRAINT IF EXISTS mc_lease_deals_insurance_status_check;
ALTER TABLE mycarco_db.mc_lease_deals
  ADD CONSTRAINT mc_lease_deals_insurance_status_check
  CHECK (insurance_status IN ('not_provided', 'information_entered', 'provided_unverified',
                              'pending_verification', 'verified', 'expired', 'rejected'));

CREATE TABLE IF NOT EXISTS mycarco_db.mc_lease_insurance_agreements (
  id                      bigserial PRIMARY KEY,
  deal_id                 bigint NOT NULL UNIQUE REFERENCES mycarco_db.mc_lease_deals(id) ON DELETE CASCADE,
  -- Creditor / loss payee: never assumed to be the dealer.
  creditor_is_dealer      boolean NOT NULL DEFAULT false,
  creditor_name           varchar(160),
  creditor_address        jsonb,                -- {street, city, state, zip}
  creditor_confirmed_by   varchar(255),
  agent_name              varchar(160),
  agent_phone             varchar(20),
  effective_from          date,
  effective_to            date,
  coverage_fire_theft     varchar(20) CHECK (coverage_fire_theft IN ('confirmed', 'reported', 'not_selected', 'not_applicable')),
  coverage_comprehensive  varchar(20) CHECK (coverage_comprehensive IN ('confirmed', 'reported', 'not_selected', 'not_applicable')),
  coverage_collision      varchar(20) CHECK (coverage_collision IN ('confirmed', 'reported', 'not_selected', 'not_applicable')),
  comprehensive_deductible_cents bigint CHECK (comprehensive_deductible_cents >= 0),
  collision_deductible_cents     bigint CHECK (collision_deductible_cents >= 0),
  verified_by             varchar(255),
  verified_at             timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CHECK (effective_to IS NULL OR effective_from IS NULL OR effective_to > effective_from),
  CHECK (NOT creditor_is_dealer OR creditor_confirmed_by IS NOT NULL)
);

ALTER TABLE mycarco_db.mc_lease_insurance_agreements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON mycarco_db.mc_lease_insurance_agreements FROM anon, authenticated;
GRANT ALL ON mycarco_db.mc_lease_insurance_agreements TO service_role;
GRANT USAGE, SELECT ON SEQUENCE mycarco_db.mc_lease_insurance_agreements_id_seq TO service_role;
