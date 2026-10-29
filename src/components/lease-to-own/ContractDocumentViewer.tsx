import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Download, FileQuestion, Loader2, TriangleAlert } from "lucide-react";

export type ContractViewerState = "loading" | "ready" | "missing" | "error";

export type ContractViewerHandle = {
  /** Prints the displayed PDF. Returns false when there is nothing printable. */
  print: () => boolean;
};

/**
 * Shows one contract PDF with the browser's built-in PDF viewer. The caller
 * resolves `src` (a short-lived signed URL for real documents) only after its
 * own authorization check; this component never fetches or authorizes anything.
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
  }
>(function ContractDocumentViewer(
  { title, src, state, missingMessage, errorMessage, downloadName },
  ref,
) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [frameFailed, setFrameFailed] = useState(false);
  const ready = state === "ready" && Boolean(src) && !frameFailed;

  useImperativeHandle(
    ref,
    () => ({
      print: () => {
        if (!ready || !src) return false;
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
    [ready, src],
  );

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
