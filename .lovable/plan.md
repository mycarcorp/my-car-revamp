# Phase 1 — Customer Dashboard + Buy a Car Workflow

## What customers get
- A **Get Started** button on every vehicle card (inventory page, home, picker) and on the vehicle detail page.
- Clicking it: signed-out visitors see the existing sign-in sheet (Google or email); after sign-in they land on `/my` with that car's purchase started. If they already have an open purchase for that car, it resumes instead of creating a duplicate.
- **/my dashboard** (signed-in only):
  - **Left sidebar**: Overview, My Purchases, Saved Vehicles, My Requests, Profile, Sign out. Collapses to a top menu on phones.
  - **Right workspace** for the selected purchase, as a step-by-step flow:
    1. **Vehicle** — photo, price, mileage, VIN, link back to the listing.
    2. **Personal details** — name, email, phone, date of birth, address (prefilled from the account).
    3. **Payment method** — Cash, My Car Financing, or Outside Financing (lender name + pre-approval amount, optional).
    4. **Trade-in** — "No trade-in" or "Yes" with basic details (year/make/model, mileage, VIN optional, payoff owed). Full Sell/Trade appraisal stays on the existing page and is not part of this phase.
    5. **Review & submit** — summary and Submit to My Car.
  - **Progress bar** (steps done) and a **status badge** set by staff: Draft, Submitted, In review, Approved, Docs needed, Ready for delivery, Completed, Cancelled.
  - **Activity timeline** showing status changes and staff notes marked visible to the customer.
  - Every step auto-saves, so customers can leave and resume anytime.
- Account menu gets a **My dashboard** link; the existing `/account` page redirects to `/my`.

## What staff get
- New **Admin → Transactions** page: searchable list with filters by status and payment method, counts per status.
- Transaction detail drawer: customer info, vehicle, payment choice, trade-in, progress; change status, assign a staff member, add notes (internal or visible to customer), cancel.
- Dashboard gets a "Purchases in progress" stat linking to Transactions.

## Integrations kept
- On first submit, a lead (type "purchase") is still created so it shows in Customers/Opportunities, and the GoHighLevel webhook receives a `purchase_submitted` event with vehicle, price, payment method, trade-in flag and attribution.
- Existing forms, inventory, financing, sell/trade, legacy mirroring and Meta Pixel are untouched.

## Not in Phase 1
Document uploads, payments/deposits, e-signing, and the full Sell/Trade workflow.

## Database changes (SQL you paste once in the SQL editor)
File: `supabase/migrations_legacy/2026_mc_purchases.sql` — additive only, safe to re-run.
- `mycarco_db.mc_purchases`: id, auth user id, customer fields, vehicle id/VIN/title/price snapshot, payment_method, outside-lender fields, trade-in fields, current_step, status, assigned staff, submitted_at, timestamps.
- `mycarco_db.mc_purchase_events`: purchase id, type (status_change / note), message, visible_to_customer, author, created_at.
- Service-role grants only; all reads/writes go through server functions that verify the signed-in user (customers see only their own purchases; staff see all).

## Technical details
- Route `src/routes/my.tsx` (layout + sidebar) with children `my.index.tsx`, `my.purchases.$id.tsx`; client-side auth gate consistent with existing `/account` (uses `useAuth` + app client).
- `src/lib/purchases.functions.ts` (customer: start/resume, get, list, save step, submit) and `src/lib/admin-purchases.functions.ts` (staff: list, update status, assign, add note), using `app-admin.server.ts` REST helpers against `mycarco_db`, auth via existing `attachAppSupabaseAuth` bearer + `verifyAppUser`.
- Pending "Get Started" vehicle stored in sessionStorage across sign-in, consumed on `/my`.
- Status/step rules in `src/lib/purchase-flow.ts` with a small vitest file (step completion → progress %, allowed status values, submit requires steps 1–4).
- `src/routes/admin.transactions.tsx` + NAV entry.
- Until the SQL is run, `/my` shows a friendly "Setup pending" message instead of erroring.

## Testing after Phase 1
Run the SQL, then: sign in → Get Started on a car → fill each step → leave and return → submit → change status as admin → confirm the customer sees it.
