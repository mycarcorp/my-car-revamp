import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Menu, Phone, User2, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { siteSettingsQuery } from "@/lib/queries";
import { useAuth } from "@/hooks/useAuth";

const NAV = [
  { to: "/search", label: "Shop inventory" },
  { to: "/finance", label: "Financing" },
  { to: "/sell", label: "Sell or trade" },
  { to: "/schedule", label: "Book a visit" },
  { to: "/blog", label: "Blog" },
  { to: "/about", label: "About" },
] as const;

export function SiteHeader() {
  const { data: settings } = useQuery(siteSettingsQuery());
  const { user, isStaff } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
      <div className="accent-bar h-1 w-full" />
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
        <Link to="/" className="flex items-center gap-2">
          <BrandLogo className="h-9 w-auto" />
          <span className="hidden text-xs font-medium text-muted-foreground sm:block">
            Fredericksburg, VA
          </span>
        </Link>


        <nav className="ml-6 hidden items-center gap-5 lg:flex">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="text-sm font-medium text-foreground/80 transition-colors hover:text-primary"
              activeProps={{ className: "text-primary" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <a
            href={`tel:${(settings?.phone ?? "").replace(/\D/g, "")}`}
            className="hidden items-center gap-2 text-sm font-semibold text-foreground md:flex"
          >
            <Phone className="size-4 text-accent" />
            {settings?.phone ?? "(540) 426-3322"}
          </a>
          {isStaff && (
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link to="/admin">Admin</Link>
            </Button>
          )}
          <Button asChild size="sm" variant={user ? "outline" : "default"}>
            <Link to={user ? "/account" : "/auth"}>
              <User2 className="size-4" />
              {user ? "Account" : "Sign in"}
            </Link>
          </Button>
          <button
            className="inline-flex size-9 items-center justify-center rounded-md border border-border lg:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-border bg-background px-4 py-3 lg:hidden">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className="block rounded-md px-2 py-2 text-sm font-medium hover:bg-muted"
            >
              {item.label}
            </Link>
          ))}
          <Link
            to="/contact"
            onClick={() => setOpen(false)}
            className="block rounded-md px-2 py-2 text-sm font-medium hover:bg-muted"
          >
            Contact
          </Link>
        </nav>
      )}
    </header>
  );
}
