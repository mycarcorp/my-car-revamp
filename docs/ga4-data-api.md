# GA4 Data API Hosting Checklist

The Marketing Hub reads property `559909149` through the Google Analytics Data API. This is server-side reporting only; it does not enable GA4 browser collection or change the consent behavior from Phase 3A.

## Required setup

- Enable **Google Analytics Data API** in Google Cloud project `mycarcorp-marketing-analytics`.
- Create a Google OAuth client suitable for the approved deployment and authorize a Google account that has the **Viewer** role on Analytics property `559909149`. The authorization must grant only `https://www.googleapis.com/auth/analytics.readonly` and produce an offline refresh token.
- Configure these server-only secrets together: `GA4_OAUTH_CLIENT_ID`, `GA4_OAUTH_CLIENT_SECRET`, and `GA4_OAUTH_REFRESH_TOKEN`. The Worker exchanges the refresh token at Google's OAuth token endpoint and calls the GA4 Data API with native HTTPS `fetch`. When all three are present, this mode takes precedence over `GA4_SERVICE_ACCOUNT_JSON`; a partial OAuth configuration is rejected rather than silently falling back.
- The legacy `GA4_SERVICE_ACCOUNT_JSON` option remains available as a fallback when no OAuth secrets are configured. Do not configure both modes unless the fallback is intentionally required.
- Never prefix credentials with `VITE_`, expose them in client configuration, log them, commit them, or place them in a repository file. Do not configure credentials in local development.
- Limit secret access to production operators and rotate/revoke credentials according to hosting policy. The Worker caches access tokens in memory only until one minute before the returned expiry.
- Restart/redeploy the server after setting credentials. No credential is assumed to exist in the hosting environment.
- Set the server-only `GA4_PROPERTY_TIME_ZONE` to the reporting time zone shown in GA4 Admin (for example, `America/Los_Angeles`) so preset date windows align with the property calendar. Custom dates are interpreted as property-local calendar dates.
- Sign in as authorized Marketing Hub staff and request a report in the Google Analytics tab. A missing credential or property permission returns an unavailable message; it is not reported as zero traffic.

## OAuth provisioning and bootstrap status

- There is intentionally no OAuth start or callback endpoint in the application. Provision the offline refresh token through an operator-controlled, Google-approved process; do not paste OAuth codes or tokens into the Marketing Hub.
- Do not implement or enable an in-app provisioning flow until its security review is approved and the exact callback URI is confirmed against the Google OAuth client's registered redirect URIs. Never guess, derive, or accept an arbitrary redirect URI.
- Any future flow must require an authorized administrator for both initiation and completion, use an exact server-side redirect-URI allowlist, validate a one-time short-lived state transaction on the server (or with integrity protection), use PKCE where supported, and prevent authorization codes, access tokens, refresh tokens, and client secrets from entering logs or client-side state.
- Review Google OAuth consent-screen publishing and verification requirements for the Analytics read-only scope before issuing a production refresh token. Google may expire or revoke refresh tokens; rotate the server secret after reauthorization. No Lovable AI credits or AI connector calls are used by this reporting path.

## Operational notes

- The report period is capped at 90 days. Presets cover 7, 30, or 90 days and use `GA4_PROPERTY_TIME_ZONE`; GA4 may report partial current-day data.
- The report includes the GA4 property time zone when returned by the API, selected dates, and fetch timestamp.
- GA4 `generate_lead` event counts are event totals from GA4, not Supabase lead totals. The two sources are kept separate.
- The API integration has a 20-second request timeout and uses a read-only OAuth scope. Browser collection remains inactive pending approved consent handling.