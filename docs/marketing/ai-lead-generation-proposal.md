# AI Lead Generation Research and Implementation Proposal

Status: proposal only. Nothing here is built, activated or paid for. Costs, platform rules and legal points below are
planning estimates from general knowledge and must be re-checked against each platform's current terms and by counsel
before anything is switched on. No lead collection runs autonomously.

## 1. Goal and ground rules

- Goal: about 6–10 workable leads per day for MyCarCorp, Fredericksburg, VA. This is a target. The dashboard's Daily Lead
  Goal tab measures real progress against it from saved website lead records.
- "Workable" = usable contact details, a legitimate inquiry, not a repeat. "Qualified" needs criteria management has not
  approved yet (see section 6).
- Rules for every option: people are contacted only after they asked to be, or where the law and the platform allow;
  no scraping of private individuals' names, emails or phone numbers from social media, maps or other sites; no bought lists;
  no bypassing site restrictions; no automatic outreach to people without the needed consent; no campaigns launched without approval.
- Geography to confirm with management before anything is activated: a 50-mile service area (roughly Fredericksburg,
  Stafford, Spotsylvania, King George, Caroline, Culpeper, Orange, Fauquier, Prince William, up to Richmond and Northern
  Virginia edges) and a tighter 10-mile brand-awareness zone (Fredericksburg city, Spotsylvania and Stafford near the lot).

## 2. Options compared

Complexity: Low = copy and settings, Medium = some development, High = significant development or ongoing work.
Cost ranges are rough monthly planning figures, excluding staff time, and are not quotes.

| # | Option | How it generates leads | Audience | Integration needed | Complexity | Rough cost | Consent and privacy | Enters GHL by | Source tracking | Qualification signal | CSV export |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | First-party website lead capture (existing forms, chat) | Visitors submit Contact, Car Finder, Sell, Trade, Appointment, Availability, Finance | Anyone on the site | Exists | Low (tune forms, add clear consent text) | $0 extra | Clear purpose notice; marketing consent as a separate unchecked choice; privacy policy must match | Existing forwarding (delivery state tracked) | Existing first/last-touch attribution | Inquiry type, vehicle named, appointment date, budget given | Yes, already built |
| 2 | Google Business Profile discovery | People find the profile in Maps and Search, then call, message, book or visit the website | Local searchers | Profile management by an authorized owner; Business Profile API is access-restricted | Low–Medium | $0 (staff time) | Reviews and messages are public or platform-handled; reply, do not harvest | Calls and messages handled by staff; website clicks carry UTM tags | UTM on profile links; call tracking if approved | Booked visits and calls | Insights exports are aggregate, not people |
| 3 | Local search traffic (organic) | Used cars, sell/trade and test-drive searches land on inventory, vehicle and blog pages | Local car shoppers and sellers | Search Console, GA4 (exist) | Medium, ongoing | $0 tools; content time | Consent banner governs analytics | Forms on those pages | Attribution classifies organic search | Same as option 1 | Yes (lead export) |
| 4 | SEO landing pages (e.g. SUVs, trucks, financing) | Pages that match a specific search and lead to a form | People with a defined need | Existing site; needs approval for new routes | Medium | $0 plus content time | Same as option 1; avoid thin location-only doorway pages | Existing forms | Attribution plus landing page | Need-specific fields | Yes |
| 5 | Organic social posts | Posts and short videos send people to inventory or a form | Followers and local community | Manual posting; no API needed to start | Low–Medium, ongoing | $0 plus content time | Platform terms; tagged links; no DMs scraped | Link to a form with UTM tags | UTM tags per post | Same as option 1 | Yes |
| 6 | Facebook and Instagram lead forms | Instant forms inside the apps | Local audiences, via ads or posts | Meta Marketing/Leads API; GHL has a native Facebook lead-form integration | Medium | Ad spend (only if approved) | Meta lead ad consent and privacy-policy link required; ad rules for auto and credit offers apply | GHL native lead-form integration, or webhook | Form name and campaign saved on the contact | Form answers | Yes, through GHL |
| 7 | Approved lead-generation partners | A vetted partner sends consenting leads that asked for a dealer | Shoppers on partner sites | Partner API or email into GHL | Medium | Usually per-lead fees | Partner must prove consent per lead; contract terms | Webhook or API into GHL, tagged by partner | Source field set per partner | Partner-supplied intent | Yes |
| 8 | Referral program | Past customers refer friends for a reward | Customers' contacts, introduced by the customer | Simple form plus GHL tag | Low | Reward cost | The referred person must be contacted lawfully; do not contact people on a customer's behalf without their consent | Referral form to GHL | Referrer name on the contact | High: warm introduction | Yes |
| 9 | Compliant local advertising (search, social) | Paid placement to local audiences | Radius or ZIP targeted | Google Ads and Meta Ads accounts (currently paused) | Medium | Ad spend (only if approved) | Auto and credit ad rules; consent banner; no sensitive targeting | Landing pages and forms | UTM, click IDs (consent-gated) | Same as option 1 | Yes |
| 10 | Opt-in forms and downloadable resources | A buyer's checklist or trade-in guide in exchange for contact details | People researching | Form plus GHL automation | Medium | $0 plus content time | Explicit opt-in; unsubscribe; no pre-checked boxes | Form to GHL with a tag | Resource name as source | Weak until they act | Yes |
| 11 | Business partnerships | Referrals from employers, repair shops, credit unions, rideshare groups | Their customers or members | None to start | Low | Possible referral fees (check legality) | Partner shares only what people agreed to | Referral form with partner name | Partner tag | Varies | Yes |
| 12 | Public business-to-business prospect discovery | Staff find businesses (fleets, contractors) from public business listings and websites, then reach out as a business | Businesses, not private individuals | Public directories and business websites | Medium | Staff time | Business contact details only; follow email and phone-contact rules; honor opt-outs | Manually created contacts, tagged | "B2B prospecting" source | Fleet size, vehicle need | Yes |

## 3. Recommendation

Do first (lowest risk, highest evidence of intent):
1. **Option 1** — make the existing forms convert better and capture a consent choice. Everything else feeds these forms.
2. **Options 2 and 3** — complete the Google Business Profile (checklist already prepared) and keep publishing useful local
   content. Free, and the source of the highest-intent local searches.
3. **Option 8** — a referral form and reward. Cheap and warm.

Do next, with approval:
4. **Option 6 and 9** — small, capped, local Meta and Google campaigns with a lead form, only after management approves a
   budget and the ad rules for vehicle and credit offers are checked. Ads stay paused until then.
5. **Option 7** — one vetted partner on a trial, with per-lead consent proof.

Later or only if a clear need appears: options 4 (needs approval for new pages), 10, 11, 12.

Geography: start with the 50-mile area for search and referrals (people travel to buy a car) and use the 10-mile zone for
brand awareness posts and community partnerships. Management should confirm both.

## 4. What can reasonably be automated

| Task | Automate with | Notes |
|---|---|---|
| Capture and save inquiries, forward once to GHL, track delivery | Existing website | Already built; unconfirmed deliveries stay manual on purpose |
| Tag the source and campaign on every lead | Existing attribution | Already built |
| Daily goal report, health checks, CSV export | Existing Marketing Hub | Built in this change |
| Draft blog posts, landing-page copy, social posts, referral emails | Claude Code, reviewed by a person | Human approval before publishing |
| Suggest fixes for failing integrations | Claude Code, from the health brief | Plan and code for review only |
| Follow-up to people who asked to be contacted | GHL workflows | Only for consenting contacts; workflow changes need approval |
| Review and reply to Business Profile reviews | Staff, with drafted replies | Replies are written by a person |
| Weekly summary of sources, goals and open issues | Claude Code or a scheduled report | Read-only |

Should never be automated: scraping or enriching private individuals' contact details, contacting people without consent,
buying lists, spending ad budget, changing GHL workflows, deleting contacts.

## 5. Consent and privacy checklist (before activating anything)

- The privacy policy must describe what is collected and why. The "How you found us" paragraph and the chat and server-side
  tracking disclosures are still pending management and legal approval.
- Marketing consent for text and email is a separate, unchecked choice with the wording counsel approves (texting and
  calling rules, such as TCPA, apply). Keep the consent record with the contact.
- Honor opt-outs everywhere. Do not message anyone who has not consented.
- Do not put customer personal data into analytics or ad platforms beyond what the platform's terms and the site's consent allow.

## 6. Qualification criteria still to be approved by management

The dashboard reports "Qualified" as not yet tracked. A proposal for management to edit:

- Located within the approved service area (or willing to travel).
- Named a vehicle, budget, trade-in or a requested appointment.
- Reachable: valid phone or email, and a reply or contact attempt logged.
- Not a duplicate, vendor solicitation or test.

When approved, staff would need a place to record it (for example a lead status or GHL stage). That is a data change and
needs approval; this change adds none.

## 7. Required integrations and access

- Existing: Search Console and GA4 reports, GHL webhook, website lead storage.
- Needs your action: owner or manager access to the Google Business Profile; Meta Business Manager access if lead forms
  are approved; a decision on the 50-mile and 10-mile areas; consent wording and privacy policy approval; a budget decision
  before any paid channel.
- Not available here: Facebook, Instagram, TikTok, LinkedIn and WhatsApp data. The dashboard shows leads from those sources
  only when a saved lead carries them.
