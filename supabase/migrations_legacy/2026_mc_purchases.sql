-- Phase 1: customer "Buy a car" transactions (dashboard at /my).
-- Additive only — no existing table, column, row or policy changes.
-- Safe to run more than once. Paste into the SQL editor and run.

CREATE TABLE IF NOT EXISTS mycarco_db.mc_purchases (
  id                    bigserial PRIMARY KEY,
  user_id               uuid NOT NULL,              -- auth user id
  status                varchar(40) NOT NULL DEFAULT 'draft',
  current_step          varchar(40) NOT NULL DEFAULT 'vehicle',
  -- Customer
  full_name             varchar(255),
  email                 varchar(255),
  phone                 varchar(40),
  date_of_birth         date,
  address               text,
  city                  varchar(120),
  state                 varchar(40),
  zip                   varchar(20),
  -- Vehicle snapshot at the time the purchase was started
  vehicle_id            text,
  vehicle_slug          text,
  vehicle_vin           varchar(40),
  vehicle_title         varchar(255),
  vehicle_price_cents   bigint,
  vehicle_mileage       integer,
  vehicle_photo         text,
  -- Payment
  payment_method        varchar(40),                -- cash | mycar_financing | outside_financing
  lender_name           varchar(160),
  preapproval_amount    numeric(12,2),
  -- Trade-in (basic only in Phase 1)
  has_trade_in          boolean,
  trade_year_make_model varchar(255),
  trade_mileage         integer,
  trade_vin             varchar(40),
  trade_payoff          numeric(12,2),
  -- Staff
  assigned_to           varchar(255),
  lead_id               uuid,
  submitted_at          timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mc_purchases_user_idx ON mycarco_db.mc_purchases (user_id);
CREATE INDEX IF NOT EXISTS mc_purchases_status_idx ON mycarco_db.mc_purchases (status);

CREATE TABLE IF NOT EXISTS mycarco_db.mc_purchase_events (
  id                  bigserial PRIMARY KEY,
  purchase_id         bigint NOT NULL REFERENCES mycarco_db.mc_purchases(id) ON DELETE CASCADE,
  event_type          varchar(40) NOT NULL,          -- status_change | note | submitted | created
  message             text,
  visible_to_customer boolean NOT NULL DEFAULT true,
  author              varchar(255),
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mc_purchase_events_purchase_idx ON mycarco_db.mc_purchase_events (purchase_id);

-- Only the server (service role) reads/writes these tables; the browser never does.
ALTER TABLE mycarco_db.mc_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE mycarco_db.mc_purchase_events ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA mycarco_db TO service_role;
GRANT ALL ON mycarco_db.mc_purchases, mycarco_db.mc_purchase_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE mycarco_db.mc_purchases_id_seq, mycarco_db.mc_purchase_events_id_seq TO service_role;

-- Lets submitted purchases appear as their own lead type in Customers.
ALTER TYPE public.lead_type ADD VALUE IF NOT EXISTS 'purchase';
