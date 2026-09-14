import { useState } from "react";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SheetClose, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/app-client";
import { legacyMigrateLogin, linkLegacyProfile } from "@/lib/legacy-auth.functions";
import { registerAccount } from "@/lib/account.functions";

export function SignInSheet() {
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const password = String(form.get("password") ?? "");
    setBusy(true);

    let { error } = await supabase.auth
      .signInWithPassword({ email, password })
      .catch((cause: Error) => ({ error: cause }));
    if (error?.message.toLowerCase().includes("invalid")) {
      try {
        const result = await legacyMigrateLogin({ data: { email, password } });
        if (result.status === "migrated") {
          ({ error } = await supabase.auth.signInWithPassword({ email, password }));
        }
      } catch {
        // Keep the normal sign-in error below.
      }
    }

    setBusy(false);
    if (error) {
      const message = error.message.toLowerCase();
      toast.error(
        message.includes("not confirmed") || message.includes("email_not_confirmed")
          ? "Please verify your email before signing in."
          : message.includes("invalid")
            ? "That email and password combination didn't work."
            : error.message,
      );
      return;
    }

    void linkLegacyProfile({}).catch(() => undefined);
    toast.success("Welcome back!");
  }

  async function google() {
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setBusy(false);
      toast.error(error.message || "Google sign-in failed. Please try again.");
    }
  }

  async function signUp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const password = String(form.get("password") ?? "");
    const fullName = String(form.get("full_name") ?? "").trim();
    setBusy(true);
    const result = await registerAccount({ data: { email, password, fullName } }).catch(
      (error: Error) => ({ status: "error" as const, message: error.message }),
    );
    setBusy(false);
    if (result.status === "exists") {
      toast.error("An account already exists for that email. Please sign in instead.");
      setMode("signin");
      return;
    }
    if (result.status !== "created") {
      toast.error(result.message || "We couldn't create your account. Please try again.");
      return;
    }
    const { error } = await supabase.auth
      .signInWithPassword({ email, password })
      .catch((cause: Error) => ({ error: cause }));
    if (error) {
      toast.success("Your account was created. Please verify your email before signing in.");
      setMode("signin");
      return;
    }
    void linkLegacyProfile({}).catch(() => undefined);
    toast.success("Welcome to MyCar!");
  }

  async function forgotPassword() {
    const email = window.prompt("Enter the email address on your account:")?.trim().toLowerCase();
    if (!email) return;
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("If that address has an account, a reset link is on the way.");
  }

  return (
    <div className="flex h-full flex-col">
      <SheetHeader className="border-b border-border pb-5 text-left">
        <SheetTitle className="font-display text-2xl">{mode === "signin" ? "Welcome to MyCar" : "Create your account"}</SheetTitle>
        <SheetDescription>
          {mode === "signin" ? "Sign in to save vehicles, searches, and requests." : "Save vehicles, searches, and requests in one place."}
        </SheetDescription>
      </SheetHeader>

      <form onSubmit={(event) => void (mode === "signin" ? signIn(event) : signUp(event))} className="mt-8 space-y-5">
        {mode === "signup" && (
          <div className="space-y-2">
            <Label htmlFor="sheet-name">Full name</Label>
            <Input id="sheet-name" name="full_name" required autoComplete="name" className="h-11" />
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="sheet-email">Email</Label>
          <Input id="sheet-email" name="email" type="email" required autoComplete="email" className="h-11" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sheet-password">Password</Label>
          <div className="relative">
            <Input
              id="sheet-password"
              name="password"
              type={showPassword ? "text" : "password"}
              required
              minLength={mode === "signup" ? 8 : undefined}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              className="h-11 pr-11"
            />
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((value) => !value)}
              className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center text-muted-foreground"
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>
        <Button type="submit" className="h-11 w-full" disabled={busy}>
          <LogIn className="size-4" />
          {busy ? (mode === "signin" ? "Signing in…" : "Creating account…") : mode === "signin" ? "Sign in" : "Create account"}
        </Button>
        <button type="button" onClick={() => void forgotPassword()} disabled={busy} className="w-full text-center text-sm font-semibold text-primary hover:underline">
          Forgot your password?
        </button>
      </form>

      <div className="my-7 flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
      </div>
      <Button variant="outline" className="h-11 w-full" onClick={() => void google()} disabled={busy}>
        Continue with Google
      </Button>

      <div className="mt-auto border-t border-border pt-6 text-center text-sm text-muted-foreground">
        {mode === "signin" ? "Need an account?" : "Already have an account?"}{" "}
        <button type="button" className="font-semibold text-primary hover:underline" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
          {mode === "signin" ? "Create one" : "Sign in"}
        </button>
      </div>
      <SheetClose asChild>
        <Button variant="ghost" className="mt-3 w-full">Continue browsing</Button>
      </SheetClose>
    </div>
  );
}
