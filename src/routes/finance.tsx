import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, type Dispatch, type SetStateAction } from "react";
import { Plus, Trash2 } from "lucide-react";
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
  lengthAtAddress: string;
};

type EmployerState = {
  name: string;
  occupation: string;
  phone: string;
  employmentStatus: string;
  incomeType: string;
  monthlyIncome: string;
  lengthAtJob: string;
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
  lengthAtAddress: "",
};

const emptyEmployer: EmployerState = {
  name: "",
  occupation: "",
  phone: "",
  employmentStatus: "",
  incomeType: "",
  monthlyIncome: "",
  lengthAtJob: "",
  street: "",
  unit: "",
  city: "",
  state: "",
  zip: "",
  county: "",
};

function FinancePage() {
  const { data: settings } = useQuery(siteSettingsQuery());

  const [buyerType, setBuyerType] = useState("primary-buyer");
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
    { id: 1, name: "", phone: "", relationship: "", address: "" },
  ]);

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
              buyer: buyerType,
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
                  <SelectField
                    label="Buyer"
                    value={buyerType}
                    onChange={setBuyerType}
                    options={[
                      ["primary-buyer", "Primary buyer"],
                      ["co-buyer", "Co-buyer"],
                    ]}
                  />
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
                  <TextField
                    id="cash-down"
                    label="Cash Down"
                    type="number"
                    min="0"
                    step="0.01"
                    value={cashDown}
                    onChange={setCashDown}
                    placeholder="$2,000"
                  />
                  <TextField
                    id="ssn"
                    label="SSN"
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={11}
                    value={ssn}
                    onChange={setSsn}
                    placeholder="XXX-XX-XXXX"
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
                    value={cellPhone}
                    onChange={setCellPhone}
                  />
                  <TextField id="home-phone" label="Home Phone" type="tel" value={homePhone} onChange={setHomePhone} />
                  <TextField id="work-phone" label="Work Phone" type="tel" value={workPhone} onChange={setWorkPhone} />
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
                      ["drivers-license", "Driver's license"],
                      ["state-id", "State ID"],
                      ["passport", "Passport"],
                      ["military-id", "Military ID"],
                      ["other", "Other"],
                    ]}
                  />
                  <TextField
                    id="id-state"
                    label="ID State"
                    value={idState}
                    onChange={setIdState}
                    maxLength={2}
                    placeholder="VA"
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
                  <TextField
                    id="other-income-amount"
                    label="Income Amount"
                    type="number"
                    min="0"
                    step="0.01"
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
                          value={reference.phone}
                          onChange={(value) => updateReference(reference.id, "phone", value)}
                        />
                        <TextField
                          id={`reference-${reference.id}-relationship`}
                          label="Relationship"
                          value={reference.relationship}
                          onChange={(value) => updateReference(reference.id, "relationship", value)}
                        />
                        <TextField
                          id={`reference-${reference.id}-address`}
                          label="Address"
                          value={reference.address}
                          onChange={(value) => updateReference(reference.id, "address", value)}
                        />
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
  const setField = (field: keyof AddressState, nextValue: string) =>
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
      <TextField
        id={`${idPrefix}-state`}
        label="State"
        value={value.state}
        onChange={(next) => setField("state", next)}
        maxLength={2}
        placeholder="VA"
        disabled={disabled}
      />
      <TextField
        id={`${idPrefix}-zip`}
        label="Zip"
        inputMode="numeric"
        value={value.zip}
        onChange={(next) => setField("zip", next)}
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
              ["own", "Own"],
              ["rent", "Rent"],
              ["family", "Living with family"],
              ["other", "Other"],
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
          <TextField
            id={`${idPrefix}-length`}
            label="Length at Address"
            value={value.lengthAtAddress}
            onChange={(next) => setField("lengthAtAddress", next)}
            placeholder="2 years, 3 months"
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
  const setField = (field: keyof EmployerState, nextValue: string) =>
    onChange((current) => ({ ...current, [field]: nextValue }));

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <TextField
        id={`${idPrefix}-name`}
        label={employerNameLabel}
        value={value.name}
        onChange={(next) => setField("name", next)}
      />
      <TextField
        id={`${idPrefix}-occupation`}
        label="Occupation"
        value={value.occupation}
        onChange={(next) => setField("occupation", next)}
      />
      <TextField
        id={`${idPrefix}-phone`}
        label="Phone"
        type="tel"
        value={value.phone}
        onChange={(next) => setField("phone", next)}
      />
      <SelectField
        label="Employment Status"
        value={value.employmentStatus}
        onChange={(next) => setField("employmentStatus", next)}
        options={[
          ["full-time", "Full-time"],
          ["part-time", "Part-time"],
          ["self-employed", "Self-employed"],
          ["retired", "Retired"],
          ["military", "Active military"],
          ["seasonal", "Seasonal"],
          ["other", "Other"],
        ]}
      />
      <SelectField
        label="Income Type"
        value={value.incomeType}
        onChange={(next) => setField("incomeType", next)}
        options={[
          ["salary", "Salary"],
          ["hourly", "Hourly"],
          ["commission", "Commission"],
          ["self-employment", "Self-employment"],
          ["retirement", "Retirement"],
          ["other", "Other"],
        ]}
      />
      <TextField
        id={`${idPrefix}-monthly-income`}
        label="Monthly Income"
        type="number"
        min="0"
        step="0.01"
        value={value.monthlyIncome}
        onChange={(next) => setField("monthlyIncome", next)}
      />
      <TextField
        id={`${idPrefix}-length`}
        label="Length at Job"
        value={value.lengthAtJob}
        onChange={(next) => setField("lengthAtJob", next)}
        placeholder="2 years, 3 months"
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
      <TextField
        id={`${idPrefix}-state`}
        label="State"
        value={value.state}
        onChange={(next) => setField("state", next)}
        maxLength={2}
        placeholder="VA"
      />
      <TextField
        id={`${idPrefix}-zip`}
        label="Zip"
        inputMode="numeric"
        value={value.zip}
        onChange={(next) => setField("zip", next)}
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
