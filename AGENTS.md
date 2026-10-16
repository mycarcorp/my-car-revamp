<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- Returning-visitor personalization lives in src/lib/visitor-personalization.ts (localStorage only, loaded after hydration, never form contents); why: keeps anonymous tracking first-party, SSR-safe and in one place.
- Customer purchases live in mycarco_db.mc_purchases/mc_purchase_events, accessed only via server fns in src/lib/purchases*.ts with token checks; why: legacy schema is never exposed to the browser.
- Vehicle descriptions are stored as sanitized HTML in the existing description column and always rendered via src/lib/vehicle-description.ts (plain-text legacy values still supported); why: one safe, SEO-crawlable format with no schema change.
- Lighthouse CI audits the live site via .github/workflows/lighthouse.yml + lighthouserc.cjs, warn-only; why: worker build isn't servable in CI and audits must never block deploys.
- Secondary vehicle card interactions use DeferredContent with React.lazy, while searchable inventory and service areas are primed by route loaders; why: critical content is available early without loading offscreen interaction code.
- Router SSR query integration hydrates the per-request QueryClient and preserves the root QueryClientProvider; why: loader data must not disappear and refetch during hydration.
- Public article list structure is normalized with the browser-safe parse5 parser after existing content sanitization; why: pasted document lists retain their content while receiving valid list parents.
- Marketing reports and per-prospect outreach records live in a private marketing-private storage bucket on the app's existing backend, read and written only through staff-verified marketing server functions; why: keep credentials and outreach private without altering public data or legacy schemas.
- Marketing page reads durable snapshots only; explicit refresh and a prepared daily callback revalidate Search Console property selection before provider calls, and never publish articles or submit sitemaps; why: avoid request-time API polling and duplicate content.
- Existing Lighthouse artifacts are parsed server-side with bounded fflate ZIP extraction, never triggering or modifying CI; why: show measured audit scores without changing deployment behavior.
