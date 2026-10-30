-- Lease to Own, Form 2: Retail Installment Contract terms.
-- PROPOSED — not executed. Run only after approval, AFTER 2026_mc_lease_deals.sql.
-- Additive only; safe to run more than once.
--
-- Stores the Form 2 values of the shared deal model (src/lib/retail-installment-fields.ts).
-- Parties, dealer, vehicle, trade-ins and contract number/date stay on
-- mc_lease_deals / mc_lease_deal_trade_ins and are NOT duplicated here.
-- Calculated rows (d, h, i, j, y, aa) and the Truth-In-Lending figures are never
-- stored as input: the server recomputes them (src/lib/retail-installment.ts)
-- before any contract is released.
--
-- Security model (unchanged): RLS on with NO policies, nothing granted to anon or
-- authenticated. Only server functions using the service role read or write,
-- after verifying the staff role (edit) or the signed-in customer (own deal,
-- read-only). Nothing here is in the public schema.

-- Form 1 page 3 notice checkboxes (added to the deal model for Form 1).
ALTER TABLE mycarco_db.mc_lease_deals
  ADD COLUMN IF NOT EXISTS notice_demonstrator boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notice_financing    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notice_arbitration  boolean NOT NULL DEFAULT false;

-- One row of Form 2 terms per deal. Optional products and acknowledgments default to "not selected".
CREATE TABLE IF NOT EXISTS mycarco_db.mc_lease_ric_terms (
  id                      bigserial PRIMARY KEY,
  deal_id                 bigint NOT NULL UNIQUE REFERENCES mycarco_db.mc_lease_deals(id) ON DELETE CASCADE,
  business_purpose        boolean NOT NULL DEFAULT false,
  late_charge             boolean NOT NULL DEFAULT false,
  late_charge_days        smallint CHECK (late_charge_days > 0),
  late_charge_terms       varchar(200),
  no_liability_insurance  boolean NOT NULL DEFAULT false,
  conditional_delivery    boolean NOT NULL DEFAULT false,
  conditional_delivery_agreement varchar(200),
  contract_rate           numeric(6,3) CHECK (contract_rate >= 0 AND contract_rate < 100),
  post_maturity_rate      numeric(6,3) CHECK (post_maturity_rate >= 0 AND post_maturity_rate < 100),
  sales_tax_included_cents bigint CHECK (sales_tax_included_cents >= 0),
  additional_charge       boolean NOT NULL DEFAULT false,
  additional_charge_description varchar(120),
  additional_charge_cents bigint CHECK (additional_charge_cents >= 0),
  additional_charge_payment varchar(10) CHECK (additional_charge_payment IN ('cash', 'financed')),
  -- Insurance disclosures: {"credit_life": {"coverage": "single", "premium_cents": ..., "term": ..., "insured": ...}, ...}
  insurance               jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Additional protections: {"service_contract": {"selected": false, ...}, "gap": {...}, "other": {...}}
  protections             jsonb NOT NULL DEFAULT '{}'::jsonb,
  third_party_owner_included boolean NOT NULL DEFAULT false,
  third_party_owner_name  varchar(160),
  third_party_owner_verified_by varchar(255),
  esign_acknowledgment    boolean NOT NULL DEFAULT false,
  assignee_name           varchar(160),
  assignee_address        varchar(255),
  assignee_phone          varchar(20),
  assignment_recourse     boolean NOT NULL DEFAULT false,
  assignment_status       varchar(20) CHECK (assignment_status IN ('not_assigned', 'pending', 'assigned')),
  financing_approved_at   timestamptz,
  financing_approved_by   varchar(255),
  field_sources           jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CHECK (NOT third_party_owner_included OR third_party_owner_name IS NOT NULL)
);

-- Itemization input rows a, b, c, e, f, g, k–x, z. Exactly one of amount / N/A / INCL.; no row = unknown.
CREATE TABLE IF NOT EXISTS mycarco_db.mc_lease_ric_items (
  id                      bigserial PRIMARY KEY,
  deal_id                 bigint NOT NULL REFERENCES mycarco_db.mc_lease_deals(id) ON DELETE CASCADE,
  row_letter              varchar(2) NOT NULL
                          CHECK (row_letter IN ('a','b','c','e','f','g','k','l','m','n','o','p','q','r','s','t','u','v','w','x','z')),
  amount_cents            bigint CHECK (amount_cents >= 0),
  not_applicable          boolean NOT NULL DEFAULT false,
  included_elsewhere      boolean NOT NULL DEFAULT false,
  detail                  varchar(160),             -- paid to / description
  source                  varchar(20) NOT NULL DEFAULT 'staff' CHECK (source IN ('staff', 'bill_of_sale', 'fee_schedule')),
  entered_by              varchar(255),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (deal_id, row_letter),
  CHECK ((amount_cents IS NOT NULL)::int + not_applicable::int + included_elsewhere::int = 1)
);

-- Payment schedule rows (up to 3, as on the form).
CREATE TABLE IF NOT EXISTS mycarco_db.mc_lease_ric_payment_schedule (
  id                      bigserial PRIMARY KEY,
  deal_id                 bigint NOT NULL REFERENCES mycarco_db.mc_lease_deals(id) ON DELETE CASCADE,
  row_no                  smallint NOT NULL CHECK (row_no BETWEEN 1 AND 3),
  payment_count           smallint NOT NULL CHECK (payment_count BETWEEN 1 AND 999),
  amount_cents            bigint NOT NULL CHECK (amount_cents > 0),
  frequency               varchar(12) NOT NULL CHECK (frequency IN ('once', 'weekly', 'biweekly', 'semimonthly', 'monthly')),
  first_due               date NOT NULL,
  kind                    varchar(15) NOT NULL DEFAULT 'installment' CHECK (kind IN ('installment', 'deferred_down')),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (deal_id, row_no),
  CHECK (frequency <> 'once' OR payment_count = 1)
);

-- Signatures: allow the Third Party Owner role (Form 2, page 4).
ALTER TABLE mycarco_db.mc_lease_agreement_signatures
  DROP CONSTRAINT IF EXISTS mc_lease_agreement_signatures_signer_role_check;
ALTER TABLE mycarco_db.mc_lease_agreement_signatures
  ADD CONSTRAINT mc_lease_agreement_signatures_signer_role_check
  CHECK (signer_role IN ('buyer', 'co_buyer', 'third_party_owner', 'dealer'));

-- Access
ALTER TABLE mycarco_db.mc_lease_ric_terms            ENABLE ROW LEVEL SECURITY;
ALTER TABLE mycarco_db.mc_lease_ric_items            ENABLE ROW LEVEL SECURITY;
ALTER TABLE mycarco_db.mc_lease_ric_payment_schedule ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON
  mycarco_db.mc_lease_ric_terms, mycarco_db.mc_lease_ric_items, mycarco_db.mc_lease_ric_payment_schedule
  FROM anon, authenticated;
GRANT ALL ON
  mycarco_db.mc_lease_ric_terms, mycarco_db.mc_lease_ric_items, mycarco_db.mc_lease_ric_payment_schedule
  TO service_role;
GRANT USAGE, SELECT ON SEQUENCE
  mycarco_db.mc_lease_ric_terms_id_seq, mycarco_db.mc_lease_ric_items_id_seq,
  mycarco_db.mc_lease_ric_payment_schedule_id_seq
  TO service_role;
