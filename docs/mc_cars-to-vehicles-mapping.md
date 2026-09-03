# Migration mapping template — `mycarco_db.mc_cars` → `public.vehicles`

Fill the "Source column" / "Transform" columns for each row. Nothing is imported until this is signed off.

| # | Destination column | Type | Required | Default | Source column (fill in) | Transform / notes |
|---|---|---|---|---|---|---|
| 1 | id | uuid | required | gen_random_uuid() | — | leave to default unless legacy IDs are uuids you want preserved |
| 2 | vin | text | required, UNIQUE | — |  | uppercase, trim; must be non-empty and unique across all 38 rows |
| 3 | stock_number | text | required | — |  | if absent, derive (e.g. last 8 of VIN) |
| 4 | slug | text | required, UNIQUE | — |  | derive: `year-make-model-trim-<stock>` lowercased, hyphenated |
| 5 | year | integer | required | — |  | int |
| 6 | make | text | required | — |  | title case, normalize (e.g. "chevy" → "Chevrolet") |
| 7 | model | text | required | — |  |  |
| 8 | trim | text | nullable | — |  |  |
| 9 | body_style | enum body_style | required | — |  | must map to: SUV, Sedan, Truck, Coupe, Hatchback, Convertible, Minivan, Wagon, Van |
| 10 | mileage | integer | required | 0 |  | strip commas/"mi" |
| 11 | price_cents | bigint | required | — |  | **dollars × 100** |
| 12 | currency | text | required | 'USD' | — | leave default |
| 13 | prior_price_cents | bigint | nullable | — |  | only if legacy has a prior/MSRP price; dollars × 100 |
| 14 | exterior_color | text | nullable | — |  |  |
| 15 | interior_color | text | nullable | — |  |  |
| 16 | transmission | text | nullable | — |  | free text |
| 17 | drivetrain | enum drivetrain | nullable | — |  | must map to: AWD/4WD, FWD, RWD (else NULL) |
| 18 | fuel_type | enum fuel_type | nullable | — |  | must map to: Gas, Electric, Hybrid, Plug-in Hybrid, Diesel (else NULL) |
| 19 | engine | text | nullable | — |  |  |
| 20 | mpg_combined | integer | nullable | — |  |  |
| 21 | description | text | nullable | — |  |  |
| 22 | features | text[] | required | '{}' |  | split delimited list; empty array if none |
| 23 | history_report_url | text | nullable | — |  | Carfax/AutoCheck link |
| 24 | status | enum vehicle_status | required | 'available' |  | map to: available, pending, sold, draft |
| 25 | is_featured | boolean | required | false |  |  |
| 26 | date_received | date | required | CURRENT_DATE |  | legacy listed/created date if available |
| 27 | last_synced_at | timestamptz | nullable | — | — | set to import timestamp |
| 28 | created_at | timestamptz | required | now() |  | preserve legacy created date if present |
| 29 | updated_at | timestamptz | required | now() | — | maintained by trigger |

## Photos (separate table)

Legacy image columns/URLs map to `public.vehicle_photos`:

| Destination | Type | Notes |
|---|---|---|
| vehicle_id | uuid FK → vehicles.id (ON DELETE CASCADE) | resolve after vehicle insert |
| url | text required | one row per image; hotlink legacy URLs or re-upload to storage |
| alt | text nullable | default `"<year> <make> <model>"` |
| position | integer required, default 0 | 0-based display order |

## Unmapped source columns

List any `mc_cars` columns with no destination here; decide per column: drop, fold into `description`, fold into `features`, or request a new column (needs approval).
