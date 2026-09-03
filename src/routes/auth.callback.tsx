import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/callback")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Signing You In — MyCar" },
      {
        name: "description",
        content: "Completing your MyCar sign-in and returning you to your account.",
      },
      { property: "og:title", content: "Signing You In — MyCar" },
      { property: "og:description", content: "Completing your MyCar sign-in." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    let done = false;
    const finish = (signedIn: boolean) => {
      if (done) return;
      done = true;
      void navigate({ to: signedIn ? "/account" : "/auth" });
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) finish(true);
    });

    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) finish(true);
      else setTimeout(() => finish(false), 2500);
    });

    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center text-sm text-muted-foreground">
      Signing you in…
    </div>
  );
}
