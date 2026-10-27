# Google Ads Budget Proposal ($300 to $600 per month)

For management approval. Nothing is created, funded or launched. The application has no Google Ads connection and no Google Ads data, so there are **no cost-per-click, conversion-rate or lead forecasts** in this proposal. Any number below is arithmetic on the budget, not a prediction.

## Starting points to be clear about
- Google Ads spending does **not** improve organic Google rankings. They are separate systems.
- The dealership has recently put its ad spend into Meta, and ads are currently paused. Meta and Google figures can only be compared when they cover the same dates and use the same definition of a lead. The dashboard refuses a comparison otherwise.
- There is no Google Ads or Meta spend data in the application, so a comparison of cost per lead, appointments or sales cannot be made yet.
- Google offers automotive-specific formats (for example vehicle listing ads, which need an inventory feed through Merchant Center). They require a feed and eligibility checks, and at this budget they are a later test, not a starting point.

## Search demand to target (themes, not volumes)
- Buying: used cars, SUVs and trucks near Fredericksburg; "used car dealership Fredericksburg".
- Selling: sell my car, trade in my car, with local terms.
- Visiting: schedule a test drive, directions to the dealership.
- Brand: searches for "My Car" with the city.
Volumes and costs are unknown until Google's Keyword Planner is checked with the account.

## Readiness checklist
1. **Conversion tracking:** the site records form submissions in GA4 and as saved leads. Google Ads needs conversion actions defined and imported or tagged, and consent handled the same way as other tracking. Not yet verified.
2. **Landing pages:** `/search`, `/sell`, `/schedule` and vehicle pages exist and are indexed. Check mobile speed first; no Core Web Vitals measurement exists yet.
3. **Attribution:** paid search is already classified separately (Google Ads). Click IDs are not stored, so Google Ads reporting must come from Google itself.
4. **Compliance:** dealer and credit ad rules apply. No approval, price, rate or condition promises.
5. **Business Profile:** complete it first; it feeds local results at no ad cost.

## Scenarios (monthly maximum; Google can vary daily spend, so use average days of about 30.4)
| | A: $300 | B: $450 | C: $600 |
|---|---|---|---|
| Average daily spend | $9.87 | $14.80 | $19.74 |
| 1. High-intent local search | $240 (80%) | $292.50 (65%) | $300 (50%) |
| 2. Sell / trade search | not funded | $90 (20%) | $120 (20%) |
| 3. Brand search | $60 (20%) | $67.50 (15%) | $60 (10%) |
| 4. Test-and-learn reserve | none | none | $120 (20%), decided with management |
| Geography | Start with a tight radius around Fredericksburg, widen only if the data supports it | Same, with Stafford and Spotsylvania | Same, with the wider 50-mile area as a test |
| Conversion objectives | Form submit and call clicks | Add appointment requests | Same, reported separately |
| Main risk | Too little spend to learn much | Thinly split across three campaigns | Larger exposure to low-quality clicks before tracking is proven |

Allocation shares are proposals for discussion. The figures come from `src/lib/google-ads-budget.ts` and are tested to add up to the full budget.

**Negative-keyword themes:** jobs and careers, free, parts and repair, new cars, rentals, other cities and states, unrelated brand names, "no credit check" claims.

## Measurement needed before spending
- Conversion actions verified with a test conversion.
- A weekly report with one fixed lead definition (website leads from the lead list) and the same date range as any Meta figure.
- Search terms reviewed weekly to add negatives.
- A stop rule agreed with management, for example reviewing results after a fixed number of weeks before any increase.

## Recommendation
Start with Scenario A only after conversion tracking is verified and the Business Profile is complete, judged on a fixed review date. Do not choose B or C until A produces data. This is a recommendation for management; the application takes no spending action.
