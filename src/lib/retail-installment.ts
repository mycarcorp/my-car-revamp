/**
 * Form 2 — Retail Installment Contract and Security Agreement: itemization of
 * amount financed (rows a–aa), payment schedule, Truth-In-Lending figures, APR,
 * Bill of Sale reconciliation and signature locations.
 *
 * Structure follows the five-page Virginia reference form (field names,
 * lettering and placement only). Its legal wording is NOT reproduced: those
 * places stay "approved template required". No figure is invented: an unknown
 * amount stays unknown (it never counts as zero), and the disclosures stay
 * pending until every input they depend on is present.
 *
 * Pure functions over the shared deal, in integer cents, so the server can run
 * the same code to verify values before a contract is released.
 *
 * NOTE: a retail installment sale is not the same product as Lease to Own.
 * Whether this form applies to a Lease to Own deal is for management/legal.
 */
import { BILL_OF_SALE_LINES, computeBillOfSale, type SignatureRequirement } from "./bill-of-sale";
import { cents as centsOf, fullName, text, type Deal } from "./deal-model";
import { formatCents } from "./money";
import {
  RIC_PAYEE_ROWS,
  RIC_SCHEDULE_ROWS,
  type PaymentFrequency,
  type RicInputRow,
} from "./retail-installment-fields";

export const RIC_CONTRACT_TYPE_REVIEW =
  "Retail installment terms are not interchangeable with Lease to Own terms. Management/legal review is required before this form is used for any deal.";

// ------------------------------------------------------------
// Amounts
// ------------------------------------------------------------

/** An itemization amount: entered, explicitly not applicable, included elsewhere, or unknown. */
export type Amount =
  { state: "amount"; cents: number } | { state: "na" } | { state: "incl" } | { state: "unknown" };

const UNKNOWN: Amount = { state: "unknown" };

export function amountOf(deal: Deal, key: string): Amount {
  const v = deal.fields[key]?.value;
  if (typeof v === "number") return { state: "amount", cents: v };
  if (v === "N/A") return { state: "na" };
  if (v === "INCL.") return { state: "incl" };
  return UNKNOWN;
}

/** "$1,250.00", "N/A", "INCL." or "" for unknown. */
export function formatAmount(a: Amount): string {
  if (a.state === "amount") return `$${formatCents(a.cents)}`;
  if (a.state === "na") return "N/A";
  if (a.state === "incl") return "INCL.";
  return "";
}

// ------------------------------------------------------------
// Itemization of Amount Financed (rows a–aa)
// ------------------------------------------------------------

export type ItemRowLetter = RicInputRow | "d" | "h" | "i" | "j" | "y" | "aa";

export type ItemRow = {
  letter: ItemRowLetter;
  label: string;
  kind: "input" | "calc";
  formula?: string;
  /** Text field naming who the amount is paid to, or what it is. */
  detailKey?: string;
  detailLabel?: string;
  /** Bill of Sale line with the SAME meaning, used to prefill and to cross-check. */
  billOfSaleLine?: number;
  bold?: boolean;
};

export const RIC_ITEM_ROWS: readonly ItemRow[] = [
  {
    letter: "a",
    label: "Cash Price of Vehicle, etc. (incl. sales tax)",
    kind: "input",
    billOfSaleLine: 3,
    bold: true,
  },
  { letter: "b", label: "Trade-in allowance", kind: "input", billOfSaleLine: 25 },
  {
    letter: "c",
    label: "Less: Amount owing, paid to (includes j)",
    kind: "input",
    detailKey: "ric.item.cPayee",
    detailLabel: "Paid to",
    billOfSaleLine: 26,
  },
  {
    letter: "d",
    label: "Net trade-in",
    kind: "calc",
    formula: "b–c; if negative, enter $0 here and enter the amount on line j",
  },
  { letter: "e", label: "Cash payment", kind: "input", billOfSaleLine: 28 },
  { letter: "f", label: "Manufacturer's rebate", kind: "input" },
  {
    letter: "g",
    label: "Other down payment",
    kind: "input",
    detailKey: "ric.item.gDescription",
    detailLabel: "Describe",
    billOfSaleLine: 29,
  },
  { letter: "h", label: "Down Payment", kind: "calc", formula: "d+e+f+g", bold: true },
  { letter: "i", label: "Unpaid balance of Cash Price", kind: "calc", formula: "a–h", bold: true },
  { letter: "j", label: "Financed trade-in balance", kind: "calc", formula: "see line d" },
  { letter: "k", label: "Paid to public officials, including filing fees", kind: "input" },
  { letter: "l", label: "Insurance premiums paid to insurance company(ies)", kind: "input" },
  {
    letter: "m",
    label: "Service Contract, paid to",
    kind: "input",
    detailKey: "ric.item.mPayee",
    detailLabel: "Paid to",
  },
  { letter: "n", label: "Processing fee, paid to Seller", kind: "input", billOfSaleLine: 7 },
  ...RIC_PAYEE_ROWS.map((letter): ItemRow => ({
    letter,
    label: "To",
    kind: "input",
    detailKey: `ric.item.${letter}Payee`,
    detailLabel: "Approved product / payee",
  })),
  {
    letter: "y",
    label: "Total Other Charges/Amts Paid",
    kind: "calc",
    formula: "j thru x",
    bold: true,
  },
  { letter: "z", label: "Prepaid Finance Charge", kind: "input", bold: true },
  { letter: "aa", label: "Amount Financed", kind: "calc", formula: "i+y–z", bold: true },
];

export type ItemSource = "contract" | "bill_of_sale" | "none";

export type ItemValue = {
  amount: Amount;
  /** Where an input row's value came from. Calculated rows report "contract". */
  source: ItemSource;
  /** For calculated rows: the input rows still unknown. */
  missing: RicInputRow[];
};

/**
 * An input row's value: what staff entered on this form, otherwise the Bill of
 * Sale line with the same meaning. Bill of Sale blanks stay unknown here.
 */
function inputRow(deal: Deal, letter: RicInputRow): ItemValue {
  const own = amountOf(deal, `ric.item.${letter}`);
  if (own.state !== "unknown") return { amount: own, source: "contract", missing: [] };
  const row = RIC_ITEM_ROWS.find((r) => r.letter === letter);
  if (row?.billOfSaleLine) {
    const bos = billOfSaleValue(deal, row.billOfSaleLine);
    if (bos !== null)
      return { amount: { state: "amount", cents: bos }, source: "bill_of_sale", missing: [] };
  }
  return { amount: UNKNOWN, source: "none", missing: [letter] };
}

/**
 * A Bill of Sale value with the same meaning. Line 3 (price + sales tax) is
 * used only when both the price and the sales tax were entered.
 */
function billOfSaleValue(deal: Deal, line: number): number | null {
  if (line === 3) {
    const price = centsOf(deal, "line.1");
    const tax = centsOf(deal, "line.2");
    return price === null || tax === null ? null : price + tax;
  }
  const def = BILL_OF_SALE_LINES.find((l) => l.number === line);
  return def?.kind === "input" ? centsOf(deal, `line.${line}`) : null;
}

/** Numeric value for arithmetic: N/A and INCL. add nothing; unknown is null. */
const num = (a: Amount): number | null =>
  a.state === "amount" ? a.cents : a.state === "unknown" ? null : 0;

function calc(missing: RicInputRow[], value: () => number): ItemValue {
  const unique = [...new Set(missing)];
  return unique.length
    ? { amount: UNKNOWN, source: "contract", missing: unique }
    : { amount: { state: "amount", cents: value() }, source: "contract", missing: [] };
}

export type Itemization = Record<ItemRowLetter, ItemValue> & {
  /** Payoff above the trade-in allowance (b − c < 0), carried to line j. */
  negativeEquityCents: number | null;
};

/** Computes rows a–aa in integer cents. Calculated rows can't be overridden. */
export function computeItemization(deal: Deal): Itemization {
  const r = {} as Record<ItemRowLetter, ItemValue>;
  for (const row of RIC_ITEM_ROWS)
    if (row.kind === "input") r[row.letter] = inputRow(deal, row.letter as RicInputRow);
  const v = (l: ItemRowLetter) => num(r[l].amount)!;
  const miss = (...ls: ItemRowLetter[]) => ls.flatMap((l) => r[l].missing);

  // d = b − c; a negative result is entered as $0 and carried to j.
  const netTrade = () => v("b") - v("c");
  r.d = calc(miss("b", "c"), () => Math.max(netTrade(), 0));
  r.j = calc(miss("b", "c"), () => Math.max(-netTrade(), 0));
  r.h = calc(miss("d", "e", "f", "g"), () => v("d") + v("e") + v("f") + v("g"));
  r.i = calc(miss("a", "h"), () => v("a") - v("h"));
  const others = ["j", "k", "l", "m", "n", ...RIC_PAYEE_ROWS] as const;
  r.y = calc(miss(...others), () => others.reduce((sum, l) => sum + v(l), 0));
  r.aa = calc(miss("i", "y", "z"), () => v("i") + v("y") - v("z"));

  const negativeEquityCents =
    r.j.amount.state === "amount" && r.j.amount.cents > 0 ? r.j.amount.cents : null;
  return Object.assign(r, { negativeEquityCents });
}

/** Input rows still unknown (neither an amount nor N/A). */
export function unknownItemRows(deal: Deal): RicInputRow[] {
  const items = computeItemization(deal);
  return RIC_ITEM_ROWS.filter(
    (row) => row.kind === "input" && items[row.letter].amount.state === "unknown",
  ).map((row) => row.letter as RicInputRow);
}

// ------------------------------------------------------------
// Dates (calendar dates as YYYY-MM-DD, computed in UTC)
// ------------------------------------------------------------

const DAY = 86_400_000;

function parseDate(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!));
  return d.getUTCDate() === +m[3]! ? d : null;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);
const daysBetween = (from: Date, to: Date) => Math.round((to.getTime() - from.getTime()) / DAY);

/** Adds months keeping the anchor day, clamped to the month's last day (Jan 31 + 1 → Feb 28). */
function addMonths(d: Date, n: number, anchorDay = d.getUTCDate()): Date {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + n;
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(anchorDay, last)));
}

/** MM/DD/YYYY, as printed on the form. */
export function formatFormDate(value: string): string {
  const d = parseDate(value);
  if (!d) return value;
  return `${String(d.getUTCMonth() + 1).padStart(2, "0")}/${String(d.getUTCDate()).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

// ------------------------------------------------------------
// Payment schedule
// ------------------------------------------------------------

export type ScheduleRow = {
  row: number;
  count: number;
  amountCents: number;
  frequency: PaymentFrequency;
  firstDue: string;
  kind: "installment" | "deferred_down";
  /** Every due date in this row. */
  dueDates: string[];
  /** "Monthly, beginning 05/01/2026 (final 04/01/2029)". */
  whenDue: string;
};

const FREQUENCY_TEXT: Record<PaymentFrequency, string> = {
  once: "",
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  semimonthly: "Twice a month",
  monthly: "Monthly",
};

function dueDate(first: Date, frequency: PaymentFrequency, k: number): Date {
  switch (frequency) {
    case "weekly":
      return addDays(first, 7 * k);
    case "biweekly":
      return addDays(first, 14 * k);
    case "semimonthly":
      return k % 2 === 0 ? addMonths(first, k / 2) : addDays(addMonths(first, (k - 1) / 2), 15);
    case "monthly":
      return addMonths(first, k);
    default:
      return first;
  }
}

/** Reads the schedule rows. Blank rows are skipped; started rows must be complete. */
export function readSchedule(deal: Deal): { rows: ScheduleRow[]; errors: string[] } {
  const rows: ScheduleRow[] = [];
  const errors: string[] = [];
  const contractDate = parseDate(text(deal, "deal.date"));
  for (const n of RIC_SCHEDULE_ROWS) {
    const k = (f: string) => `ric.schedule.${n}.${f}`;
    const count = deal.fields[k("count")]?.value;
    const amount = centsOf(deal, k("amount"));
    const frequency = text(deal, k("frequency")) as PaymentFrequency | "";
    const firstDue = text(deal, k("firstDue"));
    const kind = text(deal, k("kind")) === "deferred_down" ? "deferred_down" : "installment";
    const started = count !== null || amount !== null || frequency !== "" || firstDue !== "";
    if (!started) continue;
    const problems: string[] = [];
    if (typeof count !== "number") problems.push("number of payments");
    if (amount === null || amount <= 0) problems.push("amount");
    if (!frequency) problems.push("frequency");
    const first = parseDate(firstDue);
    if (!first) problems.push("first due date");
    if (problems.length) {
      errors.push(`Payment row ${n}: enter the ${problems.join(", ")}.`);
      continue;
    }
    if (frequency === "once" && count !== 1) {
      errors.push(`Payment row ${n}: a one-time payment has exactly 1 payment.`);
      continue;
    }
    if (contractDate && first! <= contractDate) {
      errors.push(`Payment row ${n}: the first payment must be due after the contract date.`);
      continue;
    }
    const freq = frequency as PaymentFrequency;
    const dueDates = Array.from({ length: count as number }, (_, i) =>
      iso(dueDate(first!, freq, i)),
    );
    const last = dueDates[dueDates.length - 1]!;
    rows.push({
      row: n,
      count: count as number,
      amountCents: amount!,
      frequency: freq,
      firstDue,
      kind,
      dueDates,
      whenDue:
        freq === "once"
          ? formatFormDate(firstDue)
          : `${FREQUENCY_TEXT[freq]}, beginning ${formatFormDate(firstDue)} (final ${formatFormDate(last)})`,
    });
  }
  return { rows, errors };
}

// ------------------------------------------------------------
// APR — actuarial method (Regulation Z, 12 CFR 1026, Appendix J)
// ------------------------------------------------------------

const UNIT_PERIODS: Record<Exclude<PaymentFrequency, "once">, { perYear: number }> = {
  weekly: { perYear: 52 },
  biweekly: { perYear: 26 },
  semimonthly: { perYear: 24 },
  monthly: { perYear: 12 },
};
type UnitPeriod = keyof typeof UNIT_PERIODS;

/**
 * Whole unit periods (t) and the fraction (f) between the advance and a
 * payment, counting full periods back from the payment date; remaining days
 * are a fraction of 30 (monthly), 15 (semimonthly), 7 or 14 days.
 */
export function periodsBetween(
  advance: string,
  payment: string,
  unit: UnitPeriod,
): { t: number; f: number } {
  const a = parseDate(advance)!;
  const p = parseDate(payment)!;
  if (unit === "weekly" || unit === "biweekly") {
    const len = unit === "weekly" ? 7 : 14;
    const days = daysBetween(a, p);
    return { t: Math.floor(days / len), f: (days % len) / len };
  }
  let months = 0;
  while (addMonths(p, -(months + 1), p.getUTCDate()) >= a) months++;
  let days = daysBetween(a, addMonths(p, -months, p.getUTCDate()));
  if (unit === "monthly") return { t: months, f: days / 30 };
  let t = months * 2;
  if (days >= 15) {
    t += 1;
    days -= 15;
  }
  return { t, f: days / 15 };
}

/** The unit period is the most common payment interval among installments. */
function unitPeriodOf(rows: ScheduleRow[]): UnitPeriod {
  const tally = new Map<UnitPeriod, number>();
  for (const r of rows)
    if (r.frequency !== "once") tally.set(r.frequency, (tally.get(r.frequency) ?? 0) + r.count);
  return [...tally].sort((x, y) => y[1] - x[1])[0]?.[0] ?? "monthly";
}

/**
 * Annual percentage rate (in percent) that equates the amount financed with
 * the installments, by the Appendix J general equation:
 *   A = Σ P / ((1 + f·i)(1 + i)^t)
 * Solved by bisection; null when the payments don't cover the amount financed.
 */
export function actuarialApr(
  amountFinancedCents: number,
  advanceDate: string,
  payments: ReadonlyArray<{ date: string; cents: number }>,
  unit: UnitPeriod,
): number | null {
  if (amountFinancedCents <= 0 || payments.length === 0) return null;
  const terms = payments.map((p) => ({ ...periodsBetween(advanceDate, p.date, unit), c: p.cents }));
  const pv = (i: number) => terms.reduce((s, x) => s + x.c / ((1 + x.f * i) * (1 + i) ** x.t), 0);
  if (pv(0) < amountFinancedCents) return null;
  let lo = 0;
  let hi = 1;
  while (pv(hi) > amountFinancedCents && hi < 1e6) hi *= 2;
  for (let n = 0; n < 200; n++) {
    const mid = (lo + hi) / 2;
    if (pv(mid) > amountFinancedCents) lo = mid;
    else hi = mid;
  }
  return ((lo + hi) / 2) * UNIT_PERIODS[unit].perYear * 100;
}

// ------------------------------------------------------------
// Truth-In-Lending Disclosure
// ------------------------------------------------------------

export type Disclosures = {
  /** pending: inputs missing; draft: calculated, terms not approved; approved: staff approved. */
  status: "pending" | "draft" | "approved";
  /** Why the disclosures are pending. */
  reasons: string[];
  /** Non-blocking checks for staff. */
  warnings: string[];
  schedule: ScheduleRow[];
  aprPercent: number | null;
  financeChargeCents: number | null;
  amountFinancedCents: number | null;
  totalOfPaymentsCents: number | null;
  totalSalePriceCents: number | null;
  downPaymentCents: number | null;
};

/**
 * Finance charge = installments − amount financed. A deferred down payment
 * listed in the schedule is part of the down payment (row h), not financed, so
 * it is counted in the Total of Payments but not in the finance charge or APR.
 * Total Sale Price = amount financed + finance charge + down payment.
 */
export function computeDisclosures(deal: Deal): Disclosures {
  const items = computeItemization(deal);
  const { rows, errors } = readSchedule(deal);
  const reasons = [...errors];
  const warnings: string[] = [];
  const contractDate = text(deal, "deal.date");
  const af = num(items.aa.amount);
  const down = num(items.h.amount);
  if (af === null)
    reasons.push(`Amount Financed needs itemization rows ${items.aa.missing.join(", ")}.`);
  else if (af <= 0) reasons.push("Amount Financed must be more than $0.");
  if (!parseDate(contractDate)) reasons.push("Enter the contract date.");
  const installments = rows.filter((r) => r.kind === "installment");
  if (!installments.length) reasons.push("Enter the approved payment schedule.");

  const sum = (rs: ScheduleRow[]) => rs.reduce((s, r) => s + r.count * r.amountCents, 0);
  const deferred = sum(rows.filter((r) => r.kind === "deferred_down"));
  if (down !== null && deferred > down)
    reasons.push("Deferred down payments in the schedule exceed the Down Payment (row h).");

  const blank = {
    schedule: rows,
    aprPercent: null,
    financeChargeCents: null,
    amountFinancedCents: af,
    totalOfPaymentsCents: rows.length && !errors.length ? sum(rows) : null,
    totalSalePriceCents: null,
    downPaymentCents: down,
  };
  if (reasons.length) return { status: "pending", reasons, warnings, ...blank };

  const financeCharge = sum(installments) - af!;
  const apr = actuarialApr(
    af!,
    contractDate,
    installments.flatMap((r) => r.dueDates.map((date) => ({ date, cents: r.amountCents }))),
    unitPeriodOf(installments),
  );
  if (financeCharge < 0 || apr === null)
    return {
      status: "pending",
      reasons: ["The installments don't cover the Amount Financed."],
      warnings,
      ...blank,
    };

  const stated = deal.fields["ric.contractRate"]?.value;
  if (typeof stated === "number" && Math.abs(stated - apr) > 0.125)
    warnings.push(
      `The stated finance charge rate (${stated}%) differs from the calculated APR (${apr.toFixed(2)}%). They need not match (e.g. prepaid finance charges or irregular periods), but staff should confirm both.`,
    );
  return {
    status: deal.fields["ric.financingApproved"]?.value === true ? "approved" : "draft",
    reasons: [],
    warnings,
    schedule: rows,
    aprPercent: Math.round(apr * 100) / 100,
    financeChargeCents: financeCharge,
    amountFinancedCents: af,
    totalOfPaymentsCents: sum(rows),
    totalSalePriceCents: af! + financeCharge + (down ?? 0),
    downPaymentCents: down,
  };
}

// ------------------------------------------------------------
// Reconciliation with Form 1 and within the form
// ------------------------------------------------------------

export type ReconciliationIssue = { id: string; message: string };

const money = (c: number) => `$${formatCents(c)}`;

/**
 * Disagreements staff must resolve. Nothing is replaced automatically: an
 * amount entered on this form is kept and the difference is reported.
 */
export function reconcileRetailInstallment(deal: Deal): ReconciliationIssue[] {
  const issues: ReconciliationIssue[] = [];
  const items = computeItemization(deal);
  for (const row of RIC_ITEM_ROWS) {
    if (!row.billOfSaleLine || row.kind !== "input") continue;
    const own = amountOf(deal, `ric.item.${row.letter}`);
    const bos = billOfSaleValue(deal, row.billOfSaleLine);
    if (own.state !== "unknown" && bos !== null && (num(own) ?? 0) !== bos)
      issues.push({
        id: `bos-${row.letter}`,
        message: `Row ${row.letter} (${formatAmount(own)}) differs from Bill of Sale line ${row.billOfSaleLine} (${money(bos)}).`,
      });
  }
  const tax = amountOf(deal, "ric.item.aTax");
  const bosTax = centsOf(deal, "line.2");
  if (tax.state === "amount" && bosTax !== null && tax.cents !== bosTax)
    issues.push({
      id: "bos-tax",
      message: `Sales tax in row a (${money(tax.cents)}) differs from Bill of Sale line 2 (${money(bosTax)}).`,
    });

  // Bill of Sale balance due vs. this form's amount financed (+ prepaid finance charge).
  const balance = computeBillOfSale(deal).byNumber[31] ?? null;
  const af = num(items.aa.amount);
  const z = num(items.z.amount);
  if (balance !== null && af !== null && z !== null && balance !== af + z)
    issues.push({
      id: "bos-balance",
      message: `Bill of Sale balance due (line 31, ${money(balance)}) differs from Amount Financed + Prepaid Finance Charge (${money(af + z)}). Check that every fee and product appears on both forms.`,
    });

  // Service contract: page 3 selection, its price and row m must agree.
  const svc = deal.fields["ric.svc.selected"]?.value === true;
  const svcPrice = centsOf(deal, "ric.svc.price");
  const m = items.m.amount;
  if (svc && svcPrice !== null && m.state === "amount" && m.cents !== svcPrice)
    issues.push({
      id: "svc-price",
      message: `Service contract price (${money(svcPrice)}) differs from row m (${money(m.cents)}).`,
    });
  if (!svc && m.state === "amount" && m.cents > 0)
    issues.push({
      id: "svc-unselected",
      message:
        "Row m has a service contract amount, but no Service Contract is selected on page 3.",
    });

  // Insurance premiums listed on page 2 can't exceed row l.
  const premiums = [
    centsOf(deal, "ric.creditLife.premium"),
    centsOf(deal, "ric.creditDisability.premium"),
    num(amountOf(deal, "ric.propIns.premium")),
    num(amountOf(deal, "ric.singleInterest.premium")),
  ].reduce<number>((s, c) => s + (c ?? 0), 0);
  const l = items.l.amount;
  if (premiums > 0 && l.state !== "unknown" && premiums > (num(l) ?? 0))
    issues.push({
      id: "insurance-premiums",
      message: `Insurance premiums on page 2 (${money(premiums)}) exceed row l (${formatAmount(l)}).`,
    });

  for (const prefix of ["creditLife", "creditDisability"] as const) {
    const elected = ["single", "joint"].includes(text(deal, `ric.${prefix}.coverage`));
    if (elected && centsOf(deal, `ric.${prefix}.premium`) === null)
      issues.push({
        id: `${prefix}-premium`,
        message: `${prefix === "creditLife" ? "Credit Life" : "Credit Disability"} is elected but has no premium.`,
      });
  }
  if (deal.fields["ric.thirdParty.included"]?.value === true && !text(deal, "ric.thirdParty.name"))
    issues.push({
      id: "third-party-name",
      message: "Enter the verified Third Party Owner's legal name.",
    });
  return issues;
}

// ------------------------------------------------------------
// Signature locations (from the reference layout)
// ------------------------------------------------------------

export const RETAIL_INSTALLMENT_SIGNATURES: readonly SignatureRequirement[] = [
  {
    id: "ric-p2-ins-buyer",
    role: "buyer",
    page: 2,
    location: "Insurance Disclosures — By / DOB (credit insurance elected)",
    conditional: "credit_insurance_elected",
  },
  {
    id: "ric-p2-ins-cobuyer",
    role: "co_buyer",
    page: 2,
    location: "Insurance Disclosures — By / DOB (credit insurance elected)",
    conditional: "credit_insurance_elected",
  },
  {
    id: "ric-p3-prot-buyer",
    role: "buyer",
    page: 3,
    location: "Additional Protections — By / Date (a protection selected)",
    conditional: "protection_selected",
  },
  {
    id: "ric-p3-prot-cobuyer",
    role: "co_buyer",
    page: 3,
    location: "Additional Protections — By / Date (a protection selected)",
    conditional: "protection_selected",
  },
  {
    id: "ric-p4-third-party",
    role: "third_party_owner",
    page: 4,
    location: "Third Party Agreement — Signature of Third Party Owner (NOT the Buyer)",
    conditional: "third_party_owner",
  },
  {
    id: "ric-p5-agree-buyer",
    role: "buyer",
    page: 5,
    location: "Signatures — Entire Agreement, first By / Date",
  },
  {
    id: "ric-p5-agree-cobuyer",
    role: "co_buyer",
    page: 5,
    location: "Signatures — Entire Agreement, second By / Date",
    conditional: "co_buyer_included",
  },
  { id: "ric-p5-buyer", role: "buyer", page: 5, location: "Notice to Buyer — Buyer By / Date" },
  {
    id: "ric-p5-cobuyer",
    role: "co_buyer",
    page: 5,
    location: "Notice to Buyer — Buyer By / Date (second line)",
    conditional: "co_buyer_included",
  },
  { id: "ric-p5-seller", role: "dealer", page: 5, location: "Seller — By / Date" },
  {
    id: "ric-p5-assign-seller",
    role: "dealer",
    page: 5,
    location: "Assignment — Seller By / Date (assignee entered)",
    conditional: "assignment_entered",
  },
];

export const creditInsuranceElected = (deal: Deal) =>
  ["creditLife", "creditDisability"].some((p) =>
    ["single", "joint"].includes(text(deal, `ric.${p}.coverage`)),
  );
export const protectionSelected = (deal: Deal) =>
  ["svc", "gap", "otherProtection"].some((p) => deal.fields[`ric.${p}.selected`]?.value === true);
export const thirdPartyOwnerIncluded = (deal: Deal) =>
  deal.fields["ric.thirdParty.included"]?.value === true;

// ------------------------------------------------------------
// Missing information
// ------------------------------------------------------------

/** Labels of everything this form still needs before it could be finalized. */
export function retailInstallmentMissing(deal: Deal): string[] {
  const missing: string[] = [];
  const need = (key: string, label: string) => !text(deal, key) && missing.push(label);
  need("deal.contractNumber", "Contract No. (issued by the server)");
  need("deal.date", "Contract date");
  need("dealer.legalName", "Seller name");
  need("dealer.street", "Seller address");
  if (!fullName(deal, "buyer")) missing.push("Buyer name");
  need("buyer.street", "Buyer address");
  if (deal.coBuyerIncluded) {
    if (!fullName(deal, "coBuyer")) missing.push("Co-Buyer name");
    need("coBuyer.street", "Co-Buyer address");
  }
  need("vehicle.condition", "New / Used / Demo");
  need("vehicle.year", "Vehicle year");
  need("vehicle.make", "Vehicle make");
  need("vehicle.model", "Vehicle model");
  need("vehicle.vin", "VIN");
  need("vehicle.odometer", "Odometer mileage");
  const unknown = unknownItemRows(deal);
  if (unknown.length) missing.push(`Itemization rows ${unknown.join(", ")} (amount or N/A)`);
  if (!readSchedule(deal).rows.length) missing.push("Payment schedule");
  if (thirdPartyOwnerIncluded(deal)) need("ric.thirdParty.name", "Third Party Owner name");
  if (text(deal, "ric.assign.status") && text(deal, "ric.assign.status") !== "not_assigned")
    need("ric.assign.assigneeName", "Assignee name");
  return missing;
}
