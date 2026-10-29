-- Lease to Own, Phase 4: shared deal terms, contract templates and signatures.
-- PROPOSED — not executed. Run only after approval, AFTER 2026_mc_lease_to_own.sql
-- and 2026_mc_lease_applicants.sql. Additive only; safe to run more than once.
--
-- One deal per application holds the values every contract form reads (the
-- shared deal model in src/lib/deal-model.ts). Each value keeps its source,
-- verification and who changed it. Financial lines are entered only by staff and
-- totals are recalculated on the server before any contract is released.
--
-- Security model (unchanged): RLS on with NO policies and nothing granted to anon
-- or authenticated. Only server functions using the service role read or write
-- these tables, after verifying the signed-in customer (own deal, read-only) or
-- the staff role (edit, lock, release). Nothing here is in the public schema.

-- ------------------------------------------------------------
-- Deal (one per application)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mycarco_db.mc_lease_deals (
  id                    bigserial PRIMARY KEY,
  application_id        bigint NOT NULL UNIQUE REFERENCES mycarco_db.mc_lease_applications(id) ON DELETE CASCADE,
  deal_number           varchar(40) UNIQUE,
  contract_number       varchar(40),
  contract_date         date,
  status                varchar(30) NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'staff_review', 'financials_locked', 'released', 'completed', 'voided')),
  -- Dealer / Seller snapshot (approved business details at contract time)
  dealer_legal_name     varchar(160),
  dealer_address        jsonb,          -- {street, city, state, zip}
  dealer_phone          varchar(20),
  dealer_license_number varchar(40),
  salesperson           varchar(120),
  authorized_signer     varchar(120),
  -- Vehicle snapshot (from inventory, confirmed by staff)
  vehicle_condition     varchar(10) CHECK (vehicle_condition IN ('new', 'used', 'demo')),
  vehicle_body_style    varchar(60),
  vehicle_license_number varchar(20),
  vehicle_odometer      integer CHECK (vehicle_odometer >= 0),
  vehicle_other         varchar(200),
  -- Insurance (verified only by staff against the uploaded declaration page)
  insurance_company     varchar(120),
  insurance_policy_number varchar(60),
  insurance_status      varchar(30) NOT NULL DEFAULT 'not_provided'
                        CHECK (insurance_status IN ('not_provided', 'provided_unverified', 'verified')),
  insurance_document_id bigint REFERENCES mycarco_db.mc_lease_documents(id) ON DELETE SET NULL,
  as_is_acknowledged    boolean NOT NULL DEFAULT false,
  -- Per-field provenance for non-line fields: {"buyer.street": {"source": "staff", "verified": false, "edited": true, "by": "...", "at": "..."}}
  field_sources         jsonb NOT NULL DEFAULT '{}'::jsonb,
  financials_locked_at  timestamptz,
  financials_locked_by  varchar(255),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- Up to two trade-ins, as on the Bill of Sale.
CREATE TABLE IF NOT EXISTS mycarco_db.mc_lease_deal_trade_ins (
  id                    bigserial PRIMARY KEY,
  deal_id               bigint NOT NULL REFERENCES mycarco_db.mc_lease_deals(id) ON DELETE CASCADE,
  slot                  smallint NOT NULL CHECK (slot IN (1, 2)),
  year                  varchar(4),
  make                  varchar(60),
  model                 varchar(80),
  body_style            varchar(60),
  vin                   varchar(40),
  license_number        varchar(20),
  odometer              integer CHECK (odometer >= 0),
  color                 varchar(60),
  lienholder_name       varchar(160),
  lienholder_address    varchar(255),
  lienholder_phone      varchar(20),
  payoff_cents          bigint CHECK (payoff_cents >= 0),
  payoff_good_through   date,
  appraisal_status      varchar(20) NOT NULL DEFAULT 'pending'
                        CHECK (appraisal_status IN ('pending', 'approved', 'declined')),
  approved_by           varchar(255),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (deal_id, slot)
);

-- Itemization lines. Only staff-entered lines are stored; calculated lines
-- (3, 15, 23, 24, 27, 30, 31) are computed by the server and never stored as input.
CREATE TABLE IF NOT EXISTS mycarco_db.mc_lease_deal_line_items (
  id                    bigserial PRIMARY KEY,
  deal_id               bigint NOT NULL REFERENCES mycarco_db.mc_lease_deals(id) ON DELETE CASCADE,
  line_no               smallint NOT NULL
                        CHECK (line_no BETWEEN 1 AND 31 AND line_no NOT IN (3, 15, 23, 24, 27, 30, 31)),
  label                 varchar(120),            -- approved label for configurable lines 13, 14, 17–22
  amount_cents          bigint CHECK (amount_cents >= 0),  -- null = N/A
  source                varchar(20) NOT NULL DEFAULT 'staff'
                        CHECK (source IN ('inventory', 'package', 'application', 'staff', 'fee_schedule')),
  verified              boolean NOT NULL DEFAULT false,
  entered_by            varchar(255),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (deal_id, line_no)
);

-- ------------------------------------------------------------
-- Approved contract templates and versions
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mycarco_db.mc_lease_contract_templates (
  id                    bigserial PRIMARY KEY,
  contract_id           varchar(40) NOT NULL,     -- bill_of_sale … ach_card_authorization (src/lib/lease-contracts.ts)
  version               varchar(40) NOT NULL,
  storage_bucket        varchar(60) NOT NULL,     -- private bucket only
  storage_path          text NOT NULL,
  sha256                char(64) NOT NULL,        -- the exact approved file
  field_map             jsonb NOT NULL DEFAULT '{}'::jsonb,  -- PDF field/coordinate → deal field
  approved_by           varchar(255) NOT NULL,
  approved_at           timestamptz NOT NULL,
  retired_at            timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contract_id, version)
);

-- Link each deal's agreement to the template version it was built from, and record release.
ALTER TABLE mycarco_db.mc_lease_agreements
  ADD COLUMN IF NOT EXISTS template_id  bigint REFERENCES mycarco_db.mc_lease_contract_templates(id),
  ADD COLUMN IF NOT EXISTS released_at  timestamptz,
  ADD COLUMN IF NOT EXISTS released_by  varchar(255),
  ADD COLUMN IF NOT EXISTS deal_snapshot_sha256 char(64);  -- hash of the deal values the document was filled with

-- ------------------------------------------------------------
-- Signatures (one row per signer per agreement)
-- ------------------------------------------------------------
-- Only a verified e-signature provider callback may set status 'signed'.
CREATE TABLE IF NOT EXISTS mycarco_db.mc_lease_agreement_signatures (
  id                    bigserial PRIMARY KEY,
  agreement_id          bigint NOT NULL REFERENCES mycarco_db.mc_lease_agreements(id) ON DELETE CASCADE,
  requirement_id        varchar(40) NOT NULL,     -- e.g. p1-buyer, p3-dealer (src/lib/bill-of-sale.ts)
  signer_role           varchar(20) NOT NULL CHECK (signer_role IN ('buyer', 'co_buyer', 'dealer')),
  applicant_id          bigint REFERENCES mycarco_db.mc_lease_applicants(id) ON DELETE SET NULL,
  signer_identity       varchar(255),
  template_version      varchar(40),
  status                varchar(20) NOT NULL DEFAULT 'not_ready'
                        CHECK (status IN ('not_ready', 'awaiting_provider', 'sent', 'signed', 'declined')),
  signed_at             timestamptz,
  provider              varchar(60),
  provider_reference    varchar(255),
  signed_pdf_path       text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agreement_id, requirement_id),
  CHECK (status <> 'signed' OR (provider_reference IS NOT NULL AND signed_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS mc_lease_deals_status_idx ON mycarco_db.mc_lease_deals (status);
CREATE INDEX IF NOT EXISTS mc_lease_agreement_signatures_agreement_idx ON mycarco_db.mc_lease_agreement_signatures (agreement_id);

-- ------------------------------------------------------------
-- Access
-- ------------------------------------------------------------
ALTER TABLE mycarco_db.mc_lease_deals                ENABLE ROW LEVEL SECURITY;
ALTER TABLE mycarco_db.mc_lease_deal_trade_ins       ENABLE ROW LEVEL SECURITY;
ALTER TABLE mycarco_db.mc_lease_deal_line_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE mycarco_db.mc_lease_contract_templates   ENABLE ROW LEVEL SECURITY;
ALTER TABLE mycarco_db.mc_lease_agreement_signatures ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON
  mycarco_db.mc_lease_deals, mycarco_db.mc_lease_deal_trade_ins, mycarco_db.mc_lease_deal_line_items,
  mycarco_db.mc_lease_contract_templates, mycarco_db.mc_lease_agreement_signatures
  FROM anon, authenticated;

GRANT ALL ON
  mycarco_db.mc_lease_deals, mycarco_db.mc_lease_deal_trade_ins, mycarco_db.mc_lease_deal_line_items,
  mycarco_db.mc_lease_agreement_signatures
  TO service_role;
-- Approved templates are add-only (a new version is a new row; retire, never edit).
GRANT SELECT, INSERT ON mycarco_db.mc_lease_contract_templates TO service_role;
GRANT UPDATE (retired_at) ON mycarco_db.mc_lease_contract_templates TO service_role;
GRANT USAGE, SELECT ON SEQUENCE
  mycarco_db.mc_lease_deals_id_seq, mycarco_db.mc_lease_deal_trade_ins_id_seq,
  mycarco_db.mc_lease_deal_line_items_id_seq, mycarco_db.mc_lease_contract_templates_id_seq,
  mycarco_db.mc_lease_agreement_signatures_id_seq
  TO service_role;
