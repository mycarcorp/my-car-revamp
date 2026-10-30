-- Lease to Own, Form 5: Customer Delivery Checklist.
-- PROPOSED — not executed. Run only after approval, AFTER 2026_mc_lease_deals.sql and
-- 2026_mc_lease_gps_disclosure.sql (which creates mc_lease_agreement_acknowledgments).
-- Additive only; safe to run more than once.
--
-- Statement initials reuse mc_lease_agreement_acknowledgments (Form 4), one row per
-- statement per signer. This adds only staff records of handing documents over,
-- and the representative's role. Recording them never marks a vehicle delivered or
-- a lease active; those stay in the dealership's authorized delivery workflow.
--
-- Security model (unchanged): RLS on with NO policies, nothing granted to anon or
-- authenticated. Only server functions using the service role write, after verifying
-- the staff role. Nothing here is in the public schema.

CREATE TABLE IF NOT EXISTS mycarco_db.mc_lease_document_deliveries (
  id                    bigserial PRIMARY KEY,
  deal_id               bigint NOT NULL REFERENCES mycarco_db.mc_lease_deals(id) ON DELETE CASCADE,
  document_key          varchar(40) NOT NULL
                        CHECK (document_key IN ('buyers_order', 'buyers_guide', 'buyers_guide_displayed',
                                                'warranty_documents', 'odometer_disclosure')),
  recorded_by           varchar(255) NOT NULL,   -- authorized staff member
  recorded_at           timestamptz NOT NULL DEFAULT now(),
  voided_at             timestamptz,
  voided_by             varchar(255)
);
CREATE INDEX IF NOT EXISTS mc_lease_document_deliveries_deal_idx
  ON mycarco_db.mc_lease_document_deliveries (deal_id, document_key);

ALTER TABLE mycarco_db.mc_lease_deals
  ADD COLUMN IF NOT EXISTS representative_title varchar(120);

ALTER TABLE mycarco_db.mc_lease_document_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON mycarco_db.mc_lease_document_deliveries FROM anon, authenticated;
-- Evidence: insert, read, and void (never delete).
GRANT SELECT, INSERT ON mycarco_db.mc_lease_document_deliveries TO service_role;
GRANT UPDATE (voided_at, voided_by) ON mycarco_db.mc_lease_document_deliveries TO service_role;
GRANT USAGE, SELECT ON SEQUENCE mycarco_db.mc_lease_document_deliveries_id_seq TO service_role;
