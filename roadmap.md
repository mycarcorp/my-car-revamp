# MyCar build roadmap

## Done
- Database schema (vehicles, photos, leads, appointments, blog, collections, service areas, site settings, roles, saved items) + RLS
- Design system, header/footer, home, search, VDP, finance, sell, schedule, contact, about, blog, locations, auth, account
- Google sign-in enabled

## Done (cont.)
- Sign-in / registration page + Google sign-in
- Staff admin: lead inbox, inventory manager, blog editor, site settings
- Legacy inventory import: 38 vehicles in `public.vehicles`
- Legacy photo import: 190 images in the `vehicle-photos` storage bucket (VIN-based paths),
  190 `vehicle_photos` rows, served through `/api/public/vehicle-photos/{vin}/photo-N.jpg`
  (public storage buckets are blocked on this platform, so a read-only proxy route serves them)

## Still to do
- Ongoing inventory feed sync
- Security linter pass on RLS

