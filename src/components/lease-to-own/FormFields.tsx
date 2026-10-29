import type { ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { US_STATES } from "@/lib/lease-to-own";
import { cn } from "@/lib/utils";

/** Label, control, then either the error or a hint, wired up for screen readers. */
export function FormField({
  id,
  label,
  required = false,
  error,
  hint,
  className,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>
        {label}
        {required && (
          <span aria-hidden="true" className="text-destructive">
            {" "}
            *
          </span>
        )}
      </Label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** ARIA attributes for a control rendered inside a FormField with the same id. */
function fieldAria(id: string, error: string | undefined, required = false) {
  return {
    "aria-required": required || undefined,
    "aria-invalid": Boolean(error) || undefined,
    "aria-describedby": error ? `${id}-error` : undefined,
  } as const;
}

export function TextField({
  id,
  label,
  value,
  onChange,
  onBlur,
  error,
  hint,
  required,
  className,
  inputClassName,
  ...input
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  inputClassName?: string;
} & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "id" | "value" | "onChange" | "onBlur" | "required" | "className"
>) {
  return (
    <FormField
      id={id}
      label={label}
      required={required}
      error={error}
      hint={hint}
      className={className}
    >
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className={inputClassName}
        {...fieldAria(id, error, required)}
        {...input}
      />
    </FormField>
  );
}

export function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  placeholder = "Select",
  error,
  required,
  className,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
  placeholder?: string;
  error?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <FormField id={id} label={label} required={required} error={error} className={className}>
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger id={id} {...fieldAria(id, error, required)}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FormField>
  );
}

const STATE_OPTIONS = US_STATES.map((state) => ({ value: state, label: state }));

export function StateField(props: Omit<Parameters<typeof SelectField>[0], "options">) {
  return <SelectField {...props} options={STATE_OPTIONS} />;
}

/** A section heading in the reference's style: bold title with a rule beneath it. */
export function FormSection({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <fieldset className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-border pb-2">
        <legend className="float-left text-lg font-bold text-foreground">{title}</legend>
        {action}
      </div>
      {description && <p className="clear-both text-xs text-muted-foreground">{description}</p>}
      <div className="clear-both space-y-4">{children}</div>
    </fieldset>
  );
}
