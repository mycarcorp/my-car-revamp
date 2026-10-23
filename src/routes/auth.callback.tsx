import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/app-client";
import { linkLegacyProfile } from "@/lib/legacy-auth.functions";
import { consumeLeaseApplyReturn } from "@/lib/lease-to-own-client";

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
      if (signedIn) void linkLegacyProfile({}).catch(() => undefined);
      let pending = false;
      try {
        pending = !!sessionStorage.getItem("mycar.pendingPurchase");
      } catch {
        pending = false;
      }
      // Return Google sign-ins started from the Lease to Own application to that
      // application (only the package choice is restored; no applicant data is stored).
      const leaseReturn = signedIn && !pending ? consumeLeaseApplyReturn() : null;
      if (leaseReturn) {
        void navigate({ to: "/lease-to-own/apply", search: leaseReturn });
        return;
      }
      void navigate({ to: signedIn ? (pending ? "/my" : "/search") : pending ? "/my" : "/auth" });
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
