// Runtime backend selection for this app.
//
// The generated .env in this workspace is managed by the platform and keeps
// getting reset to the built-in backend, so the external project the site must
// actually run against is pinned here. Publishable keys are safe in source.
//
// Override at build time with VITE_APP_SUPABASE_URL / VITE_APP_SUPABASE_PUBLISHABLE_KEY.

export const APP_SUPABASE_PROJECT_ID = "rpmmlzyeqpvczuuobddt";

export const APP_SUPABASE_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.["VITE_APP_SUPABASE_URL"]) ||
  "https://rpmmlzyeqpvczuuobddt.supabase.co";

export const APP_SUPABASE_PUBLISHABLE_KEY =
  (typeof import.meta !== "undefined" &&
    import.meta.env?.["VITE_APP_SUPABASE_PUBLISHABLE_KEY"]) ||
  "sb_publishable_ICvC1OElVVZV7jJ14ppRaA_w5oxHYyc";
