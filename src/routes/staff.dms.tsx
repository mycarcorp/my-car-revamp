import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { SignInSheet } from "@/components/SignInSheet";
import { VerifyEmailGate } from "@/components/VerifyEmailGate";
import { StaffDms } from "@/components/lease-to-own/StaffDms";
import { PendingIntegration } from "@/components/lease-to-own/shared";
import { useAuth } from "@/hooks/useAuth";
import { staffLeaseOverview } from "@/lib/lease-to-own.functions";
import { isLeaseSetupPending, leaseErrorMessage } from "@/lib/lease-to-own-client";

export const Route = createFileRoute("/staff/dms")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Staff DMS Portal — MyCar" },
      { name: "description", content: "Internal My Car staff console." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: StaffDmsPage,
});

/**
 * The UI gate below is only a convenience. Every server function behind this
 * page independently verifies the bearer token and the owner/editor role.
 */
function StaffDmsPage() {
  const { user, session, isStaff, emailVerified, loading } = useAuth();
  const [signInOpen, setSignInOpen] = useState(false);
  const token = session?.access_token ?? "";
  const queryKey = ["staff-lease-overview", user?.id ?? "anon"] as const;
  const overview = useQuery({
    queryKey,
    enabled: Boolean(token && isStaff && emailVerified),
    retry: false,
    queryFn: () => staffLeaseOverview({ data: { accessToken: token } }),
  });

  if (loading)
    return (
      <Shell>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </Shell>
    );

  if (!user) {
    return (
      <Shell>
        <div className="mx-auto max-w-md rounded-xl border border-border bg-card p-6 text-center">
          <h2 className="text-xl font-bold">Staff sign in</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in with your My Car staff account.
          </p>
          <Button className="mt-5" onClick={() => setSignInOpen(true)}>
            Sign in
          </Button>
        </div>
        <Sheet open={signInOpen} onOpenChange={setSignInOpen}>
          <SheetContent className="overflow-y-auto">{signInOpen && <SignInSheet />}</SheetContent>
        </Sheet>
      </Shell>
    );
  }

  if (!emailVerified) return <VerifyEmailGate email={user.email ?? ""} />;

  if (!isStaff) {
    return (
      <Shell>
        <div className="mx-auto max-w-md py-10 text-center">
          <ShieldAlert className="mx-auto size-8 text-destructive" aria-hidden="true" />
          <h2 className="mt-3 text-xl font-bold">Staff access only</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            This account doesn't have dealership staff permissions.
          </p>
          <Button asChild variant="outline" className="mt-5">
            <Link to="/">Back to the site</Link>
          </Button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      {overview.isLoading && <p className="text-sm text-muted-foreground">Loading console…</p>}
      {overview.error && (
        <PendingIntegration
          title={
            isLeaseSetupPending(overview.error)
              ? "Lease to Own tables are not installed yet"
              : "Couldn't load the console"
          }
        >
          {isLeaseSetupPending(overview.error)
            ? "Run supabase/migrations_legacy/2026_mc_lease_to_own.sql in the SQL editor, then reload."
            : leaseErrorMessage(overview.error)}
        </PendingIntegration>
      )}
      {overview.data && <StaffDms accessToken={token} data={overview.data} queryKey={queryKey} />}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-text">Internal</p>
      <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-primary">
        Staff DMS Portal — Lease to Own
      </h1>
      <div className="mt-6">{children}</div>
    </div>
  );
}
