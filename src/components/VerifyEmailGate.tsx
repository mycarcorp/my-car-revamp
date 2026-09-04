import { useState } from "react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/app-client";

export function resendVerification(email: string) {
  return supabase.auth.resend({
    type: "signup",
    email: email.trim().toLowerCase(),
    options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
  });
}

export function ResendVerificationButton({
  email,
  className,
}: {
  email: string;
  className?: string | undefined;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      className={className}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const { error } = await resendVerification(email);
        setBusy(false);
        if (error) {
          toast.error(
            error.message.toLowerCase().includes("rate")
              ? "Please wait a moment before requesting another email."
              : error.message,
          );
          return;
        }
        toast.success("Verification email sent. Check your inbox.");
      }}
    >
      {busy ? "Sending…" : "Resend verification email"}
    </Button>
  );
}

/** Blocks protected content until the signed-in user has confirmed their email. */
export function VerifyEmailGate({ email }: { email: string }) {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="font-display text-2xl font-bold">Waiting for verification</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Your account has been created. Please check your email and verify your account before
        continuing. We sent the link to {email}.
      </p>
      <div className="mt-6 flex flex-col items-center gap-3">
        <ResendVerificationButton email={email} />
        <Button asChild variant="ghost">
          <Link to="/">Back to the site</Link>
        </Button>
      </div>
    </div>
  );
}
