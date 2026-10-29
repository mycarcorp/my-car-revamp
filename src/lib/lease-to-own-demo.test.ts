import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  billOfSaleDemoPages,
  buildDemoPdf,
  buildDemoPdfPages,
  DEMO_WATERMARK,
  demoContractLines,
} from "./demo-contract-pdf";
import { CONTRACT_TEMPLATES, initialDealContracts } from "./lease-contracts";
import {
  demoDeal,
  demoReleasedContracts,
  isLeaseDemoStage,
  leaseDemoEnabled,
  visibleDemoStage,
} from "./lease-to-own-demo";

describe("demo mode gate", () => {
  it("is off by default and needs BOTH development mode and the explicit flag", () => {
    expect(leaseDemoEnabled({})).toBe(false);
    expect(leaseDemoEnabled({ DEV: true })).toBe(false);
    expect(leaseDemoEnabled({ DEV: false, VITE_LEASE_WORKFLOW_DEMO: "true" })).toBe(false);
    expect(leaseDemoEnabled({ DEV: true, VITE_LEASE_WORKFLOW_DEMO: "1" })).toBe(false);
    expect(leaseDemoEnabled({ DEV: true, VITE_LEASE_WORKFLOW_DEMO: "true" })).toBe(true);
  });
});

describe("demo stages", () => {
  it("accepts only known stages from the URL", () => {
    expect(isLeaseDemoStage("result")).toBe(true);
    expect(isLeaseDemoStage("contracts")).toBe(true);
    expect(isLeaseDemoStage("portal")).toBe(true);
    expect(isLeaseDemoStage("approve")).toBe(false);
  });

  it("keeps contracts locked until the simulated admin review, like the real rule", () => {
    expect(visibleDemoStage("contracts", false)).toBe("result");
    expect(visibleDemoStage("contracts", true)).toBe("contracts");
    expect(visibleDemoStage("result", true)).toBe("result");
  });

  it("opens the portal preview only after the simulated completion", () => {
    expect(visibleDemoStage("portal", false, true)).toBe("result");
    expect(visibleDemoStage("portal", true, false)).toBe("contracts");
    expect(visibleDemoStage("portal", true, true)).toBe("portal");
  });

  it("the simulated review releases all 10 forms but signs none", () => {
    const released = demoReleasedContracts();
    expect(released).toHaveLength(10);
    expect(released.every((c) => c.released && !c.completed && !c.signedPdfRef)).toBe(true);
    expect(released.every((c) => Object.keys(c.signedBy).length === 0)).toBe(true);
  });
});

describe("contract registry", () => {
  it("has exactly the 10 reference tabs, in order", () => {
    expect(CONTRACT_TEMPLATES.map((c) => `${c.number}. ${c.tabLabel}`)).toEqual([
      "1. Bill of Sale",
      "2. Retail Installment",
      "3. Credit Application",
      "4. GPS Disclosure",
      "5. Delivery Checklist",
      "6. Insurance Agreement",
      "7. Abuse Notice",
      "8. Recourse Agreement",
      "9. Repossession",
      "10. ACH & Card Authorization",
    ]);
  });

  it("has no approved template yet, so nothing real can be shown or released", () => {
    expect(CONTRACT_TEMPLATES.every((c) => c.source === null && c.version === null)).toBe(true);
    expect(
      initialDealContracts().every((c) => c.status === "missing_template" && !c.released),
    ).toBe(true);
  });
});

describe("demo PDFs", () => {
  const deal = demoDeal({ vehicleValueCents: 1_000_000, packageDownCents: 200_000 });
  const billOfSale = buildDemoPdfPages(billOfSaleDemoPages(deal));

  it("are structurally valid PDFs with correct cross-reference offsets", () => {
    for (const pdf of [billOfSale, buildDemoPdf(demoContractLines(CONTRACT_TEMPLATES[1]!))]) {
      expect(pdf.startsWith("%PDF-1.4")).toBe(true);
      expect(pdf.trimEnd().endsWith("%%EOF")).toBe(true);
      const xrefAt = Number(/startxref\n(\d+)/.exec(pdf)![1]);
      expect(pdf.slice(xrefAt, xrefAt + 4)).toBe("xref");
      const offsets = [...pdf.matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
      offsets.forEach((offset, i) =>
        expect(pdf.slice(offset).startsWith(`${i + 1} 0 obj`)).toBe(true),
      );
    }
  });

  it("Bill of Sale preview has 3 watermarked pages, all 31 lines and no copied legal text or reference data", () => {
    expect(billOfSale.match(/\/Type \/Page /g)).toHaveLength(3);
    expect(billOfSale.split(DEMO_WATERMARK).length - 1).toBeGreaterThanOrEqual(6);
    for (const n of [1, 15, 23, 24, 31]) expect(billOfSale).toContain(`(${n}. `);
    expect(billOfSale).toContain("Page 3 of 3");
    expect(billOfSale).toContain("Approved legal text required");
    expect(billOfSale).not.toMatch(
      /Gaspar|Sprenkle|2GKALSEK|Westlake|progressive|964153852|598\.41|Tahid/i,
    );
    expect(billOfSale).not.toMatch(
      /We make no express or implied warranties|Under Virginia law, a dealer/,
    );
  });

  it("every placeholder form is watermarked", () => {
    for (const doc of CONTRACT_TEMPLATES)
      expect(buildDemoPdf(demoContractLines(doc))).toContain(DEMO_WATERMARK);
  });
});

describe("demo isolation", () => {
  it("demo files never import server functions, analytics, CRM or uploads", () => {
    for (const file of [
      "src/lib/lease-to-own-demo.ts",
      "src/lib/demo-contract-pdf.ts",
      "src/lib/deal-model.ts",
      "src/lib/bill-of-sale.ts",
      "src/lib/contract-signatures.ts",
      "src/lib/demo-signatures.ts",
      "src/components/lease-to-own/SignaturePad.tsx",
      "src/components/lease-to-own/DigitalSignaturePanel.tsx",
      "src/components/lease-to-own/ContractSignatureBlocks.tsx",
      "src/components/lease-to-own/BillOfSaleEditor.tsx",
      "src/components/lease-to-own/LeaseDemoWorkflow.tsx",
      "src/components/lease-to-own/ContractSuite.tsx",
      "src/components/lease-to-own/ContractDocumentViewer.tsx",
    ]) {
      const imports = readFileSync(file, "utf8")
        .split("\n")
        .filter((line) => /^\s*import\b|from\s+"/.test(line))
        .join("\n");
      expect(imports).not.toMatch(
        /functions|\.server|analytics|ghl|supabase|lease-to-own-client|attribution/,
      );
    }
  });
});
