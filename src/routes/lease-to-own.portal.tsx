import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Car, LogOut, Phone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { SignInSheet } from "@/components/SignInSheet";
import {
  DocumentVault,
  EmergencyAssistance,
  MaintenanceScheduler,
  MileageTracker,
  PaymentCenter,
  PayoffCountdown,
} from "@/components/lease-to-own/PortalPanels";
import { formatCents, humanize, openLeaseDocument } from "@/components/lease-to-own/helpers";
import { PendingIntegration, StatusPill } from "@/components/lease-to-own/shared";
import { useAuth } from "@/hooks/useAuth";
import { applicationStatusLabel, getLeaseTier, isLeaseTierKey } from "@/lib/lease-to-own";
import { getMyLeasePortal } from "@/lib/lease-to-own.functions";
import { isLeaseSetupPending, leaseErrorMessage } from "@/lib/lease-to-own-client";

export const Route = createFileRoute("/lease-to-own/portal")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Lease to Own Portal | My Car Corp" },
      { name: "description", content: "Manage your My Car Lease to Own account." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PortalPage,
});

function PortalPage() {
  const { user, session, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [signInOpen, setSignInOpen] = useState(false);
  const token = session?.access_token ?? "";
  const portalKey = ["lease-portal", user?.id ?? "anon"];
  const portal = useQuery({
    queryKey: portalKey,
    enabled: Boolean(token),
    retry: false,
    queryFn: () => getMyLeasePortal({ data: { accessToken: token } }),
  });

  async function logout() {
    queryClient.removeQueries({ queryKey: ["lease-portal"] });
    queryClient.removeQueries({ queryKey: ["lease-application"] });
    await signOut();
    void navigate({ to: "/lease-to-own" });
  }

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
          <h2 className="text-xl font-bold">Client sign in</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in with the email you used for your Lease to Own application to see your account,
            payments and documents.
          </p>
          <Button className="mt-5" onClick={() => setSignInOpen(true)}>
            Sign in or create account
          </Button>
        </div>
        <Sheet open={signInOpen} onOpenChange={setSignInOpen}>
          <SheetContent className="overflow-y-auto">{signInOpen && <SignInSheet />}</SheetContent>
        </Sheet>
      </Shell>
    );
  }

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">
        Signed in as <strong className="text-foreground">{user.email}</strong>
      </p>
      <Button variant="outline" size="sm" onClick={() => void logout()}>
        <LogOut className="size-4" /> Sign out
      </Button>
    </div>
  );

  if (portal.isLoading)
    return (
      <Shell>
        {header}
        <p className="mt-6 text-sm text-muted-foreground">Loading your account…</p>
      </Shell>
    );
  if (portal.error || !portal.data) {
    return (
      <Shell>
        {header}
        <div className="mt-6">
          <PendingIntegration
            title={
              isLeaseSetupPending(portal.error)
                ? "The Lease to Own portal is being set up"
                : "We couldn't load your account"
            }
          >
            {leaseErrorMessage(portal.error)}
            <a
              href="tel:+15404263322"
              className="mt-3 flex items-center gap-2 font-semibold text-primary"
            >
              <Phone className="size-4" /> (540) 426-3322
            </a>
          </PendingIntegration>
        </div>
      </Shell>
    );
  }

  const { application, account, payments, requests, documents } = portal.data;
  const refresh = () => void queryClient.invalidateQueries({ queryKey: portalKey });
  const openDoc = (id: number) => void openLeaseDocument(token, id);
  const displayName = application?.full_legal_name ?? user.email ?? "My Car customer";

  return (
    <Shell>
      {header}

      <section
        aria-labelledby="lto-account-title"
        className="mt-6 rounded-xl bg-primary p-6 text-primary-foreground"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 id="lto-account-title" className="text-2xl font-bold">
              {displayName}
            </h2>
            {account ? (
              <p className="mt-1 text-sm text-primary-foreground/80">
                Account #{account.account_number} • {account.vehicle_title ?? "Vehicle pending"}
                {account.vehicle_vin ? ` • VIN ${account.vehicle_vin}` : ""}
              </p>
            ) : (
              <p className="mt-1 text-sm text-primary-foreground/80">
                No active lease account yet.
              </p>
            )}
          </div>
          {account && (
            <div className="flex flex-wrap gap-2">
              <StatusPill tone="info">Lease: {humanize(account.status)}</StatusPill>
              <StatusPill tone={account.payment_status === "current" ? "success" : "warning"}>
                Payments: {humanize(account.payment_status)}
              </StatusPill>
            </div>
          )}
        </div>
        {account ? (
          <dl className="mt-5 grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-primary-foreground/70">Current balance</dt>
              <dd className="font-display text-2xl font-black">
                {formatCents(account.current_balance_cents)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-primary-foreground/70">Package</dt>
              <dd className="font-semibold">
                {account.tier && isLeaseTierKey(account.tier)
                  ? getLeaseTier(account.tier).name
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-primary-foreground/70">Installment</dt>
              <dd className="font-semibold">
                {formatCents(account.payment_cents)} {account.payment_frequency ?? ""}
              </dd>
            </div>
          </dl>
        ) : application ? (
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <StatusPill tone="info">
              Application: {applicationStatusLabel(application.status)}
            </StatusPill>
            <Button asChild size="sm" variant="secondary">
              <Link
                to="/lease-to-own/apply"
                search={{
                  tier: application.tier,
                  value: Math.round((application.vehicle_value_cents ?? 1000000) / 100),
                }}
              >
                Continue application
              </Link>
            </Button>
          </div>
        ) : (
          <Button asChild size="sm" variant="secondary" className="mt-5">
            <Link to="/lease-to-own">
              <Car className="size-4" /> Explore Lease to Own
            </Link>
          </Button>
        )}
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {account && <PayoffCountdown account={account} />}
        {account && (
          <PaymentCenter account={account} payments={payments} onOpenDocument={openDoc} />
        )}
        {account && <MileageTracker account={account} />}
        <MaintenanceScheduler
          accessToken={token}
          enabled={Boolean(account)}
          requests={requests}
          onCreated={refresh}
        />
        <EmergencyAssistance
          accessToken={token}
          enabled={Boolean(account)}
          requests={requests}
          onCreated={refresh}
        />
        <DocumentVault documents={documents} onOpen={openDoc} />
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
        <Link to="/" className="hover:text-primary">
          Home
        </Link>{" "}
        /{" "}
        <Link to="/lease-to-own" className="hover:text-primary">
          Lease to Own
        </Link>{" "}
        / Portal
      </nav>
      <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-primary sm:text-4xl">
        Lease to Own portal
      </h1>
      <div className="mt-6">{children}</div>
    </div>
  );
}
