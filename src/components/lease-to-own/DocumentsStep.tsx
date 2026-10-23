import { useRef, useState } from "react";
import {
  Building2,
  FileCheck2,
  FileText,
  IdCard,
  Receipt,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { trackLeaseEvent } from "@/lib/analytics";
import {
  ACCEPTED_DOC_EXTENSIONS,
  DOC_STATUS_LABELS,
  LEASE_DOCUMENTS,
  validateDocumentFile,
  type LeaseDocStatus,
  type LeaseDocType,
} from "@/lib/lease-to-own";
import {
  completeLeaseDocumentUpload,
  startLeaseDocumentUpload,
  type LeaseDocumentRow,
  type MyLeaseApplication,
} from "@/lib/lease-to-own.functions";
import { leaseErrorMessage, uploadToSignedUrl } from "@/lib/lease-to-own-client";
import { STATUS_TONES } from "./helpers";
import { StatusPill } from "./shared";

const ICONS: Record<LeaseDocType, typeof IdCard> = {
  government_id: IdCard,
  paystub: FileText,
  bank_statement: Building2,
  insurance_declaration: ShieldCheck,
  ach_authorization: Receipt,
};

export function DocumentsStep({
  accessToken,
  applicationId,
  documents,
  locked,
  onUpdated,
}: {
  accessToken: string;
  applicationId: number;
  documents: LeaseDocumentRow[];
  locked: boolean;
  onUpdated: (next: MyLeaseApplication) => void;
}) {
  const latest = new Map<string, LeaseDocumentRow>();
  for (const doc of documents)
    if (doc.source === "customer" && doc.status !== "pending" && !latest.has(doc.doc_type))
      latest.set(doc.doc_type, doc);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Upload all five documents. Accepted: PDF, JPG, PNG, HEIC or WEBP up to 10 MB each. Files go
        to private storage that only you and authorized My Car staff can open.
      </p>
      <ul className="grid gap-4 md:grid-cols-2">
        {LEASE_DOCUMENTS.map((doc, index) => (
          <DocumentRow
            key={doc.key}
            className={index === LEASE_DOCUMENTS.length - 1 ? "md:col-span-2" : undefined}
            accessToken={accessToken}
            applicationId={applicationId}
            docType={doc.key}
            label={doc.label}
            description={doc.description}
            current={latest.get(doc.key) ?? null}
            locked={locked}
            onUpdated={onUpdated}
          />
        ))}
      </ul>
    </div>
  );
}

function DocumentRow({
  accessToken,
  applicationId,
  docType,
  label,
  description,
  current,
  locked,
  onUpdated,
  className,
}: {
  accessToken: string;
  applicationId: number;
  docType: LeaseDocType;
  label: string;
  description: string;
  current: LeaseDocumentRow | null;
  locked: boolean;
  onUpdated: (next: MyLeaseApplication) => void;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const Icon = ICONS[docType];
  const status: LeaseDocStatus = current?.status ?? "pending";
  const canReplace = !locked && status !== "verified";

  async function onFile(file: File | undefined) {
    if (!file) return;
    const problem = validateDocumentFile(file);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setProgress(0);
    try {
      const { documentId, uploadUrl } = await startLeaseDocumentUpload({
        data: { accessToken, applicationId, docType, mime: file.type, size: file.size },
      });
      await uploadToSignedUrl(uploadUrl, file, setProgress);
      const next = await completeLeaseDocumentUpload({ data: { accessToken, documentId } });
      onUpdated(next);
      trackLeaseEvent("lease_to_own_document_upload_completed", { document_type: docType });
      toast.success(`${label} uploaded.`);
    } catch (cause) {
      setError(leaseErrorMessage(cause));
    } finally {
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const inputId = `lto-doc-${docType}`;
  return (
    <li className={`rounded-xl border border-border bg-card p-4 ${className ?? ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
            <Icon className="size-4" aria-hidden="true" />
          </span>
          <div>
            <p className="font-semibold text-foreground">{label}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
        <StatusPill tone={STATUS_TONES[status]}>{DOC_STATUS_LABELS[status]}</StatusPill>
      </div>

      {status === "rejected" && current?.review_note && (
        <p className="mt-3 rounded-md bg-destructive/10 p-2 text-xs text-destructive">
          Needs attention: {current.review_note}
        </p>
      )}

      {progress !== null ? (
        <div className="mt-4" aria-live="polite">
          <Progress value={progress} aria-label={`Uploading ${label}`} />
          <p className="mt-1 text-xs text-muted-foreground">Uploading… {progress}%</p>
        </div>
      ) : (
        canReplace && (
          <div className="mt-4">
            <input
              ref={inputRef}
              id={inputId}
              type="file"
              accept={ACCEPTED_DOC_EXTENSIONS}
              className="sr-only"
              onChange={(e) => void onFile(e.target.files?.[0])}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
              aria-describedby={error ? `${inputId}-error` : undefined}
            >
              {current ? <FileCheck2 className="size-4" /> : <Upload className="size-4" />}
              {current ? "Replace file" : "Choose file"}
            </Button>
          </div>
        )
      )}
      {error && (
        <p
          id={`${inputId}-error`}
          role="alert"
          className="mt-2 text-xs font-medium text-destructive"
        >
          {error}
        </p>
      )}
    </li>
  );
}
