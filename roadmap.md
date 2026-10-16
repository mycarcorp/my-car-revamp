# MyCar build roadmap

## Lighthouse improvements — Oct 16
- [x] Optimize VDP primary image, secondary gallery work, and repeated rendering.
- [x] Optimize search initial loading and hidden carousel photos.
- [x] Optimize blog image loading and locations layout stability.
- [x] Address source-confirmed accessibility/SEO issues and review third-party scripts.
- [x] Run relevant tests and browser checks; document changes, measurements, and external limitations.
- [ ] Production Lighthouse score verification — waits for approval to publish these changes.
- [ ] Responsive transformed photo variants — requires an approved managed image transformation service; original vehicle photos retained.
- [ ] GHL avatar aspect ratio and third-party cookie configuration — requires changes in the provider's widget settings.

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


## Auth (Sep 11)
- Fixed: account creation + sign-in now run against project rpmmlzyeqpvczuuobddt
- Open: password-reset / verification emails fail (project email sending returns 500) — needs SMTP setup
- Open: Google sign-in provider is disabled on that project

## AutoSEO blog (Sep 16)
- Done: `mycarco_db.blog_posts` SQL (supabase/migrations_legacy/2026_autoseo_blog_posts.sql), webhook
  `/api/public/receive-article` (bearer AUTOSEO_WEBHOOK_TOKEN), combined /blog listing + /blog/$slug
  article view (hero, prose, FAQ accordion, related, JSON-LD), /sitemap.xml, robots sitemap line
- Open: run the SQL once in the project's SQL editor — until then the webhook returns 500 (table missing)

## Phase 1 — Buy a Car (Oct 15)
- Done: /my dashboard, Get Started, 5-step purchase flow, admin Transactions
- Open: run supabase/migrations_legacy/2026_mc_purchases.sql in SQL editor
- Waiting: Phase 2 needs user approval
