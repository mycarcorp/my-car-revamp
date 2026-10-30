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
import {
  applicableStateNotices,
  dealerUseFinancials,
  dealerUseTradeIn,
  initialsOf,
  jointCreditRequested,
  wisconsinApplies,
} from "./credit-application";
import { fullName, text, type Deal } from "./deal-model";
import {
  demoSignatureFor,
  initialKey,
  type DemoInitials,
  type DemoSignature,
  type DemoSignatures,
} from "./demo-signatures";
import { itemApplies } from "./acknowledgments";
import { DELIVERY_INITIAL_ROLES, DELIVERY_STATEMENTS, purchaserNames } from "./delivery-checklist";
import { GPS_PROVISION_INITIAL_ROLES, GPS_PROVISIONS, gpsCreditorName } from "./gps-disclosure";
import type { ContractTemplate } from "./lease-contracts";
import { formatCents } from "./money";
import {
  computeDisclosures,
  computeItemization,
  formatAmount,
  formatFormDate,
  RIC_ITEM_ROWS,
} from "./retail-installment";

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
      ...signatureMark(
        slot.mark === "initials" && sig.capture.kind === "script"
          ? { ...sig, capture: { kind: "script", name: initialsOf(sig.capture.name) } }
          : sig,
        x + 2,
        y + 3,
        w - 4,
        h - 9,
      ),
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
/** "X" when a checkbox field is ticked, otherwise a space. */
const box = (deal: Deal, key: string) => (deal.fields[key]?.value === true ? "X" : " ");
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
    {
      text: `[ ${box(deal, "notice.demonstrator")} ] Demonstrator mileage notice`,
      size: 7,
      x: L,
      y: 386,
    },
    ...legalBox("", L, 380, LW, 26),
    {
      text: `[ ${box(deal, "notice.financing")} ] Financing notice (retail installment sales contract)`,
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
      text: `[ ${box(deal, "notice.arbitration")} ] Separate arbitration agreement (approved wording required)`,
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

// ------------------------------------------------------------
// Form 2 — Retail Installment Contract: 5-page structural preview
// ------------------------------------------------------------

/** Top-down text flow inside one column of a page. */
function column(x: number, width: number, top = 732) {
  const items: PdfItem[] = [];
  let y = top;
  return {
    items,
    get y() {
      return y;
    },
    line(value: string, opts: { bold?: boolean; size?: number; indent?: number } = {}) {
      const size = opts.size ?? 7;
      items.push({ text: value, bold: opts.bold, size, x: x + (opts.indent ?? 0), y });
      y -= size + 4;
    },
    bar(title: string) {
      items.push(...bar(title, x, y, width));
      y -= 16;
    },
    legal(title: string) {
      items.push(...legalBox(title, x, y, width, 14));
      y -= 30;
    },
    sig(block: PdfItem[]) {
      items.push(...block);
      y -= 52;
    },
  };
}

const RIC_PAGES = 5;
const ricFooter = (page: number): PdfLine[] => [
  {
    text: "Retail Installment Contract - structural preview. Approved PDF template required.",
    size: 7,
    y: 40,
  },
  { text: `Page ${page} of ${RIC_PAGES}`, size: 8, x: 520, y: 40 },
];
const yes = (deal: Deal, key: string) => `[ ${box(deal, key)} ]`;
/** Formatted cents of a money field, or "-". */
const amt = (deal: Deal, key: string) => {
  const value = deal.fields[key]?.value;
  return typeof value === "number"
    ? formatCents(value)
    : typeof value === "string" && value
      ? value
      : "-";
};

export function retailInstallmentDemoPages(
  deal: Deal,
  signatures: DemoSignatures = {},
): PdfItem[][] {
  const items = computeItemization(deal);
  const tila = computeDisclosures(deal);
  const slots = new Map(signatureSlotsFor("retail_installment", deal).map((s) => [s.id, s]));
  const sig = (id: string, x: number, y: number) => {
    const slot = slots.get(id);
    return slot ? signatureBlock(slot, deal, signatures, x + 10, y, 150, 26) : [];
  };
  const pending = tila.status === "pending";
  const tilaValue = (c: number | null) =>
    c === null || pending ? "Pending" : `$ ${formatCents(c)}`;
  const head = (title: string): PdfItem[] => [
    { text: DEMO_WATERMARK, bold: true, size: 8, x: 40, y: 772 },
    { text: title, bold: true, size: 11, x: 40, y: 756 },
  ];
  const address = (prefix: string) =>
    `${v(deal, `${prefix}.street`)}, ${v(deal, `${prefix}.city`)}, ${v(deal, `${prefix}.state`)} ${text(deal, `${prefix}.zip`)}`;

  // Page 1
  const p1 = column(40, 532);
  p1.line("Seller Name and Address", { bold: true });
  p1.line(`${v(deal, "dealer.legalName")}, ${address("dealer")}`);
  p1.line("Buyer(s) Name(s) and Address(es)", { bold: true });
  p1.line(`${fullName(deal, "buyer") || "-"}, ${address("buyer")}`);
  if (deal.coBuyerIncluded) p1.line(`${fullName(deal, "coBuyer") || "-"}, ${address("coBuyer")}`);
  p1.line(
    `No. ${text(deal, "deal.contractNumber") || "[issued by server]"}    Date ${text(deal, "deal.date") ? formatFormDate(text(deal, "deal.date")) : "-"}`,
  );
  p1.line(
    `${yes(deal, "ric.businessPurpose")} Business, commercial or agricultural purpose Contract`,
  );
  p1.bar("Truth-In-Lending Disclosure");
  p1.line(
    `Annual Percentage Rate: ${tila.aprPercent === null || pending ? "Pending" : `${tila.aprPercent.toFixed(2)} %`}    Finance Charge: ${tilaValue(tila.financeChargeCents)}`,
  );
  p1.line(
    `Amount Financed: ${tilaValue(tila.amountFinancedCents)}    Total of Payments: ${tilaValue(tila.totalOfPaymentsCents)}    Total Sale Price: ${tilaValue(tila.totalSalePriceCents)}`,
  );
  p1.line(
    pending
      ? "Pending approved financing terms."
      : tila.status === "draft"
        ? "Draft calculation - terms not approved."
        : "Calculated from staff-approved terms.",
    { size: 6 },
  );
  p1.line("Payment Schedule (No. of Payments / Amount / When Due)", { bold: true });
  if (tila.schedule.length)
    for (const r of tila.schedule)
      p1.line(
        `${r.count}   $ ${formatCents(r.amountCents)}   ${r.whenDue}${r.kind === "deferred_down" ? " (deferred down payment)" : ""}`,
        { indent: 8 },
      );
  else p1.line("Pending approved financing terms", { indent: 8 });
  p1.legal("Security");
  p1.line(
    `${yes(deal, "ric.lateCharge")} Late Charge: more than ${text(deal, "ric.lateChargeDays") || "__"} days late: ${text(deal, "ric.lateChargeTerms") || "__"}`,
  );
  p1.legal("Prepayment / Contract Provisions");
  p1.bar("Description of Property");
  p1.line(
    `${v(deal, "vehicle.year")} ${v(deal, "vehicle.make")} ${v(deal, "vehicle.model")} ${v(deal, "vehicle.bodyStyle")}   VIN ${v(deal, "vehicle.vin")}   Odometer ${v(deal, "vehicle.odometer")}   ${v(deal, "vehicle.condition")}`,
  );
  p1.bar("Description of Trade-In");
  p1.line(
    `${text(deal, "tradeIn1.year")} ${text(deal, "tradeIn1.make")} ${text(deal, "tradeIn1.model")}`.trim() ||
      "N/A",
  );
  p1.line(`${yes(deal, "ric.noLiabilityInsurance")} No Liability Insurance Included.`, {
    bold: true,
  });
  p1.line(
    `${yes(deal, "ric.conditionalDelivery")} Conditional Delivery: ${text(deal, "ric.conditionalDeliveryAgreement") || "-"}`,
  );
  p1.bar("Sales Agreement");
  p1.line(
    `Payment: principal ${formatAmount(items.aa.amount) || "Pending"} at ${text(deal, "ric.contractRate") || "__"} % per year; after maturity ${text(deal, "ric.postMaturityRate") || "__"} %`,
  );

  // Page 2
  const p2l = column(40, 262);
  p2l.legal("Down Payment");
  p2l.line(
    `${yes(deal, "ric.addlCharge")} Additional Charge: ${text(deal, "ric.addlChargeDescription") || "-"} $ ${amt(deal, "ric.addlChargeAmount")} (${text(deal, "ric.addlChargePayment") || "-"})`,
  );
  p2l.bar("Itemization of Amount Financed");
  for (const row of RIC_ITEM_ROWS) {
    const value = formatAmount(items[row.letter].amount) || (row.kind === "calc" ? "Pending" : "?");
    const detail = row.detailKey ? text(deal, row.detailKey) : "";
    p2l.line(`${row.letter}. ${row.label}${detail ? `: ${detail}` : ""}`.slice(0, 54), {
      bold: row.bold,
    });
    p2l.items.push({ text: value, size: 7, bold: row.bold, x: 250, y: p2l.y + 11 });
  }
  const p2r = column(316, 256);
  p2r.bar("Insurance Disclosures");
  p2r.legal("Credit Insurance");
  for (const [k, label] of [
    ["creditLife", "Credit Life"],
    ["creditDisability", "Credit Disability"],
  ] as const)
    p2r.line(
      `${label}: ${text(deal, `ric.${k}.coverage`) || "not selected"}  Premium $ ${amt(deal, `ric.${k}.premium`)}  Term ${v(deal, `ric.${k}.term`)}`,
    );
  if (slots.has("ric-p2-ins-buyer")) {
    p2r.sig(sig("ric-p2-ins-buyer", 316, p2r.y - 30));
    p2r.sig(sig("ric-p2-ins-cobuyer", 316, p2r.y - 30));
  } else p2r.line("By / DOB: applies only when credit insurance is elected.");
  p2r.legal("Property Insurance");
  p2r.line(`Max collision deductible $ ${amt(deal, "ric.propIns.maxDeductible")}`);
  for (const [k, label] of [
    ["collision", "Collision"],
    ["comprehensive", "Comprehensive"],
    ["fireTheft", "Fire-Theft"],
    ["other", "Other"],
  ] as const)
    p2r.line(
      `${yes(deal, `ric.propIns.${k}`)} ${label}  premium ${amt(deal, `ric.propIns.${k}Premium`)}`,
    );
  p2r.line(
    `${yes(deal, "ric.singleInterest")} Single-Interest Insurance  ${v(deal, "ric.singleInterest.provider")}`,
  );

  // Page 3
  const p3l = column(40, 262);
  p3l.bar("Additional Protections");
  for (const [k, label] of [
    ["svc", "Service Contract"],
    ["gap", "Gap Waiver or Gap Insurance"],
    ["otherProtection", "Other protection"],
  ] as const) {
    p3l.line(`${yes(deal, `ric.${k}.selected`)} ${label}`, { bold: true });
    p3l.line(
      `Term ${v(deal, `ric.${k}.term`)}   Price $ ${amt(deal, `ric.${k}.price`)}   Coverage ${v(deal, `ric.${k}.coverage`)}`,
      { indent: 8 },
    );
  }
  if (slots.has("ric-p3-prot-buyer")) {
    p3l.sig(sig("ric-p3-prot-buyer", 40, p3l.y - 30));
    p3l.sig(sig("ric-p3-prot-cobuyer", 40, p3l.y - 30));
  } else p3l.line("By / Date: applies only when a protection is selected.");
  p3l.bar("Additional Terms of the Sales Agreement");
  for (const t of ["Definitions", "Purchase of Property", "General Terms"]) p3l.legal(t);
  const p3r = column(316, 256);
  for (const t of [
    "Third-party payments / Use of Property",
    "Prepayment",
    "Balloon Payment",
    "Governing Law and Interpretation",
    "Name and Location",
    "Telephone Monitoring and Calling",
    "Default",
    "Remedies",
    "Notice of intended sale or transfer",
  ])
    p3r.legal(t);

  // Page 4
  const p4l = column(40, 262);
  for (const t of [
    "Personal property",
    "Electronic tracking device",
    "Waiver of Homestead Exemption",
    "Obligations Independent",
    "Warranty",
  ])
    p4l.legal(t);
  p4l.bar("Security Agreement");
  for (const t of [
    "Security",
    "Duties Toward Property",
    "Agreement to Provide Insurance",
    "Gap Waiver or Gap Insurance",
  ])
    p4l.legal(t);
  const p4r = column(316, 256);
  p4r.bar("Notices");
  for (const t of [
    "Consumer credit holder notice",
    "Used vehicle window form notice",
    "Spanish-language notice",
  ])
    p4r.legal(t);
  p4r.bar("Third Party Agreement");
  p4r.legal("Third Party Owner (NOT the Buyer)");
  if (slots.has("ric-p4-third-party")) p4r.sig(sig("ric-p4-third-party", 316, p4r.y - 30));
  else p4r.line("No Third Party Owner on this deal - N/A");

  // Page 5
  const p5l = column(40, 262);
  p5l.line(`${yes(deal, "ric.esignAck")} Electronic Signature Acknowledgment`, { bold: true });
  p5l.legal("Electronic Signature Acknowledgment");
  p5l.bar("Signature Notices");
  p5l.legal("APR negotiability / assignment notice");
  p5l.bar("Signatures");
  p5l.legal("Entire Agreement");
  p5l.sig(sig("ric-p5-agree-buyer", 40, p5l.y - 30));
  if (slots.has("ric-p5-agree-cobuyer")) p5l.sig(sig("ric-p5-agree-cobuyer", 40, p5l.y - 30));
  const p5r = column(316, 256);
  p5r.legal("Notice to Buyer");
  p5r.line("Buyer", { bold: true });
  p5r.sig(sig("ric-p5-buyer", 316, p5r.y - 30));
  if (slots.has("ric-p5-cobuyer")) p5r.sig(sig("ric-p5-cobuyer", 316, p5r.y - 30));
  p5r.line(`Seller ${v(deal, "dealer.legalName")}`, { bold: true });
  p5r.sig(sig("ric-p5-seller", 316, p5r.y - 30));
  p5r.bar("Assignment");
  p5r.line(
    `Assigned to ${v(deal, "ric.assign.assigneeName")}, ${v(deal, "ric.assign.assigneeAddress")}`,
  );
  p5r.line(
    `Assignee phone ${v(deal, "ric.assign.assigneePhone")}   ${yes(deal, "ric.assign.recourse")} With recourse`,
  );
  if (slots.has("ric-p5-assign-seller")) p5r.sig(sig("ric-p5-assign-seller", 316, p5r.y - 30));

  return [
    [...head("RETAIL INSTALLMENT CONTRACT AND SECURITY AGREEMENT"), ...p1.items, ...ricFooter(1)],
    [
      ...head("Itemization of Amount Financed & Insurance Disclosures"),
      ...p2l.items,
      ...p2r.items,
      ...ricFooter(2),
    ],
    [
      ...head("Additional Protections & Contract Terms"),
      ...p3l.items,
      ...p3r.items,
      ...ricFooter(3),
    ],
    [
      ...head("Security Agreement, Notices & Third Party Owner"),
      ...p4l.items,
      ...p4r.items,
      ...ricFooter(4),
    ],
    [
      ...head("E-Signature Acknowledgment, Signatures & Assignment"),
      ...p5l.items,
      ...p5r.items,
      ...ricFooter(5),
    ],
  ];
}

// ------------------------------------------------------------
// Form 3 — Credit Application: 3-page structural preview
// ------------------------------------------------------------

const caFooter = (page: number): PdfLine[] => [
  {
    text: "Retail Motor Vehicle Credit Application - structural preview. Approved template required.",
    size: 7,
    y: 40,
  },
  { text: `Page ${page} of 3`, size: 8, x: 520, y: 40 },
];

export function creditApplicationDemoPages(
  deal: Deal,
  signatures: DemoSignatures = {},
): PdfItem[][] {
  const slots = new Map(signatureSlotsFor("credit_application", deal).map((s) => [s.id, s]));
  const sig = (id: string, x: number, y: number, w = 150) => {
    const slot = slots.get(id);
    return slot ? signatureBlock(slot, deal, signatures, x + 10, y, w, 26) : [];
  };
  const head = (title: string): PdfItem[] => [
    { text: DEMO_WATERMARK, bold: true, size: 8, x: 40, y: 772 },
    { text: title, bold: true, size: 11, x: 40, y: 756 },
  ];
  const joint = jointCreditRequested(deal);
  const masked = (p: string) => {
    const ssn = ["collected", "verified"].includes(text(deal, `${p}.ssnStatus`))
      ? `***-**-${text(deal, `${p}.ssnLast4`)}`
      : "[secure identity integration required]";
    const id = text(deal, `${p}.idLast4`) ? `**** ${text(deal, `${p}.idLast4`)}` : "-";
    return { ssn, id };
  };
  const applicant = (p: "buyer" | "coBuyer", x: number) => {
    const c = column(x, 262, 706);
    c.bar(p === "buyer" ? "(A) Applicant" : "(B) Joint Applicant or Other Party");
    if (p === "coBuyer" && !deal.coBuyerIncluded) {
      c.line("No Joint Applicant on this deal.");
      return c.items;
    }
    if (p === "coBuyer" && !joint) c.line("Used only if joint credit is requested.", { size: 6 });
    const m = masked(p);
    const rows: Array<[string, string]> = [
      [
        "Full name",
        [text(deal, `${p}.firstName`), text(deal, `${p}.middleName`), text(deal, `${p}.lastName`)]
          .filter(Boolean)
          .join(" ") || "-",
      ],
      [
        "Gov't ID",
        `${v(deal, `${p}.idType`)}  No. ${m.id}  Issued by ${v(deal, `${p}.idIssuedBy`)}`,
      ],
      ["ID issue / exp.", `${v(deal, `${p}.idIssueDate`)} / ${v(deal, `${p}.idExpiryDate`)}`],
      ["Date of birth", v(deal, `${p}.dob`)],
      ["Soc. Sec. No.", m.ssn],
      [
        "Phones",
        `${v(deal, `${p}.phone`)}${box(deal, `${p}.phoneCell`) === "X" ? " (cell)" : ""}  ${text(deal, `${p}.secondPhone`)}`,
      ],
      ["Email", v(deal, `${p}.email`)],
      ["Street", `${v(deal, `${p}.street`)} ${text(deal, `${p}.unit`)}`],
      [
        "City/State/ZIP",
        `${v(deal, `${p}.city`)} ${text(deal, `${p}.state`)} ${text(deal, `${p}.zip`)}`,
      ],
      [
        "How long",
        `${v(deal, `${p}.yearsAtAddress`)} yrs ${text(deal, `${p}.monthsAtAddress`) || "0"} mos`,
      ],
      ["Mailing address", v(deal, `${p}.mailingStreet`)],
      ["Rent/mortgage", amtText(deal, `${p}.monthlyHousing`)],
      ["Residential status", v(deal, `${p}.residentialStatus`)],
      ["Landlord/Mortgage", `${v(deal, `${p}.landlord`)}  ${text(deal, `${p}.landlordPhone`)}`],
      ["Previous address", `${v(deal, `${p}.prevStreet`)} ${text(deal, `${p}.prevCity`)}`],
      ["Current employer", v(deal, `${p}.employer`)],
      ["Gross monthly", amtText(deal, `${p}.income`)],
      ["Employer address", `${v(deal, `${p}.employerStreet`)} ${text(deal, `${p}.employerCity`)}`],
      [
        "Work phone / how long",
        `${v(deal, `${p}.workPhone`)}  ${text(deal, `${p}.yearsAtJob`) || "-"} yrs ${text(deal, `${p}.monthsAtJob`) || "0"} mos`,
      ],
      ["Occupation", v(deal, `${p}.jobTitle`)],
      [
        "Previous employer",
        `${v(deal, `${p}.prevEmployer`)} ${amtText(deal, `${p}.prevEmployerIncome`)}`,
      ],
      [
        "Secondary employer",
        `${v(deal, `${p}.secEmployer`)} ${amtText(deal, `${p}.secEmployerIncome`)}`,
      ],
      [
        "Reference",
        `${v(deal, `${p}.refName`)}  ${text(deal, `${p}.refPhone`)}  ${text(deal, `${p}.refRelationship`)}`,
      ],
      [
        "Bank reference",
        `${v(deal, `${p}.bankName`)}  [${box(deal, `${p}.bankChecking`)}] Checking [${box(deal, `${p}.bankSavings`)}] Savings`,
      ],
    ];
    for (const [label, value] of rows) c.line(`${label}: ${value}`.slice(0, 70));
    return c.items;
  };

  // Page 1
  const p1: PdfItem[] = [
    ...head("RETAIL MOTOR VEHICLE CREDIT APPLICATION"),
    {
      text: `${v(deal, "dealer.legalName")}, ${v(deal, "dealer.street")} ${text(deal, "dealer.city")} ${text(deal, "dealer.state")} ${text(deal, "dealer.zip")}`,
      size: 8,
      x: 40,
      y: 742,
    },
    {
      text: `[${text(deal, "credit.saleOrLease") === "credit_sale" ? "X" : " "}] Credit Sale  [${text(deal, "credit.saleOrLease") === "lease" ? "X" : " "}] Lease   Application No. ${v(deal, "deal.appNumber")}   Date ${v(deal, "deal.date")}`,
      size: 7,
      x: 40,
      y: 730,
    },
    {
      text: `Type of credit: ${text(deal, "credit.creditType") || "not selected"}${joint ? " - joint credit initials below" : ""}`,
      size: 7,
      x: 40,
      y: 720,
    },
    ...applicant("buyer", 40),
    ...applicant("coBuyer", 316),
    {
      text: `Other income: (${text(deal, "credit.otherIncome.1.party") || "-"}) ${amtText(deal, "credit.otherIncome.1.amount")} ${text(deal, "credit.otherIncome.1.source")}   (${text(deal, "credit.otherIncome.2.party") || "-"}) ${amtText(deal, "credit.otherIncome.2.amount")} ${text(deal, "credit.otherIncome.2.source")}`,
      size: 7,
      x: 40,
      y: 300,
    },
    ...legalBox("Support / maintenance income notice", 40, 290, 532, 14),
    ...sig("ca-p1-joint-buyer", 40, 220, 90),
    ...sig("ca-p1-joint-cobuyer", 316, 220, 90),
    ...sig("ca-p1-inits-buyer", 40, 140, 60),
    ...sig("ca-p1-inits-cobuyer", 316, 140, 60),
    ...caFooter(1),
  ];

  // Page 2
  const p2 = column(40, 532);
  p2.bar("Signatures");
  p2.legal("Applicant certification and authorization to submit");
  p2.line(`Submitted to: ${v(deal, "credit.submitTo")}`);
  p2.legal("Verification and consumer report authorization");
  p2.sig(sig("ca-p2-buyer", 40, p2.y - 30));
  p2.line(`DL #: ${masked("buyer").id}`);
  if (slots.has("ca-p2-cobuyer")) {
    p2.sig(sig("ca-p2-cobuyer", 40, p2.y - 30));
    p2.line(`DL #: ${masked("coBuyer").id}`);
  } else p2.line("Joint applicant signature: applies only when joint credit is requested.");
  p2.bar("Notices");
  const notices = applicableStateNotices(deal);
  if (notices.length) for (const n of notices) p2.legal(`${n.title} (applies)`);
  else p2.line("No state-specific notice applies to this application.");
  if (wisconsinApplies(deal)) {
    p2.line(
      `Wisconsin: applicant is ${text(deal, "credit.wi.maritalStatus") || "-"}; spouse ${v(deal, "credit.wi.spouseName")}`,
    );
    if (slots.has("ca-p2-wi-spouse")) p2.sig(sig("ca-p2-wi-spouse", 40, p2.y - 30));
  }
  p2.sig(sig("ca-p2-inits-buyer", 40, p2.y - 30, 60));
  if (slots.has("ca-p2-inits-cobuyer")) p2.sig(sig("ca-p2-inits-cobuyer", 40, p2.y - 30, 60));

  // Page 3
  const p3 = column(40, 532);
  p3.bar("All Applicants: Important Applicant Information");
  for (const t of [
    "Consumer report authorization",
    "Verification and retention",
    "Telephone and electronic communications",
  ])
    p3.legal(t);
  p3.sig(sig("ca-p3-buyer", 40, p3.y - 30));
  if (slots.has("ca-p3-cobuyer")) p3.sig(sig("ca-p3-cobuyer", 40, p3.y - 30));
  p3.bar(`For Dealer Use Only   VIN #: ${v(deal, "vehicle.vin")}`);
  p3.line(
    `${v(deal, "vehicle.condition")}  ${v(deal, "vehicle.year")} ${v(deal, "vehicle.make")} ${v(deal, "vehicle.model")} ${v(deal, "vehicle.bodyStyle")}  Mileage ${v(deal, "vehicle.odometer")}  Book value ${amtText(deal, "credit.dealer.bookValue")}`,
  );
  p3.line(
    dealerUseTradeIn(deal)
      .map((x) => `${x.label} ${x.value || "-"}`)
      .join("  "),
  );
  p3.line(
    dealerUseFinancials(deal)
      .map((x) => `${x.label} ${x.value || "-"}`)
      .join("  ")
      .slice(0, 120),
  );
  p3.sig(sig("ca-p3-inits-buyer", 40, p3.y - 30, 60));
  if (slots.has("ca-p3-inits-cobuyer")) p3.sig(sig("ca-p3-inits-cobuyer", 40, p3.y - 30, 60));

  return [
    p1,
    [
      ...head("Credit Application - Authorizations, Signatures & Notices"),
      ...p2.items,
      ...caFooter(2),
    ],
    [...head("Credit Application - Important Applicant Information"), ...p3.items, ...caFooter(3)],
  ];
}

const amtText = (deal: Deal, key: string) => {
  const value = deal.fields[key]?.value;
  return typeof value === "number" ? `$ ${formatCents(value)}` : "-";
};

// ------------------------------------------------------------
// Form 4 — GPS Disclosure: 2-page structural preview
// ------------------------------------------------------------

const gpsFooter = (page: number): PdfLine[] => [
  {
    text: "GPS Installation Disclosure - structural preview. Approved template required.",
    size: 7,
    y: 40,
  },
  { text: `Page ${page} of 2`, size: 8, x: 520, y: 40 },
];

export function gpsDisclosureDemoPages(
  deal: Deal,
  signatures: DemoSignatures = {},
  initials: DemoInitials = {},
): PdfItem[][] {
  const slots = new Map(signatureSlotsFor("gps_disclosure", deal).map((s) => [s.id, s]));
  const sig = (id: string, x: number, y: number) => {
    const slot = slots.get(id);
    return slot ? signatureBlock(slot, deal, signatures, x + 10, y, 160, 26) : [];
  };
  const creditor = gpsCreditorName(deal) || "[creditor missing]";
  const provision = (
    c: ReturnType<typeof column>,
    p: (typeof GPS_PROVISIONS)[number],
    page: number,
  ) => {
    const continued = p.pages.length > 1 && page === 2;
    const inits = continued
      ? "(initialled with 4 above)"
      : GPS_PROVISION_INITIAL_ROLES.map(
          (r) => `[${initials[initialKey("gps_disclosure", p.number, r)]?.initials ?? "    "}]`,
        ).join(" ");
    c.line(`${inits}  ${p.number}.${continued ? " (continued)" : ""} ${p.title}`.slice(0, 120), {
      bold: true,
    });
    c.line(`[Approved GPS disclosure wording required]  Creditor: ${creditor}`, {
      size: 6,
      indent: 40,
    });
  };
  const device = text(deal, "gps.deviceId") || "GPS Device Not Assigned";

  const p1 = column(40, 532, 740);
  p1.line("DISCLOSURE STATEMENT AND AGREEMENT FOR GPS INSTALLATION", { bold: true, size: 11 });
  p1.line(`Borrower Name: ${fullName(deal, "buyer") || "-"}    Date: ${v(deal, "deal.date")}`);
  if (deal.coBuyerIncluded)
    p1.line(
      `Co-Borrower Name: ${fullName(deal, "coBuyer") || "-"}    Date: ${v(deal, "deal.date")}`,
    );
  p1.line(
    `Vehicle: ${v(deal, "vehicle.year")} (model year)  ${v(deal, "vehicle.model")} (model)  ${v(deal, "vehicle.make")} (make)   VIN ${v(deal, "vehicle.vin")}`,
  );
  p1.line(`GPS Device ID Number: ${device}`);
  p1.legal("GPS electronic device disclosure");
  p1.bar("By reading and signing below - acceptance of the installation terms");
  for (const p of GPS_PROVISIONS.filter((x) => x.pages.includes(1))) provision(p1, p, 1);

  const p2 = column(40, 532, 760);
  for (const p of GPS_PROVISIONS.filter((x) => x.pages.includes(2))) provision(p2, p, 2);
  p2.legal("Violation of this Agreement as a default under the Contract");
  p2.legal("NOTICE: DO NOT SIGN WITHOUT READING THE AGREEMENT");
  p2.sig(sig("gps-p2-borrower", 40, p2.y - 30));
  if (slots.has("gps-p2-coborrower")) p2.sig(sig("gps-p2-coborrower", 40, p2.y - 30));

  return [
    [{ text: DEMO_WATERMARK, bold: true, size: 8, x: 40, y: 772 }, ...p1.items, ...gpsFooter(1)],
    [{ text: DEMO_WATERMARK, bold: true, size: 8, x: 40, y: 772 }, ...p2.items, ...gpsFooter(2)],
  ];
}

// ------------------------------------------------------------
// Form 5 — Customer Delivery Checklist: 1-page structural preview
// ------------------------------------------------------------

export function deliveryChecklistDemoPages(
  deal: Deal,
  signatures: DemoSignatures = {},
  initials: DemoInitials = {},
): PdfItem[][] {
  const slots = new Map(signatureSlotsFor("delivery_checklist", deal).map((s) => [s.id, s]));
  const sig = (id: string, x: number, y: number) => {
    const slot = slots.get(id);
    return slot ? signatureBlock(slot, deal, signatures, x + 10, y, 160, 26) : [];
  };
  const c = column(40, 532, 740);
  c.line((text(deal, "dealer.legalName") || "[dealer name missing]").toUpperCase(), {
    bold: true,
    size: 11,
    indent: 180,
  });
  c.line(
    `${v(deal, "dealer.street")} ${text(deal, "dealer.city")}, ${text(deal, "dealer.state")} ${text(deal, "dealer.zip")}`.toUpperCase(),
    { indent: 180 },
  );
  c.line("CUSTOMER DELIVERY CHECKLIST", { bold: true, size: 9, indent: 190 });
  c.line(`Purchaser Name(s): ${purchaserNames(deal) || "-"}`);
  c.line(
    text(deal, "vehicle.vin")
      ? `Vehicle Description: ${v(deal, "vehicle.year")} ${v(deal, "vehicle.make")} ${v(deal, "vehicle.model")}   VIN ${v(deal, "vehicle.vin")}`
      : "Vehicle Description: Vehicle Not Assigned",
  );
  c.legal("Introduction and instructions");
  c.bar("Please read - by initialing and signing below you consent to the following statements");
  for (const s of DELIVERY_STATEMENTS) {
    const applies = itemApplies(s, deal);
    const inits = applies.applies
      ? DELIVERY_INITIAL_ROLES.map(
          (r) => `[${initials[initialKey("delivery_checklist", s.number, r)]?.initials ?? "    "}]`,
        ).join(" ")
      : "[N/A]";
    c.line(`${inits}  ${s.number}. ${s.title}`.slice(0, 125), { bold: true });
    c.line(
      applies.applies
        ? "[Approved statement wording required]"
        : `Not applicable: ${applies.reason ?? ""}`,
      { size: 6, indent: 40 },
    );
  }
  c.legal("Closing message");
  const y = c.y - 30;
  return [
    [
      { text: DEMO_WATERMARK, bold: true, size: 8, x: 40, y: 772 },
      ...c.items,
      ...sig("dc-purchaser", 40, y),
      ...sig("dc-copurchaser", 316, y),
      ...sig("dc-representative", 40, y - 60),
      {
        text: "Customer Delivery Checklist - structural preview. Approved template required.",
        size: 7,
        x: 40,
        y: 40,
      },
    ],
  ];
}
