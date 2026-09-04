// The Supabase client the application actually uses at runtime.
//
// It is a thin copy of the generated client, but pointed at the external
// project defined in runtime-config.ts instead of the platform-managed .env.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { brokeredPreviewStorage } from "./previewAuthStorage";
import { APP_SUPABASE_PUBLISHABLE_KEY, APP_SUPABASE_URL } from "./runtime-config";

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    // New Supabase API keys are opaque strings, not bearer JWTs.
    if (isNewSupabaseApiKey(supabaseKey) && headers.get("Authorization") === `Bearer ${supabaseKey}`) {
      headers.delete("Authorization");
    }

    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

function createAppSupabaseClient() {
  return createClient<Database>(APP_SUPABASE_URL, APP_SUPABASE_PUBLISHABLE_KEY, {
    global: { fetch: createSupabaseFetch(APP_SUPABASE_PUBLISHABLE_KEY) },
    auth: {
      storage: brokeredPreviewStorage(),
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

let _client: ReturnType<typeof createAppSupabaseClient> | undefined;

export const supabase = new Proxy({} as ReturnType<typeof createAppSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_client) _client = createAppSupabaseClient();
    return Reflect.get(_client, prop, receiver);
  },
});
