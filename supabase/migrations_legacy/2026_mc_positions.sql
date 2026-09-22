-- Positions & responsibilities for staff accounts (legacy mycarco_db schema).
-- Non-destructive: safe to run more than once.

create table if not exists mycarco_db.mc_positions (
  id bigserial primary key,
  name text not null,
  description text,
  responsibilities text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists mc_positions_name_key
  on mycarco_db.mc_positions (lower(name));

alter table mycarco_db.mc_users
  add column if not exists position_id bigint
  references mycarco_db.mc_positions (id) on delete set null;

create index if not exists mc_users_position_id_idx
  on mycarco_db.mc_users (position_id);

grant usage on schema mycarco_db to service_role;
grant all on mycarco_db.mc_positions to service_role;
grant usage, select on sequence mycarco_db.mc_positions_id_seq to service_role;

alter table mycarco_db.mc_positions enable row level security;

drop policy if exists "service role manages positions" on mycarco_db.mc_positions;
create policy "service role manages positions"
  on mycarco_db.mc_positions
  for all
  to service_role
  using (true)
  with check (true);
