import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/app-client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/useAuth";
import { ResendVerificationButton } from "@/components/VerifyEmailGate";
import { legacyMigrateLogin, linkLegacyProfile } from "@/lib/legacy-auth.functions";
import { registerAccount } from "@/lib/account.functions";


export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign In or Create an Account — MyCar" },
      {
        name: "description",
        content:
          "Sign in to save vehicles, store searches and track the requests you've sent to MyCar in Fredericksburg, VA.",
      },
      { property: "og:title", content: "Sign In — MyCar" },
      { property: "og:description", content: "Save vehicles, store searches and track requests." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);


  useEffect(() => {
    if (user) void navigate({ to: "/search" });
  }, [user, navigate]);

  async function signIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email")).trim().toLowerCase();
    const password = String(f.get("password"));
    setBusy(true);
    let { error } = await supabase.auth.signInWithPassword({ email, password });

    // Legacy fallback: only when this email has no account in Supabase Auth yet.
    if (error && error.message.toLowerCase().includes("invalid")) {
      try {
        const res = await legacyMigrateLogin({ data: { email, password } });
        if (res.status === "migrated") {
          ({ error } = await supabase.auth.signInWithPassword({ email, password }));
        } else if (res.status === "google_only") {
          setBusy(false);
          toast.error("This account uses Google sign-in. Please continue with Google.");
          return;
        }
      } catch {
        /* fall through to the normal error message */
      }
    }
    setBusy(false);
    if (error) {
      const m = error.message.toLowerCase();
      if (m.includes("not confirmed") || m.includes("email_not_confirmed")) {
        setPendingEmail(email);
        toast.error("Please verify your email before signing in.");
        return;
      }
      toast.error(
        m.includes("invalid") ? "That email and password combination didn't work." : error.message,
      );
      return;
    }
    void linkLegacyProfile({}).catch(() => undefined);
    void navigate({ to: "/search" });
  }



  async function forgotPassword() {
    const email = window.prompt("Enter the email address on your account:")?.trim().toLowerCase();
    if (!email) return;
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("If that address has an account, a reset link is on the way.");
  }


  async function signUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email")).trim().toLowerCase();
    const password = String(f.get("password"));
    const fullName = String(f.get("full_name") ?? "");
    setBusy(true);

    const res = await registerAccount({ data: { email, password, fullName } }).catch(
      (err: Error) => ({ status: "error" as const, message: err.message }),
    );

    if (res.status === "exists") {
      setBusy(false);
      toast.error("An account with that email already exists. Try signing in instead.");
      return;
    }
    if (res.status === "weak_password") {
      setBusy(false);
      toast.error(res.message || "Please choose a stronger password.");
      return;
    }
    if (res.status === "error") {
      setBusy(false);
      toast.error(res.message || "We couldn't create your account. Please try again.");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      toast.error("Your account was created. Please sign in.");
      return;
    }
    void linkLegacyProfile({}).catch(() => undefined);
    toast.success("Welcome to MyCar!");
    void navigate({ to: "/search" });
  }



  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/auth/callback`,
    });
    if (result.error) { toast.error("Google sign-in failed. Please try email instead."); return; }
    if (result.redirected) return;
    void navigate({ to: "/search" });
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="font-display text-3xl font-bold">Welcome to MyCar</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        An account lets you save vehicles, store searches, and follow the status of every request you
        send us.
      </p>

      {pendingEmail && (
        <div className="mt-6 rounded-lg border border-border bg-surface p-4 text-sm">
          <p className="font-semibold">Waiting for verification</p>
          <p className="mt-1 text-muted-foreground">
            Your account has been created. Please check your email and verify your account before
            signing in. We sent the link to {pendingEmail}.
          </p>
          <ResendVerificationButton email={pendingEmail} className="mt-3" />
        </div>
      )}

      <Tabs defaultValue="signin" className="mt-8">
        <TabsList className="w-full">
          <TabsTrigger value="signin" className="flex-1">
            Sign in
          </TabsTrigger>
          <TabsTrigger value="signup" className="flex-1">
            Create account
          </TabsTrigger>
        </TabsList>

        <TabsContent value="signin" className="mt-6">
          <form onSubmit={signIn} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="si-email">Email</Label>
              <Input id="si-email" name="email" type="email" required autoComplete="email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="si-password">Password</Label>
              <Input
                id="si-password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </Button>
            <button
              type="button"
              onClick={forgotPassword}
              className="block w-full text-center text-sm font-medium text-primary hover:underline"
            >
              Forgot your password?
            </button>
          </form>

        </TabsContent>

        <TabsContent value="signup" className="mt-6">
          <form onSubmit={signUp} className="space-y-4">

            <div className="space-y-2">
              <Label htmlFor="su-name">Full name</Label>
              <Input id="su-name" name="full_name" required autoComplete="name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="su-email">Email</Label>
              <Input id="su-email" name="email" type="email" required autoComplete="email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="su-password">Password</Label>
              <Input
                id="su-password"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Creating account…" : "Create account"}
            </Button>

          </form>
        </TabsContent>
      </Tabs>

      <div className="my-6 flex items-center gap-3 text-xs uppercase text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
      </div>

      <Button variant="outline" className="w-full" onClick={google}>
        Continue with Google
      </Button>
    </div>
  );
}
