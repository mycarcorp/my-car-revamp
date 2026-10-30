import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from "react";
import {
  Download,
  ExternalLink,
  FileCheck2,
  FileQuestion,
  Loader2,
  Printer,
  TriangleAlert,
} from "lucide-react";

export type ContractViewerState = "loading" | "ready" | "missing" | "error";

export type ContractViewerHandle = {
  /** Prints the displayed PDF. Returns false when there is nothing printable. */
  print: () => boolean;
};

/**
 * Shows one contract PDF with the browser's built-in PDF viewer. The caller
 * resolves `src` (a short-lived signed URL for real documents) only after its
 * own authorization check; this component never fetches or authorizes anything.
 *
 * `display="actions"` shows no embedded viewer — only Preview, Download and
 * Print — for forms whose web form is the main view (e.g. Form 1).
 */
export const ContractDocumentViewer = forwardRef<
  ContractViewerHandle,
  {
    title: string;
    src: string | null;
    state: ContractViewerState;
    /** Shown when there is no approved document yet. */
    missingMessage?: string;
    errorMessage?: string;
    /** Offer a download link; only for documents the viewer is allowed to keep. */
    downloadName?: string;
    display?: "embedded" | "actions";
    /** Shown beside the actions (e.g. "watermarked demo preview"). */
    actionsNote?: string;
  }
>(function ContractDocumentViewer(
  {
    title,
    src,
    state,
    missingMessage,
    errorMessage,
    downloadName,
    display = "embedded",
    actionsNote,
  },
  ref,
) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [frameFailed, setFrameFailed] = useState(false);
  // Actions mode loads the PDF into an off-screen frame only when printing.
  const [printSrc, setPrintSrc] = useState<string | null>(null);
  const ready = state === "ready" && Boolean(src) && !frameFailed;
  const startPrint = useCallback(() => {
    setPrintSrc(null);
    queueMicrotask(() => setPrintSrc(src));
  }, [src]);

  useImperativeHandle(
    ref,
    () => ({
      print: () => {
        if (!ready || !src) return false;
        if (display === "actions") {
          startPrint();
          return true;
        }
        try {
          frame.current?.contentWindow?.focus();
          frame.current?.contentWindow?.print();
          return true;
        } catch {
          // Some browsers block printing an embedded PDF; open it so the user can print there.
          window.open(src, "_blank", "noopener");
          return true;
        }
      },
    }),
    [ready, src, display, startPrint],
  );

  if (display === "actions") {
    const button =
      "inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50";
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-900 px-4 py-3">
        <p className="flex items-center gap-2 text-xs text-slate-300">
          {ready ? (
            <FileCheck2 className="size-4 text-emerald-400" aria-hidden="true" />
          ) : state === "loading" ? (
            <Loader2 className="size-4 animate-spin text-sky-400" aria-hidden="true" />
          ) : (
            <FileQuestion className="size-4 text-slate-400" aria-hidden="true" />
          )}
          <span>
            <strong className="text-white">{title} PDF</strong>
            <span className="block text-[11px] text-slate-400">
              {ready
                ? (actionsNote ?? "Ready to preview, download or print.")
                : state === "loading"
                  ? "Preparing the PDF…"
                  : (missingMessage ?? "Available once the approved document exists.")}
            </span>
          </span>
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!ready}
            onClick={() => src && window.open(src, "_blank", "noopener")}
            className={button}
          >
            <ExternalLink className="size-3.5" aria-hidden="true" /> Preview Final PDF
          </button>
          {downloadName && ready ? (
            <a href={src!} download={downloadName} className={button}>
              <Download className="size-3.5" aria-hidden="true" /> Download
            </a>
          ) : (
            <button type="button" disabled className={button}>
              <Download className="size-3.5" aria-hidden="true" /> Download
            </button>
          )}
          <button type="button" disabled={!ready} onClick={startPrint} className={button}>
            <Printer className="size-3.5" aria-hidden="true" /> Print
          </button>
        </div>
        {printSrc && (
          <iframe
            key={printSrc}
            src={printSrc}
            title={`${title} (print)`}
            aria-hidden="true"
            tabIndex={-1}
            className="pointer-events-none fixed -left-[10000px] top-0 h-[1000px] w-[800px]"
            onLoad={(e) => {
              const win = e.currentTarget.contentWindow;
              // The PDF viewer needs a moment after load before it can print.
              window.setTimeout(() => {
                try {
                  win?.focus();
                  win?.print();
                } catch {
                  window.open(printSrc, "_blank", "noopener");
                }
              }, 500);
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-900">
      {ready ? (
        <>
          <iframe
            key={src}
            ref={frame}
            // Fit the page to the viewer width instead of scrolling sideways.
            src={src!.includes("#") ? src! : `${src}#view=FitH`}
            title={title}
            onError={() => setFrameFailed(true)}
            className="block h-[70vh] min-h-[480px] w-full bg-white"
          />
          {downloadName && (
            <div className="flex justify-end border-t border-white/10 px-4 py-2">
              <a
                href={src!}
                download={downloadName}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-300 hover:underline"
              >
                <Download className="size-3.5" aria-hidden="true" /> Download
              </a>
            </div>
          )}
        </>
      ) : (
        <div
          role="status"
          className="flex min-h-[320px] flex-col items-center justify-center gap-3 p-8 text-center text-sm text-slate-300"
        >
          {state === "loading" ? (
            <>
              <Loader2 className="size-6 animate-spin text-sky-400" aria-hidden="true" />
              Loading {title}…
            </>
          ) : state === "error" || frameFailed ? (
            <>
              <TriangleAlert className="size-6 text-amber-400" aria-hidden="true" />
              {errorMessage ?? `We couldn't open ${title}. Please try again.`}
            </>
          ) : (
            <>
              <FileQuestion className="size-6 text-slate-400" aria-hidden="true" />
              <span className="font-semibold text-white">{title}</span>
              {missingMessage ?? "The approved document for this form hasn't been supplied yet."}
            </>
          )}
        </div>
      )}
    </div>
  );
});
