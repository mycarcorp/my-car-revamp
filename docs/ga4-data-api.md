# GA4 Data API Hosting Checklist

The Marketing Hub reads property `559909149` through the Google Analytics Data API. This is server-side reporting only; it does not enable GA4 browser collection or change the consent behavior from Phase 3A.

## Required setup

- Enable **Google Analytics Data API** in Google Cloud project `mycarcorp-marketing-analytics`.
- In Google Analytics Admin for property `559909149`, add `mycarcorp-ga4-reporting@mycarcorp-marketing-analytics.iam.gserviceaccount.com` with the **Viewer** role. The Data API client requests only `https://www.googleapis.com/auth/analytics.readonly`.
- Configure credentials in the production server runtime using either:
  - **Application Default Credentials (recommended):** attach/workload-identity-bind the service account or provide a host-managed ADC identity. Ensure the runtime identity can impersonate/use the reporting service account as required by the host.
  - **Server-only service-account JSON:** set `GA4_SERVICE_ACCOUNT_JSON` to the complete service-account JSON as a protected server secret. Never prefix it with `VITE_`, expose it in client configuration, commit it, or place it in a repository file.
- If using service-account JSON, limit access to production operators, use the least-privilege secret store available, and rotate/revoke the key according to the hosting provider's policy. Prefer workload identity/ADC when available to avoid long-lived keys.
- Redeploy/restart the server after setting credentials. No credential is assumed to exist in the hosting environment.
- Sign in as authorized Marketing Hub staff and request a report in the Google Analytics tab. A missing credential or property permission returns an unavailable message; it is not reported as zero traffic.

## Operational notes

- The report period is capped at 90 days. Presets cover 7, 30, or 90 days and include the current UTC date; GA4 may report partial current-day data.
- The report includes the GA4 property time zone when returned by the API, selected dates, and fetch timestamp.
- GA4 `generate_lead` event counts are event totals from GA4, not Supabase lead totals. The two sources are kept separate.
- The API integration has a 20-second request timeout and uses a read-only OAuth scope. Browser collection remains inactive pending approved consent handling.