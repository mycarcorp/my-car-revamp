# GA4 Data API Hosting Checklist

The Marketing Hub reads property `559909149` through the Google Analytics Data API. This is server-side reporting only; it does not enable GA4 browser collection or change the consent behavior from Phase 3A.

## Required setup

- Enable **Google Analytics Data API** in Google Cloud project `mycarcorp-marketing-analytics`.
- In Google Analytics Admin for property `559909149`, add the reporting service account with the **Viewer** role. OAuth requests only `https://www.googleapis.com/auth/analytics.readonly`.
- Configure `GA4_SERVICE_ACCOUNT_JSON` as a protected server secret containing the complete service-account JSON. The Worker signs a short-lived RS256 assertion with Web Crypto via `jose`, exchanges it at Google's OAuth token endpoint, and calls the GA4 Data API with native HTTPS `fetch`.
- Never prefix credentials with `VITE_`, expose them in client configuration, log them, commit them, or place them in a repository file. Do not configure credentials in local development.
- Limit secret access to production operators and rotate/revoke the key according to hosting policy. The Worker caches access tokens in memory only until one minute before the returned expiry.
- Restart/redeploy the server after setting credentials. No credential is assumed to exist in the hosting environment.
- Set the server-only `GA4_PROPERTY_TIME_ZONE` to the reporting time zone shown in GA4 Admin (for example, `America/Los_Angeles`) so preset date windows align with the property calendar. Custom dates are interpreted as property-local calendar dates.
- Sign in as authorized Marketing Hub staff and request a report in the Google Analytics tab. A missing credential or property permission returns an unavailable message; it is not reported as zero traffic.

## Operational notes

- The report period is capped at 90 days. Presets cover 7, 30, or 90 days and use `GA4_PROPERTY_TIME_ZONE`; GA4 may report partial current-day data.
- The report includes the GA4 property time zone when returned by the API, selected dates, and fetch timestamp.
- GA4 `generate_lead` event counts are event totals from GA4, not Supabase lead totals. The two sources are kept separate.
- The API integration has a 20-second request timeout and uses a read-only OAuth scope. Browser collection remains inactive pending approved consent handling.