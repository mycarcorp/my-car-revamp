import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/app-client";
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
  const [activeTab, setActiveTab] = useState("signin");
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);


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
    if (busy) return;
    setBusy(true);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setBusy(false);
      toast.error(error.message || "Google sign-in failed. Please try again.");
    }
  }

  function handleTabChange(value: string) {
    setActiveTab(value);
    setPendingEmail(null);
  }

  return (
    <main className="flex min-h-[calc(100vh-5rem)] items-center justify-center bg-surface px-4 py-8 sm:py-12">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-[0_18px_50px_-24px_rgba(7,17,27,0.45)] sm:p-8">
        <div className="text-center">
          <BrandLogo className="mx-auto h-10 w-auto object-contain" />
          <h1 className="mt-5 font-display text-3xl font-bold tracking-tight text-foreground">
            Welcome to MyCar
          </h1>
         
        </div>

        {pendingEmail && (
          <div className="mt-6 rounded-xl border border-[#F7941D]/40 bg-[#F7941D]/10 p-4 text-sm" role="status">
            <p className="font-semibold text-foreground">Waiting for verification</p>
            <p className="mt-1 leading-6 text-muted-foreground">
              Please verify your account. We sent the link to {pendingEmail}.
            </p>
            <ResendVerificationButton email={pendingEmail} className="mt-3" />
          </div>
        )}

        <Tabs value={activeTab} onValueChange={handleTabChange} className="mt-7">
          <TabsList className="h-11 w-full rounded-lg bg-muted p-1">
            <TabsTrigger value="signin" className="flex-1 rounded-md text-sm font-semibold">
              Sign In
            </TabsTrigger>
            <TabsTrigger value="signup" className="flex-1 rounded-md text-sm font-semibold">
              Create Account
            </TabsTrigger>
          </TabsList>

          <TabsContent value="signin" className="mt-6 min-h-[246px] data-[state=inactive]:animate-none data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:duration-200">
            <form onSubmit={signIn} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="si-email" className="text-sm font-semibold">Email</Label>
                <Input id="si-email" name="email" type="email" required autoComplete="email" className="h-11 rounded-md border-input bg-background px-3 shadow-sm transition focus-visible:border-[#F7941D] focus-visible:ring-2 focus-visible:ring-[#F7941D]" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="si-password" className="text-sm font-semibold">Password</Label>
                <div className="relative">
                  <Input id="si-password" name="password" type={showSignInPassword ? "text" : "password"} required autoComplete="current-password" className="h-11 rounded-md border-input bg-background px-3 pr-11 shadow-sm transition focus-visible:border-[#F7941D] focus-visible:ring-2 focus-visible:ring-[#F7941D]" />
                  <button type="button" aria-label={showSignInPassword ? "Hide password" : "Show password"} onClick={() => setShowSignInPassword((visible) => !visible)} className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#F7941D]">
                    {showSignInPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="h-11 w-full rounded-md border border-[#F7941D] bg-[#F7941D] px-5 text-sm font-semibold text-slate-950 shadow-[0_10px_22px_rgba(247,148,29,0.25)] transition-colors hover:border-[#ea8718] hover:bg-[#ea8718] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F7941D] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60" disabled={busy}>
                {busy ? "Signing in…" : "Sign in"}
              </Button>
              <button type="button" onClick={forgotPassword} disabled={busy} className="block w-full text-center text-sm font-semibold text-primary transition hover:text-[#F7941D] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F7941D] disabled:cursor-not-allowed disabled:opacity-50">
                Forgot your password?
              </button>
            </form>
          </TabsContent>

          <TabsContent value="signup" className="mt-6 min-h-[246px] data-[state=inactive]:animate-none data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:duration-200">
            <form onSubmit={signUp} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="su-name" className="text-sm font-semibold">Full name</Label>
                <Input id="su-name" name="full_name" required autoComplete="name" className="h-11 rounded-md border-input bg-background px-3 shadow-sm transition focus-visible:border-[#F7941D] focus-visible:ring-2 focus-visible:ring-[#F7941D]" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="su-email" className="text-sm font-semibold">Email</Label>
                <Input id="su-email" name="email" type="email" required autoComplete="email" className="h-11 rounded-md border-input bg-background px-3 shadow-sm transition focus-visible:border-[#F7941D] focus-visible:ring-2 focus-visible:ring-[#F7941D]" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="su-password" className="text-sm font-semibold">Password</Label>
                <div className="relative">
                  <Input id="su-password" name="password" type={showSignUpPassword ? "text" : "password"} required minLength={8} autoComplete="new-password" className="h-11 rounded-md border-input bg-background px-3 pr-11 shadow-sm transition focus-visible:border-[#F7941D] focus-visible:ring-2 focus-visible:ring-[#F7941D]" />
                  <button type="button" aria-label={showSignUpPassword ? "Hide password" : "Show password"} onClick={() => setShowSignUpPassword((visible) => !visible)} className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#F7941D]">
                    {showSignUpPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="h-11 w-full rounded-md border border-[#F7941D] bg-[#F7941D] px-5 text-sm font-semibold text-slate-950 shadow-[0_10px_22px_rgba(247,148,29,0.25)] transition-colors hover:border-[#ea8718] hover:bg-[#ea8718] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F7941D] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60" disabled={busy}>
                {busy ? "Creating account…" : "Create account"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <div className="my-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> or continue with <span className="h-px flex-1 bg-border" />
        </div>

        <Button variant="outline" className="h-11 w-full rounded-md border-border bg-background text-sm font-semibold shadow-sm transition hover:border-[#F7941D] hover:bg-[#F7941D]/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F7941D] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60" onClick={google} disabled={busy}>
          {busy ? "Connecting…" : "Continue with Google"}
        </Button>
      </div>
    </main>
  );
}
