export function formatUsd(cents: number | null | undefined, opts?: { cents?: boolean }) {
  if (cents == null) return "Call for price";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: opts?.cents ? 2 : 0,
    maximumFractionDigits: opts?.cents ? 2 : 0,
  }).format(Number(cents) / 100);
}

export function formatMiles(miles: number | null | undefined) {
  if (miles == null) return "—";
  return `${new Intl.NumberFormat("en-US").format(miles)} mi`;
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export type FinanceAssumptions = {
  apr: number;
  termMonths: number;
  downPercent: number;
};

/** Standard amortized monthly payment, returned in whole dollars. */
export function monthlyPayment(priceCents: number, a: FinanceAssumptions) {
  const principal = (Number(priceCents) / 100) * (1 - a.downPercent / 100);
  const r = a.apr / 100 / 12;
  if (principal <= 0) return 0;
  if (r === 0) return Math.round(principal / a.termMonths);
  const p = (principal * r) / (1 - Math.pow(1 + r, -a.termMonths));
  return Math.round(p);
}

export function vehicleTitle(v: {
  year: number;
  make: string;
  model: string;
  trim?: string | null;
}) {
  return [v.year, v.make, v.model, v.trim].filter(Boolean).join(" ");
}
