import { useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/app-client";
import { ctaButtonClass } from "@/lib/ui";
import { useAuth } from "@/hooks/useAuth";
import { mirrorLeadToLegacy } from "@/lib/legacy-mirror.functions";
import { sendLeadToGhl } from "@/lib/ghl-webhook.functions";
import { getAttributionDetails, mergeAttributionDetails } from "@/lib/attribution";
import { getLeadFormType, recordFormStart, recordLeadSubmission, withLeadEventId } from "@/lib/analytics";
import type { Database } from "@/integrations/supabase/types";

type LeadType = Database["public"]["Enums"]["lead_type"];

export type LeadVehicleSummary = {
  id?: string | null;
  vin?: string | null;
  stock_number?: string | null;
  year?: number | string | null;
  make?: string | null;
  model?: string | null;
  trim?: string | null;
  price?: number | string | null;
};

export type LeadFormProps = {
  leadType: LeadType;
  vehicleId?: string | null;
  /** Vehicle context sent along with the lead (used by the CRM webhook). */
  vehicle?: LeadVehicleSummary | null;
  submitLabel?: string;
  successTitle?: string;
  successBody?: string;
  showMessage?: boolean;
  messageLabel?: string;
  children?: ReactNode;
  /** Extra fields serialized into the lead details column. */
  collectDetails?: () => Record<string, unknown>;
  /** When set, the built-in contact fields and submit button are hidden and these values are used. */
  contact?: { fullName: string; email: string; phone?: string | null } | null;
};

export function LeadForm({
  leadType,
  vehicleId = null,
  vehicle = null,
  submitLabel = "Send request",
  successTitle = "Request received",
  successBody = "A member of our team will reach out shortly during business hours.",
  showMessage = true,
  messageLabel = "Anything we should know?",
  children,
  collectDetails,
  contact = null,
}: LeadFormProps) {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const formStarted = useRef(false);

  function markFormStarted() {
    if (formStarted.current) return;
    formStarted.current = true;
    const formType = getLeadFormType(leadType, collectDetails?.() ?? {});
    if (formType) recordFormStart(formType);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const full_name = (contact ? contact.fullName : String(form.get("full_name") ?? "")).trim();
    const email = (contact ? contact.email : String(form.get("email") ?? "")).trim();
    if (!full_name || !email) {
      toast.error("Please enter your name and email.");
      return;
    }
    setSubmitting(true);
    const phone = (contact ? contact.phone ?? "" : String(form.get("phone") ?? "")) || null;
    const message = String(form.get("message") ?? "") || null;
    const details = mergeAttributionDetails(collectDetails?.() ?? {}, getAttributionDetails());
    if (vehicle) {
      const title = [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(" ");
      if (title && !details["vehicle_of_interest"]) details["vehicle_of_interest"] = title;
      if (vehicle.vin) details["vehicle_vin"] = vehicle.vin;
      if (vehicle.stock_number) details["vehicle_stock_number"] = vehicle.stock_number;
      if (vehicle.year) details["vehicle_year"] = String(vehicle.year);
      if (vehicle.make) details["vehicle_make"] = vehicle.make;
      if (vehicle.model) details["vehicle_model"] = vehicle.model;
      if (vehicle.trim) details["vehicle_trim"] = vehicle.trim;
      if (vehicle.price != null && vehicle.price !== "") details["vehicle_price"] = String(vehicle.price);
      if (typeof window !== "undefined") details["vehicle_url"] = window.location.href;
    }
    // Opaque ID for browser/server event deduplication; added only to non-finance lead types.
    withLeadEventId(leadType, details);
    const { error } = await supabase.from("leads").insert({
      lead_type: leadType,
      full_name,
      email,
      phone,
      message,
      vehicle_id: vehicleId,
      user_id: user?.id ?? null,
      details: details as never,
    });
    setSubmitting(false);
    if (error) {
      toast.error("We couldn't send that. Please call us at (540) 426-3322.");
      return;
    }
    recordLeadSubmission(true, leadType, details);
    // Mirror into the legacy tables. Never blocks or fails the submission.
    void mirrorLeadToLegacy({
      data: {
        leadType,
        fullName: full_name,
        email,
        phone,
        message,
        vehicleId,
        userId: user?.id ?? null,
        details,
      },
    }).catch(() => undefined);
    // Mirror to the CRM webhook, only after the database save succeeded.
    if (leadType === "finance" || leadType === "availability" || leadType === "trade" || leadType === "appointment") {
      void sendLeadToGhl({
        data: {
          leadType,
          fullName: full_name,
          email,
          phone,
          message,
          vehicleUrl: typeof window !== "undefined" ? window.location.href : null,
          vehicle: vehicle ?? (vehicleId ? { id: vehicleId } : null),
          details,
        },
      }).catch((err) => console.error("[ghl-webhook] client call failed", err));
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
    <form onSubmit={onSubmit} onInputCapture={markFormStarted} className="space-y-4">
      {children}
      {!contact && (<>
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
      <Button type="submit" size="lg" disabled={submitting} className={`${ctaButtonClass} w-full sm:w-auto`}>
        {submitting ? "Sending…" : submitLabel}
      </Button>
      <p className="text-xs text-muted-foreground">
        By submitting you agree to be contacted by My Car Business Services LLC about your request.
        We never sell your information.
      </p>
      </>)}
    </form>
  );
}
