import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Car, ClipboardList, Heart, LayoutDashboard, LogOut, Settings } from "lucide-react";
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
      { title: "My Dashboard — MyCar" },
      { name: "description", content: "Track your MyCar vehicle purchase, payment choice, trade-in and status in one place." },
      { property: "og:title", content: "My Dashboard — MyCar" },
      { property: "og:description", content: "Track your MyCar vehicle purchase and status." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MyLayout,
});

const NAV = [
  { to: "/my", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/my/purchases", label: "My purchases", icon: Car, exact: false },
  { to: "/account", label: "Saved vehicles", icon: Heart, exact: true },
  { to: "/account", label: "My requests", icon: ClipboardList, exact: true },
  { to: "/account", label: "Profile & settings", icon: Settings, exact: true },
] as const;

function MyLayout() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [signInOpen, setSignInOpen] = useState(true);

  if (loading) return <div className="p-10 text-sm text-muted-foreground">Loading…</div>;

  if (!user) {
    const pending = readPendingPurchase();
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="font-display text-3xl font-bold">Sign in to get started</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {pending
            ? `Sign in or create an account to start buying the ${pending.title}. Your progress is saved.`
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

  async function logout() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await signOut();
    void navigate({ to: "/", replace: true });
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 md:flex-row lg:px-8">
      <aside className="md:sticky md:top-24 md:h-fit md:w-60 md:shrink-0">
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="hidden px-3 pb-3 pt-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary md:block">
            My dashboard
          </p>
          <nav className="flex gap-1 overflow-x-auto md:flex-col">
            {NAV.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                activeOptions={{ exact: item.exact }}
                activeProps={{ className: item.to.startsWith("/my") ? "bg-primary/10 text-primary" : "" }}
                className="flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
              >
                <item.icon className="size-4" /> {item.label}
              </Link>
            ))}
            <button
              type="button"
              onClick={() => void logout()}
              className="flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-muted-foreground hover:bg-muted"
            >
              <LogOut className="size-4" /> Sign out
            </button>
          </nav>
        </div>
      </aside>
      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}
