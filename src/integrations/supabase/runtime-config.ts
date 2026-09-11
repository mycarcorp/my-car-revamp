// Runtime backend selection for this app.
//
// Preferred source of truth: the environment variables in .env
// (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY).
//
// The platform periodically rewrites .env back to its built-in backend
// (project ref "zqwnvktukyrtqnbvsmrg"). When that happens the env value is
// ignored and the external project below is used instead, so the app never
// silently falls back to the old backend. Publishable keys are safe in source.

const LEGACY_CLOUD_REF = "zqwnvktukyrtqnbvsmrg";

const FALLBACK_URL = "https://rpmmlzyeqpvczuuobddt.supabase.co";
const FALLBACK_PUBLISHABLE_KEY = "sb_publishable_ICvC1OElVVZV7jJ14ppRaA_w5oxHYyc";

// Publishable keys that belong to the old platform backend. If one of these is
// injected into the env it must never be paired with the external project URL,
// because the external project rejects it with 401 on every auth request.
const LEGACY_PUBLISHABLE_KEYS = new Set(["sb_publishable_oqfjBAu3Ozfa_sTVIMXdQw_X753X_PI"]);

function envValue(name: string): string | undefined {
  const fromVite =
    typeof import.meta !== "undefined" ? (import.meta.env?.[name] as string | undefined) : undefined;
  if (fromVite) return fromVite;
  const serverName = name.replace(/^VITE_/, "");
  return typeof process !== "undefined" ? process.env?.[serverName] : undefined;
}

const envUrl = envValue("VITE_SUPABASE_URL");
const envKey = envValue("VITE_SUPABASE_PUBLISHABLE_KEY");

const useEnv = Boolean(envUrl && envKey && !envUrl.includes(LEGACY_CLOUD_REF));

export const APP_SUPABASE_URL = useEnv ? envUrl! : FALLBACK_URL;
export const APP_SUPABASE_PUBLISHABLE_KEY = useEnv ? envKey! : FALLBACK_PUBLISHABLE_KEY;
export const APP_SUPABASE_PROJECT_ID =
  APP_SUPABASE_URL.replace("https://", "").split(".")[0] ?? "";
