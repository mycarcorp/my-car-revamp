# My Car performance and accessibility review — October 16, 2026

## Implemented increment

No deployment, publishing, credentials, schema, CRM webhook, inventory data or conversion event changes.

- Vehicle pages: preload/high-priority eager main photo, memoized descriptions/photo data, stable fallback photo identifiers, lazy fullscreen thumbnails, no preloading of offscreen video bytes, related card code loaded near visibility. Reuse the already-needed inventory query for related cars rather than a second overlapping request.
- Image proxy: deduplicates concurrent VIN existence checks for 30 seconds, bounded to 200 entries. Original access checks, replacement versioning, video Range support and storage fallback retained. Opaque keys are not sent as JWT bearer credentials.
- Search: loader primes inventory, query cache is serialized/hydrated between server and browser to prevent content disappearing during hydration. Only the initial photo of each paginated card is mounted; additional photos mount when selected, preserving sliding transitions. Cards/photo arrays are memoized. One first image per page receives high priority. Removed always-on transform compositor hints.
- Blog: preload the actual featured background photo; summary reads avoid transferring all AutoSEO article bodies/FAQs and strip manual editor body/settings from listing responses. Existing quality gates, canonical ownership, slugs and redirects preserved. Failed images retain their allocated space.
- Locations: server-render service areas and prime location-page featured cars, preventing late insertion above the footer.
- Accessibility/SEO: darker semantic navigation/positive text colors, contrast fixes on pricing disclosures and homepage labels, search H1/card hierarchy, named result pagination and fullscreen thumbnail buttons, 44px vehicle arrows, valid slider and finance carousel labels, descriptive homepage Contact My Car link. Malformed pasted article lists repaired with parse5 without modifying stored content.
- Shared scripts: sign-in drawer code loads on demand; chat initialization delayed 1.5 seconds after mount. Meta initialization/PageView, attribution and conversion webhook timing unchanged.

## Verified

- Latest automatic build entry: **build OK** at 20:56:49 UTC.
- 14 tests passed: article-list normalization, vehicle-description sanitization, visitor personalization.
- Existing purchase-flow suite separately reports two failures: its old five-step fixtures do not satisfy the current expanded flow (expected 80% vs actual 44%; missing additional required steps). Not changed because purchase business rules are outside this task.
- Browser: live keyword filtering for Equinox returned three matching vehicles; card arrow mounted the second image; vehicle navigation, fullscreen gallery next-photo and close, and lazy sign-in drawer worked, with no page errors.
- Axe WCAG checks returned no violations in the tested rendered state on both specified VDPs, search, blog listing, locations, finance and homepage. This is not a claim of complete accessibility compliance or a Lighthouse score.
- Both malformed first-time-buyer article lists were checked after repair; no list/listitem violations. Final end-to-end check repeated the first article successfully. Some repeated article navigations were intermittently aborted; not treated as a score measurement.

## Measurements and limits

Fresh local development Chromium observations (1280 × 1800, unthrottled, 15-second observation), **not Lighthouse scores and not comparable to production reports**:

| Page | LCP | CLS | Sum of long-task time over 50ms |
| --- | ---: | ---: | ---: |
| Equinox VDP | 12.804s | 0.0024 | 373ms |
| Search | 6.684s | 0.00033 | 641ms |
| Blog | 2.888s | 0.00275 | 479ms |
| Locations | 0.616s | 0.00125 | 164ms |

These timings vary with the development server, image upstream latency and third-party loading. The long-task sum is **not Lighthouse TBT**. Search's measured hydration-induced CLS fell from approximately 0.529 to 0.00033 in these local runs. VDP/search loading targets remain unproven and were not achieved in this local observation. No new production performance scores are claimed.

### Still external or unverified

- Responsive WebP/AVIF vehicle variants were not fabricated: the current proxy streams original storage bytes and has no approved image transformer. Merely adding `sizes` without real variants would not optimize downloads. A managed transformation service is needed for that next increment.
- GHL chat avatar is inside provider-owned widget/shadow content. Its image proportions must be configured by GHL; site CSS cannot reliably repair that safely.
- Browser observed Meta and LeadConnector/widget/phone-library scripts. No directly configured Google Analytics or Google Ads script was found in site source; tracking inside external provider configurations is unverified.
- Third-party cookie/DevTools warnings cannot safely be eliminated by removing tracking. Review provider settings and consent configuration rather than disable working conversions.
- Full mobile, all dialogs/forms, admin save flows, conversion delivery and authenticated purchase completion were not retested. Backend integrations were not modified.
- The existing GitHub Lighthouse workflow audits the published domain. It cannot measure these unpublished changes until you approve publishing. Targets of 85–90+ and LCP <2.5s/TBT <200ms remain goals, not guarantees.

## Files created

- src/components/DeferredContent.tsx
- src/lib/article-lists.ts
- src/lib/article-lists.test.ts
- docs/performance-review-2026-10-16.md

## Files modified

- src/routes/inventory.$slug.tsx
- src/routes/search.tsx
- src/routes/blog.index.tsx
- src/routes/blog.$slug.tsx
- src/routes/locations.index.tsx
- src/routes/locations.$slug.tsx
- src/routes/finance.tsx
- src/routes/__root.tsx
- src/router.tsx
- src/routes/api/public/vehicle-photos.$.tsx
- src/components/SiteHeader.tsx
- src/components/home/CustomerGallery.tsx
- src/components/home/DealershipMap.tsx
- src/lib/legacy-inventory.server.ts
- src/lib/legacy-blog.functions.ts
- src/lib/autoseo-blog.functions.ts
- src/lib/autoseo-blog.server.ts
- src/styles.css
- package.json
- bun.lock
- AGENTS.md
- roadmap.md

Project memory also records preservation/deployment constraints; .env and supabase/config.toml were not edited. Lighthouse workflow/configuration and package-lock.json were not changed.

## How to verify

1. In preview, filter inventory by Equinox without pressing Enter; navigate to a vehicle and use both image arrows/fullscreen gallery.
2. Open the sign-in drawer and finance estimator, confirm forms remain available.
3. Reload locations and blog; verify article text/images and first-time-buyer lists.
4. After approving release, run GitHub Actions → Lighthouse CI against mycarcorp.com; compare the same VDPs and all four category scores. No publishing was performed by this task.