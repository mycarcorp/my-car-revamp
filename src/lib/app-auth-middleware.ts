// Client-side middleware that attaches the bearer token from the client the app
// actually signs in with (the permanent project in runtime-config.ts).
// The generated attacher reads a different client's session, so it never has a token.
import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/app-client";

export const attachAppSupabaseAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    let token: string | undefined;
    try {
      const { data } = await supabase.auth.getSession();
      token = data.session?.access_token;
    } catch {
      token = undefined;
    }
    return next({ headers: token ? { Authorization: `Bearer ${token}` } : {} });
  },
);
