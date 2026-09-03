# MyCar build roadmap

## Done
- Database schema (vehicles, photos, leads, appointments, blog, collections, service areas, site settings, roles, saved items) + RLS
- Design system, header/footer, home, search, VDP, finance, sell, schedule, contact, about, blog, locations, auth, account
- Google sign-in enabled

## Done (cont.)
- Sign-in / registration page + Google sign-in
- Staff admin: lead inbox, inventory manager, blog editor, site settings

## Blocked
- Load inventory from `mycarco_db.mc_cars`: that schema/table does not exist in this project's
  Lovable Cloud backend (only `public` + Supabase system schemas). Need either the data export to
  import into `public.vehicles`, or confirmation of which backend holds mc_cars.
  Listing pages already read live records from the database (no mock data) with loading/empty/error states.

## Still to do
- Inventory feed/CSV import
- Original photography for remaining stock imagery
- Security linter pass on RLS
