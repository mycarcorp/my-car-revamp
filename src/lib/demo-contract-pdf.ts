// DEVELOPMENT DEMO ONLY. Imported only by the local demo workflow, so production
// builds never include it. Builds small sample PDFs in the browser, watermarked
// "DEMO - NOT A LEGAL CONTRACT", with fictional data only. No legal terms are
// generated: sections that need approved legal text say so instead.
import {
  BILL_OF_SALE_LAYOUT,
  BILL_OF_SALE_SECTION_TITLES,
  computeBillOfSale,
} from "./bill-of-sale";
import {
  formatSignatureDate,
  signatureSlotsFor,
  signerIdentity,
  SIGNER_ROLE_LABELS,
  type ContractSignatureSlot,
} from "./contract-signatures";
import { fullName, text, type Deal } from "./deal-model";
import { demoSignatureFor, type DemoSignature, type DemoSignatures } from "./demo-signatures";
import type { ContractTemplate } from "./lease-contracts";
import { formatCents } from "./money";

export const DEMO_WATERMARK = "DEMO - NOT A LEGAL CONTRACT";
export const DEMO_SIGNATURE_TAG = "DEMO SIGNATURE - NOT VALID";

/** Fictional deal reference used by the demo screens. */
export const DEMO_DEAL = { reference: "DEMO-3244" } as const;

export type PdfLine = {
  text: string;
  size?: number;
  bold?: boolean;
  /** Script face for demo script signatures. */
  script?: boolean;
  white?: boolean;
  x?: number;
  /** Absolute baseline (points from the bottom). Otherwise placed below the previous line. */
  y?: number;
  gap?: number;
};

/** Rectangle (outline, or filled black for section bars) or free strokes, in page points. */
export type PdfShape =
  | { rect: [number, number, number, number]; fill?: boolean }
  | { strokes: Array<Array<[number, number]>>; lineWidth?: number };

export type PdfItem = PdfLine | PdfShape;

/** PDF string literal: ASCII only, with (, ) and \ escaped. */
function pdfText(value: string): string {
  return value
    .replace(/[^\x20-\x7e]/g, "-")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

const n2 = (n: number) => Number(n.toFixed(2));

function pageStream(items: PdfItem[]): string {
  let y = 760;
  const body: string[] = [
    // Watermark first, so the content prints over it.
    "q 0.96 0.82 0.94 rg BT /F2 40 Tf 0.7071 0.7071 -0.7071 0.7071 150 180 Tm",
    `(${pdfText(DEMO_WATERMARK)}) Tj ET Q`,
  ];
  for (const item of items) {
    if ("rect" in item) {
      const [x, ry, w, h] = item.rect;
      body.push(
        item.fill ? `q 0 g ${x} ${ry} ${w} ${h} re f Q` : `q 0.6 w ${x} ${ry} ${w} ${h} re S Q`,
      );
      continue;
    }
    if ("strokes" in item) {
      const paths = item.strokes
        .filter((s) => s.length > 1)
        .map(
          (s) => s.map(([px, py], i) => `${n2(px)} ${n2(py)} ${i ? "l" : "m"}`).join(" ") + " S",
        );
      if (paths.length)
        body.push(`q 0.06 0.22 0.36 RG ${item.lineWidth ?? 1} w 1 J 1 j ${paths.join(" ")} Q`);
      continue;
    }
    const size = item.size ?? 9;
    y = item.y ?? y - (item.gap ?? size + 4);
    const font = item.script ? "F3" : item.bold ? "F2" : "F1";
    const color = item.white ? "1 g " : item.script ? "0.06 0.22 0.36 rg " : "";
    body.push(
      `q ${color}BT /${font} ${size} Tf ${item.x ?? 40} ${y} Td (${pdfText(item.text)}) Tj ET Q`,
    );
  }
  return body.join("\n");
}

/** Letter-size PDF, one page per entry. */
export function buildDemoPdfPages(pages: PdfItem[][]): string {
  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "", // page tree, filled below
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Times-BoldItalic >>",
  ];
  const kids: number[] = [];
  for (const items of pages) {
    const stream = pageStream(items);
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    const contentId = objects.length;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${contentId} 0 R >>`,
    );
    kids.push(objects.length);
  }
  objects[1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(" ")}] /Count ${kids.length} >>`;
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return pdf;
}

export function buildDemoPdf(items: PdfItem[]): string {
  return buildDemoPdfPages([items]);
}

// ------------------------------------------------------------
// Signature blocks
// ------------------------------------------------------------

/** Most points drawn into one signature, to keep the preview PDF small. */
const MAX_SIGNATURE_POINTS = 1500;

/** Fit a drawn or script demo signature inside the box (x, y, w, h). */
function signatureMark(sig: DemoSignature, x: number, y: number, w: number, h: number): PdfItem[] {
  const capture = sig.capture;
  if (capture.kind === "script") {
    // Centered, shrunk to fit; Times Bold Italic averages about half an em per character.
    const size = Math.min(h * 0.6, 15, (w - 12) / (capture.name.length * 0.5));
    const width = capture.name.length * size * 0.5;
    return [
      {
        text: capture.name,
        script: true,
        size,
        x: x + Math.max(4, (w - width) / 2),
        y: y + (h - size) / 2 + 1,
      },
    ];
  }
  const total = capture.strokes.reduce((n, s) => n + s.length, 0);
  const step = Math.max(1, Math.ceil(total / MAX_SIGNATURE_POINTS));
  const scale = Math.min(w / capture.width, h / capture.height);
  const ox = x + (w - capture.width * scale) / 2;
  const oy = y + (h - capture.height * scale) / 2;
  const strokes = capture.strokes.map((stroke) =>
    stroke
      .filter((_, i) => i % step === 0 || i === stroke.length - 1)
      .map(([px, py]): [number, number] => [ox + px * scale, oy + (capture.height - py) * scale]),
  );
  return [{ strokes, lineWidth: 0.9 }];
}

/**
 * One labeled signature location: "X", the box, the printed name, the date and
 * the status. Shows only the matching signer's own demo signature.
 */
function signatureBlock(
  slot: ContractSignatureSlot,
  deal: Deal,
  signatures: DemoSignatures,
  x: number,
  y: number,
  w: number,
  h: number,
): PdfItem[] {
  const label = SIGNER_ROLE_LABELS[slot.role];
  const name = signerIdentity(deal, slot.role).printedName;
  const sig = demoSignatureFor(slot, signatures);
  // Like the reference: [signature box] [date] / [printed name] [role] / status.
  const items: PdfItem[] = [
    { text: "X", bold: true, size: 9, x: x - 9, y: y + 1 },
    { rect: [x, y, w, h] },
    { text: name ?? `[${label} name missing]`, size: 8, x, y: y - 9 },
    { text: label, size: 7, x: x + w - label.length * 3.4, y: y - 9 },
    {
      text: sig ? formatSignatureDate(sig.adoptedAt) : "__________",
      size: 9,
      x: x + w + 8,
      y: y + 3,
    },
    { text: "Date", size: 6, x: x + w + 8, y: y - 9 },
    {
      text: sig ? "Status: demo signature - NOT legally signed" : "Status: awaiting signature",
      size: 5.5,
      x,
      y: y - 17,
    },
  ];
  if (sig) {
    const at = new Date(sig.adoptedAt);
    const time = `${at.getHours() % 12 || 12}:${String(at.getMinutes()).padStart(2, "0")} ${at.getHours() < 12 ? "AM" : "PM"}`;
    items.push(
      { text: DEMO_SIGNATURE_TAG, bold: true, size: 4.5, x: x + 2, y: y + h - 5.5 },
      ...signatureMark(sig, x + 2, y + 3, w - 4, h - 9),
      {
        text: `DEMO ${formatSignatureDate(at)} ${time}`,
        size: 4,
        x: x + w - 62,
        y: y + 2,
      },
    );
  }
  return items;
}

/** Generic placeholder page for Forms 2–10 (no approved template yet). */
export function demoContractLines(
  doc: ContractTemplate,
  signing?: { deal: Deal; signatures: DemoSignatures },
): PdfItem[] {
  const head: PdfItem[] = [
    { text: DEMO_WATERMARK, bold: true, size: 9 },
    { text: `${doc.number}. ${doc.title.toUpperCase()}`, bold: true, size: 16, gap: 28 },
    {
      text: `Demo deal ${DEMO_DEAL.reference}  |  Template ${doc.templateId}  |  Approved version: not supplied`,
    },
    { text: "DOCUMENT BODY", bold: true, gap: 30 },
    { text: "Placeholder. The approved template for this form has not been supplied yet." },
  ];
  if (!signing)
    return [
      ...head,
      { text: "Buyer signature: ______________________   (signing disabled in demo)", gap: 36 },
      { text: "Co-Buyer signature: ___________________   (signing disabled in demo)", gap: 22 },
    ];
  const slots = signatureSlotsFor(doc.id, signing.deal);
  return [
    ...head,
    {
      text: "SIGNATURES (placeholder locations until the approved template is supplied)",
      bold: true,
      size: 8,
      x: 40,
      y: 560,
    },
    ...slots.flatMap((slot, i) =>
      signatureBlock(slot, signing.deal, signing.signatures, 60, 510 - i * 60, 200, 30),
    ),
  ];
}

// ------------------------------------------------------------
// Form 1 — Bill of Sale / Buyer's Order: 3-page structural preview
// ------------------------------------------------------------

const v = (deal: Deal, key: string) => text(deal, key) || "-";
const money = (c: number | null) => (c === null ? "N/A" : formatCents(c));

function footer(page: number): PdfLine[] {
  return [
    {
      text: "Bill of Sale / Buyer's Order - structural preview. Approved PDF template required.",
      size: 7,
      y: 40,
    },
    { text: `Page ${page} of 3`, size: 8, x: 520, y: 40 },
  ];
}

/** Black section bar with white heading, as on the reference. */
const bar = (title: string, x: number, y: number, w: number): PdfItem[] => [
  { rect: [x, y - 3, w, 12], fill: true },
  { text: title, bold: true, white: true, size: 8, x: x + 3, y },
];

/** Outlined area where the approved template's legal text goes. */
const legalBox = (title: string, x: number, top: number, w: number, h: number): PdfItem[] => [
  { text: title, bold: true, size: 7, x, y: top },
  { rect: [x, top - 4 - h, w, h] },
  { text: "[Approved legal text required]", size: 6, x: x + 4, y: top - 14 },
];

export function billOfSaleDemoPages(deal: Deal, signatures: DemoSignatures = {}): PdfItem[][] {
  const { lines, negativeEquityCents } = computeBillOfSale(deal);
  const slots = new Map(signatureSlotsFor("bill_of_sale", deal).map((s) => [s.id, s]));
  const block = (id: string, x: number, y: number, w: number, h: number) => {
    const slot = slots.get(id);
    return slot ? signatureBlock(slot, deal, signatures, x, y, w, h) : [];
  };
  const L = 40;
  const R = 320;
  const leftCol = (rows: Array<[string, string]>, startY: number): PdfLine[] =>
    rows.map(([label, value], i) => ({ text: `${label}: ${value}`, x: L, y: startY - i * 12 }));

  const page1: PdfItem[] = [
    { text: DEMO_WATERMARK, bold: true, size: 8, x: L, y: 772 },
    { text: "BILL OF SALE / BUYER'S ORDER", bold: true, size: 14, x: 200, y: 752 },
    { text: "Dealer/Seller Name and Address", bold: true, x: L, y: 728 },
    { text: v(deal, "dealer.legalName"), x: L, y: 716 },
    {
      text: `${v(deal, "dealer.street")}, ${v(deal, "dealer.city")}, ${v(deal, "dealer.state")} ${text(deal, "dealer.zip")}`,
      x: L,
      y: 704,
    },
    { text: v(deal, "dealer.phone"), x: L, y: 692 },
    { text: "Buyer/Co-Buyer Name(s) and Address(es)", bold: true, x: R, y: 728 },
    { text: `${fullName(deal, "buyer") || "-"}  ${text(deal, "buyer.phone")}`, x: R, y: 716 },
    {
      text: `${v(deal, "buyer.street")}, ${v(deal, "buyer.city")}, ${v(deal, "buyer.state")} ${text(deal, "buyer.zip")}`,
      x: R,
      y: 704,
    },
    ...(deal.coBuyerIncluded
      ? [
          {
            text: `${fullName(deal, "coBuyer") || "-"}  ${text(deal, "coBuyer.phone")}`,
            x: R,
            y: 692,
          },
          {
            text: `${v(deal, "coBuyer.street")}, ${v(deal, "coBuyer.city")}, ${v(deal, "coBuyer.state")} ${text(deal, "coBuyer.zip")}`,
            x: R,
            y: 680,
          },
        ]
      : []),
    {
      text: `Date ${v(deal, "deal.date")}    Stock No. ${v(deal, "deal.stockNumber")}    Salesperson ${v(deal, "dealer.salesperson")}`,
      x: L,
      y: 664,
    },
    {
      text: `App No. ${v(deal, "deal.appNumber")}    Contract No. ${v(deal, "deal.contractNumber")}`,
      x: L,
      y: 652,
    },
    { text: "Vehicle Information", bold: true, x: L, y: 632 },
    ...leftCol(
      [
        ["Condition", v(deal, "vehicle.condition")],
        ["Year", v(deal, "vehicle.year")],
        ["Make", v(deal, "vehicle.make")],
        ["Model", v(deal, "vehicle.model")],
        ["Body Style", v(deal, "vehicle.bodyStyle")],
        ["VIN", v(deal, "vehicle.vin")],
        ["Lic. No.", v(deal, "vehicle.licenseNumber")],
        ["Odometer Reading", v(deal, "vehicle.odometer")],
        ["Color", v(deal, "vehicle.color")],
      ],
      620,
    ),
    { text: "Insurance Information", bold: true, x: L, y: 500 },
    ...leftCol(
      [
        ["Insurance Company", v(deal, "insurance.company")],
        ["Policy No.", v(deal, "insurance.policyNumber")],
        ["Status", v(deal, "insurance.status")],
      ],
      488,
    ),
    { text: "[Approved insurance disclosure text required]", size: 7, x: L, y: 452 },
    { text: "Trade-In Information", bold: true, x: L, y: 432 },
    ...[1, 2].flatMap((n, i) =>
      leftCol(
        [
          [
            `Trade-in ${n}`,
            `${text(deal, `tradeIn${n}.year`)} ${text(deal, `tradeIn${n}.make`)} ${text(deal, `tradeIn${n}.model`)}`.trim() ||
              "-",
          ],
          ["VIN", v(deal, `tradeIn${n}.vin`)],
          ["Odometer", v(deal, `tradeIn${n}.odometer`)],
          ["Lienholder", v(deal, `tradeIn${n}.lienholderName`)],
          ["Payoff good through", v(deal, `tradeIn${n}.payoffGoodThrough`)],
        ],
        420 - i * 72,
      ),
    ),
    { text: "Itemization of Sale", bold: true, x: R, y: 632 },
  ];
  let y = 620;
  let section: string | null = null;
  for (const line of lines) {
    const title = BILL_OF_SALE_SECTION_TITLES[line.section];
    if (title && title !== section) {
      page1.push({ text: title, bold: true, size: 8, x: R, y });
      y -= 11;
    }
    section = title;
    const label = `${line.number}. ${line.label}${line.formula ? ` (${line.formula})` : ""}`;
    page1.push({ text: label, size: 8, bold: line.kind === "calc", x: R, y });
    page1.push({ text: `$ ${money(line.cents)}`, size: 8, bold: line.kind === "calc", x: 505, y });
    y -= 11;
  }
  page1.push(
    {
      text: `[ ${text(deal, "asIs") === "true" ? "X" : " "} ] "AS IS" acknowledgment - approved text required`,
      size: 8,
      x: R,
      y: y - 6,
    },
    ...block("p1-buyer", R + 10, y - 48, 110, 24),
    ...block("p1-cobuyer", R + 150, y - 48, 110, 24),
    ...footer(1),
  );

  const page2: PdfItem[] = [
    { text: DEMO_WATERMARK, bold: true, size: 8, x: L, y: 772 },
    { text: "Additional Terms (section map)", bold: true, size: 13, x: L, y: 748 },
  ];
  let left = 720;
  let right = 720;
  for (const s of BILL_OF_SALE_LAYOUT.find((p) => p.page === 2)!.sections) {
    const x = s.column === "right" ? R : L;
    const yy = s.column === "right" ? right : left;
    page2.push(
      { text: s.title, bold: true, size: 8, x, y: yy },
      { text: "[Approved legal text required]", size: 7, x, y: yy - 12 },
    );
    if (s.column === "right") right -= 44;
    else left -= 44;
  }
  page2.push(...footer(2));

  // Page 3 follows the reference: Warranty Information and Notices on the left;
  // the financing notice continues at the top right, then Signatures.
  const LW = 262;
  const R3 = 316;
  const RW = 256;
  const negEquity = negativeEquityCents === null ? "N/A" : formatCents(negativeEquityCents);
  const page3: PdfItem[] = [
    { text: DEMO_WATERMARK, bold: true, size: 8, x: L, y: 772 },
    { text: "Bill of Sale / Buyer's Order - page 3", bold: true, size: 10, x: L, y: 752 },
    ...bar("Warranty Information", L, 728, LW),
    ...legalBox("Warranty", L, 712, LW, 54),
    ...legalBox("Used Car Buyer Notice", L, 648, LW, 32),
    ...legalBox("Used Car Buyer Notice (Spanish)", L, 606, LW, 32),
    ...legalBox("Additional Virginia Notice", L, 564, LW, 96),
    ...bar("Notices", L, 446, LW),
    {
      text: `[ ${negativeEquityCents ? "X" : " "} ] Negative equity notice   Amount: $ ${negEquity}`,
      size: 7,
      x: L,
      y: 430,
    },
    ...legalBox("", L, 424, LW, 24),
    { text: "[   ] Demonstrator mileage notice", size: 7, x: L, y: 386 },
    ...legalBox("", L, 380, LW, 26),
    {
      text: "[   ] Financing notice (retail installment sales contract)",
      bold: true,
      size: 7,
      x: L,
      y: 340,
    },
    ...legalBox("", L, 334, LW, 150),
    { text: "(continued at top right)", size: 6, x: L + LW - 70, y: 170 },

    ...legalBox("Financing notice (continued)", R3, 728, RW, 130),
    ...bar("Signatures", R3, 576, RW),
    ...legalBox("Dealer acceptance statement", R3, 560, RW, 22),
    ...legalBox("Signer acknowledgment", R3, 524, RW, 22),
    {
      text: "[   ] Separate arbitration agreement (approved wording required)",
      size: 7,
      x: R3,
      y: 484,
    },
    ...block("p3-buyer", R3 + 12, 436, 168, 30),
    ...block("p3-cobuyer", R3 + 12, 376, 168, 30),
    ...block("p3-dealer", R3 + 12, 316, 168, 30),
    {
      text: signerIdentity(deal, "dealer").organization ?? "[Dealer legal name missing]",
      size: 8,
      x: R3 + 12,
      y: 280,
    },
    { text: v(deal, "dealer.street"), size: 8, x: R3 + 12, y: 270 },
    {
      text: `${v(deal, "dealer.city")}, ${v(deal, "dealer.state")} ${text(deal, "dealer.zip")}`,
      size: 8,
      x: R3 + 12,
      y: 260,
    },
    {
      text: `Authorized representative: ${signerIdentity(deal, "dealer").printedName ?? "[missing]"}`,
      size: 7,
      x: R3 + 12,
      y: 248,
    },
    ...footer(3),
  ];

  return [page1, page2, page3];
}
