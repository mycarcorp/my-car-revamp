export type AutoseoPost = {
  id: number;
  title: string;
  slug: string;
  content_html: string | null;
  content_markdown: string | null;
  hero_image_url: string | null;
  hero_image_alt: string | null;
  infographic_url: string | null;
  meta_description: string | null;
  meta_keywords: string | null;
  tags: string | null;
  faq_schema: Array<{ question: string; answer: string }> | null;
  language: string | null;
  reading_time: number | null;
  published_at: string | null;
  updated_at: string | null;
  created_at: string | null;

  // Optional SEO ownership fields.
  //
  // These are intentionally optional because the current Supabase table may
  // not have these columns yet. upsertRow() already safely removes unknown
  // columns instead of breaking article delivery.
  primary_intent?: string | null;
  canonical_slug?: string | null;
  seo_indexable?: boolean | null;
  status?: string | null;
  published_url?: string | null;
  is_featured?: boolean | null;

  // Quality-gate fields. Optional at the TypeScript layer so deployments can
  // roll out the database migration without breaking older environments.
  quality_status?: AutoseoQualityStatus | null;
  risk_level?: AutoseoRiskLevel | null;
  requires_human_review?: boolean | null;
  quality_flags?: AutoseoQualityFlag[] | null;
  source_urls?: string[] | null;
  review_notes?: string | null;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
};

export type AutoseoIntentInfo = {
  primaryIntent: string;
  canonicalSlug: string;
  indexable: boolean;
  duplicateOf: string | null;
};

export type AutoseoQualityStatus = "pending" | "needs_review" | "approved" | "flagged";

export type AutoseoRiskLevel = "low" | "medium" | "high";
export type AutoseoQualityFlagSeverity = "warning" | "blocking";

export type AutoseoQualityFlag = {
  code: string;
  severity: AutoseoQualityFlagSeverity;
  message: string;
  matched_text?: string | null;
  requires_source?: boolean;
};

export type AutoseoQualityResult = {
  status: AutoseoQualityStatus;
  riskLevel: AutoseoRiskLevel;
  requiresHumanReview: boolean;
  flags: AutoseoQualityFlag[];
  sourceUrls: string[];
};

export const SITE_ORIGIN = "https://mycarcorp.com";

function creds() {
  const url = process.env["LEGACY_SUPABASE_URL"] ?? process.env["SUPABASE_URL"];

  const key = process.env["LEGACY_SUPABASE_SERVICE_ROLE_KEY"] ?? process.env["SUPABASE_SERVICE_ROLE_KEY"];

  if (!url || !key) {
    throw new Error("Blog backend credentials are not configured.");
  }

  return { url, key };
}

async function rest(
  path: string,
  init: {
    method?: string;
    body?: unknown;
    prefer?: string;
  } = {},
): Promise<unknown> {
  const c = creds();
  const method = init.method ?? "GET";

  const headers: Record<string, string> = {
    apikey: c.key,
    Authorization: `Bearer ${c.key}`,
    "Content-Type": "application/json",
    [method === "GET" ? "Accept-Profile" : "Content-Profile"]: "mycarco_db",
  };

  if (init.prefer) {
    headers["Prefer"] = init.prefer;
  }

  const res = await fetch(`${c.url}/rest/v1/${path}`, {
    method,
    headers,
    body: init.body === undefined ? null : JSON.stringify(init.body),
  });

  const responseText = await res.text();

  if (!res.ok) {
    throw new Error(`AutoSEO blog request failed (${res.status}): ${responseText.slice(0, 300)}`);
  }

  return responseText ? JSON.parse(responseText) : null;
}

// ---------------------------------------------------------------------------
// Selects
// ---------------------------------------------------------------------------

const SELECT =
  "id,title,slug,content_html,hero_image_url,hero_image_alt,infographic_url,meta_description,meta_keywords,tags,faq_schema,language,reading_time,published_at,updated_at,created_at";

/**
 * Public AutoSEO list.
 *
 * Mandatory quality gate:
 * - article must be explicitly published
 * - article must be approved
 * - article must have a published_at value
 *
 * The fallback exists only for deployments where the quality-gate migration
 * has not been applied yet. Once the columns exist, the first query is the
 * enforced path.
 */

export async function listAutoseoPosts(): Promise<AutoseoPost[]> {
  try {
    return (await rest(
      `blog_posts?select=${SELECT}&status=eq.published&quality_status=eq.approved&published_at=not.is.null&order=published_at.desc.nullslast,created_at.desc`,
    )) as AutoseoPost[];
  } catch {
    try {
      return (await rest(
        `blog_posts?select=${SELECT}&status=eq.published&published_at=not.is.null&order=published_at.desc.nullslast,created_at.desc`,
      )) as AutoseoPost[];
    } catch {
      return (await rest(
        `blog_posts?select=${SELECT}&published_at=not.is.null&order=published_at.desc.nullslast,created_at.desc`,
      )) as AutoseoPost[];
    }
  }
}

/**
 * Admin read: every column the table happens to have, newest activity first.
 */
export async function listAutoseoAdminRows(): Promise<Array<Record<string, unknown>>> {
  return (await rest(
    "blog_posts?select=*&order=updated_at.desc.nullslast,published_at.desc.nullslast,created_at.desc.nullslast",
  )) as Array<Record<string, unknown>>;
}

export async function getAutoseoPost(slug: string): Promise<AutoseoPost | null> {
  try {
    const rows = (await rest(
      `blog_posts?select=${SELECT},content_markdown&slug=eq.${encodeURIComponent(
        slug,
      )}&status=eq.published&quality_status=eq.approved&published_at=not.is.null&limit=1`,
    )) as AutoseoPost[];

    return rows?.[0] ?? null;
  } catch {
    try {
      const rows = (await rest(
        `blog_posts?select=${SELECT},content_markdown&slug=eq.${encodeURIComponent(
          slug,
        )}&status=eq.published&published_at=not.is.null&limit=1`,
      )) as AutoseoPost[];

      return rows?.[0] ?? null;
    } catch {
      const rows = (await rest(
        `blog_posts?select=${SELECT},content_markdown&slug=eq.${encodeURIComponent(
          slug,
        )}&published_at=not.is.null&limit=1`,
      )) as AutoseoPost[];

      return rows?.[0] ?? null;
    }
  }
}

// ---------------------------------------------------------------------------
// Mandatory AutoSEO quality gate
// ---------------------------------------------------------------------------

const APPROVED_BUSINESS_FACTS = {
  businessName: "My Car",
  address: "4720 Harrison Rd, Fredericksburg, VA 22408",
  phone: "(540) 426-3322",
  financing: [
    "My Car offers vehicle financing options.",
    "Customers can submit a financing application online.",
    "Financing is subject to review and approval.",
    "Actual rates, terms, down payments and payments may vary.",
  ],
  trade: [
    "Customers can request a trade appraisal.",
    "Customers can provide vehicle information for review when selling or trading a vehicle.",
  ],
  appointments: [
    "Customers can schedule a test drive.",
    "Customers can schedule a trade appraisal.",
    "Customers can schedule a financing consultation.",
    "Customers can schedule a general dealership visit.",
  ],
} as const;

export function getApprovedMyCarFacts() {
  return APPROVED_BUSINESS_FACTS;
}

export type BlogQualityRuleType =
  "blocked_claim" | "high_risk_topic" | "finance_trade_topic" | "source_required_topic" | "authoritative_source_domain";

export type BlogQualityRule = {
  id?: number;
  code: string;
  name: string;
  rule_type: BlogQualityRuleType;
  severity: AutoseoQualityFlagSeverity;
  phrases: string[];
  message: string;
  requires_source: boolean;
  requires_human_review: boolean;
  allow_negated: boolean;
  is_enabled: boolean;
  is_system_rule: boolean;
  sort_order: number;
  created_at?: string | null;
  updated_at?: string | null;
};

/**
 * These defaults are intentionally kept in code.
 *
 * Database rules are the editable source of truth once the migration exists.
 * If the table is unavailable, empty, or temporarily unreadable, the scanner
 * falls back to these defaults so AutoSEO protection never disappears.
 */
const DEFAULT_QUALITY_RULES: BlogQualityRule[] = [
  {
    code: "guaranteed_approval",
    name: "Guaranteed approval / financing",
    rule_type: "blocked_claim",
    severity: "blocking",
    phrases: [
      "guaranteed approval",
      "guaranteed financing",
      "100% approval",
      "100% approved",
      "everyone approved",
      "everyone is approved",
      "everyone gets approved",
    ],

    message: "Guaranteed financing or approval claims are not approved My Car facts.",
    requires_source: false,
    requires_human_review: true,
    allow_negated: true,
    is_enabled: true,
    is_system_rule: true,
    sort_order: 10,
  },
  {
    code: "approval_timing",
    name: "Approval timing",
    rule_type: "blocked_claim",
    severity: "blocking",
    phrases: [
      "instant approval",
      "immediate approval",
      "same-day approval",
      "same day approval",
      "approval in minutes",
      "approval times in minutes",
      "approved in minutes",
    ],
    message: "Specific approval-speed or decision-time claims require verified operational evidence.",
    requires_source: false,
    requires_human_review: true,
    allow_negated: true,
    is_enabled: true,
    is_system_rule: true,
    sort_order: 20,
  },
  {
    code: "best_lowest_rate",
    name: "Best / lowest rate claims",
    rule_type: "blocked_claim",
    severity: "blocking",
    phrases: [
      "best rate",
      "best rates",
      "lowest rate",
      "lowest rates",
      "cheapest rate",
      "cheapest rates",
      "best APR",
      "lowest APR",
      "best interest rate",
      "best interest rates",
      "lowest interest rate",
      "lowest interest rates",
    ],

    message: "Best/lowest rate claims are prohibited unless a current, verifiable offer supports them.",
    requires_source: true,
    requires_human_review: true,
    allow_negated: true,
    is_enabled: true,
    is_system_rule: true,
    sort_order: 30,
  },
  {
    code: "no_credit_check",
    name: "No credit check",
    rule_type: "blocked_claim",
    severity: "blocking",
    phrases: ["no credit check", "no hard credit check", "without a credit check", "without credit check"],
    message: "No-credit-check claims are not an approved My Car financing fact.",
    requires_source: false,
    requires_human_review: true,
    allow_negated: false,
    is_enabled: true,
    is_system_rule: true,
    sort_order: 40,
  },
  {
    code: "credit_impact_guarantee",
    name: "Guaranteed credit-score impact",
    rule_type: "blocked_claim",
    severity: "blocking",
    phrases: [
      "won't hurt your credit",
      "will not hurt your credit",
      "does not hurt your credit",
      "doesn't hurt your credit",
      "won't affect your credit",
      "will not affect your credit",
      "does not affect your credit",
      "doesn't affect your credit",
      "won't impact your credit",
      "will not impact your credit",
      "does not impact your credit",
      "doesn't impact your credit",
    ],

    message: "Exact or guaranteed credit-score impact claims require authoritative sourcing and careful context.",
    requires_source: true,
    requires_human_review: true,
    allow_negated: false,
    is_enabled: true,
    is_system_rule: true,
    sort_order: 50,
  },
  {
    code: "cpo_claim",
    name: "Certified Pre-Owned / CPO",
    rule_type: "blocked_claim",
    severity: "blocking",
    phrases: ["certified pre-owned", "certified preowned", "CPO"],
    message: "Certified Pre-Owned/CPO claims are not approved unless the specific program and inventory are verified.",
    requires_source: false,
    requires_human_review: true,
    allow_negated: true,
    is_enabled: true,
    is_system_rule: true,
    sort_order: 60,
  },
  {
    code: "insurance_claim",
    name: "My Car insurance product",
    rule_type: "blocked_claim",
    severity: "blocking",
    phrases: [
      "My Car Insurance",
      "MyCar Insurance",
      "our insurance plan",
      "our insurance program",
      "our insurance coverage",
      "our insurance product",
    ],

    message: "My Car insurance-product claims are not approved business facts.",
    requires_source: false,
    requires_human_review: true,
    allow_negated: true,
    is_enabled: true,
    is_system_rule: true,
    sort_order: 70,
  },
  {
    code: "inspection_guarantee",
    name: "Inspection guarantee",
    rule_type: "blocked_claim",
    severity: "blocking",
    phrases: [
      "every vehicle is inspected",
      "every vehicle fully inspected",
      "all vehicles are inspected",
      "all vehicles fully inspected",
      "fully inspected inventory",
      "fully inspected vehicles",
      "fully inspected cars",
    ],
    message: "Inspection-process claims require verified inspection terms before publication.",
    requires_source: false,
    requires_human_review: true,
    allow_negated: true,
    is_enabled: true,
    is_system_rule: true,
    sort_order: 80,
  },
  {
    code: "warranty_claim",
    name: "Warranty inclusion / guarantee",
    rule_type: "blocked_claim",
    severity: "blocking",
    phrases: [
      "every vehicle comes with a warranty",
      "every car comes with a warranty",
      "all vehicles come with a warranty",
      "all cars come with a warranty",
      "warranty included",
      "warranty guaranteed",
    ],

    message: "Warranty coverage or inclusion claims require verified warranty terms.",
    requires_source: false,
    requires_human_review: true,
    allow_negated: true,
    is_enabled: true,
    is_system_rule: true,
    sort_order: 90,
  },
  {
    code: "inventory_promise",
    name: "Inventory promise",
    rule_type: "blocked_claim",
    severity: "blocking",
    phrases: [
      "largest inventory",
      "best inventory",
      "always in stock",
      "always available",
      "every vehicle is available",
      "all vehicles are available",
      "every car is available",
      "all cars are available",
    ],
    message: "Inventory availability and superlative inventory claims cannot be automated without live verification.",
    requires_source: false,
    requires_human_review: true,
    allow_negated: true,
    is_enabled: true,
    is_system_rule: true,
    sort_order: 100,
  },

  {
    code: "under_20k_promise",
    name: "Under $20,000 inventory promise",
    rule_type: "blocked_claim",
    severity: "blocking",
    phrases: [
      "all vehicles under $20,000",
      "every vehicle under $20,000",
      "all cars under $20,000",
      "every car under $20,000",
      "only vehicles under $20,000",
      "only cars under $20,000",
      "exclusively vehicles under $20,000",
      "exclusively cars under $20,000",
    ],
    message: "Inventory price-range promises require current inventory verification.",
    requires_source: false,
    requires_human_review: true,
    allow_negated: true,
    is_enabled: true,
    is_system_rule: true,
    sort_order: 110,
  },
  {
    code: "fee_guarantee",
    name: "Fee guarantee",
    rule_type: "blocked_claim",
    severity: "blocking",
    phrases: ["no hidden fees", "no hidden fee", "no surprise fees", "no surprise fee"],
    message: "Absolute fee claims require verified pricing and fee policy.",
    requires_source: false,
    requires_human_review: true,
    allow_negated: false,
    is_enabled: true,
    is_system_rule: true,
    sort_order: 120,
  },

  {
    code: "high_risk_topics",
    name: "High-risk topics",
    rule_type: "high_risk_topic",
    severity: "warning",
    phrases: [
      "finance",
      "finances",
      "financing",
      "loan",
      "lender",
      "APR",
      "interest rate",
      "credit score",
      "credit check",
      "credit inquiry",
      "bad credit",
      "bankruptcy",
      "pre-approval",
      "pre-approved",
      "prequalification",
      "pre-qualified",
      "down payment",
      "monthly payment",
      "trade-in",
      "trade value",
      "appraisal",
      "sell my car",
      "vehicle value",
      "warranty",
      "insurance",
      "certified pre-owned",
      "CPO",
      "regulation",
      "law",
      "legal",
    ],
    message: "Sensitive financial, trade, legal, warranty, insurance or CPO topics require additional review.",
    requires_source: false,
    requires_human_review: true,
    allow_negated: false,
    is_enabled: true,
    is_system_rule: true,
    sort_order: 200,
  },

  {
    code: "finance_trade_topics",
    name: "Finance and trade topics",
    rule_type: "finance_trade_topic",
    severity: "warning",
    phrases: [
      "finance",
      "finances",
      "financing",
      "loan",
      "lender",
      "APR",
      "interest rate",
      "credit",
      "bad credit",
      "bankruptcy",
      "pre-approval",
      "pre-approved",
      "prequalification",
      "pre-qualified",
      "down payment",
      "monthly payment",
      "trade-in",
      "trade value",
      "appraisal",
      "sell my car",
      "vehicle value",
    ],
    message: "Finance and trade articles require human review before indexation during the current rollout.",
    requires_source: false,
    requires_human_review: true,
    allow_negated: false,
    is_enabled: true,
    is_system_rule: true,
    sort_order: 210,
  },

  {
    code: "source_required_topics",
    name: "Source-required topics",
    rule_type: "source_required_topic",
    severity: "blocking",
    phrases: [
      "current rate",
      "current rates",
      "current auto loan rate",
      "current auto loan rates",
      "current car loan rate",
      "current car loan rates",
      "average APR",
      "average rate",
      "average interest rate",
      "APR",
      "interest rate",
      "interest rates",
      "credit score",
      "credit inquiry",
      "credit inquiries",
      "hard inquiry",
      "hard inquiries",
      "soft pull",
      "rate shopping",
      "14-day window",
      "30-day window",
      "law",
      "laws",
      "regulation",
      "regulations",
      "statistic",
      "statistics",
      "percent",
      "percentage",
      "market price",
      "market prices",
      "market rate",
      "market rates",
      "market data",
      "market statistics",
      "market average",
      "tax",
      "taxes",
      "consumer right",
      "consumer rights",
    ],
    message: "Time-sensitive, financial, legal, credit, market or statistical claims require an external source.",
    requires_source: true,
    requires_human_review: true,
    allow_negated: false,
    is_enabled: true,
    is_system_rule: true,
    sort_order: 220,
  },
  ...[
    ["source_consumerfinance_gov", "Consumer Financial Protection Bureau", "consumerfinance.gov", 300],
    ["source_ftc_gov", "Federal Trade Commission", "ftc.gov", 310],
    ["source_federalreserve_gov", "Federal Reserve", "federalreserve.gov", 320],
    ["source_usa_gov", "USA.gov", "usa.gov", 330],
    ["source_virginia_gov", "Virginia.gov", "virginia.gov", 340],
    ["source_dmv_virginia_gov", "Virginia DMV", "dmv.virginia.gov", 350],
    ["source_uscourts_gov", "U.S. Courts", "uscourts.gov", 360],
    ["source_myfico_com", "myFICO", "myfico.com", 370],
    ["source_fico_com", "FICO", "fico.com", 380],
    ["source_experian_com", "Experian", "experian.com", 390],
    ["source_equifax_com", "Equifax", "equifax.com", 400],
    ["source_transunion_com", "TransUnion", "transunion.com", 410],
  ].map(([code, name, domain, sortOrder]): BlogQualityRule => ({
    code: String(code),
    name: String(name),
    rule_type: "authoritative_source_domain",
    severity: "warning",
    phrases: [String(domain)],
    message: "Preferred authoritative source domain.",
    requires_source: false,
    requires_human_review: false,
    allow_negated: false,
    is_enabled: true,
    is_system_rule: true,
    sort_order: Number(sortOrder),
  })),
];

function normalizeQualityRule(row: Record<string, unknown>): BlogQualityRule | null {
  const code = String(row["code"] ?? "").trim();
  const name = String(row["name"] ?? "").trim();
  const ruleType = String(row["rule_type"] ?? "").trim() as BlogQualityRuleType;

  if (
    !code ||
    !name ||
    ![
      "blocked_claim",
      "high_risk_topic",
      "finance_trade_topic",
      "source_required_topic",
      "authoritative_source_domain",
    ].includes(ruleType)
  ) {
    return null;
  }

  const rawPhrases = row["phrases"];

  const phrases = Array.isArray(rawPhrases)
    ? rawPhrases.map((value) => String(value ?? "").trim()).filter(Boolean)
    : [];

  return {
    id: Number.isFinite(Number(row["id"])) ? Number(row["id"]) : undefined,
    code,
    name,
    rule_type: ruleType,
    severity: row["severity"] === "warning" ? "warning" : "blocking",
    phrases,
    message: String(row["message"] ?? "").trim(),
    requires_source: Boolean(row["requires_source"]),
    requires_human_review: Boolean(row["requires_human_review"]),
    allow_negated: Boolean(row["allow_negated"]),
    is_enabled: row["is_enabled"] !== false,
    is_system_rule: row["is_system_rule"] !== false,
    sort_order: Number.isFinite(Number(row["sort_order"])) ? Number(row["sort_order"]) : 100,
    created_at: row["created_at"] == null ? null : String(row["created_at"]),
    updated_at: row["updated_at"] == null ? null : String(row["updated_at"]),
  };
}

/**
 * Read the editable Admin quality-gate rules from Supabase.
 *
 * Important:
 * - Active DB rules are authoritative when the table exists.
 * - If the migration has not been applied, the database is unavailable, or
 *   the query returns no valid enabled rows, built-in defaults are returned.
 * - A disabled DB rule stays disabled because only enabled rows are queried;
 *   we do not merge defaults over a successful DB response.
 */
export async function listActiveBlogQualityRules(): Promise<BlogQualityRule[]> {
  try {
    const rows = (await rest("blog_quality_rules?select=*&is_enabled=eq.true&order=sort_order.asc,id.asc")) as Array<
      Record<string, unknown>
    >;

    const normalized = (rows ?? [])
      .map(normalizeQualityRule)
      .filter((rule): rule is BlogQualityRule => Boolean(rule && rule.is_enabled));

    if (normalized.length > 0) {
      return normalized;
    }
  } catch (error) {
    console.error(
      "[autoseo] Quality-rule table unavailable; using built-in defaults:",
      error instanceof Error ? error.message : error,
    );
  }

  return DEFAULT_QUALITY_RULES.map((rule) => ({
    ...rule,
    phrases: [...rule.phrases],
  }));
}

/**
 * Staff/Admin pages will use this in the next update to display every rule,
 * including disabled ones. It also falls back to the defaults before the
 * migration exists.
 */
export async function listAllBlogQualityRules(): Promise<BlogQualityRule[]> {
  try {
    const rows = (await rest("blog_quality_rules?select=*&order=sort_order.asc,id.asc")) as Array<
      Record<string, unknown>
    >;

    const normalized = (rows ?? []).map(normalizeQualityRule).filter((rule): rule is BlogQualityRule => Boolean(rule));

    if (normalized.length > 0) {
      return normalized;
    }
  } catch (error) {
    console.error(
      "[autoseo] Could not list database quality rules; using built-in defaults:",
      error instanceof Error ? error.message : error,
    );
  }

  return DEFAULT_QUALITY_RULES.map((rule) => ({
    ...rule,
    phrases: [...rule.phrases],
  }));
}

function stripHtml(value: string): string {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function extractSourceUrls(html: string): string[] {
  const found = new Set<string>();

  const hrefPattern = /href\s*=\s*["'](https?:\/\/[^"'#\s]+[^"']*)["']/gi;
  const rawPattern = /https?:\/\/[^\s<>'"]+/gi;

  for (const pattern of [hrefPattern, rawPattern]) {
    pattern.lastIndex = 0;

    let match: RegExpExecArray | null;

    while ((match = pattern.exec(html))) {
      const candidate = String(match[1] ?? match[0] ?? "").trim();

      try {
        const url = new URL(candidate);

        if (url.protocol !== "http:" && url.protocol !== "https:") continue;
        if (url.hostname === "mycarcorp.com" || url.hostname.endsWith(".mycarcorp.com")) continue;

        found.add(url.toString());
      } catch {
        // Ignore malformed source URLs.
      }
    }
  }

  return Array.from(found);
}

function isNegated(textValue: string, index: number): boolean {
  const before = textValue.slice(Math.max(0, index - 55), index).toLowerCase();

  return /\b(?:not|never|cannot|can['’]?t|does\s+not|doesn['’]?t|do\s+not|don['’]?t|is\s+not|isn['’]?t|are\s+not|aren['’]?t)\b[^.!?]{0,35}$/.test(
    before,
  );
}

function normalizePhrase(value: string): string {
  return value
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/[-–—_/]+/g, " ")
    .replace(/[^\p{L}\p{N}$%'.]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizedSearchText(value: string): {
  normalized: string;
  original: string;
} {
  return {
    original: value,
    normalized: normalizePhrase(value),
  };
}

/**
 * Phrase rules are stored as normal human-readable text, not regular
 * expressions. This is deliberate: Admin users can safely edit them without
 * being able to break the scanner with invalid regex.
 */
function findPhraseMatch(textValue: string, phrases: string[], allowNegated: boolean): string | null {
  const { normalized } = normalizedSearchText(textValue);

  for (const phrase of phrases) {
    const needle = normalizePhrase(phrase);

    if (!needle) continue;

    const index = normalized.indexOf(needle);

    if (index < 0) continue;

    /**
     * Negation detection is performed against the normalized text. The index
     * can differ slightly from the original HTML-stripped content because
     * punctuation is collapsed, but the surrounding sentence still remains
     * sufficient for the defensive negation check.
     */
    if (allowNegated && isNegated(normalized, index)) {
      continue;
    }

    return phrase.slice(0, 180);
  }

  return null;
}

function anyRulePhraseMatch(textValue: string, rules: BlogQualityRule[]): boolean {
  return rules.some((rule) => Boolean(findPhraseMatch(textValue, rule.phrases, false)));
}

function authoritativeDomainsFromRules(rules: BlogQualityRule[]): string[] {
  return rules
    .filter((rule) => rule.rule_type === "authoritative_source_domain")
    .flatMap((rule) => rule.phrases)
    .map(
      (domain) =>
        domain
          .toLowerCase()
          .replace(/^https?:\/\//, "")
          .replace(/^www\./, "")
          .split("/")[0] ?? "",
    )
    .filter(Boolean);
}

function isAuthoritativeSource(urlValue: string, domains: string[]): boolean {
  try {
    const hostname = new URL(urlValue).hostname.toLowerCase().replace(/^www\./, "");

    return domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

function dedupeFlags(flags: AutoseoQualityFlag[]): AutoseoQualityFlag[] {
  const seen = new Set<string>();

  return flags.filter((flag) => {
    const key = `${flag.code}:${flag.matched_text ?? ""}`;

    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

export async function evaluateAutoseoQuality(input: {
  id: number;
  title: string;
  slug: string;
  contentHtml: string | null;
  metaDescription?: string | null;
  metaKeywords?: string | null;
  tags?: string | null;
  duplicateOf?: string | null;
}): Promise<AutoseoQualityResult> {
  const html = String(input.contentHtml ?? "");

  const searchable = [
    input.title,
    input.slug,
    input.metaDescription ?? "",
    input.metaKeywords ?? "",
    input.tags ?? "",
    stripHtml(html),
  ]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  const rules = await listActiveBlogQualityRules();

  const blockedClaimRules = rules.filter((rule) => rule.rule_type === "blocked_claim");
  const highRiskRules = rules.filter((rule) => rule.rule_type === "high_risk_topic");
  const financeTradeRules = rules.filter((rule) => rule.rule_type === "finance_trade_topic");
  const sourceRequiredRules = rules.filter((rule) => rule.rule_type === "source_required_topic");

  const flags: AutoseoQualityFlag[] = [];

  for (const rule of blockedClaimRules) {
    const matched = findPhraseMatch(searchable, rule.phrases, rule.allow_negated);

    if (!matched) continue;

    flags.push({
      code: rule.code,
      severity: rule.severity,
      message: rule.message || `Quality rule "${rule.name}" was matched.`,
      matched_text: matched,
      requires_source: rule.requires_source || undefined,
    });
  }

  const sourceUrls = extractSourceUrls(html);
  const sourceRequired = anyRulePhraseMatch(searchable, sourceRequiredRules);
  const authoritativeDomains = authoritativeDomainsFromRules(rules);
  const hasAuthoritativeSource = sourceUrls.some((url) => isAuthoritativeSource(url, authoritativeDomains));

  if (sourceRequired && sourceUrls.length === 0) {
    flags.push({
      code: "source_required",
      severity: "blocking",
      message:
        sourceRequiredRules.find((rule) => anyRulePhraseMatch(searchable, [rule]))?.message ||
        "This article contains time-sensitive, financial, legal, credit, market or statistical claims but no external source link was detected.",
      requires_source: true,
    });
  } else if (sourceRequired && authoritativeDomains.length > 0 && !hasAuthoritativeSource) {
    flags.push({
      code: "authoritative_source_review",
      severity: "warning",
      message:
        "Sources were detected, but none match the currently approved authoritative source domains. Human source review is required.",
      requires_source: true,
    });
  }

  let duplicateOf = input.duplicateOf ?? null;

  if (duplicateOf === undefined) duplicateOf = null;

  if (!duplicateOf) {
    const owner = await findExistingIntentOwner({
      id: input.id,
      title: input.title,
      metaKeywords: input.metaKeywords ?? null,
      tags: input.tags ?? null,
    });

    duplicateOf = owner?.post.slug ?? null;
  }

  if (duplicateOf && duplicateOf !== input.slug) {
    flags.push({
      code: "duplicate_topic",
      severity: "blocking",
      message: `A previously established AutoSEO URL already owns this search intent: /blog/${duplicateOf}.`,
      matched_text: duplicateOf,
    });
  }

  const financeOrTrade = anyRulePhraseMatch(searchable, financeTradeRules);
  const highRiskTopic = anyRulePhraseMatch(searchable, highRiskRules);

  const matchedRuleRequiresHumanReview = rules.some(
    (rule) =>
      rule.requires_human_review &&
      rule.rule_type !== "authoritative_source_domain" &&
      Boolean(findPhraseMatch(searchable, rule.phrases, rule.allow_negated)),
  );

  const uniqueFlags = dedupeFlags(flags);
  const hasBlockingFlag = uniqueFlags.some((flag) => flag.severity === "blocking");

  const riskLevel: AutoseoRiskLevel = highRiskTopic
    ? "high"
    : uniqueFlags.length > 0 || sourceRequired
      ? "medium"
      : "low";

  /**
   * Current rollout rule:
   * - finance/trade content requires human review,
   * - high-risk content requires human review,
   * - any matched Admin rule marked requires_human_review does too,
   * - any quality flag also requires review.
   */
  const requiresHumanReview =
    financeOrTrade || highRiskTopic || matchedRuleRequiresHumanReview || uniqueFlags.length > 0;

  const status: AutoseoQualityStatus = hasBlockingFlag || requiresHumanReview ? "needs_review" : "approved";

  return {
    status,
    riskLevel,
    requiresHumanReview,
    flags: uniqueFlags,
    sourceUrls,
  };
}

async function patchBlogPostCompat(id: number, body: Record<string, unknown>): Promise<void> {
  let payload = { ...body };

  for (let attempt = 0; attempt < 16; attempt += 1) {
    try {
      await rest(`blog_posts?id=eq.${encodeURIComponent(String(id))}`, {
        method: "PATCH",
        prefer: "return=minimal",
        body: payload,
      });

      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const missing = /PGRST204/.test(message)
        ? (/'([^']+)' column/.exec(message)?.[1] ?? /column\s+"?([a-z_]+)"?/i.exec(message)?.[1])
        : undefined;

      if (!missing || !(missing in payload)) throw error;

      const { [missing]: _drop, ...remaining } = payload;
      payload = remaining;
    }
  }

  throw new Error("Could not update the AutoSEO article after removing unknown columns.");
}

async function writeRevisionLog(input: {
  postId: number;
  action: string;
  previousStatus?: string | null;
  newStatus?: string | null;
  qualityStatus?: AutoseoQualityStatus | null;
  riskLevel?: AutoseoRiskLevel | null;
  flags?: AutoseoQualityFlag[] | null;
  notes?: string | null;
  changedBy?: string | null;
}): Promise<void> {
  try {
    await rest("blog_revision_log", {
      method: "POST",
      prefer: "return=minimal",
      body: {
        post_id: input.postId,
        action: input.action,
        previous_status: input.previousStatus ?? null,
        new_status: input.newStatus ?? null,
        quality_status: input.qualityStatus ?? null,
        risk_level: input.riskLevel ?? null,
        flags: input.flags ?? [],
        notes: input.notes ?? null,
        changed_by: input.changedBy ?? null,
      },
    });
  } catch (error) {
    // The revision table is intentionally best-effort so a migration rollout
    // cannot interrupt AutoSEO ingestion. Once the table exists, logging is
    // automatic.
    console.error("[autoseo] Could not write revision log:", error instanceof Error ? error.message : error);
  }
}

// ---------------------------------------------------------------------------
// Admin mutations
// ---------------------------------------------------------------------------

export type AutoseoAdminUpdate = {
  id: number;
  title: string;
  slug: string;
  content_html: string | null;
  content_markdown?: string | null;
  hero_image_url?: string | null;
  hero_image_alt?: string | null;
  infographic_url?: string | null;
  meta_description?: string | null;
  meta_keywords?: string | null;
  tags?: string | null;
  faq_schema?: Array<{ question: string; answer: string }> | null;
  language?: string | null;
};

async function invalidateBlogSitemap(): Promise<void> {
  try {
    (await import("./sitemap-cache.server")).invalidateSitemapCache();
  } catch {
    // Best-effort cache invalidation.
  }
}

export async function updateAutoseoAdminRow(input: AutoseoAdminUpdate): Promise<void> {
  const id = Number(input.id);
  const title = String(input.title ?? "").trim();
  const slug = String(input.slug ?? "").trim();

  if (!Number.isFinite(id) || !title || !slug) {
    throw new Error("AutoSEO post requires a valid id, title and slug.");
  }

  const html = String(input.content_html ?? "");
  const now = new Date().toISOString();
  const quality = await evaluateAutoseoQuality({
    id,
    title,
    slug,
    contentHtml: html,
    metaDescription: input.meta_description ?? null,
    metaKeywords: input.meta_keywords ?? null,
    tags: input.tags ?? null,
  });

  const current = (await rest(
    `blog_posts?select=id,status,quality_status&id=eq.${encodeURIComponent(String(id))}&limit=1`,
  )) as Array<{ id: number; status?: string | null; quality_status?: string | null }>;

  if (!current?.[0]) {
    throw new Error("AutoSEO post not found.");
  }

  // Every substantive edit re-runs the gate. High-risk/finance/trade content
  // returns to review until a human approves the updated version.
  const nextStatus = quality.status === "approved" ? (current[0].status ?? "draft") : "draft";

  await patchBlogPostCompat(id, {
    title,
    slug,
    content_html: html || null,
    content_markdown: input.content_markdown ?? null,
    hero_image_url: input.hero_image_url ?? null,
    hero_image_alt: input.hero_image_alt ?? null,
    infographic_url: input.infographic_url ?? null,
    meta_description: input.meta_description ?? null,
    meta_keywords: input.meta_keywords ?? null,
    tags: input.tags ?? null,
    faq_schema: input.faq_schema ?? null,
    language: input.language ?? "en",
    reading_time: readingTimeFromHtml(html),
    quality_status: quality.status,
    risk_level: quality.riskLevel,
    requires_human_review: quality.requiresHumanReview,
    quality_flags: quality.flags,
    source_urls: quality.sourceUrls,
    reviewed_at: null,
    reviewed_by: null,
    status: nextStatus,
    is_featured: nextStatus === "published" ? undefined : false,
    updated_at: now,
  });

  await writeRevisionLog({
    postId: id,
    action: "article_updated",
    previousStatus: current[0].status ?? null,
    newStatus: nextStatus,
    qualityStatus: quality.status,
    riskLevel: quality.riskLevel,
    flags: quality.flags,
  });

  await invalidateBlogSitemap();
}

export async function approveAutoseoPost(id: number, reviewer: string, notes?: string | null): Promise<void> {
  const numericId = Number(id);
  const reviewedBy = String(reviewer ?? "").trim();

  if (!Number.isFinite(numericId)) {
    throw new Error("Invalid AutoSEO post id.");
  }

  if (!reviewedBy) {
    throw new Error("Reviewer is required to approve an AutoSEO article.");
  }

  const rows = (await rest(`blog_posts?select=*&id=eq.${encodeURIComponent(String(numericId))}&limit=1`)) as Array<
    Record<string, unknown>
  >;

  const row = rows?.[0];

  if (!row) {
    throw new Error("AutoSEO post not found.");
  }

  const quality = await evaluateAutoseoQuality({
    id: numericId,
    title: String(row["title"] ?? ""),
    slug: String(row["slug"] ?? ""),
    contentHtml: row["content_html"] == null ? null : String(row["content_html"]),
    metaDescription: row["meta_description"] == null ? null : String(row["meta_description"]),
    metaKeywords: row["meta_keywords"] == null ? null : String(row["meta_keywords"]),
    tags: row["tags"] == null ? null : String(row["tags"]),
  });

  const blockingFlags = quality.flags.filter((flag) => flag.severity === "blocking");

  if (blockingFlags.length > 0) {
    throw new Error(
      `This article still has blocking quality issues: ${blockingFlags.map((flag) => flag.message).join(" ")}`,
    );
  }

  const now = new Date().toISOString();

  await patchBlogPostCompat(numericId, {
    quality_status: "approved",
    risk_level: quality.riskLevel,
    requires_human_review: quality.requiresHumanReview,
    quality_flags: quality.flags,
    source_urls: quality.sourceUrls,
    review_notes: notes ?? null,
    reviewed_at: now,
    reviewed_by: reviewedBy,
    updated_at: now,
  });
  await writeRevisionLog({
    postId: numericId,
    action: "quality_approved",
    previousStatus: row["status"] == null ? null : String(row["status"]),
    newStatus: row["status"] == null ? null : String(row["status"]),
    qualityStatus: "approved",
    riskLevel: quality.riskLevel,
    flags: quality.flags,
    notes: notes ?? null,
    changedBy: reviewedBy,
  });

  await invalidateBlogSitemap();
}

export async function flagAutoseoPost(id: number, reviewer: string, notes?: string | null): Promise<void> {
  const numericId = Number(id);
  const reviewedBy = String(reviewer ?? "").trim();

  if (!Number.isFinite(numericId)) {
    throw new Error("Invalid AutoSEO post id.");
  }

  const rows = (await rest(
    `blog_posts?select=id,status,risk_level,quality_flags&id=eq.${encodeURIComponent(String(numericId))}&limit=1`,
  )) as Array<{
    id: number;
    status?: string | null;
    risk_level?: AutoseoRiskLevel | null;
    quality_flags?: AutoseoQualityFlag[] | null;
  }>;

  if (!rows?.[0]) {
    throw new Error("AutoSEO post not found.");
  }

  const now = new Date().toISOString();

  await patchBlogPostCompat(numericId, {
    quality_status: "flagged",
    status: "draft",
    is_featured: false,
    review_notes: notes ?? null,
    reviewed_at: now,
    reviewed_by: reviewedBy || null,
    updated_at: now,
  });

  await writeRevisionLog({
    postId: numericId,
    action: "quality_flagged",
    previousStatus: rows[0].status ?? null,
    newStatus: "draft",
    qualityStatus: "flagged",
    riskLevel: rows[0].risk_level ?? null,
    flags: rows[0].quality_flags ?? [],
    notes: notes ?? null,
    changedBy: reviewedBy || null,
  });

  await invalidateBlogSitemap();
}

export async function setAutoseoPublished(id: number, published: boolean): Promise<void> {
  const numericId = Number(id);

  if (!Number.isFinite(numericId)) {
    throw new Error("Invalid AutoSEO post id.");
  }

  const existing = (await rest(
    `blog_posts?select=id,status,published_at,quality_status,seo_indexable&id=eq.${encodeURIComponent(
      String(numericId),
    )}&limit=1`,
  )) as Array<{
    id: number;
    status?: string | null;
    published_at: string | null;
    quality_status?: AutoseoQualityStatus | null;
    seo_indexable?: boolean | null;
  }>;

  if (!existing?.[0]) {
    throw new Error("AutoSEO post not found.");
  }

  if (published && existing[0].quality_status !== "approved") {
    throw new Error("This AutoSEO article must pass the quality review and be approved before it can be published.");
  }

  if (published && existing[0].seo_indexable === false) {
    throw new Error(
      "This AutoSEO article overlaps an established search intent and cannot be published as a competing indexable URL.",
    );
  }

  const now = new Date().toISOString();
  const nextStatus = published ? "published" : "draft";

  await patchBlogPostCompat(numericId, {
    status: nextStatus,
    published_at: published ? (existing[0].published_at ?? now) : existing[0].published_at,
    is_featured: published ? undefined : false,
    updated_at: now,
  });

  await writeRevisionLog({
    postId: numericId,
    action: published ? "published" : "unpublished",
    previousStatus: existing[0].status ?? null,
    newStatus: nextStatus,
    qualityStatus: existing[0].quality_status ?? null,
  });

  await invalidateBlogSitemap();
}

export async function setFeaturedAutoseoPost(id: number): Promise<void> {
  const numericId = Number(id);

  if (!Number.isFinite(numericId)) {
    throw new Error("Invalid AutoSEO post id.");
  }

  const rows = (await rest(
    `blog_posts?select=id,status,quality_status&id=eq.${encodeURIComponent(String(numericId))}&limit=1`,
  )) as Array<{ id: number; status?: string | null; quality_status?: AutoseoQualityStatus | null }>;

  if (!rows?.[0]) {
    throw new Error("AutoSEO post not found.");
  }

  if (rows[0].status !== "published" || rows[0].quality_status !== "approved") {
    throw new Error("Only approved, published AutoSEO articles can be featured.");
  }

  const now = new Date().toISOString();

  await rest("blog_posts?is_featured=eq.true", {
    method: "PATCH",
    prefer: "return=minimal",
    body: {
      is_featured: false,
      updated_at: now,
    },
  });

  await patchBlogPostCompat(numericId, {
    is_featured: true,
    updated_at: now,
  });

  await writeRevisionLog({
    postId: numericId,
    action: "featured",
    previousStatus: rows[0].status ?? null,
    newStatus: rows[0].status ?? null,
    qualityStatus: rows[0].quality_status ?? null,
  });
}

// ---------------------------------------------------------------------------
// Reading time
// ---------------------------------------------------------------------------

export function readingTimeFromHtml(html: string): number {
  const words = html
    .replace(/<[^>]+>/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;

  return Math.max(1, Math.ceil(words / 200));
}

type WebhookBody = Record<string, unknown>;

const text = (v: unknown): string | null => {
  const s = v == null ? "" : String(v).trim();
  return s ? s : null;
};

// ---------------------------------------------------------------------------
// SEO intent ownership
// ---------------------------------------------------------------------------

/**
 * These words usually add little value when comparing whether two article
 * topics target the same organic-search intent.
 *
 * IMPORTANT:
 * We intentionally do NOT remove meaningful financing modifiers such as:
 *
 * - pre approval
 * - pre qualification
 * - bad credit
 * - interest rates
 * - down payment
 * - refinance
 *
 * Those represent potentially different search intents.
 */

const INTENT_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "at",
  "be",
  "best",
  "by",
  "for",
  "from",
  "guide",
  "how",
  "in",
  "is",
  "it",
  "my",
  "of",
  "on",
  "the",
  "to",
  "what",
  "when",
  "where",
  "why",
  "with",
  "your",
  "you",

  // Local modifiers. My Car is already locally associated with these terms,
  // so they should not create separate intent ownership.
  "fredericksburg",
  "virginia",
  "va",
]);

const INTENT_SYNONYMS: Record<string, string> = {
  automobiles: "car",
  automobile: "car",
  cars: "car",
  vehicles: "vehicle",
  loans: "loan",
  rates: "rate",
  payments: "payment",
  dealerships: "dealership",
  dealers: "dealer",
};

/**
 * Normalize common keyword formatting so small variations don't create
 * artificial differences.
 */
function normalizeIntentText(value: string): string {
  return (
    value
      .toLowerCase()

      // Normalize common forms before punctuation is removed.
      .replace(/\bpre[\s-]?approved\b/g, "pre approval")
      .replace(/\bpre[\s-]?approve\b/g, "pre approval")
      .replace(/\bpre[\s-]?approval\b/g, "pre approval")
      .replace(/\bpre[\s-]?qualified\b/g, "pre qualification")
      .replace(/\bpre[\s-]?qualify\b/g, "pre qualification")
      .replace(/\bpre[\s-]?qualification\b/g, "pre qualification")

      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function intentTokens(value: string): string[] {
  const normalized = normalizeIntentText(value);

  if (!normalized) {
    return [];
  }

  return normalized
    .split(" ")
    .map((token) => INTENT_SYNONYMS[token] ?? token)
    .filter((token) => token.length > 1 && !INTENT_STOP_WORDS.has(token));
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort();
}

/**
 * Create a stable normalized search-intent key.
 *
 * Examples:
 *
 * "How to Get Pre-Approved for a Used Car in Fredericksburg, VA"
 * becomes roughly:
 *
 * "car pre approval used"
 *
 * while:
 *
 * "Used Car Interest Rates"
 * becomes:
 *
 * "car interest rate used"
 *
 * Therefore the two pages remain separate intents.
 */
export function normalizePrimaryIntent(value: string): string {
  return uniqueSorted(intentTokens(value)).join(" ");
}

/**
 * AutoSEO normally provides metaKeywords/keywords. Those are our preferred
 * source for the article's primary target query.
 *
 * If AutoSEO does not provide them, fall back to the article title.
 */
export function derivePrimaryIntent(input: {
  title: string;
  metaKeywords?: string | null;
  tags?: string | null;
}): string {
  const keywordSource = text(input.metaKeywords);

  if (keywordSource) {
    const firstKeyword =
      keywordSource
        .split(",")
        .map((part) => part.trim())
        .find(Boolean) ?? keywordSource;

    const normalizedKeyword = normalizePrimaryIntent(firstKeyword);

    if (normalizedKeyword) {
      return normalizedKeyword;
    }
  }

  const normalizedTitle = normalizePrimaryIntent(input.title);

  if (normalizedTitle) {
    return normalizedTitle;
  }

  const normalizedTags = normalizePrimaryIntent(input.tags ?? "");

  return normalizedTags;
}

function tokenSet(value: string): Set<string> {
  return new Set(
    value
      .split(" ")
      .map((token) => token.trim())
      .filter(Boolean),
  );
}

/**
 * Jaccard similarity between two normalized intent keys.
 *
 * This is deliberately conservative. We do not want to accidentally merge
 * two useful financing articles simply because they both mention "used car"
 * or "financing".
 */

export function intentSimilarity(a: string, b: string): number {
  if (!a || !b) {
    return 0;
  }

  if (a === b) {
    return 1;
  }

  const setA = tokenSet(a);
  const setB = tokenSet(b);

  if (!setA.size || !setB.size) {
    return 0;
  }

  let intersection = 0;

  for (const token of setA) {
    if (setB.has(token)) {
      intersection += 1;
    }
  }

  const union = new Set([...setA, ...setB]).size;

  return union ? intersection / union : 0;
}

/**
 * Exact normalized intents are duplicates.
 *
 * For non-exact matches we use a high threshold so pages such as:
 *
 * - used car pre approval
 * - bad credit car financing
 * - used car interest rates
 *
 * are NOT collapsed merely because they share broad financing terminology.
 */
export function intentsOverlap(a: string, b: string): boolean {
  if (!a || !b) {
    return false;
  }

  if (a === b) {
    return true;
  }

  return intentSimilarity(a, b) >= 0.82;
}

function articleIntent(post: { title: string; meta_keywords?: string | null; tags?: string | null }): string {
  return derivePrimaryIntent({
    title: post.title,
    metaKeywords: post.meta_keywords ?? null,
    tags: post.tags ?? null,
  });
}

/**
 * Find an existing AutoSEO article that already owns the same search intent.
 *
 * We exclude the current AutoSEO ID so webhook updates to an existing article
 * never identify themselves as duplicates.
 */
async function findExistingIntentOwner(input: {
  id: number;
  title: string;
  metaKeywords: string | null;
  tags: string | null;
}): Promise<{
  post: AutoseoPost;
  intent: string;
} | null> {
  const incomingIntent = derivePrimaryIntent({
    title: input.title,
    metaKeywords: input.metaKeywords,
    tags: input.tags,
  });

  if (!incomingIntent) {
    return null;
  }

  let existing: AutoseoPost[];

  try {
    existing = (await rest(
      `blog_posts?select=${SELECT}&id=neq.${encodeURIComponent(
        String(input.id),
      )}&order=published_at.asc.nullslast,created_at.asc`,
    )) as AutoseoPost[];
  } catch (error) {
    console.error("[autoseo] Could not check existing search intents:", error instanceof Error ? error.message : error);

    // Never fail article delivery because the defensive SEO check could not
    // complete.
    return null;
  }

  for (const post of existing ?? []) {
    if (!post?.slug || !post?.title) {
      continue;
    }

    const existingIntent = articleIntent(post);

    if (existingIntent && intentsOverlap(incomingIntent, existingIntent)) {
      return {
        post,
        intent: existingIntent,
      };
    }
  }

  return null;
}

/**
 * Return SEO ownership information for a stored article.
 *
 * This helper will be used by the blog route/index in the next update.
 */
export async function getAutoseoIntentInfo(article: AutoseoPost): Promise<AutoseoIntentInfo> {
  const primaryIntent = articleIntent(article);

  if (!primaryIntent) {
    return {
      primaryIntent: "",
      canonicalSlug: article.slug,
      indexable: true,
      duplicateOf: null,
    };
  }

  const owner = await findExistingIntentOwner({
    id: article.id,
    title: article.title,
    metaKeywords: article.meta_keywords,
    tags: article.tags,
  });

  if (!owner) {
    return {
      primaryIntent,
      canonicalSlug: article.slug,
      indexable: true,
      duplicateOf: null,
    };
  }

  const articleDate = new Date(article.published_at ?? article.created_at ?? 0).getTime();

  const ownerDate = new Date(owner.post.published_at ?? owner.post.created_at ?? 0).getTime();

  /**
   * Prefer the older established URL as the owner.
   *
   * This avoids allowing a newly generated AutoSEO article to displace an
   * existing URL simply because it arrived later.
   */
  if (articleDate && ownerDate && articleDate < ownerDate) {
    return {
      primaryIntent,
      canonicalSlug: article.slug,
      indexable: true,
      duplicateOf: null,
    };
  }

  return {
    primaryIntent,
    canonicalSlug: owner.post.slug,
    indexable: false,
    duplicateOf: owner.post.slug,
  };
}

/**
 * Remove duplicate-intent AutoSEO articles from a public collection.
 *
 * The oldest article owns an intent. Different intents remain untouched.
 */
export function dedupeAutoseoPostsByIntent(posts: AutoseoPost[]): AutoseoPost[] {
  const sorted = [...posts].sort((a, b) => {
    const aTime = new Date(a.published_at ?? a.created_at ?? 0).getTime();

    const bTime = new Date(b.published_at ?? b.created_at ?? 0).getTime();

    return aTime - bTime;
  });

  const owners: Array<{
    post: AutoseoPost;
    intent: string;
  }> = [];

  for (const post of sorted) {
    const intent = articleIntent(post);

    if (!intent) {
      owners.push({
        post,
        intent: `__slug:${post.slug}`,
      });

      continue;
    }

    const duplicate = owners.some(
      (owner) => !owner.intent.startsWith("__slug:") && intentsOverlap(intent, owner.intent),
    );

    if (!duplicate) {
      owners.push({
        post,
        intent,
      });
    }
  }

  const ownerIds = new Set(owners.map(({ post }) => post.id));

  // Preserve the original ordering supplied by the caller.
  return posts.filter((post) => ownerIds.has(post.id));
}

// ---------------------------------------------------------------------------
// Image mirror
// ---------------------------------------------------------------------------

const IMAGE_BUCKET = "autoseo-images";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/svg+xml": "svg",
};

let bucketReady = false;

/**
 * Create the public image bucket if it isn't there yet.
 * Other buckets untouched.
 */
async function ensureImageBucket(): Promise<void> {
  if (bucketReady) {
    return;
  }

  const c = creds();

  const res = await fetch(`${c.url}/storage/v1/bucket`, {
    method: "POST",
    headers: {
      apikey: c.key,
      Authorization: `Bearer ${c.key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id: IMAGE_BUCKET,
      name: IMAGE_BUCKET,
      public: true,
    }),
  });

  if (res.ok || res.status === 409) {
    bucketReady = true;
    return;
  }

  const detail = await res.text();

  if (/already exists|Duplicate/i.test(detail)) {
    bucketReady = true;
    return;
  }

  throw new Error(`Could not prepare image bucket (${res.status}): ${detail.slice(0, 200)}`);
}

/**
 * Copy a remote image into storage and return its public URL.
 *
 * Returns the original URL when anything goes wrong, so an image problem
 * never fails article delivery.
 */

async function mirrorImage(
  remoteUrl: string | null,
  articleId: number,
  name: "hero" | "infographic",
): Promise<string | null> {
  if (!remoteUrl) {
    return null;
  }

  try {
    await ensureImageBucket();

    const download = await fetch(remoteUrl);

    if (!download.ok) {
      throw new Error(`download failed (${download.status})`);
    }

    const contentType = (download.headers.get("content-type") ?? "").split(";")[0]!.toLowerCase();

    if (!contentType.startsWith("image/")) {
      throw new Error(`not an image (${contentType})`);
    }

    const bytes = new Uint8Array(await download.arrayBuffer());

    if (bytes.byteLength === 0) {
      throw new Error("empty image");
    }

    if (bytes.byteLength > MAX_IMAGE_BYTES) {
      throw new Error("image too large");
    }

    const fromUrl = new URL(remoteUrl).pathname.split(".").pop()?.toLowerCase() ?? "";

    const ext = EXT_BY_TYPE[contentType] ?? (/^[a-z0-9]{2,5}$/.test(fromUrl) ? fromUrl : "jpg");

    const path = `articles/${articleId}/${name}.${ext}`;

    const c = creds();

    const upload = await fetch(`${c.url}/storage/v1/object/${IMAGE_BUCKET}/${path}`, {
      method: "POST",
      headers: {
        apikey: c.key,
        Authorization: `Bearer ${c.key}`,
        "Content-Type": contentType,
        "x-upsert": "true",
        "cache-control": "public, max-age=31536000",
      },
      body: bytes,
    });

    if (!upload.ok) {
      throw new Error(`upload failed (${upload.status})`);
    }

    return `${c.url}/storage/v1/object/public/${IMAGE_BUCKET}/${path}`;
  } catch (error) {
    console.error(
      `[autoseo] ${name} image kept as remote URL for article ${articleId}:`,
      error instanceof Error ? error.message : error,
    );

    return remoteUrl;
  }
}

// ---------------------------------------------------------------------------
// Upsert
// ---------------------------------------------------------------------------

/**
 * Retry the upsert without columns the table doesn't have.
 *
 * This preserves compatibility with the current database and means the new
 * optional SEO ownership fields can be added later without breaking article
 * publishing today.
 */
async function upsertRow(row: Record<string, unknown>): Promise<void> {
  let payload = { ...row };

  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      await rest("blog_posts?on_conflict=id", {
        method: "POST",
        prefer: "resolution=merge-duplicates,return=minimal",
        body: payload,
      });

      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      const missing = /PGRST204/.test(message)
        ? (/'([^']+)' column/.exec(message)?.[1] ?? /column\s+"?([a-z_]+)"?/i.exec(message)?.[1])
        : undefined;

      if (!missing || !(missing in payload)) {
        throw error;
      }

      console.error(`[autoseo] blog_posts has no "${missing}" column — skipping that field.`);

      const { [missing]: _drop, ...remaining } = payload;

      payload = remaining;
    }
  }

  throw new Error("Could not store the article after removing unknown columns.");
}

export async function upsertAutoseoArticle(body: WebhookBody): Promise<{
  slug: string;
}> {
  const id = Number(body["id"]);

  const title = text(body["title"]);

  const slug = text(body["slug"]);

  if (!Number.isFinite(id) || !title || !slug) {
    throw new Error("Missing id, title or slug.");
  }

  const html = String(body["content_html"] ?? "");

  const faq = body["faqSchema"];

  const now = new Date().toISOString();

  const metaKeywords =
    text(body["metaKeywords"]) ??
    (Array.isArray(body["keywords"])
      ? (body["keywords"] as unknown[])
          .map((value) => String(value).trim())
          .filter(Boolean)
          .join(", ")
      : null);

  const tags = text(body["wordpressTags"]);

  const primaryIntent = derivePrimaryIntent({
    title,
    metaKeywords,
    tags,
  });

  /**
   * Check whether an older AutoSEO article already owns this search intent.
   *
   * IMPORTANT:
   * We still store the incoming article. We do NOT automatically delete,
   * overwrite or redirect content at webhook time.
   *
   * Instead we record ownership metadata when the table supports it. The
   * public route/index updates will use the same intent logic even if those
   * optional DB columns do not exist yet.
   */

  const existingOwner = await findExistingIntentOwner({
    id,
    title,
    metaKeywords,
    tags,
  });

  const canonicalSlug = existingOwner?.post.slug ?? slug;

  const seoIndexable = !existingOwner;

  const quality = await evaluateAutoseoQuality({
    id,
    title,
    slug,
    contentHtml: html,
    metaDescription: text(body["metaDescription"]),
    metaKeywords,
    tags,
    duplicateOf: existingOwner?.post.slug ?? null,
  });

  if (existingOwner) {
    console.warn(
      `[autoseo] Search-intent overlap detected for "${slug}". ` +
        `Primary intent: "${primaryIntent}". ` +
        `Existing owner: "${existingOwner.post.slug}".`,
    );
  }

  const [heroUrl, infographicUrl] = await Promise.all([
    mirrorImage(text(body["heroImageUrl"]), id, "hero"),

    mirrorImage(text(body["infographicImageUrl"]), id, "infographic"),
  ]);

  const sourceArticleId = Number(body["sourceArticleId"]);

  const row = {
    id,
    title,
    slug,

    content_html: html || null,

    content_markdown: text(body["content_markdown"]),

    hero_image_url: heroUrl,

    hero_image_alt: text(body["heroImageAlt"]),

    infographic_url: infographicUrl,

    meta_description: text(body["metaDescription"]),

    meta_keywords: metaKeywords,

    tags,

    faq_schema: Array.isArray(faq) && faq.length > 0 ? faq : null,

    language: text(body["languageCode"]) ?? "en",

    reading_time: readingTimeFromHtml(html),

    published_url: text(body["published_url"]) ?? text(body["publishedUrl"]),

    source_article_id: Number.isFinite(sourceArticleId) ? sourceArticleId : null,

    // AutoSEO cannot bypass the My Car quality gate. Clean low-risk content can
    // retain the incoming publish intent, while finance/trade/high-risk or
    // flagged content is held as a draft until a human approves it.
    status:
      quality.status === "approved" && (text(body["status"]) ?? "published") === "published" ? "published" : "draft",

    published_at: text(body["publishedAt"]) ?? now,

    updated_at: text(body["updatedAt"]) ?? now,

    created_at: text(body["createdAt"]) ?? now,

    received_at: now,

    /**
     * Optional SEO ownership fields.
     *
     * If these columns do not yet exist, upsertRow() safely removes them.
     */
    primary_intent: primaryIntent || null,

    canonical_slug: canonicalSlug,

    seo_indexable: seoIndexable && quality.status === "approved",

    quality_status: quality.status,

    risk_level: quality.riskLevel,

    requires_human_review: quality.requiresHumanReview,

    quality_flags: quality.flags,

    source_urls: quality.sourceUrls,

    review_notes: null,

    reviewed_at: quality.status === "approved" ? now : null,

    reviewed_by: quality.status === "approved" ? "automatic_quality_gate" : null,
  };

  await upsertRow(row);

  await writeRevisionLog({
    postId: id,
    action: "autoseo_received",
    newStatus: String(row.status),
    qualityStatus: quality.status,
    riskLevel: quality.riskLevel,
    flags: quality.flags,
    changedBy: "autoseo",
  });

  // A new or changed article means the cached sitemap is stale.
  try {
    (await import("./sitemap-cache.server")).invalidateSitemapCache();
  } catch {
    // Sitemap cache is best-effort.
  }

  return { slug };
}

// ---------------------------------------------------------------------------
// Sitemap
// ---------------------------------------------------------------------------

type SitemapRow = {
  id?: number;
  title?: string;
  slug: string;
  meta_keywords?: string | null;
  tags?: string | null;
  updated_at: string | null;
  published_at: string | null;
  created_at?: string | null;
  status?: string | null;
  quality_status?: AutoseoQualityStatus | null;
};

/**
 * Published AutoSEO articles for the sitemap.
 *
 * We perform the same intent deduplication here in application code instead
 * of depending on optional database columns. That means the protection works
 * even before primary_intent/canonical_slug/seo_indexable are added to the
 * Supabase table.
 */

export async function sitemapUrls(): Promise<
  Array<{
    slug: string;
    lastmod: string | null;
  }>
> {
  let rows: SitemapRow[] = [];

  try {
    rows = (await rest(
      "blog_posts?select=id,title,slug,meta_keywords,tags,updated_at,published_at,created_at,status,quality_status&status=eq.published&quality_status=eq.approved&published_at=not.is.null",
    )) as SitemapRow[];
  } catch {
    try {
      // Compatibility fallback for a table with status but without the quality
      // gate columns.
      rows = (await rest(
        "blog_posts?select=id,title,slug,meta_keywords,tags,updated_at,published_at,created_at,status&status=eq.published&published_at=not.is.null",
      )) as SitemapRow[];
    } catch {
      // Oldest compatibility fallback.
      rows = (await rest(
        "blog_posts?select=id,title,slug,meta_keywords,tags,updated_at,published_at,created_at&published_at=not.is.null",
      )) as SitemapRow[];
    }
  }

  const validRows = (rows ?? []).filter((row) => row.slug && row.title);

  /**
   * Oldest URL owns a normalized intent.
   *
   * This keeps established URLs in the sitemap and prevents a newer AutoSEO
   * article targeting the same intent from receiving another strong
   * indexation signal.
   */
  const chronological = [...validRows].sort((a, b) => {
    const aTime = new Date(a.published_at ?? a.created_at ?? 0).getTime();

    const bTime = new Date(b.published_at ?? b.created_at ?? 0).getTime();

    return aTime - bTime;
  });

  const owners: Array<{
    row: SitemapRow;
    intent: string;
  }> = [];

  for (const row of chronological) {
    const intent = derivePrimaryIntent({
      title: row.title ?? row.slug,
      metaKeywords: row.meta_keywords ?? null,
      tags: row.tags ?? null,
    });

    if (!intent) {
      owners.push({
        row,
        intent: `__slug:${row.slug}`,
      });

      continue;
    }

    const duplicate = owners.some(
      (owner) => !owner.intent.startsWith("__slug:") && intentsOverlap(intent, owner.intent),
    );

    if (!duplicate) {
      owners.push({
        row,
        intent,
      });
    }
  }

  return owners.map(({ row }) => ({
    slug: row.slug,
    lastmod: row.updated_at ?? row.published_at ?? null,
  }));
}
