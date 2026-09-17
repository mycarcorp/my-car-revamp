-- Sell / Trade page: store every field of the appraisal request in the legacy
-- schema. Additive only — no existing table, column, row or policy changes.
-- Safe to run more than once.

CREATE TABLE IF NOT EXISTS mycarco_db.mc_trade_ins (
  id                    bigserial PRIMARY KEY,
  user_id               bigint,
  -- Customer
  full_name             varchar(255) NOT NULL,
  email                 varchar(255),
  phone                 varchar(40),
  address               text,
  zip                   varchar(20),
  intent                varchar(40),           -- 'trade' or 'sell'
  -- Vehicle being sold / traded
  vin                   varchar(40),
  license_plate         varchar(40),
  year_make_model       varchar(255),
  odometer              integer,
  condition             varchar(40),
  title_status          varchar(40),
  message               text,
  -- Trade toward inventory
  wish_list             jsonb,
  selected_vehicle_ids  text,
  selected_vehicles     jsonb,
  -- Appraisal worksheet (first saved trade-in, flattened for reporting)
  vehicle_year          varchar(10),
  make                  varchar(120),
  model                 varchar(120),
  trim                  varchar(120),
  engine                varchar(120),
  transmission          varchar(60),
  drivetrain            varchar(40),
  doors                 varchar(10),
  cylinders             varchar(10),
  body_type             varchar(60),
  fuel_type             varchar(60),
  horsepower            varchar(20),
  exterior_color        varchar(60),
  interior_color        varchar(60),
  mpg_city              varchar(10),
  mpg_highway           varchar(10),
  vehicle_weight        varchar(20),
  gvw                   varchar(20),
  stock_number          varchar(60),
  appraisal_date        date,
  location              varchar(120),
  appraiser_name        varchar(120),
  sales_rep             varchar(120),
  target_selling_price  numeric(12,2),
  recondition           numeric(12,2),
  packs                 numeric(12,2),
  additional            numeric(12,2),
  gross_profit          numeric(12,2),
  appraisal_value       numeric(12,2),
  source                varchar(60),
  lienholder            varchar(160),
  lien_account_number   varchar(80),
  payoff_amount         numeric(12,2),
  payoff_due_date       date,
  per_diem              numeric(12,2),
  memo                  text,
  title_owner           varchar(160),
  title_state           varchar(20),
  title_brand           varchar(80),
  license_number        varchar(60),
  license_state         varchar(20),
  license_expiry_date   date,
  notes                 text,
  -- Full raw payloads
  photo_names           text,
  trade_ins             jsonb,
  submission            jsonb,
  status                varchar(40) NOT NULL DEFAULT 'new',
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mc_trade_ins_created_at_idx ON mycarco_db.mc_trade_ins (created_at DESC);
CREATE INDEX IF NOT EXISTS mc_trade_ins_email_idx ON mycarco_db.mc_trade_ins (email);
CREATE INDEX IF NOT EXISTS mc_trade_ins_vin_idx ON mycarco_db.mc_trade_ins (vin);

ALTER TABLE mycarco_db.mc_trade_ins ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'mycarco_db' AND tablename = 'mc_trade_ins'
      AND policyname = 'service role manages trade-ins'
  ) THEN
    CREATE POLICY "service role manages trade-ins"
      ON mycarco_db.mc_trade_ins FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON mycarco_db.mc_trade_ins TO service_role;
GRANT USAGE, SELECT ON SEQUENCE mycarco_db.mc_trade_ins_id_seq TO service_role;
