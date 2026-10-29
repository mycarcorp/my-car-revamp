/**
 * Exact money handling in integer cents. Contract amounts are never added as
 * floating-point dollars, so totals like 0.1 + 0.2 can't drift.
 */

/** Parses "$12,499.00", "12499", "0.5" into integer cents; null for blank or invalid. */
export function parseCents(input: string): number | null {
  const s = input.replace(/[$,\s]/g, "");
  const match = /^(-)?(\d{1,9})(?:\.(\d{0,2}))?$/.exec(s);
  if (!match) return null;
  const whole = Number(match[2]);
  const fraction = Number((match[3] ?? "").padEnd(2, "0"));
  const cents = whole * 100 + fraction;
  return match[1] ? -cents : cents;
}

/** 1249900 → "12,499.00"; negative amounts as "-1,000.00". */
export function formatCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.trunc(cents));
  const whole = Math.floor(abs / 100).toLocaleString("en-US");
  return `${sign}${whole}.${String(abs % 100).padStart(2, "0")}`;
}

/** Sum of the present amounts; null when none are present. */
export function sumCents(values: ReadonlyArray<number | null>): number | null {
  const present = values.filter((v): v is number => v !== null);
  return present.length ? present.reduce((a, b) => a + b, 0) : null;
}
