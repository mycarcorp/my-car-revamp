# My Car marketing link guide

Add these tags to links you post or advertise so the website records the right source.
Only tag links that you place yourself. Don't tag the website's own internal links, and leave Google Ads auto-tagging switched on.

Pattern: `https://mycarcorp.com/<page>?utm_source=<source>&utm_medium=<medium>&utm_campaign=<campaign>&utm_content=<optional>`

Naming rules: lowercase, words joined with underscores, campaign = `<topic>_<yyyy_mm>` (e.g. `fall_suv_sale_2026_10`).

| Where | utm_source | utm_medium (organic / paid) | Shows in admin as |
|---|---|---|---|
| Facebook post / ad | `facebook` | `social` / `paid_social` | Facebook |
| Instagram post / bio / ad | `instagram` | `social` / `paid_social` | Instagram |
| TikTok | `tiktok` | `social` / `paid_social` | TikTok |
| LinkedIn | `linkedin` | `social` / `paid_social` | LinkedIn |
| Reddit | `reddit` | `social` / `paid_social` | Reddit |
| Google Ads (search/display) | `google` | `cpc` | Google Ads |
| Google Vehicle Ads | `google` | `cpc` + campaign containing `vla` or `vehicle_ads` | Google Vehicle Ads |
| Google Business Profile | `google` | `organic` | Google Organic |
| Email / newsletter | `newsletter` | `email` | newsletter |

Meta ads that run on both Facebook and Instagram: use `utm_source={{site_source_name}}` (Meta fills in `fb` or `ig`) so each platform is recorded separately. Without tags, a Meta click shows as "Meta (Facebook/Instagram)".

Examples:
- `https://mycarcorp.com/finance?utm_source=facebook&utm_medium=paid_social&utm_campaign=preapproval_2026_10`
- `https://mycarcorp.com/search?utm_source=google&utm_medium=cpc&utm_campaign=vla_inventory_2026_10`
- `https://mycarcorp.com/?utm_source=instagram&utm_medium=social&utm_campaign=bio_link`
