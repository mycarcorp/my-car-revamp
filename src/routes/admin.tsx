import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Car, FileText, Receipt, Inbox, LogOut, Settings, Users, ExternalLink } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { VerifyEmailGate } from "@/components/VerifyEmailGate";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Staff Admin — MyCar" },
      { name: "description", content: "Internal MyCar staff tools for inventory, leads and content." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Staff Admin — MyCar" },
      { property: "og:description", content: "Internal staff tools." },
    ],
  }),
  component: AdminLayout,
});

const NAV = [
  { to: "/admin", label: "Dashboard", icon: Inbox, exact: true },
  { to: "/admin/customers", label: "Customers", icon: Users, exact: false },
  { to: "/admin/transactions", label: "Transactions", icon: Receipt, exact: false },
  { to: "/admin/inventory", label: "Inventory", icon: Car, exact: false },
  { to: "/admin/blog", label: "Blog", icon: FileText, exact: false },
  { to: "/admin/settings", label: "Site settings", icon: Settings, exact: false },
] as const;

function AdminLayout() {
  const { user, isStaff, loading, emailVerified, signOut } = useAuth();
  const navigate = useNavigate();

  async function logout() {
    await signOut();
    void navigate({ to: "/" });
  }

  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/" });
  }, [loading, user, navigate]);

  if (loading) {
    return <div className="p-10 text-sm text-muted-foreground">Loading…</div>;
  }

  if (!user) return null;

  if (!emailVerified) return <VerifyEmailGate email={user.email ?? ""} />;

  if (!isStaff) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="font-display text-2xl font-bold">Staff access only</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This account doesn't have dealership staff permissions. Ask an owner to grant you the editor
          or owner role.
        </p>
        <Button asChild className="mt-6" variant="outline">
          <Link to="/">Back to the site</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full">
      <aside className="sticky top-0 hidden h-screen w-52 shrink-0 flex-col overflow-y-auto bg-sidebar p-3 text-sidebar-foreground md:flex">
        <Link to="/" className="font-display text-lg font-extrabold">
          My<span className="text-sidebar-primary">Car</span>{" "}
          <span className="text-xs font-medium opacity-70">admin</span>
        </Link>
        <nav className="mt-8 space-y-1">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.exact }}
              activeProps={{ className: "bg-sidebar-accent" }}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-sidebar-accent"
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <Link
          to="/"
          className="mt-auto flex items-center gap-2 rounded-md px-3 py-2 text-sm opacity-80 hover:opacity-100"
        >
          <ExternalLink className="size-4" /> View public site
        </Link>
        <Button variant="ghost" className="justify-start gap-2 px-3 text-sidebar-foreground hover:bg-sidebar-accent" onClick={() => void logout()}>
          <LogOut className="size-4" /> Log out
        </Button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col bg-surface">
        <nav className="flex gap-2 overflow-x-auto border-b border-border bg-background p-2 md:hidden">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium"
              activeProps={{ className: "bg-muted" }}
            >
              {item.label}
            </Link>
          ))}
          <Button variant="ghost" className="w-full justify-start gap-2 px-3" onClick={() => void logout()}>
            <LogOut className="size-4" /> Log out
          </Button>
        </nav>
        <Outlet />
      </div>
    </div>
  );
}
