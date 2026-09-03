# MyCar build roadmap

## Done
- Database schema (vehicles, photos, leads, appointments, blog, collections, service areas, site settings, roles, saved items) + RLS
- Design system, header/footer, home, search, VDP, finance, sell, schedule, contact, about, blog, locations, auth, account
- Google sign-in enabled

## In progress
- Staff admin: lead inbox, inventory manager, blog editor, site settings

## New (from user)
- Read real inventory from custom schema `mycarco_db.mc_cars` instead of the app's own vehicles table
  - Inspect mc_cars columns, map to existing vehicle cards / VDP
  - Loading, empty and error states
  - Read-only: no writes or deletes to mc_cars
