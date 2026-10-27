# Internal SEO Content Agent: architecture and publishing recommendation

Status: draft-and-review prototype is built (Marketing Hub, Content Plan tab). Nothing publishes from it.

## What exists today
- **Storage and publishing:** the website already has a gated publishing path. Hand-written posts live in `mc_blog` and are managed in the Blog workspace; AutoSEO-delivered articles live in `mycarco_db.blog_posts` and arrive through the authenticated webhook (`/api/public/receive-article`). An automatic quality gate holds risky content as a draft, overlapping search intents are consolidated with a 301 to the oldest URL, and the sitemap cache is invalidated on every change.
- **Public safety:** public reads now fail closed (published and approved only, no weaker fallback on errors).
- **SEO output:** BlogPosting and breadcrumb schema, canonicals, titles under 60 characters, topic-aware links and a crawlable article index.
- **Known gap:** AutoSEO HTML is shown without sanitizing (see the Phase 7 security notes). Any new content source must go through the sanitized Blog workspace.

## Agent workflow
Topic suggestion → search intent → comparison with existing articles → outline → draft → fact check → SEO metadata → internal links → editorial approval → publishing authorization → publication → sitemap check → monitoring.

| Step | Where it happens | Built |
|---|---|---|
| Topic suggestions, intent, keyword theme, cluster | Content Plan tab (backlog from the approved plan) | Yes |
| Existing-article comparison | Staff-only server check using the existing intent logic, published articles only | Yes |
| Outline, title and description guidance, internal links, image and alt guidance | Brief (headings and questions only) | Yes |
| Draft | A person writes or edits it; AI may suggest wording but is not a source of fact | By a person |
| Risky-claim pre-check, fact-check checklist | Content Plan tab | Yes |
| Approval | Different reviewer than the author, full checklist, no findings, no duplicate | Yes (session only) |
| Publishing authorization, publication | Separate named authorization, then the Blog workspace and its quality gate | Authorization step yes; publication stays in the Blog workspace |
| Sitemap verification, monitoring | Existing sitemap cache invalidation; Marketing Hub reports | Existing |
| Audit trail | Shown in the page, lost on reload | Needs a database table (approval required) |

The agent never invents dealership facts, inventory, financing rates, reviews or guarantees. A brief is structure, not claims. No recurring job and no GitHub workflow was added.

## Option A or B for publishing
**Option A: the existing website publishing path (recommended).**
**Option B: article files in GitHub with reviewed pull requests.**

| | A. Existing path | B. GitHub files and PRs |
|---|---|---|
| Reliability | Already running; one database; the sitemap updates immediately | Needs a build and deploy per article; slower; a failed build blocks content |
| Security | Server-side checks, quality gate, staff authentication; one known gap (render-time sanitizing) | A write token to the repository is needed; every merge deploys to production; the PR review is a real control |
| Maintenance | One system | A second content store plus a sync to the database, or a rewrite of the blog to read files |
| Editorial approval | Quality gate plus staff review; the approval and audit trail still need a table | Strong: PR review, history, rollback with git |
| Deployment | None needed to publish | Every article needs a deployment, which the repository's deployment rules treat as a deliberate step |
| SEO | Canonicals, schema and sitemap already handled | Same output only if rebuilt to match; risk of duplicate URLs during the move |

**Recommendation:** keep Option A. Add (1) sanitizing at render, (2) a small approval and audit table, and (3) a Blog workspace import for a Markdown brief or draft. Option B adds a second source of truth, a deployment per article and a write credential, without a benefit that the audit table does not already give. Do not implement both.

## Approvals needed
1. A table for drafts, approvals and the audit trail (production database change).
2. Whether AI drafting through an API is wanted and who pays for it. Drafts would still be reviewed by a person.
3. HTML sanitizing at render, with a visual check of live articles.
