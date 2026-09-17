import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, type Dispatch, type SetStateAction } from "react";
import { CalendarDays, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LeadForm } from "@/components/LeadForm";
import { siteSettingsQuery } from "@/lib/queries";
import { monthlyPayment } from "@/lib/format";

export const Route = createFileRoute("/finance")({
  head: () => ({
    meta: [
      { title: "Car Financing in Fredericksburg, VA — MyCar" },
      {
        name: "description",
        content:
          "Submit your vehicle financing information to MyCar in Fredericksburg, VA and let our finance team help you review available options.",
      },
      { property: "og:title", content: "Car Financing — MyCar Fredericksburg" },
      {
        property: "og:description",
        content: "Complete your financing information and let our finance team help with the next steps.",
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
  "Employed Full-Time",
  "Employed Part-Time",
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

  const [desired, setDesired] = useState("");
  const [interest, setInterest] = useState("");
  const [price, setPrice] = useState(22000);
  const [down, setDown] = useState(2000);
  const [term, setTerm] = useState(72);

  const apr = Number(settings?.finance_apr ?? 8.9);
  const estimate = monthlyPayment(price * 100, {
    apr,
    termMonths: term,
    downPercent: price > 0 ? (down / price) * 100 : 0,
  });

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

  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      <h1 className="font-display text-4xl font-bold">Financing Application</h1>
      <p className="mt-3 max-w-3xl text-muted-foreground">
        Complete the information below so our finance team can review your request and contact you about available next
        steps.
      </p>

      <div className="mt-10 grid items-start gap-10 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
          <LeadForm
            leadType="finance"
            submitLabel="Submit financing application"
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
              other_income_amount: otherIncomeAmount,
              other_income_source: otherIncomeSource,
              references: JSON.stringify(references),
              desired_payment: desired,
              vehicle_of_interest: interest,
              vehicle_price: price,
              down_payment: down,
              loan_term: term,
              apr,
            })}
          >
            <div className="space-y-8">
              <FormSection title="Buyer Info" description="Personal and identification information for the applicant.">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="sm:col-span-2 lg:col-span-3">
                    <Label htmlFor="buyer-name">Buyer</Label>
                    <div className="mt-2 flex gap-2">
                      <Input
                        id="buyer-name"
                        value={buyerName}
                        onChange={(event) => setBuyerName(event.target.value)}
                        autoComplete="name"
                        placeholder="Enter buyer's full name"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        aria-label="Open detailed buyer name fields"
                        aria-expanded={showBuyerNameDetails}
                        className="h-10 w-14 shrink-0 text-lg font-bold tracking-widest"
                        onClick={() => setShowBuyerNameDetails((current) => !current)}
                      >
                        •••
                      </Button>
                    </div>
                    {showBuyerNameDetails && (
                      <div className="mt-3 grid gap-4 rounded-lg border border-border bg-muted/30 p-4 sm:grid-cols-2 lg:grid-cols-3">
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
                    />
                  </Subsection>
                ) : (
                  <Button type="button" variant="outline" onClick={() => setShowPreviousAddress(true)}>
                    <Plus className="size-4" />
                    Add Previous Address
                  </Button>
                )}
              </FormSection>

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
                          setShowPreviousEmployer(false);
                          setPreviousEmployer({ ...emptyEmployer });
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

                <div className="flex flex-wrap gap-3">
                  {!showCurrentEmployer2 && (
                    <Button type="button" variant="outline" onClick={() => setShowCurrentEmployer2(true)}>
                      <Plus className="size-4" />
                      Add Current Employer
                    </Button>
                  )}
                  {!showPreviousEmployer && (
                    <Button type="button" variant="outline" onClick={() => setShowPreviousEmployer(true)}>
                      <Plus className="size-4" />
                      Add Previous Employer
                    </Button>
                  )}
                </div>
              </FormSection>

              <FormSection title="Other Income">
                <div className="grid gap-4 sm:grid-cols-2">
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

              <FormSection title="Reference">
                <div className="space-y-4">
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
                      <div className="grid gap-4 sm:grid-cols-2">
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
                              onChange={(event) => updateReference(reference.id, "address", event.target.value)}
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
                          <div className="grid gap-4 rounded-lg border border-border bg-muted/30 p-4 sm:col-span-2 sm:grid-cols-2 lg:grid-cols-3">
                            <div className="sm:col-span-2">
                              <TextField
                                id={`reference-${reference.id}-street`}
                                label="Street"
                                value={reference.street}
                                onChange={(value) => updateReference(reference.id, "street", value)}
                              />
                            </div>
                            <TextField
                              id={`reference-${reference.id}-street-2`}
                              label="Street 2 (Apt, Unit, Suite, Bldg.)"
                              value={reference.street2}
                              onChange={(value) => updateReference(reference.id, "street2", value)}
                            />
                            <TextField
                              id={`reference-${reference.id}-city`}
                              label="City"
                              value={reference.city}
                              onChange={(value) => updateReference(reference.id, "city", value)}
                            />
                            <SelectField
                              label="State"
                              value={reference.state}
                              onChange={(value) => updateReference(reference.id, "state", value)}
                              placeholder="Select state"
                              options={US_STATES.map(([abbreviation, name]) => [abbreviation, name])}
                            />
                            <TextField
                              id={`reference-${reference.id}-zip`}
                              label="Zip"
                              inputMode="numeric"
                              maxLength={10}
                              value={formatZip(reference.zip)}
                              onChange={(value) => updateReference(reference.id, "zip", digitsOnly(value, 9))}
                            />
                            <TextField
                              id={`reference-${reference.id}-county`}
                              label="County"
                              value={reference.county}
                              onChange={(value) => updateReference(reference.id, "county", value)}
                            />
                            <TextField
                              id={`reference-${reference.id}-county-code`}
                              label="County Code"
                              value={reference.countyCode}
                              onChange={(value) => updateReference(reference.id, "countyCode", value)}
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

              <FormSection title="Financing Preferences">
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField
                    id="desired"
                    label="Target Monthly Payment"
                    value={desired}
                    onChange={setDesired}
                    placeholder="$450"
                  />
                  <TextField
                    id="interest"
                    label="Vehicle of Interest"
                    value={interest}
                    onChange={setInterest}
                    placeholder="Stock # or model"
                  />
                </div>
              </FormSection>
            </div>
          </LeadForm>
        </div>

        <aside className="space-y-6 xl:sticky xl:top-6">
          <div className="rounded-xl border border-border bg-surface p-6">
            <h2 className="font-display text-lg font-bold">Payment Estimator</h2>
            <div className="mt-4 space-y-4">
              <TextField
                id="price"
                label="Vehicle Price"
                type="number"
                min="0"
                value={String(price)}
                onChange={(value) => setPrice(Number(value))}
              />
              <TextField
                id="down"
                label="Down Payment"
                type="number"
                min="0"
                value={String(down)}
                onChange={(value) => setDown(Number(value))}
              />
              <SelectField
                label="Term"
                value={String(term)}
                onChange={(value) => setTerm(Number(value))}
                options={[36, 48, 60, 72, 84].map((months) => [String(months), `${months} months`])}
              />
            </div>
            <p className="mt-5 font-display text-3xl font-extrabold text-primary">${estimate}/mo</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Based on {apr}% APR. {settings?.finance_disclosure}
            </p>
          </div>

          <div className="rounded-xl border border-border p-6 text-sm text-muted-foreground">
            <h3 className="font-semibold text-foreground">What Happens Next</h3>
            <ol className="mt-3 list-decimal space-y-2 pl-4">
              <li>We securely review the information you submitted.</li>
              <li>Our finance manager contacts you to confirm details and explain next steps.</li>
              <li>Any lender authorization or credit-pull consent is handled separately when required.</li>
            </ol>
          </div>
        </aside>
      </div>
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
    <section className="space-y-5 rounded-xl border border-border bg-background p-4 sm:p-5">
      <div>
        <h2 className="font-display text-xl font-bold text-foreground">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
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
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-foreground">{title}</h3>
        {action}
      </div>
      {children}
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
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} {...inputProps} />
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
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        list={listId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        disabled={disabled}
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
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
          $
        </span>
        <Input
          id={id}
          inputMode="decimal"
          value={value}
          onChange={(event) => onChange(normalizeMoney(event.target.value))}
          onBlur={() => onChange(moneyOnBlur(value))}
          placeholder={placeholder}
          className="pl-7"
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
    <div className="space-y-2 lg:col-span-2">
      <div className="flex items-center justify-between gap-2">
        <Label>{label}</Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={() => onModeChange(mode === "duration" ? "date" : "duration")}
        >
          <CalendarDays className="size-4" />
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
        />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-years`} className="text-xs text-muted-foreground">
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
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map(([optionValue, optionLabel]) => (
            <SelectItem key={optionValue} value={optionValue}>
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
  disabled = false,
}: {
  idPrefix: string;
  value: AddressState;
  onChange: Dispatch<SetStateAction<AddressState>>;
  showHousingDetails?: boolean;
  disabled?: boolean;
}) {
  const setField = <K extends keyof AddressState>(field: K, nextValue: AddressState[K]) =>
    onChange((current) => ({ ...current, [field]: nextValue }));

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
          <TextField
            id={`${idPrefix}-rent-mortgage`}
            label="Rent / Mort. Amt"
            type="number"
            min="0"
            step="0.01"
            value={value.rentMortgage}
            onChange={(next) => setField("rentMortgage", next)}
            disabled={disabled}
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
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
