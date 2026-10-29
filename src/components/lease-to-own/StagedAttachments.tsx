import { useRef, useState } from "react";
import {
  CheckCircle2,
  CircleDashed,
  FileUp,
  Loader2,
  Trash2,
  TriangleAlert,
  Upload,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  ACCEPTED_DOC_EXTENSIONS,
  LEASE_DOCUMENTS,
  MAX_DOC_BYTES,
  validateDocumentFile,
  type ApplicantRole,
  type LeaseDocType,
} from "@/lib/lease-to-own";
import { cn } from "@/lib/utils";
import { FormSection, SelectField } from "./FormFields";

/** A file chosen in the form. It stays in memory only and is uploaded after submission. */
export type StagedFile = {
  docType: LeaseDocType;
  file: File;
  state: "ready" | "uploading" | "uploaded" | "failed";
  progress: number;
  error?: string;
};
export type StagedFiles = Partial<Record<LeaseDocType, StagedFile>>;

const DOC_OPTIONS = LEASE_DOCUMENTS.map((d) => ({ value: d.key, label: d.label }));

/**
 * Attachments for one applicant. Files are held in this page's memory (never in
 * browser storage) and go through the existing private upload flow once the
 * application is saved, so nothing is uploaded before the applicant is signed
 * in and the application exists. Status shown after upload is what the server
 * confirmed; nothing is ever shown as verified by uploading it.
 */
export function StagedAttachments({
  role,
  files,
  onChange,
  disabled,
}: {
  role: ApplicantRole;
  files: StagedFiles;
  onChange: (next: StagedFiles) => void;
  disabled: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState<LeaseDocType>(
    () => LEASE_DOCUMENTS.find((d) => !files[d.key])?.key ?? LEASE_DOCUMENTS[0]!.key,
  );
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const id = `lto-${role}-attachments`;

  function add(file: File | undefined) {
    if (!file || disabled) return;
    const problem = validateDocumentFile(file);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    const next = {
      ...files,
      [docType]: { docType, file, state: "ready", progress: 0 } as StagedFile,
    };
    onChange(next);
    const nextMissing = LEASE_DOCUMENTS.find((d) => !next[d.key]);
    if (nextMissing) setDocType(nextMissing.key);
  }

  function remove(type: LeaseDocType) {
    const next = { ...files };
    delete next[type];
    onChange(next);
  }

  return (
    <FormSection
      title="Attachments"
      description="Optional now — you can also upload after submitting. Files stay on this page until your application is saved, then go to private storage that only you and authorized My Car staff can open."
    >
      <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
        <SelectField
          id={`${id}-type`}
          label="Document type"
          value={docType}
          onChange={(value) => setDocType(value as LeaseDocType)}
          options={DOC_OPTIONS}
        />
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            add(e.dataTransfer.files?.[0]);
          }}
          className={cn(
            "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors",
            dragging ? "border-primary bg-primary/5" : "border-border bg-muted/30",
            disabled && "opacity-60",
          )}
        >
          <FileUp className="size-6 text-primary" aria-hidden="true" />
          <p className="text-sm font-semibold">Drag and drop a file here</p>
          <input
            ref={inputRef}
            id={id}
            type="file"
            accept={ACCEPTED_DOC_EXTENSIONS}
            className="sr-only"
            disabled={disabled}
            onChange={(e) => {
              add(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="size-4" aria-hidden="true" /> Browse for file
          </Button>
          <p className="text-xs text-muted-foreground">
            PDF, JPG, PNG, HEIC or WEBP · up to {MAX_DOC_BYTES / 1024 / 1024} MB each
          </p>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}

      <ul
        className="divide-y divide-border rounded-lg border border-border"
        aria-label="Attached documents"
      >
        {LEASE_DOCUMENTS.map((doc) => {
          const staged = files[doc.key];
          return (
            <li key={doc.key} className="flex items-center gap-3 px-4 py-3 text-sm">
              <StatusIcon state={staged?.state} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{doc.label}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {!staged
                    ? "Not attached"
                    : staged.state === "ready"
                      ? `${staged.file.name} — uploads when you submit`
                      : staged.state === "uploading"
                        ? `Uploading… ${staged.progress}%`
                        : staged.state === "uploaded"
                          ? "Uploaded — awaiting staff review"
                          : `Upload failed: ${staged.error ?? "try again from Document Uploads"}`}
                </p>
                {staged?.state === "uploading" && (
                  <Progress
                    value={staged.progress}
                    className="mt-1 h-1.5"
                    aria-label={`Uploading ${doc.label}`}
                  />
                )}
              </div>
              {staged && (staged.state === "ready" || staged.state === "failed") && !disabled && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(doc.key)}
                  aria-label={`Remove ${doc.label}`}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </FormSection>
  );
}

function StatusIcon({ state }: { state: StagedFile["state"] | undefined }) {
  if (state === "uploading")
    return <Loader2 className="size-4 shrink-0 animate-spin text-primary" aria-hidden="true" />;
  if (state === "uploaded")
    return <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden="true" />;
  if (state === "failed")
    return <TriangleAlert className="size-4 shrink-0 text-destructive" aria-hidden="true" />;
  if (state === "ready")
    return <FileUp className="size-4 shrink-0 text-primary" aria-hidden="true" />;
  return <CircleDashed className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />;
}
