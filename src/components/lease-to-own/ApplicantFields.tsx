import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  EMPLOYMENT_STATUSES,
  HOUSING_TYPES,
  LICENSE_REQUIRED,
  employmentNeedsEmployer,
  formatPhoneInput,
  type ApplicantErrors,
  type ApplicantField,
  type ApplicantProfile,
  type ApplicantRole,
} from "@/lib/lease-to-own";
import { FormSection, SelectField, StateField, TextField } from "./FormFields";
import { SecureSsnField } from "./SecureSsnField";
import { applicantFieldId } from "./helpers";

const EMPLOYMENT_OPTIONS = EMPLOYMENT_STATUSES.map((s) => ({ value: s.value, label: s.value }));

/**
 * Personal, residential and employment fields for one applicant. The Buyer and
 * the Co-Buyer each render their own copy with their own values and errors;
 * nothing here is shared or copied between them.
 */
export function ApplicantFields({
  role,
  value,
  errors,
  onChange,
  onBlurField,
  secureCollection,
}: {
  role: ApplicantRole;
  value: ApplicantProfile;
  errors: ApplicantErrors;
  onChange: (patch: Partial<ApplicantProfile>) => void;
  onBlurField: (field: ApplicantField) => void;
  secureCollection: boolean;
}) {
  const id = (field: string) => applicantFieldId(role, field);
  /** Common props for a text field bound to one applicant property. */
  const bind = (field: ApplicantField) => ({
    id: id(field),
    value: value[field],
    onChange: (next: string) => onChange({ [field]: next }),
    onBlur: () => onBlurField(field),
    error: errors[field],
  });
  const select = (field: ApplicantField) => ({
    id: id(field),
    value: value[field],
    onChange: (next: string) => onChange({ [field]: next }),
    error: errors[field],
  });
  const phone = (field: ApplicantField) => ({
    ...bind(field),
    value: formatPhoneInput(value[field]),
    type: "tel",
    inputMode: "tel" as const,
  });
  const money = (field: ApplicantField) => ({
    ...bind(field),
    inputMode: "decimal" as const,
    placeholder: "0.00",
    autoComplete: "off",
  });
  const hasEmployer = !value.employmentStatus || employmentNeedsEmployer(value.employmentStatus);

  return (
    <div className="space-y-8">
      <FormSection title="Personal Information">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            {...bind("firstName")}
            label="First Name"
            required
            autoComplete={role === "buyer" ? "given-name" : "off"}
          />
          <TextField
            {...bind("lastName")}
            label="Last Name"
            required
            autoComplete={role === "buyer" ? "family-name" : "off"}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField
            {...bind("email")}
            label="Email Address"
            required
            type="email"
            autoComplete={role === "buyer" ? "email" : "off"}
          />
          <TextField
            {...phone("cellPhone")}
            label="Cell Phone Number"
            required
            autoComplete={role === "buyer" ? "tel-national" : "off"}
          />
          <TextField
            {...phone("homePhone")}
            label="Home Phone Number (optional)"
            autoComplete="off"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            {...bind("dateOfBirth")}
            label="Date of Birth"
            required
            type="date"
            autoComplete={role === "buyer" ? "bday" : "off"}
          />
          <SecureSsnField id={id("ssn")} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            {...bind("driversLicenseNumber")}
            onChange={(next) => onChange({ driversLicenseNumber: next.toUpperCase() })}
            label="Driver's License Number"
            required={LICENSE_REQUIRED}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={24}
            inputClassName="font-mono"
            hint={
              secureCollection
                ? "As printed on the license. Encrypted before it's stored; staff see only the last 4."
                : "As printed on the license. Not saved until secure collection is configured."
            }
          />
          <StateField
            {...select("driversLicenseState")}
            label="Driver's License Issuing State"
            required={LICENSE_REQUIRED}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            {...bind("driversLicenseIssueDate")}
            label="Driver's License Issue Date"
            type="date"
            autoComplete="off"
          />
          <TextField
            {...bind("driversLicenseExpiryDate")}
            label="Driver's License Expiration Date"
            type="date"
            autoComplete="off"
          />
        </div>
      </FormSection>

      <FormSection title="Residential Information">
        <div className="grid gap-4 sm:grid-cols-[3fr_1fr]">
          <TextField
            {...bind("street")}
            label="Street Address"
            required
            autoComplete={role === "buyer" ? "address-line1" : "off"}
          />
          <TextField
            {...bind("unit")}
            label="Apt / Unit (optional)"
            autoComplete={role === "buyer" ? "address-line2" : "off"}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr]">
          <TextField
            {...bind("city")}
            label="City"
            required
            autoComplete={role === "buyer" ? "address-level2" : "off"}
          />
          <StateField {...select("state")} label="State" required />
          <TextField
            {...bind("zip")}
            label="ZIP Code"
            required
            inputMode="numeric"
            maxLength={10}
            autoComplete={role === "buyer" ? "postal-code" : "off"}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            {...select("housingType")}
            label="Housing Type"
            required
            options={HOUSING_TYPES}
          />
          <TextField
            {...money("monthlyHousingPayment")}
            label="Monthly Rent / Mortgage Amount"
            required
          />
        </div>
        <ToggleRow
          id={id("hasPreviousAddress")}
          checked={value.hasPreviousAddress}
          onChange={(checked) => onChange({ hasPreviousAddress: checked })}
          label="Add previous address"
        />
        {value.hasPreviousAddress && (
          <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-4">
            <TextField
              {...bind("previousStreet")}
              label="Previous Street Address"
              required
              autoComplete="off"
            />
            <div className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr]">
              <TextField {...bind("previousCity")} label="City" required autoComplete="off" />
              <StateField {...select("previousState")} label="State" required />
              <TextField
                {...bind("previousZip")}
                label="ZIP Code"
                required
                inputMode="numeric"
                maxLength={10}
                autoComplete="off"
              />
            </div>
          </div>
        )}
      </FormSection>

      <FormSection title="Employment Information">
        <SelectField
          {...select("employmentStatus")}
          label="Employment Status"
          required
          options={EMPLOYMENT_OPTIONS}
          className="sm:max-w-sm"
        />
        {hasEmployer ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                {...bind("employerName")}
                label={
                  value.employmentStatus === "Self-Employed" ? "Business Name" : "Employer Name"
                }
                required
                autoComplete="off"
              />
              <TextField
                {...bind("jobTitle")}
                label="Title / Position"
                required
                autoComplete="off"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                {...phone("employerPhone")}
                label={
                  value.employmentStatus === "Self-Employed"
                    ? "Business Phone Number"
                    : "Employer Phone Number"
                }
                required
                autoComplete="off"
              />
              <TextField
                {...money("monthlyIncome")}
                label="Monthly Gross Income"
                required
                hint="Before taxes."
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                {...bind("yearsAtJob")}
                label="Years at Current Job"
                required
                inputMode="numeric"
                maxLength={2}
                autoComplete="off"
              />
              <TextField
                {...bind("monthsAtJob")}
                label="Months at Current Job"
                inputMode="numeric"
                maxLength={2}
                autoComplete="off"
                hint="0–11, in addition to the years."
              />
            </div>
          </>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              {...money("monthlyIncome")}
              label="Monthly Gross Income"
              required
              hint="Before taxes, from all sources. Enter 0 if none."
            />
            <TextField
              {...bind("incomeSource")}
              label="Income Source (optional)"
              placeholder="e.g. Social Security, pension"
              autoComplete="off"
            />
          </div>
        )}
        <ToggleRow
          id={id("hasPreviousEmployment")}
          checked={value.hasPreviousEmployment}
          onChange={(checked) => onChange({ hasPreviousEmployment: checked })}
          label="Add previous employment"
        />
        {value.hasPreviousEmployment && (
          <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                {...bind("previousEmployerName")}
                label="Previous Employer Name"
                required
                autoComplete="off"
              />
              <TextField
                {...bind("previousJobTitle")}
                label="Title / Position"
                required
                autoComplete="off"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <TextField
                {...phone("previousEmployerPhone")}
                label="Employer Phone (optional)"
                autoComplete="off"
              />
              <TextField
                {...bind("previousYearsAtJob")}
                label="Years There (optional)"
                inputMode="numeric"
                maxLength={2}
                autoComplete="off"
              />
              <TextField
                {...bind("previousMonthsAtJob")}
                label="Months There (optional)"
                inputMode="numeric"
                maxLength={2}
                autoComplete="off"
              />
            </div>
          </div>
        )}
      </FormSection>
    </div>
  );
}

function ToggleRow({
  id,
  checked,
  onChange,
  label,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox id={id} checked={checked} onCheckedChange={(state) => onChange(state === true)} />
      <Label htmlFor={id} className="cursor-pointer text-sm font-semibold text-primary">
        {label}
      </Label>
    </div>
  );
}
