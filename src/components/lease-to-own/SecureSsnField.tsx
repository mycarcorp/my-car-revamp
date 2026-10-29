import { useState } from "react";
import { Eye, EyeOff, FlaskConical, ShieldCheck } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatSsnInput, ssnTestMockError } from "@/lib/lease-to-own";

/**
 * SSN / ITIN slot in the Credit Form.
 *
 * Raw SSNs are never collected by the ordinary React form. This slot is where an
 * approved identity provider's hosted (iframe) field will mount; the provider
 * keeps the number and returns only a reference, which the server records
 * against the signed-in customer's application.
 *
 * No provider is integrated, so production shows "Integration required".
 * Local development (`vite dev`) shows a clearly labelled TEST-ONLY mock that
 * accepts only fictional numbers and keeps its value inside this component, so
 * it cannot be submitted, stored or sent anywhere. Vite removes the mock from
 * production builds.
 */
export function SecureSsnField({ id = "lto-ssn" }: { id?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        SSN / Taxpayer ID (ITIN){" "}
        <span aria-hidden="true" className="text-destructive">
          *
        </span>
      </Label>
      {import.meta.env.DEV ? (
        <SsnTestMock id={id} />
      ) : (
        <>
          <div
            id={id}
            className="flex h-9 items-center rounded-md border border-dashed border-border bg-muted/50 px-3 text-xs font-semibold text-muted-foreground"
          >
            Integration required — not collected online yet
          </div>
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            Collected later through a secure identity provider. We never ask for it in this form.
          </p>
        </>
      )}
    </div>
  );
}

/** Development-only, non-persistent mock. Never rendered in production builds. */
function SsnTestMock({ id }: { id: string }) {
  const [value, setValue] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const accepted = touched && !error && value.length > 0;

  return (
    <>
      <div className="relative">
        <Input
          id={id}
          // Not named and outside the form's state: the value cannot be submitted.
          form="lto-ssn-test-mock"
          type={visible ? "text" : "password"}
          inputMode="numeric"
          autoComplete="off"
          spellCheck={false}
          placeholder="987-65-4320"
          value={formatSsnInput(value)}
          onChange={(e) => {
            setValue(e.target.value);
            if (touched) setError(ssnTestMockError(e.target.value));
          }}
          onBlur={() => {
            setTouched(true);
            setError(ssnTestMockError(value));
          }}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={`${id}-mock-note`}
          className="border-dashed border-[#F7941D] pr-10 font-mono"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide test number" : "Show test number"}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      {error && (
        <p className="text-xs font-medium text-destructive" role="alert">
          {error}
        </p>
      )}
      <p
        id={`${id}-mock-note`}
        className="flex items-start gap-1.5 text-xs font-semibold text-accent-text"
      >
        <FlaskConical className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        {accepted
          ? "TEST-ONLY MOCK: format accepted. Not submitted, stored or sent — production uses a secure provider."
          : "TEST-ONLY MOCK (local development). Use fictional 987-65-4320 to 987-65-4329. Never submitted."}
      </p>
    </>
  );
}
