import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import {
  ArrowRight,
  BadgeDollarSign,
  BriefcaseBusiness,
  Calculator,
  CalendarDays,
  FileCheck2,
  MapPin,
  MoreHorizontal,
  MoreVertical,
  Plus,
  ShieldCheck,
  Sparkles,
  UserRound,
  UsersRound,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LeadForm } from "@/components/LeadForm";
import { siteSettingsQuery } from "@/lib/queries";
import { useAuth } from "@/hooks/useAuth";

import { monthlyPayment } from "@/lib/format";

export const Route = createFileRoute("/finance")({
  head: () => ({
    meta: [
      {
        title: "Used Car Financing in Fredericksburg, VA | My Car",
      },
      {
        name: "description",
        content:
          "Explore used car financing in Fredericksburg, VA with My Car. Complete our secure finance application, estimate your payment and review available financing options.",
      },
      {
        property: "og:title",
        content: "Used Car Financing in Fredericksburg, VA | My Car",
      },
      {
        property: "og:description",
        content:
          "Explore used car financing in Fredericksburg, VA with My Car. Complete our secure finance application, estimate your payment and review available financing options.",
      },
      {
        property: "og:url",
        content: "https://mycarcorp.com/finance",
      },
      {
        property: "og:type",
        content: "website",
      },
    ],
    links: [
      {
        rel: "canonical",
        href: "https://mycarcorp.com/finance",
      },
    ],
  }),
  component: FinancePage,
});

type AddressState = {
  street: string;
  unit: string;
  city: string;
  state: string;
  zip: string;
  county: string;
  countyCode: string;
  addressType: string;
  rentMortgage: string;
  lengthMode: "duration" | "date";
  lengthYears: string;
  lengthMonths: string;
  moveInDate: string;
};

type EmployerState = {
  name: string;
  occupation: string;
  phone: string;
  employmentStatus: string;
  incomeType: string;
  monthlyIncome: string;
  lengthMode: "duration" | "date";
  lengthYears: string;
  lengthMonths: string;
  startDate: string;
  street: string;
  unit: string;
  city: string;
  state: string;
  zip: string;
  county: string;
};

type ReferenceState = {
  id: number;
  name: string;
  phone: string;
  relationship: string;
  address: string;
  street: string;
  street2: string;
  city: string;
  state: string;
  zip: string;
  county: string;
  countyCode: string;
};

const emptyAddress: AddressState = {
  street: "",
  unit: "",
  city: "",
  state: "",
  zip: "",
  county: "",
  countyCode: "",
  addressType: "",
  rentMortgage: "",
  lengthMode: "duration",
  lengthYears: "",
  lengthMonths: "0 months",
  moveInDate: "",
};

const emptyEmployer: EmployerState = {
  name: "",
  occupation: "",
  phone: "",
  employmentStatus: "",
  incomeType: "",
  monthlyIncome: "",
  lengthMode: "duration",
  lengthYears: "",
  lengthMonths: "0 months",
  startDate: "",
  street: "",
  unit: "",
  city: "",
  state: "",
  zip: "",
  county: "",
};

const US_STATES = [
  ["AL", "Alabama"],
  ["AK", "Alaska"],
  ["AZ", "Arizona"],
  ["AR", "Arkansas"],
  ["CA", "California"],
  ["CO", "Colorado"],
  ["CT", "Connecticut"],
  ["DC", "District of Columbia"],
  ["DE", "Delaware"],
  ["FL", "Florida"],
  ["GA", "Georgia"],
  ["HI", "Hawaii"],
  ["ID", "Idaho"],
  ["IL", "Illinois"],
  ["IN", "Indiana"],
  ["IA", "Iowa"],
  ["KS", "Kansas"],
  ["KY", "Kentucky"],
  ["LA", "Louisiana"],
  ["ME", "Maine"],
  ["MD", "Maryland"],
  ["MA", "Massachusetts"],
  ["MI", "Michigan"],
  ["MN", "Minnesota"],
  ["MS", "Mississippi"],
  ["MO", "Missouri"],
  ["MT", "Montana"],
  ["NE", "Nebraska"],
  ["NV", "Nevada"],
  ["NH", "New Hampshire"],
  ["NJ", "New Jersey"],
  ["NM", "New Mexico"],
  ["NY", "New York"],
  ["NC", "North Carolina"],
  ["ND", "North Dakota"],
  ["OH", "Ohio"],
  ["OK", "Oklahoma"],
  ["OR", "Oregon"],
  ["PA", "Pennsylvania"],
  ["RI", "Rhode Island"],
  ["SC", "South Carolina"],
  ["SD", "South Dakota"],
  ["TN", "Tennessee"],
  ["TX", "Texas"],
  ["UT", "Utah"],
  ["VT", "Vermont"],
  ["VA", "Virginia"],
  ["WA", "Washington"],
  ["WV", "West Virginia"],
  ["WI", "Wisconsin"],
  ["WY", "Wyoming"],
] as const;

const OCCUPATIONS = [
  "Child Support",
  "Clerk",
  "Collector",
  "Construction",
  "Customer Service",
  "Data Entry",
  "Daycare",
  "Disability",
  "Dispatcher",
  "Driver",
  "Emergency Service",
  "Entertainer",
  "Food Service",
  "Foreman",
  "General Job",
  "Hairstylist / Barber",
  "Housekeeper",
  "Installer",
  "Instructor",
  "Janitor",
  "Laborer",
  "Lifeguard",
  "Machine Operator",
  "Management",
  "Mechanic",
  "Medical",
  "Military",
  "Non-Listed",
  "Office",
  "MGR",
  "Other",
  "Plumber",
  "Professional",
  "Public Service",
  "Receptionist",
  "Retirees",
  "Ride Share",
  "Sales",
  "Security",
  "Self-Employed",
  "Semi-Professional",
  "Social Security",
  "Student",
  "Supervisor",
  "Teacher",
  "Unemployed",
  "Union",
  "Waiter / Waitress",
];

const EMPLOYMENT_STATUSES = [
  "Employed - Full-Time",
  "Employed - Part-Time",
  "Temporary / Seasonal",
  "Active Military",
  "SSI / Retired",
  "Self-Employed",
  "Unemployed",
  "Other",
];

const INCOME_TYPES = [
  "W-2",
  "Self-Employed",
  "TurboPass",
  "Fixed Income",
  "Cash Income",
  "Military",
  "Self-Employed Business",
];

const RELATIONSHIPS = [
  "Other",
  "Aunt",
  "Brother",
  "Brother-in-Law",
  "Co-Buyer",
  "Cousin",
  "Daughter",
  "Daughter-in-Law",
  "Father",
  "Father-in-Law",
  "Fiancé",
  "Friend",
  "Grandparent",
  "Mother",
  "Mother-in-Law",
  "Neighbor",
  "Nephew",
  "Niece",
  "Roommate",
  "Sister",
  "Son",
  "Spouse",
];

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, month) => `${month} ${month === 1 ? "month" : "months"}`);

function digitsOnly(value: string, maxLength: number) {
  return value.replace(/\D/g, "").slice(0, maxLength);
}

function formatSsn(value: string) {
  const digits = digitsOnly(value, 9);
  if (digits.length <= 3) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
}

function formatPhone(value: string) {
  const digits = digitsOnly(value, 10);
  if (digits.length <= 3) return digits.length ? `(${digits}` : "";
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function formatZip(value: string) {
  const digits = digitsOnly(value, 9);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

function normalizeMoney(value: string) {
  const cleaned = value.replace(/[^\d.]/g, "");
  const [whole = "", ...decimalParts] = cleaned.split(".");
  return decimalParts.length ? `${whole}.${decimalParts.join("").slice(0, 2)}` : whole;
}

function moneyOnBlur(value: string) {
  if (!value) return "";
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toFixed(2) : "";
}

function FinancePage() {
  const { data: settings } = useQuery(siteSettingsQuery());
  const { user } = useAuth();
  const [activeStep, setActiveStep] = useState("applicant");

  const [buyerName, setBuyerName] = useState("");
  const [showBuyerNameDetails, setShowBuyerNameDetails] = useState(false);
  const [salutation, setSalutation] = useState("");
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [suffix, setSuffix] = useState("");
  const [nickName, setNickName] = useState("");
  const [gender, setGender] = useState("");
  const [cashDown, setCashDown] = useState("");
  const [ssn, setSsn] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [cellPhone, setCellPhone] = useState("");
  const [homePhone, setHomePhone] = useState("");
  const [workPhone, setWorkPhone] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [idType, setIdType] = useState("");
  const [idState, setIdState] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [issuedDate, setIssuedDate] = useState("");
  const [expirationDate, setExpirationDate] = useState("");

  const [currentAddress, setCurrentAddress] = useState<AddressState>({ ...emptyAddress });
  const [mailingAddress, setMailingAddress] = useState<AddressState>({ ...emptyAddress });
  const [sameAsCurrent, setSameAsCurrent] = useState(true);
  const [showPreviousAddress, setShowPreviousAddress] = useState(false);
  const [previousAddress, setPreviousAddress] = useState<AddressState>({ ...emptyAddress });

  const [currentEmployer1, setCurrentEmployer1] = useState<EmployerState>({ ...emptyEmployer });
  const [showCurrentEmployer2, setShowCurrentEmployer2] = useState(false);
  const [currentEmployer2, setCurrentEmployer2] = useState<EmployerState>({ ...emptyEmployer });
  const [showPreviousEmployer, setShowPreviousEmployer] = useState(false);
  const [previousEmployer, setPreviousEmployer] = useState<EmployerState>({ ...emptyEmployer });
  const [showPreviousEmployer2, setShowPreviousEmployer2] = useState(false);
  const [previousEmployer2, setPreviousEmployer2] = useState<EmployerState>({ ...emptyEmployer });

  const [otherIncomeAmount, setOtherIncomeAmount] = useState("");
  const [otherIncomeSource, setOtherIncomeSource] = useState("");
  const [references, setReferences] = useState<ReferenceState[]>([
    {
      id: 1,
      name: "",
      phone: "",
      relationship: "",
      address: "",
      street: "",
      street2: "",
      city: "",
      state: "",
      zip: "",
      county: "",
      countyCode: "",
    },
  ]);
  const [expandedReferenceAddresses, setExpandedReferenceAddresses] = useState<number[]>([]);
  const leadFormScopeRef = useRef<HTMLDivElement>(null);

  const [price, setPrice] = useState(22000);
  const [down, setDown] = useState(2000);
  const [term, setTerm] = useState(72);
  const [defaultsApplied, setDefaultsApplied] = useState(false);

  const apr = Number(settings?.finance_apr ?? 8.9);
  const estimate = monthlyPayment(price * 100, {
    apr,
    termMonths: term,
    downPercent: price > 0 ? (down / price) * 100 : 0,
  });

  // Estimator defaults come from the dealership settings stored in the database.
  useEffect(() => {
    if (defaultsApplied || !settings) return;
    const months = Number(settings.finance_term_months ?? 0);
    const downPercent = Number(settings.finance_down_percent ?? 0);
    if (months > 0) setTerm(months);
    if (downPercent > 0) setDown(Math.round((22000 * downPercent) / 100));
    setDefaultsApplied(true);
  }, [settings, defaultsApplied]);

  // Prefill the applicant's contact details for a signed-in shopper.
  useEffect(() => {
    if (!user) return;
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const metaName = String(meta["full_name"] ?? "").trim();
    const metaPhone = String(meta["phone"] ?? "").trim();
    setBuyerEmail((current) => current || (user.email ?? ""));
    if (metaName) setBuyerName((current) => current || metaName);
    if (metaPhone) setCellPhone((current) => current || digitsOnly(metaPhone, 10));
  }, [user]);

  useEffect(() => {
    const scope = leadFormScopeRef.current;
    if (!scope) return;

    const hiddenFields = [
      { label: "Full name", value: buyerName },
      { label: "Email", value: buyerEmail },
      { label: "Phone", value: formatPhone(cellPhone) },
      { label: "Anything else we should know?", value: "" },
    ];

    hiddenFields.forEach(({ label, value }) => {
      const labelElement = Array.from(scope.querySelectorAll("label"))
        .filter((element) => element.textContent?.trim().toLowerCase() === label.toLowerCase())
        .at(-1);
      if (!labelElement) return;

      const fieldId = labelElement.getAttribute("for");
      const field = fieldId
        ? scope.querySelector<HTMLInputElement | HTMLTextAreaElement>(`#${CSS.escape(fieldId)}`)
        : labelElement.parentElement?.querySelector<HTMLInputElement | HTMLTextAreaElement>("input, textarea");

      if (field && field.value !== value) {
        const prototype =
          field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
        setter?.call(field, value);
        field.dispatchEvent(new Event("input", { bubbles: true }));
        field.dispatchEvent(new Event("change", { bubbles: true }));
      }

      const wrapper = labelElement.parentElement;
      if (wrapper) wrapper.style.display = "none";
    });

    Array.from(scope.querySelectorAll<HTMLElement>("p, small")).forEach((element) => {
      const text = element.textContent?.replace(/\s+/g, " ").trim().toLowerCase();
      if (text?.startsWith("by submitting you agree to be contacted by my car business services llc")) {
        element.style.display = "none";
      }
    });

    const generatedSubmitButton = Array.from(scope.querySelectorAll<HTMLButtonElement>('button[type="submit"]')).find(
      (button) => !button.hasAttribute("data-finance-submit"),
    );

    if (generatedSubmitButton) generatedSubmitButton.style.display = "none";
  }, [buyerName, buyerEmail, cellPhone, activeStep]);

  function addReference() {
    setReferences((current) => [
      ...current,
      {
        id: Math.max(0, ...current.map((reference) => reference.id)) + 1,
        name: "",
        phone: "",
        relationship: "",
        address: "",
        street: "",
        street2: "",
        city: "",
        state: "",
        zip: "",
        county: "",
        countyCode: "",
      },
    ]);
  }

  function updateReference(id: number, field: keyof Omit<ReferenceState, "id">, value: string) {
    setReferences((current) =>
      current.map((reference) => (reference.id === id ? { ...reference, [field]: value } : reference)),
    );
  }

  function updateReferenceAddressField(
    id: number,
    field: "street" | "street2" | "city" | "state" | "zip" | "county" | "countyCode",
    value: string,
  ) {
    setReferences((current) =>
      current.map((reference) => {
        if (reference.id !== id) return reference;
        const next = { ...reference, [field]: value };
        const locality = [next.city, next.state, formatZip(next.zip)].filter(Boolean).join(", ");
        const county = [next.county, next.countyCode].filter(Boolean).join(" ");
        const address = [next.street, next.street2, locality, county]
          .map((part) => part.trim())
          .filter(Boolean)
          .join(", ");
        return { ...next, address };
      }),
    );
  }

  function removeReference(id: number) {
    setReferences((current) => current.filter((reference) => reference.id !== id));
    setExpandedReferenceAddresses((current) => current.filter((referenceId) => referenceId !== id));
  }

  function updateBuyerNameParts(parts: {
    salutation?: string;
    firstName?: string;
    middleName?: string;
    lastName?: string;
    suffix?: string;
    nickName?: string;
  }) {
    const nextSalutation = parts.salutation ?? salutation;
    const nextFirstName = parts.firstName ?? firstName;
    const nextMiddleName = parts.middleName ?? middleName;
    const nextLastName = parts.lastName ?? lastName;
    const nextSuffix = parts.suffix ?? suffix;
    const nextNickName = parts.nickName ?? nickName;

    const legalName = [nextSalutation, nextFirstName, nextMiddleName, nextLastName, nextSuffix]
      .map((part) => part.trim())
      .filter(Boolean)
      .join(" ");

    setBuyerName(nextNickName.trim() ? `${legalName}${legalName ? " " : ""}(${nextNickName.trim()})` : legalName);
  }

  const scrollToApplication = () => {
    document.getElementById("finance-application")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* HERO */}
      <section
        className="relative isolate overflow-hidden bg-slate-950 bg-cover bg-center"
        style={{
          backgroundImage:
            'linear-gradient(90deg, rgba(3,12,22,0.95) 0%, rgba(3,12,22,0.84) 48%, rgba(3,12,22,0.48) 100%), url("https://images.unsplash.com/photo-1493238792000-8113da705763?auto=format&fit=crop&w=2000&q=88")',
        }}
      >
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_82%_42%,rgba(255,255,255,0.14),transparent_32%)]" />

        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-12 lg:py-28">
          <div className="max-w-3xl">
            <p className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/90 backdrop-blur-sm">
              Financing at My Car
            </p>

            <h1 className="mt-5 font-display text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Used Car Financing in Fredericksburg, VA
            </h1>

            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-200 sm:text-lg">
              Explore financing options for your next used vehicle with My Car. Estimate a monthly payment, learn how
              the process works and complete your finance application when you&apos;re ready.
            </p>

            <button
              type="button"
              onClick={scrollToApplication}
              className="mt-8 inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#F7941D] px-6 py-3 text-sm font-bold text-slate-950 shadow-[0_12px_30px_rgba(247,148,29,0.28)] transition hover:bg-[#ea8718] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              Start My Finance Application
              <ArrowRight className="size-4" />
            </button>
          </div>
        </div>
      </section>

      {/* WHY FINANCE WITH MY CAR */}
      <section className="bg-white py-14 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-12">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Financing Made Clear</p>

            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
              Why Finance With My Car?
            </h2>

            <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">
              Get the information you need in one place before you submit an application for your next vehicle.
            </p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Calculator className="size-6" />
              </div>
              <h3 className="mt-5 font-display text-xl font-bold text-slate-950">Estimate Your Payment</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Adjust vehicle price, down payment and term to see an estimated monthly payment before you apply.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <FileCheck2 className="size-6" />
              </div>
              <h3 className="mt-5 font-display text-xl font-bold text-slate-950">One Online Application</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Complete your applicant, address, employment and reference information through one organized form.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <ShieldCheck className="size-6" />
              </div>
              <h3 className="mt-5 font-display text-xl font-bold text-slate-950">A Clear Next Step</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                After submission, our finance team reviews the information you provide and contacts you about next
                steps.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* THREE STEP PROCESS */}
      <section className="border-y border-slate-200 bg-slate-50 py-14 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-12">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">How It Works</p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-slate-950">
              Financing in three simple steps
            </h2>
          </div>

          <div className="mt-10 grid gap-8 md:grid-cols-3">
            <div className="text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
                1
              </div>
              <h3 className="mt-4 font-display text-lg font-bold text-slate-950">Estimate Your Budget</h3>
              <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-slate-600">
                Use the payment estimator below to explore a vehicle price, down payment and loan term.
              </p>
            </div>

            <div className="text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
                2
              </div>
              <h3 className="mt-4 font-display text-lg font-bold text-slate-950">Complete the Application</h3>
              <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-slate-600">
                Provide the applicant, address, employment and reference information requested in the form.
              </p>
            </div>

            <div className="text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
                3
              </div>
              <h3 className="mt-4 font-display text-lg font-bold text-slate-950">Review the Next Steps</h3>
              <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-slate-600">
                Our finance team reviews your submission and contacts you to discuss available next steps.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* PAYMENT ESTIMATOR */}
      <section className="bg-white py-14 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-12">
          <div className="grid overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:grid-cols-[0.92fr_1.08fr]">
            <div className="bg-slate-950 p-6 text-white sm:p-8 lg:p-10">
              <div className="flex size-12 items-center justify-center rounded-xl bg-white/10 text-[#F7941D]">
                <BadgeDollarSign className="size-6" />
              </div>

              <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-[#F7941D]">Payment Estimator</p>

              <h2 className="mt-3 font-display text-3xl font-bold tracking-tight">Plan a payment before you apply</h2>

              <p className="mt-3 max-w-lg text-sm leading-6 text-slate-300">
                Change the vehicle price, down payment and loan term to explore an estimated monthly payment.
              </p>

              <div className="mt-8 rounded-xl border border-white/10 bg-white/5 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Estimated Monthly Payment
                </p>
                <p className="mt-2 font-display text-4xl font-extrabold text-white">${estimate}/mo</p>
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  Based on {apr}% APR. {settings?.finance_disclosure}
                </p>
              </div>
            </div>

            <div className="p-6 sm:p-8 lg:p-10">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="landing-price" className="text-sm font-semibold text-slate-800">
                    Vehicle Price
                  </label>
                  <div className="relative mt-2">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                      $
                    </span>
                    <Input
                      id="landing-price"
                      type="number"
                      min="0"
                      value={String(price)}
                      onChange={(event) => setPrice(Number(event.target.value))}
                      className="h-11 pl-7"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="landing-down" className="text-sm font-semibold text-slate-800">
                    Down Payment
                  </label>
                  <div className="relative mt-2">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                      $
                    </span>
                    <Input
                      id="landing-down"
                      type="number"
                      min="0"
                      value={String(down)}
                      onChange={(event) => setDown(Number(event.target.value))}
                      className="h-11 pl-7"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="landing-term" className="text-sm font-semibold text-slate-800">
                    Loan Term
                  </Label>
                  <Select value={String(term)} onValueChange={(value) => setTerm(Number(value))}>
                    <SelectTrigger id="landing-term" className="mt-2 h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[36, 48, 60, 72, 84].map((months) => (
                        <SelectItem key={months} value={String(months)}>
                          {months} months
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="mt-7 rounded-xl bg-slate-50 p-4 text-xs leading-5 text-slate-500">
                This calculator provides an estimate only. Actual financing terms, rates and payments may vary based on
                the financing source, vehicle, applicant information and other applicable factors.
              </div>

              <button
                type="button"
                onClick={scrollToApplication}
                className="mt-6 inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#071b33] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#0b2a4d]"
              >
                Start My Finance Application
                <ArrowRight className="size-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* FINANCING FAQ */}
      <section className="border-y border-slate-200 bg-slate-50 py-14 sm:py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-12">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Financing Information</p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-slate-950">
              Frequently asked questions
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Review a few common questions before starting the finance application.
            </p>
          </div>

          <div className="mx-auto mt-9 max-w-3xl space-y-3">
            <details className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <summary className="cursor-pointer list-none font-semibold text-slate-950">
                What information should I have ready?
              </summary>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                The application requests applicant contact information, current and previous address details, employment
                and income information, identification details and references.
              </p>
            </details>

            <details className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <summary className="cursor-pointer list-none font-semibold text-slate-950">
                Does submitting the application guarantee approval?
              </summary>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                No. Submitting an application allows the information you provide to be reviewed. Approval and final
                financing terms depend on the applicable financing source and its requirements.
              </p>
            </details>

            <details className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <summary className="cursor-pointer list-none font-semibold text-slate-950">
                Is the payment estimator my final payment?
              </summary>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                No. The payment estimator is for planning purposes only. Actual rates, terms, down payment requirements
                and monthly payments may differ.
              </p>
            </details>

            <details className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <summary className="cursor-pointer list-none font-semibold text-slate-950">
                What happens after I submit?
              </summary>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                My Car&apos;s finance team will review the information submitted and contact you about the next steps
                and any additional information that may be needed.
              </p>
            </details>
          </div>
        </div>
      </section>

      {/* FINANCE APPLICATION */}
      <section id="finance-application" className="scroll-mt-20 bg-slate-50/70 py-14 sm:py-16">
        <div className="mx-auto w-full max-w-[1180px] px-4 sm:px-6">
          <div className="mx-auto mb-9 max-w-3xl text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="size-6" />
            </div>
            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-primary">Ready to Apply?</p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
              Finance Application
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">
              Complete each section below with accurate information. Our finance team will review your submission and
              contact you about the next steps.
            </p>
          </div>

          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_290px]">
            <div className="overflow-visible rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div ref={leadFormScopeRef}>
                <LeadForm
                  leadType="finance"
                  submitLabel="Submit"
                  successTitle="Financing application received"
                  successBody="Our finance manager will review your information and contact you about the next steps."
                  messageLabel="Anything else we should know?"
                  collectDetails={() => ({
                    buyer: buyerName,
                    salutation,
                    first_name: firstName,
                    middle_name: middleName,
                    last_name: lastName,
                    suffix,
                    nick_name: nickName,
                    gender,
                    cash_down: cashDown,
                    ssn,
                    date_of_birth: dateOfBirth,
                    cell_phone: cellPhone,
                    home_phone: homePhone,
                    work_phone: workPhone,
                    buyer_email: buyerEmail,
                    id_type: idType,
                    id_state: idState,
                    id_number: idNumber,
                    issued_date: issuedDate,
                    expiration_date: expirationDate,
                    current_address: JSON.stringify(currentAddress),
                    mailing_address: JSON.stringify(sameAsCurrent ? currentAddress : mailingAddress),
                    mailing_same_as_current: sameAsCurrent,
                    previous_address: showPreviousAddress ? JSON.stringify(previousAddress) : "",
                    current_employer_1: JSON.stringify(currentEmployer1),
                    current_employer_2: showCurrentEmployer2 ? JSON.stringify(currentEmployer2) : "",
                    previous_employer_1: showPreviousEmployer ? JSON.stringify(previousEmployer) : "",
                    previous_employer_2: showPreviousEmployer2 ? JSON.stringify(previousEmployer2) : "",
                    other_income_amount: otherIncomeAmount,
                    other_income_source: otherIncomeSource,
                    references: JSON.stringify(references),
                    vehicle_price: price,
                    down_payment: down,
                    loan_term: term,
                    apr,
                    estimated_payment: estimate,
                  })}
                >
                  <Tabs value={activeStep} onValueChange={setActiveStep} className="w-full">
                    <div className="border-b border-slate-200 px-3 pt-3 sm:px-5 sm:pt-5">
                      <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 lg:grid-cols-4">
                        <TabsTrigger value="applicant" className="gap-2 rounded-lg py-2.5 text-xs sm:text-sm">
                          <UserRound className="size-4" /> Applicant
                        </TabsTrigger>
                        <TabsTrigger value="address" className="gap-2 rounded-lg py-2.5 text-xs sm:text-sm">
                          <MapPin className="size-4" /> Address
                        </TabsTrigger>
                        <TabsTrigger value="employment" className="gap-2 rounded-lg py-2.5 text-xs sm:text-sm">
                          <BriefcaseBusiness className="size-4" /> Employment
                        </TabsTrigger>
                        <TabsTrigger value="references" className="gap-2 rounded-lg py-2.5 text-xs sm:text-sm">
                          <UsersRound className="size-4" /> References
                        </TabsTrigger>
                      </TabsList>
                      <div className="flex items-center justify-between py-3 text-xs text-slate-500">
                        <span>
                          Step{" "}
                          {activeStep === "applicant"
                            ? 1
                            : activeStep === "address"
                              ? 2
                              : activeStep === "employment"
                                ? 3
                                : 4}{" "}
                          of 4
                        </span>
                        <span className="hidden sm:inline">Use the tabs to review each section.</span>
                      </div>
                    </div>

                    <div className="p-3 sm:p-5">
                      <TabsContent value="applicant" className="m-0 focus-visible:outline-none">
                        <FormSection title="Buyer Info">
                          <div className="grid gap-x-3 gap-y-2 sm:grid-cols-2 lg:grid-cols-5">
                            <div className="sm:col-span-2 lg:col-span-2">
                              <Label htmlFor="buyer-name" className="text-[11px] font-medium text-slate-700">
                                Buyer
                              </Label>
                              <div className="relative mt-1">
                                <Input
                                  id="buyer-name"
                                  value={buyerName}
                                  onChange={(event) => setBuyerName(event.target.value)}
                                  autoComplete="name"
                                  placeholder="Enter buyer's full name"
                                  className="h-8 rounded-sm border-slate-300 bg-white pr-8 text-xs focus-visible:ring-1"
                                />
                                <button
                                  type="button"
                                  aria-label="Open detailed buyer name fields"
                                  aria-expanded={showBuyerNameDetails}
                                  className="absolute right-0.5 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-sm text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-700"
                                  onClick={() => setShowBuyerNameDetails((current) => !current)}
                                >
                                  <MoreVertical className="size-3.5" />
                                </button>
                                {showBuyerNameDetails && (
                                  <div className="absolute left-0 top-full z-50 mt-1 grid w-[620px] max-w-[calc(100vw-3rem)] gap-x-3 gap-y-2 border border-slate-300 bg-white p-3 shadow-xl sm:grid-cols-2 lg:grid-cols-3">
                                    <ComboField
                                      id="salutation"
                                      label="Salutation"
                                      value={salutation}
                                      options={["Mr.", "Mrs.", "Ms.", "Miss", "Dr."]}
                                      onChange={(value) => {
                                        setSalutation(value);
                                        updateBuyerNameParts({ salutation: value });
                                      }}
                                    />
                                    <TextField
                                      id="first-name"
                                      label="First Name"
                                      value={firstName}
                                      onChange={(value) => {
                                        setFirstName(value);
                                        updateBuyerNameParts({ firstName: value });
                                      }}
                                    />
                                    <TextField
                                      id="middle-name"
                                      label="Middle Name"
                                      value={middleName}
                                      onChange={(value) => {
                                        setMiddleName(value);
                                        updateBuyerNameParts({ middleName: value });
                                      }}
                                    />
                                    <TextField
                                      id="last-name"
                                      label="Last Name"
                                      value={lastName}
                                      onChange={(value) => {
                                        setLastName(value);
                                        updateBuyerNameParts({ lastName: value });
                                      }}
                                    />
                                    <ComboField
                                      id="suffix"
                                      label="Suffix"
                                      value={suffix}
                                      options={["Jr.", "Sr.", "II", "III", "IV", "V"]}
                                      onChange={(value) => {
                                        setSuffix(value);
                                        updateBuyerNameParts({ suffix: value });
                                      }}
                                    />
                                    <TextField
                                      id="nick-name"
                                      label="Nick Name"
                                      value={nickName}
                                      onChange={(value) => {
                                        setNickName(value);
                                        updateBuyerNameParts({ nickName: value });
                                      }}
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                            <SelectField
                              label="Gender"
                              value={gender}
                              onChange={setGender}
                              placeholder="Select gender"
                              options={[
                                ["female", "Female"],
                                ["male", "Male"],
                                ["non-binary", "Non-binary"],
                                ["prefer-not-to-say", "Prefer not to say"],
                              ]}
                            />
                            <CurrencyField
                              id="cash-down"
                              label="Cash Down"
                              value={cashDown}
                              onChange={setCashDown}
                              placeholder="$2,000"
                            />
                            <TextField
                              id="ssn"
                              label="SSN"
                              inputMode="numeric"
                              autoComplete="off"
                              maxLength={11}
                              value={formatSsn(ssn)}
                              onChange={(value) => setSsn(digitsOnly(value, 9))}
                              placeholder="000-00-0000"
                            />
                            <TextField
                              id="date-of-birth"
                              label="Date of Birth"
                              type="date"
                              value={dateOfBirth}
                              onChange={setDateOfBirth}
                            />
                            <TextField
                              id="cell-phone"
                              label="Cell Phone"
                              type="tel"
                              autoComplete="tel"
                              maxLength={14}
                              value={formatPhone(cellPhone)}
                              onChange={(value) => setCellPhone(digitsOnly(value, 10))}
                            />
                            <TextField
                              id="home-phone"
                              label="Home Phone"
                              type="tel"
                              maxLength={14}
                              value={formatPhone(homePhone)}
                              onChange={(value) => setHomePhone(digitsOnly(value, 10))}
                            />
                            <TextField
                              id="work-phone"
                              label="Work Phone"
                              type="tel"
                              maxLength={14}
                              value={formatPhone(workPhone)}
                              onChange={(value) => setWorkPhone(digitsOnly(value, 10))}
                            />
                            <TextField
                              id="buyer-email"
                              label="Email"
                              type="email"
                              autoComplete="email"
                              value={buyerEmail}
                              onChange={setBuyerEmail}
                            />
                            <SelectField
                              label="ID Type"
                              value={idType}
                              onChange={setIdType}
                              placeholder="Select ID type"
                              options={[
                                ["us-drivers-license", "US Driver's Licence"],
                                ["us-passport", "US Passport"],
                                ["us-id-card", "US ID Card"],
                                ["foreign-id", "Foreign DL/ID/Passport"],
                              ]}
                            />
                            <SelectField
                              label="ID State"
                              value={idState}
                              onChange={setIdState}
                              placeholder="Select state"
                              options={US_STATES.map(([abbreviation]) => [abbreviation, abbreviation])}
                            />
                            <TextField id="id-number" label="ID No." value={idNumber} onChange={setIdNumber} />
                            <TextField
                              id="issued-date"
                              label="Issued Date"
                              type="date"
                              value={issuedDate}
                              onChange={setIssuedDate}
                            />
                            <TextField
                              id="expiration-date"
                              label="Expiration Date"
                              type="date"
                              value={expirationDate}
                              onChange={setExpirationDate}
                            />
                          </div>
                        </FormSection>
                        <StepActions onNext={() => setActiveStep("address")} />
                      </TabsContent>

                      <TabsContent value="address" className="m-0 focus-visible:outline-none">
                        <FormSection title="Address">
                          <Subsection title="Current Address">
                            <AddressFields
                              idPrefix="current-address"
                              value={currentAddress}
                              onChange={setCurrentAddress}
                              showHousingDetails
                            />
                          </Subsection>

                          <Subsection title="Mailing Address">
                            <label className="mb-4 flex cursor-pointer items-center gap-2 text-sm font-medium">
                              <input
                                type="checkbox"
                                checked={sameAsCurrent}
                                onChange={(event) => setSameAsCurrent(event.target.checked)}
                                className="size-4 rounded border-border accent-primary"
                              />
                              Same as Current Address
                            </label>
                            <AddressFields
                              idPrefix="mailing-address"
                              value={sameAsCurrent ? currentAddress : mailingAddress}
                              onChange={setMailingAddress}
                              disabled={sameAsCurrent}
                              showCountyCode
                            />
                          </Subsection>

                          {showPreviousAddress ? (
                            <Subsection
                              title="Previous Address"
                              action={
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                  onClick={() => {
                                    setShowPreviousAddress(false);
                                    setPreviousAddress({ ...emptyAddress });
                                  }}
                                >
                                  <Trash2 className="size-4" />
                                  Remove
                                </Button>
                              }
                            >
                              <AddressFields
                                idPrefix="previous-address"
                                value={previousAddress}
                                onChange={setPreviousAddress}
                                showHousingDetails
                                showCountyCode
                              />
                            </Subsection>
                          ) : (
                            <Button type="button" variant="outline" onClick={() => setShowPreviousAddress(true)}>
                              <Plus className="size-4" />
                              Add Previous Address
                            </Button>
                          )}
                        </FormSection>
                        <StepActions
                          onBack={() => setActiveStep("applicant")}
                          onNext={() => setActiveStep("employment")}
                        />
                      </TabsContent>

                      <TabsContent value="employment" className="m-0 space-y-4 focus-visible:outline-none">
                        <FormSection title="Employment">
                          <Subsection title="Current Employer">
                            <EmployerFields
                              idPrefix="current-employer-1"
                              value={currentEmployer1}
                              onChange={setCurrentEmployer1}
                              employerNameLabel="Current Employer Name"
                            />
                          </Subsection>

                          {showCurrentEmployer2 && (
                            <Subsection
                              title="Current Employer 2"
                              action={
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                  onClick={() => {
                                    setShowCurrentEmployer2(false);
                                    setCurrentEmployer2({ ...emptyEmployer });
                                  }}
                                >
                                  <Trash2 className="size-4" />
                                  Remove
                                </Button>
                              }
                            >
                              <EmployerFields
                                idPrefix="current-employer-2"
                                value={currentEmployer2}
                                onChange={setCurrentEmployer2}
                                employerNameLabel="Current Employer Name"
                              />
                            </Subsection>
                          )}

                          {showPreviousEmployer && (
                            <Subsection
                              title="Previous Employer 1"
                              action={
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                  onClick={() => {
                                    if (showPreviousEmployer2) {
                                      setPreviousEmployer(previousEmployer2);
                                      setPreviousEmployer2({ ...emptyEmployer });
                                      setShowPreviousEmployer2(false);
                                    } else {
                                      setShowPreviousEmployer(false);
                                      setPreviousEmployer({ ...emptyEmployer });
                                    }
                                  }}
                                >
                                  <Trash2 className="size-4" />
                                  Remove
                                </Button>
                              }
                            >
                              <EmployerFields
                                idPrefix="previous-employer-1"
                                value={previousEmployer}
                                onChange={setPreviousEmployer}
                                employerNameLabel="Previous Employer Name"
                              />
                            </Subsection>
                          )}

                          {showPreviousEmployer2 && (
                            <Subsection
                              title="Previous Employer 2"
                              action={
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                  onClick={() => {
                                    setShowPreviousEmployer2(false);
                                    setPreviousEmployer2({ ...emptyEmployer });
                                  }}
                                >
                                  <Trash2 className="size-4" />
                                  Remove
                                </Button>
                              }
                            >
                              <EmployerFields
                                idPrefix="previous-employer-2"
                                value={previousEmployer2}
                                onChange={setPreviousEmployer2}
                                employerNameLabel="Previous Employer Name"
                              />
                            </Subsection>
                          )}

                          <div className="flex flex-wrap gap-3">
                            {!showCurrentEmployer2 && (
                              <Button type="button" variant="outline" onClick={() => setShowCurrentEmployer2(true)}>
                                <Plus className="size-4" />
                                Add Current Employer
                              </Button>
                            )}
                            {(!showPreviousEmployer || !showPreviousEmployer2) && (
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                  if (!showPreviousEmployer) setShowPreviousEmployer(true);
                                  else setShowPreviousEmployer2(true);
                                }}
                              >
                                <Plus className="size-4" />
                                Add Previous Employer
                              </Button>
                            )}
                          </div>
                        </FormSection>

                        <FormSection title="Other Income">
                          <div className="grid gap-x-3 gap-y-2 sm:grid-cols-2 lg:grid-cols-5">
                            <CurrencyField
                              id="other-income-amount"
                              label="Income Amount"
                              value={otherIncomeAmount}
                              onChange={setOtherIncomeAmount}
                            />
                            <TextField
                              id="other-income-source"
                              label="Income Source"
                              value={otherIncomeSource}
                              onChange={setOtherIncomeSource}
                            />
                          </div>
                        </FormSection>
                        <StepActions
                          onBack={() => setActiveStep("address")}
                          onNext={() => setActiveStep("references")}
                        />
                      </TabsContent>

                      <TabsContent value="references" className="m-0 focus-visible:outline-none">
                        <FormSection title="Reference">
                          <div className="space-y-2">
                            {references.map((reference, index) => (
                              <Subsection
                                key={reference.id}
                                title={`Reference ${index + 1}`}
                                action={
                                  references.length > 1 ? (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                      onClick={() => removeReference(reference.id)}
                                    >
                                      <Trash2 className="size-4" />
                                      Remove
                                    </Button>
                                  ) : undefined
                                }
                              >
                                <div className="grid gap-x-3 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
                                  <TextField
                                    id={`reference-${reference.id}-name`}
                                    label="Name"
                                    value={reference.name}
                                    onChange={(value) => updateReference(reference.id, "name", value)}
                                  />
                                  <TextField
                                    id={`reference-${reference.id}-phone`}
                                    label="Phone"
                                    type="tel"
                                    inputMode="numeric"
                                    maxLength={14}
                                    value={formatPhone(reference.phone)}
                                    onChange={(value) => updateReference(reference.id, "phone", digitsOnly(value, 10))}
                                  />
                                  <ComboField
                                    id={`reference-${reference.id}-relationship`}
                                    label="Relationship"
                                    value={reference.relationship}
                                    onChange={(value) => updateReference(reference.id, "relationship", value)}
                                    options={RELATIONSHIPS}
                                  />
                                  <div className="sm:col-span-2">
                                    <Label htmlFor={`reference-${reference.id}-address`}>Address</Label>
                                    <div className="mt-2 flex gap-2">
                                      <Input
                                        id={`reference-${reference.id}-address`}
                                        value={reference.address}
                                        onChange={(event) =>
                                          updateReference(reference.id, "address", event.target.value)
                                        }
                                        placeholder="Type the full address"
                                      />
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        aria-label="Open detailed reference address fields"
                                        aria-expanded={expandedReferenceAddresses.includes(reference.id)}
                                        onClick={() =>
                                          setExpandedReferenceAddresses((current) =>
                                            current.includes(reference.id)
                                              ? current.filter((id) => id !== reference.id)
                                              : [...current, reference.id],
                                          )
                                        }
                                      >
                                        <MoreHorizontal className="size-4" />
                                      </Button>
                                    </div>
                                  </div>

                                  {expandedReferenceAddresses.includes(reference.id) && (
                                    <div className="grid gap-x-3 gap-y-2 border border-slate-300 bg-slate-50 p-3 sm:col-span-2 lg:col-span-4 sm:grid-cols-2 lg:grid-cols-4">
                                      <div className="sm:col-span-2">
                                        <TextField
                                          id={`reference-${reference.id}-street`}
                                          label="Street"
                                          value={reference.street}
                                          onChange={(value) =>
                                            updateReferenceAddressField(reference.id, "street", value)
                                          }
                                        />
                                      </div>
                                      <TextField
                                        id={`reference-${reference.id}-street-2`}
                                        label="Street 2 (Apt, Unit, Suite, Bldg.)"
                                        value={reference.street2}
                                        onChange={(value) =>
                                          updateReferenceAddressField(reference.id, "street2", value)
                                        }
                                      />
                                      <TextField
                                        id={`reference-${reference.id}-city`}
                                        label="City"
                                        value={reference.city}
                                        onChange={(value) => updateReferenceAddressField(reference.id, "city", value)}
                                      />
                                      <SelectField
                                        label="State"
                                        value={reference.state}
                                        onChange={(value) => updateReferenceAddressField(reference.id, "state", value)}
                                        placeholder="Select state"
                                        options={US_STATES.map(([abbreviation, name]) => [abbreviation, name])}
                                      />
                                      <TextField
                                        id={`reference-${reference.id}-zip`}
                                        label="Zip"
                                        inputMode="numeric"
                                        maxLength={10}
                                        value={formatZip(reference.zip)}
                                        onChange={(value) =>
                                          updateReferenceAddressField(reference.id, "zip", digitsOnly(value, 9))
                                        }
                                      />
                                      <TextField
                                        id={`reference-${reference.id}-county`}
                                        label="County"
                                        value={reference.county}
                                        onChange={(value) => updateReferenceAddressField(reference.id, "county", value)}
                                      />
                                      <TextField
                                        id={`reference-${reference.id}-county-code`}
                                        label="County Code"
                                        value={reference.countyCode}
                                        onChange={(value) =>
                                          updateReferenceAddressField(reference.id, "countyCode", value)
                                        }
                                      />
                                    </div>
                                  )}
                                </div>
                              </Subsection>
                            ))}
                          </div>
                          <Button type="button" variant="outline" onClick={addReference}>
                            <Plus className="size-4" />
                            Add More Reference
                          </Button>
                        </FormSection>
                        <div className="mt-5 flex items-center justify-between">
                          <Button type="button" variant="ghost" onClick={() => setActiveStep("employment")}>
                            Back
                          </Button>
                          <Button
                            type="submit"
                            data-finance-submit
                            className="bg-amber-400 font-semibold text-slate-950 hover:bg-amber-500"
                          >
                            Submit
                          </Button>
                        </div>
                      </TabsContent>
                    </div>
                  </Tabs>
                </LeadForm>
              </div>
            </div>

            <aside className="space-y-4 xl:sticky xl:top-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 text-xs leading-5 text-slate-500 shadow-sm">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-5 text-primary" />
                  <h3 className="text-sm font-semibold text-slate-900">Before you begin</h3>
                </div>
                <p className="mt-3">
                  Have your contact, address, employment and income information ready so you can complete the
                  application in one sitting.
                </p>
                <ol className="mt-4 list-decimal space-y-2 pl-4">
                  <li>Complete each application section.</li>
                  <li>Review the information you provide before submitting.</li>
                  <li>Our finance team will contact you about the next steps.</li>
                </ol>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-950 p-5 text-xs leading-5 text-slate-300 shadow-sm">
                <h3 className="text-sm font-semibold text-white">Questions before applying?</h3>
                <p className="mt-2">
                  You can review the payment estimate and financing information above before starting the application.
                </p>
                {settings?.phone && (
                  <a
                    href={`tel:${String(settings.phone).replace(/\D/g, "")}`}
                    className="mt-4 inline-flex font-semibold text-[#F7941D] hover:underline"
                  >
                    Call {settings.phone}
                  </a>
                )}
              </div>
            </aside>
          </div>
        </div>
      </section>
    </div>
  );
}
function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="relative overflow-visible rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3 sm:px-5">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {description && <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>}
      </div>
      <div className="space-y-4 p-4 sm:p-5">{children}</div>
    </section>
  );
}

function StepActions({ onBack, onNext }: { onBack?: () => void; onNext: () => void }) {
  return (
    <div className={`mt-5 flex items-center ${onBack ? "justify-between" : "justify-end"}`}>
      {onBack && (
        <Button type="button" variant="ghost" onClick={onBack}>
          Back
        </Button>
      )}
      <Button type="button" onClick={onNext} className="bg-[#071b33] font-semibold text-white hover:bg-[#0b2a4d]">
        Continue
      </Button>
    </div>
  );
}

function Subsection({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-slate-300 bg-white">
      <div className="flex min-h-8 flex-wrap items-center justify-between gap-2 border-b border-slate-300 bg-slate-50 px-3 py-1">
        <h3 className="text-[11px] font-semibold text-slate-800">{title}</h3>
        {action}
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  type = "text",
  ...inputProps
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
} & Omit<React.ComponentProps<typeof Input>, "id" | "value" | "onChange" | "type">) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-[10px] font-medium leading-none text-slate-700">
        {label}
      </Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        {...inputProps}
        className={`h-8 rounded-sm border-slate-300 bg-white px-2 text-xs focus-visible:ring-1 ${inputProps.className ?? ""}`}
      />
    </div>
  );
}

function ComboField({
  id,
  label,
  value,
  onChange,
  options,
  placeholder = "Type or select",
  disabled = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  placeholder?: string;
  disabled?: boolean;
}) {
  const listId = `${id}-options`;
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-[10px] font-medium leading-none text-slate-700">
        {label}
      </Label>
      <Input
        id={id}
        list={listId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        disabled={disabled}
        className="h-8 rounded-sm border-slate-300 bg-white px-2 text-xs focus-visible:ring-1"
      />
      <datalist id={listId}>
        {options.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
    </div>
  );
}

function CurrencyField({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-[10px] font-medium leading-none text-slate-700">
        {label}
      </Label>
      <div className="relative">
        <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-500">$</span>
        <Input
          id={id}
          inputMode="decimal"
          value={value}
          onChange={(event) => onChange(normalizeMoney(event.target.value))}
          onBlur={() => onChange(moneyOnBlur(value))}
          placeholder={placeholder}
          className="h-8 rounded-sm border-slate-300 bg-white pl-5 text-xs focus-visible:ring-1"
        />
      </div>
    </div>
  );
}

function DurationField({
  idPrefix,
  label,
  mode,
  years,
  months,
  date,
  onModeChange,
  onYearsChange,
  onMonthsChange,
  onDateChange,
  disabled = false,
}: {
  idPrefix: string;
  label: string;
  mode: "duration" | "date";
  years: string;
  months: string;
  date: string;
  onModeChange: (mode: "duration" | "date") => void;
  onYearsChange: (value: string) => void;
  onMonthsChange: (value: string) => void;
  onDateChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1 lg:col-span-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-[10px] font-medium leading-none text-slate-700">{label}</Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={() => onModeChange(mode === "duration" ? "date" : "duration")}
          className="h-6 px-2 text-[10px] text-cyan-800"
        >
          <CalendarDays className="size-3" />
          {mode === "duration" ? "Use start month" : "Use duration"}
        </Button>
      </div>
      {mode === "date" ? (
        <Input
          id={`${idPrefix}-date`}
          type="month"
          value={date}
          onChange={(event) => onDateChange(event.target.value)}
          disabled={disabled}
          className="h-8 rounded-sm border-slate-300 bg-white px-2 text-xs focus-visible:ring-1"
        />
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor={`${idPrefix}-years`} className="text-[10px] font-medium leading-none text-slate-700">
              Years
            </Label>
            <Input
              id={`${idPrefix}-years`}
              type="number"
              min="0"
              value={years}
              onChange={(event) => onYearsChange(event.target.value)}
              placeholder="0"
              disabled={disabled}
              className="h-8 rounded-sm border-slate-300 bg-white px-2 text-xs focus-visible:ring-1"
            />
          </div>
          <ComboField
            id={`${idPrefix}-months`}
            label="Months"
            value={months}
            onChange={onMonthsChange}
            options={MONTH_OPTIONS}
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder = "Select an option",
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[][];
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] font-medium leading-none text-slate-700">{label}</Label>
      <Select value={value} onValueChange={onChange} disabled={disabled ?? false}>
        <SelectTrigger className="h-8 rounded-sm border-slate-300 bg-white px-2 text-xs focus:ring-1">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map(([optionValue, optionLabel]) => (
            <SelectItem key={optionValue ?? ""} value={optionValue ?? ""}>
              {optionLabel}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function AddressFields({
  idPrefix,
  value,
  onChange,
  showHousingDetails = false,
  showCountyCode = false,
  disabled = false,
}: {
  idPrefix: string;
  value: AddressState;
  onChange: Dispatch<SetStateAction<AddressState>>;
  showHousingDetails?: boolean;
  showCountyCode?: boolean;
  disabled?: boolean;
}) {
  const setField = <K extends keyof AddressState>(field: K, nextValue: AddressState[K]) =>
    onChange((current) => ({ ...current, [field]: nextValue }));

  return (
    <div className="grid gap-x-3 gap-y-2 sm:grid-cols-2 lg:grid-cols-5">
      <div className="sm:col-span-2">
        <TextField
          id={`${idPrefix}-street`}
          label="Street"
          autoComplete="street-address"
          value={value.street}
          onChange={(next) => setField("street", next)}
          disabled={disabled}
        />
      </div>
      <TextField
        id={`${idPrefix}-unit`}
        label="Apt / Unit / Suite / Bldg."
        value={value.unit}
        onChange={(next) => setField("unit", next)}
        disabled={disabled}
      />
      <TextField
        id={`${idPrefix}-city`}
        label="City"
        value={value.city}
        onChange={(next) => setField("city", next)}
        disabled={disabled}
      />
      <SelectField
        label="State"
        value={value.state}
        onChange={(next) => setField("state", next)}
        placeholder="Select state"
        options={US_STATES.map(([abbreviation, name]) => [abbreviation, name])}
        disabled={disabled}
      />
      <TextField
        id={`${idPrefix}-zip`}
        label="Zip"
        inputMode="numeric"
        maxLength={10}
        value={formatZip(value.zip)}
        onChange={(next) => setField("zip", digitsOnly(next, 9))}
        disabled={disabled}
      />
      <TextField
        id={`${idPrefix}-county`}
        label="County"
        value={value.county}
        onChange={(next) => setField("county", next)}
        disabled={disabled}
      />
      {showCountyCode && (
        <TextField
          id={`${idPrefix}-county-code`}
          label="County Code"
          value={value.countyCode}
          onChange={(next) => setField("countyCode", next)}
          disabled={disabled}
        />
      )}

      {showHousingDetails && (
        <>
          <SelectField
            label="Address Type"
            value={value.addressType}
            onChange={(next) => setField("addressType", next)}
            disabled={disabled}
            options={[
              ["rent", "Rent"],
              ["own", "Own"],
              ["other", "Other"],
              ["mortgage", "Mortgage"],
              ["family", "Family"],
              ["military", "Military"],
            ]}
          />
          <CurrencyField
            id={`${idPrefix}-rent-mortgage`}
            label="Rent / Mort. Amt"
            value={value.rentMortgage}
            onChange={(next) => setField("rentMortgage", next)}
          />
          <DurationField
            idPrefix={`${idPrefix}-length`}
            label="Length at Address"
            mode={value.lengthMode}
            years={value.lengthYears}
            months={value.lengthMonths}
            date={value.moveInDate}
            onModeChange={(next) => setField("lengthMode", next)}
            onYearsChange={(next) => setField("lengthYears", next)}
            onMonthsChange={(next) => setField("lengthMonths", next)}
            onDateChange={(next) => setField("moveInDate", next)}
            disabled={disabled}
          />
        </>
      )}
    </div>
  );
}

function EmployerFields({
  idPrefix,
  value,
  onChange,
  employerNameLabel,
}: {
  idPrefix: string;
  value: EmployerState;
  onChange: Dispatch<SetStateAction<EmployerState>>;
  employerNameLabel: string;
}) {
  const setField = <K extends keyof EmployerState>(field: K, nextValue: EmployerState[K]) =>
    onChange((current) => ({ ...current, [field]: nextValue }));

  return (
    <div className="grid gap-x-3 gap-y-2 sm:grid-cols-2 lg:grid-cols-5">
      <TextField
        id={`${idPrefix}-name`}
        label={employerNameLabel}
        value={value.name}
        onChange={(next) => setField("name", next)}
      />
      <ComboField
        id={`${idPrefix}-occupation`}
        label="Occupation"
        value={value.occupation}
        onChange={(next) => setField("occupation", next)}
        options={OCCUPATIONS}
      />
      <TextField
        id={`${idPrefix}-phone`}
        label="Phone"
        type="tel"
        inputMode="numeric"
        maxLength={14}
        value={formatPhone(value.phone)}
        onChange={(next) => setField("phone", digitsOnly(next, 10))}
      />
      <ComboField
        id={`${idPrefix}-employment-status`}
        label="Employment Status"
        value={value.employmentStatus}
        onChange={(next) => setField("employmentStatus", next)}
        options={EMPLOYMENT_STATUSES}
      />
      <ComboField
        id={`${idPrefix}-income-type`}
        label="Income Type"
        value={value.incomeType}
        onChange={(next) => setField("incomeType", next)}
        options={INCOME_TYPES}
      />
      <CurrencyField
        id={`${idPrefix}-monthly-income`}
        label="Monthly Income"
        value={value.monthlyIncome}
        onChange={(next) => setField("monthlyIncome", next)}
      />
      <DurationField
        idPrefix={`${idPrefix}-length`}
        label="Length at Job"
        mode={value.lengthMode}
        years={value.lengthYears}
        months={value.lengthMonths}
        date={value.startDate}
        onModeChange={(next) => setField("lengthMode", next)}
        onYearsChange={(next) => setField("lengthYears", next)}
        onMonthsChange={(next) => setField("lengthMonths", next)}
        onDateChange={(next) => setField("startDate", next)}
      />
      <div className="sm:col-span-2">
        <TextField
          id={`${idPrefix}-street`}
          label="Street"
          value={value.street}
          onChange={(next) => setField("street", next)}
        />
      </div>
      <TextField
        id={`${idPrefix}-unit`}
        label="Apt / Unit / Suite / Bldg."
        value={value.unit}
        onChange={(next) => setField("unit", next)}
      />
      <TextField id={`${idPrefix}-city`} label="City" value={value.city} onChange={(next) => setField("city", next)} />
      <SelectField
        label="State"
        value={value.state}
        onChange={(next) => setField("state", next)}
        placeholder="Select state"
        options={US_STATES.map(([abbreviation, name]) => [abbreviation, name])}
      />
      <TextField
        id={`${idPrefix}-zip`}
        label="Zip"
        inputMode="numeric"
        maxLength={10}
        value={formatZip(value.zip)}
        onChange={(next) => setField("zip", digitsOnly(next, 9))}
      />
      <TextField
        id={`${idPrefix}-county`}
        label="County"
        value={value.county}
        onChange={(next) => setField("county", next)}
      />
    </div>
  );
}
