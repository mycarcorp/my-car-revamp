import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Database } from "@/integrations/supabase/types";

type LeadType = Database["public"]["Enums"]["lead_type"];

export type LeadFormProps = {
  leadType: LeadType;
  vehicleId?: string | null;
  submitLabel?: string;
  successTitle?: string;
  successBody?: string;
  showMessage?: boolean;
  messageLabel?: string;
  children?: ReactNode;
  /** Extra fields serialized into the lead details column. */
  collectDetails?: () => Record<string, unknown>;
};

export function LeadForm({
  leadType,
  vehicleId = null,
  submitLabel = "Send request",
  successTitle = "Request received",
  successBody = "A member of our team will reach out shortly during business hours.",
  showMessage = true,
  messageLabel = "Anything we should know?",
  children,
  collectDetails,
}: LeadFormProps) {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const full_name = String(form.get("full_name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    if (!full_name || !email) {
      toast.error("Please enter your name and email.");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("leads").insert({
      lead_type: leadType,
      full_name,
      email,
      phone: String(form.get("phone") ?? "") || null,
      message: String(form.get("message") ?? "") || null,
      vehicle_id: vehicleId,
      user_id: user?.id ?? null,
      details: (collectDetails?.() ?? {}) as never,
    });
    setSubmitting(false);
    if (error) {
      toast.error("We couldn't send that. Please call us at (540) 426-3322.");
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <CheckCircle2 className="mx-auto size-10 text-success" />
        <h3 className="mt-4 font-display text-xl font-semibold">{successTitle}</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{successBody}</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {children}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="full_name">Full name</Label>
          <Input id="full_name" name="full_name" required autoComplete="name" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Phone</Label>
        <Input id="phone" name="phone" type="tel" autoComplete="tel" />
      </div>
      {showMessage && (
        <div className="space-y-2">
          <Label htmlFor="message">{messageLabel}</Label>
          <Textarea id="message" name="message" rows={4} />
        </div>
      )}
      <Button type="submit" size="lg" disabled={submitting} className="w-full sm:w-auto">
        {submitting ? "Sending…" : submitLabel}
      </Button>
      <p className="text-xs text-muted-foreground">
        By submitting you agree to be contacted by My Car Business Services LLC about your request.
        We never sell your information.
      </p>
    </form>
  );
}
