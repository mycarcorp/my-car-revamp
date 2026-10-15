import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { SignInSheet } from "@/components/SignInSheet";
import { readPendingPurchase } from "@/components/GetStartedButton";

export const Route = createFileRoute("/my")({
  ssr: false,
  head: () => ({
    meta: [
      {
        title: "My Dashboard — MyCar",
      },
      {
        name: "description",
        content: "Track your MyCar vehicle purchase, payment choice, trade-in and status in one place.",
      },
      {
        property: "og:title",
        content: "My Dashboard — MyCar",
      },
      {
        property: "og:description",
        content: "Track your MyCar vehicle purchase and status.",
      },
      {
        property: "og:type",
        content: "website",
      },
      {
        name: "twitter:card",
        content: "summary",
      },
      {
        name: "robots",
        content: "noindex",
      },
    ],
  }),
  component: MyLayout,
});

function MyLayout() {
  const { user, loading } = useAuth();
  const [signInOpen, setSignInOpen] = useState(true);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10">
        <p className="text-sm text-muted-foreground">Loading your My Car dashboard...</p>
      </div>
    );
  }

  if (!user) {
    const pending = readPendingPurchase();

    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="font-display text-3xl font-bold">Sign in to get started</h1>

        <p className="mt-3 text-sm text-muted-foreground">
          {pending
            ? `Sign in or create an account to start buying the ${pending.title}. Your progress will be saved as you complete your purchase.`
            : "Sign in to see your purchases and track their status."}
        </p>

        <Button className="mt-6" onClick={() => setSignInOpen(true)}>
          Sign in or create account
        </Button>

        <Sheet open={signInOpen} onOpenChange={setSignInOpen}>
          <SheetContent className="overflow-y-auto">
            <SignInSheet />
          </SheetContent>
        </Sheet>
      </div>
    );
  }

  return (
    <div className="min-h-[65vh] w-full">
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
