// Social platform status for the Marketing Hub.
//
// No social platform has an API connection in this application. The only Meta item present is the browser Pixel in the
// site code, which records website events with consent; it does not read page, ad or lead data. So every platform is
// reported as Not Connected, and the only per-platform number shown is how many saved website leads name that platform
// as their source. Facts about each platform's API are planning notes and must be checked against current platform
// documentation before an integration is built.

export type SocialPlatformId = "facebook" | "instagram" | "tiktok" | "linkedin" | "whatsapp" | "snapchat";

export type SocialPlatform = {
  id: SocialPlatformId;
  name: string;
  /** What exists in this application today. */
  existing: string;
  api: string;
  permissions: string;
  authentication: string;
  tokenRenewal: string;
  metrics: string;
  leadData: string;
  limitations: string;
  action: string;
};

export const SOCIAL_PLATFORMS: SocialPlatform[] = [
  {
    id: "facebook",
    name: "Facebook",
    existing: "Meta Pixel in the website code (consent-gated). No Page, ad or lead connection.",
    api: "Meta Graph API (Page insights) and Marketing API (ads, insights, lead forms)",
    permissions: "Page and ads read permissions such as read_insights, ads_read and leads_retrieval; some need Meta app review",
    authentication: "A Meta app with a Business Manager system user or long-lived token, stored server-side only",
    tokenRenewal: "Depends on token type; long-lived user tokens expire and system-user tokens do not. Verify before building",
    metrics: "Page reach and engagement; ad spend, impressions, clicks, CPC, CPM and leads per campaign",
    leadData: "Lead form submissions can be read with the right permission, or sent to GoHighLevel through its native integration",
    limitations: "Organic and paid data come from different endpoints and cannot be summed. Reporting excludes people who opted out of tracking",
    action: "Approve a read-only Meta connection (ads_read, read_insights) and create a server-side token",
  },
  {
    id: "instagram",
    name: "Instagram",
    existing: "Nothing connected. Footer link to the profile only.",
    api: "Instagram Graph API for professional accounts, and the Marketing API for ads",
    permissions: "instagram_basic and instagram_manage_insights through the linked Facebook Page",
    authentication: "Same Meta app and token as Facebook; the Instagram account must be professional and linked to a Page",
    tokenRenewal: "Same as Facebook",
    metrics: "Reach, impressions, profile visits and post engagement; ad metrics through the Marketing API",
    leadData: "Instagram lead ads use the same lead form system as Facebook",
    limitations: "Insights are limited for small accounts and some metrics are available only for a limited time window",
    action: "Link the Instagram professional account to the Facebook Page, then add it to the same read-only connection",
  },
  {
    id: "tiktok",
    name: "TikTok",
    existing: "Nothing connected. Footer link to the profile only.",
    api: "TikTok for Business (ads reporting) and TikTok developer APIs for account data",
    permissions: "An approved developer app and advertiser or account authorization",
    authentication: "OAuth with access and refresh tokens, stored server-side",
    tokenRenewal: "Access tokens expire and must be refreshed with a refresh token",
    metrics: "Ad spend, impressions, clicks and conversions; limited organic video metrics",
    leadData: "TikTok Instant Form leads are available for ads, with a lead export or webhook",
    limitations: "Developer access needs approval, and embedding TikTok on the website loads third-party scripts that may need consent",
    action: "Decide whether TikTok ads will run; if so, request developer and advertiser access",
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    existing: "Nothing connected. Footer link to the company page only.",
    api: "LinkedIn Marketing and Community Management APIs",
    permissions: "Partner program approval is normally required for analytics and ads access",
    authentication: "OAuth 2.0 with member tokens, stored server-side",
    tokenRenewal: "Access tokens are short-lived and refresh tokens expire; renewal needs planning",
    metrics: "Company page follower and post statistics; ad metrics with ads access",
    leadData: "LinkedIn Lead Gen Forms can be exported or sent through integrations",
    limitations: "Access approval can be slow, and the audience is mostly business users, not typical used-car shoppers",
    action: "Low priority: confirm whether LinkedIn is worth connecting",
  },
  {
    id: "whatsapp",
    name: "WhatsApp Business",
    existing: "Nothing connected.",
    api: "WhatsApp Business Platform (Cloud API)",
    permissions: "A verified Meta business, a registered phone number and approved message templates",
    authentication: "A Meta system user token and webhook secret, stored server-side",
    tokenRenewal: "System user tokens do not expire; webhook verification must be maintained",
    metrics: "Message and conversation counts; there is no marketing reach metric",
    leadData: "Inbound messages arrive by webhook and could be created as GoHighLevel contacts",
    limitations: "Messaging people requires their prior opt-in, businesses are charged per conversation category, and templates need approval",
    action: "Decide whether WhatsApp inquiries are wanted, and set up opt-in and a message policy first",
  },
  {
    id: "snapchat",
    name: "Snapchat",
    existing: "Nothing connected, and the site has no Snapchat link.",
    api: "Snap Marketing API (ads) and Snap Kit",
    permissions: "A Snap Ads account and an approved OAuth app",
    authentication: "OAuth 2.0 with access and refresh tokens, stored server-side",
    tokenRenewal: "Access tokens expire and are refreshed with a refresh token",
    metrics: "Ad spend, impressions, swipes and conversions; no organic account insights via the Marketing API",
    leadData: "Instant Form leads for ads, with export or webhook",
    limitations: "Little local-dealer evidence of demand, and no existing presence to measure",
    action: "Low priority: confirm whether Snapchat is wanted before any setup",
  },
];

export type SocialStatus = {
  platform: SocialPlatform;
  connection: "Not Connected";
  lastVerified: null;
  /** Saved website leads whose last touch names this platform. Not clicks, reach or ad results. */
  leadsAttributed: number;
  analytics: "Not Connected";
  campaigns: "Not Connected";
};

/** How many saved website leads name each platform as their source. */
export function socialLeadCounts(sources: Array<{ source: string; count: number }>): Record<SocialPlatformId, number> {
  const out = { facebook: 0, instagram: 0, tiktok: 0, linkedin: 0, whatsapp: 0, snapchat: 0 } as Record<SocialPlatformId, number>;
  for (const row of sources) {
    const key = row.source.trim().toLowerCase();
    if (key in out) out[key as SocialPlatformId] += row.count;
  }
  return out;
}

export function buildSocialStatuses(sources: Array<{ source: string; count: number }>): SocialStatus[] {
  const counts = socialLeadCounts(sources);
  return SOCIAL_PLATFORMS.map((platform) => ({
    platform,
    connection: "Not Connected" as const,
    lastVerified: null,
    leadsAttributed: counts[platform.id],
    analytics: "Not Connected" as const,
    campaigns: "Not Connected" as const,
  }));
}

/** Kinds of social data that must never be added together. */
export const SOCIAL_METRIC_KINDS: Array<{ kind: string; status: string }> = [
  { kind: "Organic social performance (reach, engagement)", status: "Not Connected: no platform API is connected" },
  { kind: "Paid advertising performance (spend, clicks, leads)", status: "Not Connected: no ads API is connected; ads are paused" },
  { kind: "Website referral traffic from social", status: "Available: Google Analytics report, Website Visitors tab" },
  { kind: "Leads generated and saved by the website", status: "Available: counted from saved lead records, last touch" },
  { kind: "Leads created in GoHighLevel directly", status: "Not visible here: only the website's webhook response is seen" },
  { kind: "Direct-message inquiries", status: "Not tracked: messages are not connected to this dashboard" },
];
