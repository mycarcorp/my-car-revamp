// Lighthouse CI config. Audits the live public site (the app is built for an
// edge worker, so it is not served locally in CI). URLs come from LHCI_URLS
// (set by the workflow from sitemap.xml) with static fallbacks.
const BASE = process.env.LHCI_BASE_URL || "https://mycarcorp.com";
const fallback = ["/", "/search", "/finance", "/sell", "/schedule", "/contact", "/blog", "/locations"].map(
  (p) => BASE + p,
);
const urls = (process.env.LHCI_URLS || "").split(/\s+/).filter(Boolean);

module.exports = {
  ci: {
    collect: {
      url: urls.length ? urls : fallback,
      numberOfRuns: 1,
      settings: { preset: "desktop" },
    },
    assert: {
      // Warnings only: existing issues never fail the run.
      assertions: {
        "categories:seo": ["warn", { minScore: 0.9 }],
        "categories:performance": ["warn", { minScore: 0.6 }],
        "categories:accessibility": ["warn", { minScore: 0.85 }],
        "categories:best-practices": ["warn", { minScore: 0.85 }],
      },
    },
    upload: { target: "filesystem", outputDir: "./lhci-reports" },
  },
};
