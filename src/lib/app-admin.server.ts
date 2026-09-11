// Server-only admin client for the project the app actually runs against.
//
// The platform periodically rewrites SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
// back to its built-in backend, so prefer the explicitly configured project
// credentials (LEGACY_SUPABASE_*) which point at the live project.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function appAdminCreds() {
  const url = process.env["LEGACY_SUPABASE_URL"] ?? process.env["SUPABASE_URL"];
  const key =
    process.env["LEGACY_SUPABASE_SERVICE_ROLE_KEY"] ?? process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) throw new Error("Backend credentials are not configured.");
  return { url, key };
}

let _admin: SupabaseClient | undefined;

/** Service-role client for the live project. Never expose to the browser. */
export function appAdmin(): SupabaseClient {
  if (!_admin) {
    const { url, key } = appAdminCreds();
    _admin = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        // New-style keys are opaque strings, not JWTs.
        fetch: (input, init) => {
          const headers = new Headers(init?.headers);
          headers.set("apikey", key);
          headers.set("Authorization", `Bearer ${key}`);
          return fetch(input as RequestInfo, { ...init, headers });
        },
      },
    });
  }
  return _admin;
}
