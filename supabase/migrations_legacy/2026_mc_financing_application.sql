-- Financing application: store the full credit-application form on
-- mycarco_db.mc_financing. Additive only — no existing column, row, policy or
-- table is changed. Safe to run more than once.

ALTER TABLE mycarco_db.mc_financing
  ADD COLUMN IF NOT EXISTS salutation              varchar(20),
  ADD COLUMN IF NOT EXISTS first_name              varchar(120),
  ADD COLUMN IF NOT EXISTS middle_name             varchar(120),
  ADD COLUMN IF NOT EXISTS last_name               varchar(120),
  ADD COLUMN IF NOT EXISTS suffix                  varchar(20),
  ADD COLUMN IF NOT EXISTS nick_name               varchar(120),
  ADD COLUMN IF NOT EXISTS gender                  varchar(40),
  ADD COLUMN IF NOT EXISTS cash_down               numeric(12,2),
  ADD COLUMN IF NOT EXISTS ssn                     varchar(20),
  ADD COLUMN IF NOT EXISTS date_of_birth           date,
  ADD COLUMN IF NOT EXISTS cell_phone              varchar(40),
  ADD COLUMN IF NOT EXISTS home_phone              varchar(40),
  ADD COLUMN IF NOT EXISTS work_phone              varchar(40),
  ADD COLUMN IF NOT EXISTS id_type                 varchar(60),
  ADD COLUMN IF NOT EXISTS id_state                varchar(10),
  ADD COLUMN IF NOT EXISTS id_number               varchar(60),
  ADD COLUMN IF NOT EXISTS id_issued_date          date,
  ADD COLUMN IF NOT EXISTS id_expiration_date      date,
  ADD COLUMN IF NOT EXISTS current_address         jsonb,
  ADD COLUMN IF NOT EXISTS mailing_address         jsonb,
  ADD COLUMN IF NOT EXISTS mailing_same_as_current boolean,
  ADD COLUMN IF NOT EXISTS previous_address        jsonb,
  ADD COLUMN IF NOT EXISTS current_employer_1      jsonb,
  ADD COLUMN IF NOT EXISTS current_employer_2      jsonb,
  ADD COLUMN IF NOT EXISTS previous_employer_1     jsonb,
  ADD COLUMN IF NOT EXISTS previous_employer_2     jsonb,
  ADD COLUMN IF NOT EXISTS other_income_amount     numeric(12,2),
  ADD COLUMN IF NOT EXISTS other_income_source     varchar(160),
  ADD COLUMN IF NOT EXISTS applicant_references    jsonb,
  ADD COLUMN IF NOT EXISTS apr                     numeric(6,3),
  ADD COLUMN IF NOT EXISTS estimated_payment       numeric(12,2),
  ADD COLUMN IF NOT EXISTS application             jsonb;

CREATE INDEX IF NOT EXISTS mc_financing_created_at_idx
  ON mycarco_db.mc_financing (created_at DESC);
