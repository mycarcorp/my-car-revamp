-- Lease to Own, Form 4: Disclosure Statement and Agreement for GPS Installation.
-- PROPOSED — not executed. Run only after approval, AFTER 2026_mc_lease_deals.sql.
-- Additive only; safe to run more than once.
--
-- Records only: which device is assigned to a deal and each signer's
-- acknowledgment of each numbered provision. Nothing here (or in the web form)
-- tracks, locates, disables or otherwise controls a vehicle or device. Any future
-- device integration needs its own separately authorized, audited server path.
--
-- Security model (unchanged): RLS on with NO policies, nothing granted to anon or
-- authenticated. Only server functions using the service role read or write, after
-- verifying the staff role (assign/verify) or the signed-in signer (own
-- acknowledgments). Nothing here is in the public schema.

-- Device assignment per deal. "verified" only by authorized staff or a verified provider record.
CREATE TABLE IF NOT EXISTS mycarco_db.mc_lease_gps_devices (
  id                    bigserial PRIMARY KEY,
  deal_id               bigint NOT NULL UNIQUE REFERENCES mycarco_db.mc_lease_deals(id) ON DELETE CASCADE,
  device_id             varchar(60),
  status                varchar(30) NOT NULL DEFAULT 'not_assigned'
                        CHECK (status IN ('not_assigned', 'pending_verification', 'verified')),
  controller_name       varchar(160),          -- only if different from the dealership
  assignee_name         varchar(160),
  verified_by           varchar(255),
  verified_at           timestamptz,
  provider              varchar(60),
  provider_reference    varchar(255),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CHECK (status = 'not_assigned' OR device_id IS NOT NULL),
  CHECK (status <> 'verified' OR (verified_by IS NOT NULL AND verified_at IS NOT NULL))
);

-- Provision acknowledgments (append-only evidence; a withdrawal is a new row).
CREATE TABLE IF NOT EXISTS mycarco_db.mc_lease_agreement_acknowledgments (
  id                    bigserial PRIMARY KEY,
  agreement_id          bigint NOT NULL REFERENCES mycarco_db.mc_lease_agreements(id) ON DELETE CASCADE,
  provision_no          smallint NOT NULL CHECK (provision_no BETWEEN 1 AND 50),
  signer_role           varchar(20) NOT NULL CHECK (signer_role IN ('buyer', 'co_buyer')),
  applicant_id          bigint REFERENCES mycarco_db.mc_lease_applicants(id) ON DELETE SET NULL,
  template_version      varchar(40) NOT NULL,
  initials              varchar(4) NOT NULL,
  acknowledged          boolean NOT NULL,
  provider              varchar(60),
  provider_reference    varchar(255),
  recorded_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mc_lease_agreement_ack_idx
  ON mycarco_db.mc_lease_agreement_acknowledgments (agreement_id, provision_no, signer_role);

ALTER TABLE mycarco_db.mc_lease_gps_devices               ENABLE ROW LEVEL SECURITY;
ALTER TABLE mycarco_db.mc_lease_agreement_acknowledgments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON mycarco_db.mc_lease_gps_devices, mycarco_db.mc_lease_agreement_acknowledgments
  FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON mycarco_db.mc_lease_gps_devices TO service_role;
-- Acknowledgments are evidence: insert and read only.
GRANT SELECT, INSERT ON mycarco_db.mc_lease_agreement_acknowledgments TO service_role;
GRANT USAGE, SELECT ON SEQUENCE
  mycarco_db.mc_lease_gps_devices_id_seq, mycarco_db.mc_lease_agreement_acknowledgments_id_seq
  TO service_role;
