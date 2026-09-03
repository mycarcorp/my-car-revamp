import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/useAuth";
import { ResendVerificationButton } from "@/components/VerifyEmailGate";

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
    if (user) void navigate({ to: "/account" });
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
        const res = await migrateLegacy({ data: { email, password } });
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
    void linkLegacy({}).catch(() => undefined);
    void navigate({ to: "/account" });
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
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: { full_name: String(f.get("full_name")) },
      },
    });
    setBusy(false);
    if (error) {
      const m = error.message.toLowerCase();
      if (m.includes("already registered") || m.includes("already been registered") || m.includes("user already")) {
        toast.error("An account with that email already exists. Try signing in instead.");
      } else if (m.includes("invalid") && m.includes("email")) {
        toast.error("That email address doesn't look valid.");
      } else if (m.includes("pwned") || m.includes("compromised") || m.includes("leaked")) {
        toast.error("That password has appeared in a data breach. Please choose a different one.");
      } else if (m.includes("password")) {
        toast.error(error.message || "Please choose a stronger password (at least 8 characters).");

      } else {
        toast.error(error.message || "We couldn't create your account. Please try again.");
      }
      return;
    }
    if (!data.user) {
      toast.error("We couldn't create your account. Please try again.");
      return;
    }
    if (data.session) {
      void navigate({ to: "/account" });
      return;
    }
    setPendingEmail(email);
    toast.success("Check your email to confirm your account.");
  }


  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/auth/callback`,
    });
    if (result.error) { toast.error("Google sign-in failed. Please try email instead."); return; }
    if (result.redirected) return;
    void navigate({ to: "/account" });
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
