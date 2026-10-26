// Redaction-safe error handling for server code that touches customer submissions.
// Upstream response bodies, request paths and submitted fields can contain
// financial or identity data, so none of them may reach logs or thrown messages.
// Only an operation name, an HTTP status, a fixed category and a short
// provider error code (for example PGRST204) are ever recorded.

export type UpstreamErrorCategory = "http_error" | "invalid_response";

const SAFE_CODE = /^[A-Za-z0-9_]{1,12}$/;
const MISSING_COLUMN_CODES = new Set(["PGRST204", "42703"]);

export class UpstreamRequestError extends Error {
  readonly category: UpstreamErrorCategory;
  readonly status: number | null;
  readonly code: string | null;
  readonly missingColumn: boolean;

  constructor(init: {
    category: UpstreamErrorCategory;
    status: number | null;
    code?: string | null;
    missingColumn?: boolean;
  }) {
    const code = init.code ?? null;
    super(`Upstream request failed (${init.category}, status ${init.status ?? "none"}${code ? `, code ${code}` : ""})`);
    this.name = "UpstreamRequestError";
    this.category = init.category;
    this.status = init.status;
    this.code = code;
    this.missingColumn = init.missingColumn ?? false;
  }
}

/**
 * Build an error from a failed upstream response without keeping its body.
 * The body is inspected only to extract a short provider error code.
 */
export function upstreamHttpError(status: number, body: string): UpstreamRequestError {
  let code: string | null = null;
  try {
    const parsed = JSON.parse(body) as { code?: unknown };
    if (typeof parsed?.code === "string" && SAFE_CODE.test(parsed.code)) code = parsed.code;
  } catch {
    // Non-JSON body: no code is recorded.
  }
  const missingColumn =
    (code !== null && MISSING_COLUMN_CODES.has(code)) || /column .* does not exist/i.test(body);
  return new UpstreamRequestError({ category: "http_error", status, code, missingColumn });
}

export type SafeErrorInfo = {
  category: UpstreamErrorCategory | "unexpected";
  status?: number;
  code?: string;
  errorName?: string;
};

/** Fixed-shape description of any thrown value. Never includes its message, stack or cause. */
export function describeError(error: unknown): SafeErrorInfo {
  if (error instanceof UpstreamRequestError) {
    const info: SafeErrorInfo = { category: error.category };
    if (error.status !== null) info.status = error.status;
    if (error.code) info.code = error.code;
    return info;
  }
  const name = error instanceof Error ? error.name : "";
  return { category: "unexpected", errorName: /^[A-Za-z]{1,40}$/.test(name) ? name : "Error" };
}

/** Log a failure as operation + fixed category only. `operation` must be a constant string. */
export function logSafeError(operation: string, error: unknown): void {
  console.error(`[${operation}] failed`, describeError(error));
}
