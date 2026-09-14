import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Heart, LogOut, Menu, User2, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";
import { BrandLogo } from "@/components/BrandLogo";
import { SignInSheet } from "@/components/SignInSheet";
import { supabase } from "@/integrations/supabase/app-client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const NAV = [
  { to: "/search", label: "Shop inventory" },
  { to: "/finance", label: "Financing" },
  { to: "/sell", label: "Sell or trade" },
  { to: "/schedule", label: "Book a visit" },
  { to: "/blog", label: "Blog" },
] as const;

export function SiteHeader() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);

  const profileName = String(
    user?.user_metadata?.["full_name"] ?? user?.user_metadata?.["name"] ?? "",
  ).trim();
  const initials = (profileName || user?.email || "M")
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  async function logout() {
    await supabase.auth.signOut();
    void navigate({ to: "/" });
  }

  useEffect(() => {
    if (!user || !signInOpen) return;

    setSignInOpen(false);
    void supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .then(({ data }) => {
        const staff = (data ?? []).some((row) => row.role === "owner" || row.role === "editor");
        void navigate({ to: staff ? "/admin" : "/search" });
      });
  }, [user, signInOpen, navigate]);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
      <div className="accent-bar h-1 w-full" />
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
        <Link to="/" className="flex items-center gap-2">
          <BrandLogo className="h-12 w-auto" />
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
          {user ? (
            <>
              <Link
                to="/account"
                aria-label="Saved vehicles and account"
                className="inline-flex size-9 items-center justify-center text-primary transition hover:text-primary/70"
              >
                <Heart className="size-5" />
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Open account menu"
                    className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-background p-1 shadow-sm transition hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  >
                    <span className="inline-flex size-8 items-center justify-center rounded-full bg-[#F7941D] text-xs font-bold text-slate-950">
                      {initials}
                    </span>
                    <Menu className="mx-1 size-5 text-primary" />
                  </button>
                </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <div className="px-2 py-2">
                      <p className="text-sm font-semibold">{profileName || "MyCar customer"}</p>
                      <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to="/account"><User2 className="size-4" /> Account settings</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => void logout()}>
                      <LogOut className="size-4" /> Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Button size="sm" onClick={() => setSignInOpen(true)}>
              <User2 className="size-4" />
              Sign in
            </Button>
          )}
          {!user && (
            <button
              className="inline-flex size-9 items-center justify-center rounded-md border border-border lg:hidden"
              onClick={() => setOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          )}
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

      <Sheet open={signInOpen} onOpenChange={setSignInOpen}>
        {signInOpen && (
          <style>{`
            #chat-widget-container,
            #lc_chat_widget,
            chat-widget,
            iframe[src*="leadconnectorhq.com"],
            iframe[src*="leadconnector"] {
              display: none !important;
            }
          `}</style>
        )}
        <SheetContent
          side="right"
          className="z-[100] w-[min(100%,380px)] overflow-y-auto p-6 sm:max-w-md"
        >
          <SignInSheet />
        </SheetContent>
      </Sheet>
    </header>
  );
}
