import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Heart, LayoutDashboard, LogOut, Menu, User2, X } from "lucide-react";

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
  const { user, isStaff } = useAuth();
  const navigate = useNavigate();

  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  const [open, setOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [scrolled, setScrolled] = useState(false);

  const profileName = String(user?.user_metadata?.["full_name"] ?? user?.user_metadata?.["name"] ?? "").trim();

  const initials = (profileName || user?.email || "M")
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  /*
   * Active navigation logic
   *
   * Shop inventory should also remain active while viewing
   * an individual vehicle page.
   */
  function isNavActive(to: string) {
    if (to === "/search") {
      return pathname === "/search" || pathname.startsWith("/search/") || pathname.startsWith("/inventory/");
    }

    return pathname === to || pathname.startsWith(`${to}/`);
  }

  async function logout() {
    await supabase.auth.signOut();

    void navigate({
      to: "/",
    });
  }

  /*
   * Scroll progress indicator.
   * Updates as the visitor moves down the current page.
   */
  useEffect(() => {
    let animationFrame = 0;

    const updateScrollProgress = () => {
      cancelAnimationFrame(animationFrame);

      animationFrame = requestAnimationFrame(() => {
        const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;

        const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;

        const nextProgress =
          scrollableHeight > 0 ? Math.min(100, Math.max(0, (scrollTop / scrollableHeight) * 100)) : 0;

        setScrollProgress(nextProgress);
        setScrolled(scrollTop > 8);
      });
    };

    updateScrollProgress();

    window.addEventListener("scroll", updateScrollProgress, {
      passive: true,
    });

    window.addEventListener("resize", updateScrollProgress);

    /*
     * Recalculate when page content changes height,
     * such as inventory, blog posts, images or forms loading.
     */
    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            updateScrollProgress();
          })
        : null;

    if (resizeObserver) {
      resizeObserver.observe(document.documentElement);
    }

    return () => {
      cancelAnimationFrame(animationFrame);

      window.removeEventListener("scroll", updateScrollProgress);

      window.removeEventListener("resize", updateScrollProgress);

      resizeObserver?.disconnect();
    };
  }, [pathname]);

  /*
   * Sign-in redirect logic.
   */
  useEffect(() => {
    if (!user || !signInOpen) return;

    setSignInOpen(false);

    void supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .then(({ data }) => {
        const staff = (data ?? []).some((row) => row.role === "owner" || row.role === "editor");

        void navigate({
          to: staff ? "/admin" : "/search",
        });
      });
  }, [user, signInOpen, navigate]);

  /*
   * Close mobile navigation when moving to another route.
   */
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header
      className={`sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-xl transition-shadow duration-300 ${
        scrolled ? "shadow-[0_6px_24px_rgba(15,23,42,0.08)]" : ""
      }`}
    >
      {/* BRAND ACCENT BAR */}
      <div className="accent-bar h-1 w-full" />

      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
        {/* LOGO */}
        <Link
          to="/"
          aria-label="My Car home"
          className="flex items-center gap-2 rounded-md transition duration-200 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F7941D]/50 focus-visible:ring-offset-2"
        >
          <BrandLogo className="h-12 w-auto transition-transform duration-200 hover:scale-[1.02]" />
        </Link>

        {/* DESKTOP NAVIGATION */}
        <nav aria-label="Main navigation" className="ml-6 hidden items-center gap-1 lg:flex">
          {NAV.map((item) => {
            const active = isNavActive(item.to);

            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={`
                  relative rounded-lg px-3 py-2
                  text-sm font-semibold
                  transition-all duration-200
                  focus-visible:outline-none
                  focus-visible:ring-2
                  focus-visible:ring-[#F7941D]/40
                  ${
                    active
                      ? `
                        bg-[#F7941D]/10
                        text-[#F7941D]
                        shadow-[0_0_18px_rgba(247,148,29,0.16)]
                      `
                      : `
                        text-foreground/75
                        hover:bg-[#F7941D]/[0.06]
                        hover:text-[#F7941D]
                      `
                  }
                `}
              >
                {item.label}

                {/* ACTIVE UNDERLINE */}
                <span
                  aria-hidden="true"
                  className={`
                    absolute
                    bottom-0
                    left-1/2
                    h-[2px]
                    -translate-x-1/2
                    rounded-full
                    bg-[#F7941D]
                    shadow-[0_0_8px_rgba(247,148,29,0.65)]
                    transition-all
                    duration-300
                    ${active ? "w-6 opacity-100" : "w-0 opacity-0"}
                  `}
                />
              </Link>
            );
          })}
        </nav>

        {/* ACCOUNT / MOBILE CONTROLS */}
        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <>
              {/* SAVED VEHICLES */}
              <Link
                to="/account"
                aria-label="Saved vehicles and account"
                className={`
                  inline-flex size-9 items-center justify-center
                  rounded-full
                  transition-all duration-200
                  ${
                    pathname.startsWith("/account")
                      ? `
                        bg-[#F7941D]/10
                        text-[#F7941D]
                        shadow-[0_0_14px_rgba(247,148,29,0.2)]
                      `
                      : `
                        text-primary
                        hover:bg-primary/5
                        hover:text-[#F7941D]
                      `
                  }
                `}
              >
                <Heart className="size-5" />
              </Link>

              {/* ACCOUNT MENU */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Open account menu"
                    className="
                      inline-flex items-center gap-1
                      rounded-full
                      border border-primary/30
                      bg-background
                      p-1
                      shadow-sm
                      transition-all
                      duration-200
                      hover:border-[#F7941D]/60
                      hover:shadow-[0_0_14px_rgba(247,148,29,0.14)]
                      focus-visible:outline-none
                      focus-visible:ring-2
                      focus-visible:ring-[#F7941D]/50
                      focus-visible:ring-offset-2
                    "
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

                  {isStaff && (
                    <DropdownMenuItem asChild>
                      <Link to="/admin">
                        <LayoutDashboard className="size-4" />
                        Admin dashboard
                      </Link>
                    </DropdownMenuItem>
                  )}

                  <DropdownMenuItem asChild>
                    <Link to="/account">
                      <User2 className="size-4" />
                      Account settings
                    </Link>
                  </DropdownMenuItem>

                  <DropdownMenuItem onSelect={() => void logout()}>
                    <LogOut className="size-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Button
              size="sm"
              onClick={() => setSignInOpen(true)}
              className="
                transition-all
                duration-200
                hover:shadow-[0_0_14px_rgba(247,148,29,0.18)]
              "
            >
              <User2 className="size-4" />
              Sign in
            </Button>
          )}

          {/* MOBILE MENU BUTTON */}
          <button
            type="button"
            className={`
              inline-flex size-9 items-center justify-center
              rounded-md
              border
              transition-all
              duration-200
              lg:hidden
              ${
                open
                  ? `
                    border-[#F7941D]/50
                    bg-[#F7941D]/10
                    text-[#F7941D]
                    shadow-[0_0_12px_rgba(247,148,29,0.16)]
                  `
                  : `
                    border-border
                    text-foreground
                    hover:border-[#F7941D]/40
                    hover:bg-[#F7941D]/5
                    hover:text-[#F7941D]
                  `
              }
            `}
            onClick={() => setOpen((value) => !value)}
            aria-label={open ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={open}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {/* MOBILE NAVIGATION */}
      {open && (
        <nav
          aria-label="Mobile navigation"
          className="
            border-t
            border-border
            bg-background/98
            px-4
            py-3
            shadow-lg
            backdrop-blur-xl
            lg:hidden
          "
        >
          <div className="mx-auto max-w-7xl space-y-1">
            {NAV.map((item) => {
              const active = isNavActive(item.to);

              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={`
                    relative
                    flex
                    items-center
                    rounded-lg
                    px-3
                    py-3
                    text-sm
                    font-semibold
                    transition-all
                    duration-200
                    ${
                      active
                        ? `
                          bg-[#F7941D]/10
                          text-[#F7941D]
                          shadow-[inset_3px_0_0_#F7941D]
                        `
                        : `
                          text-foreground/80
                          hover:bg-[#F7941D]/5
                          hover:text-[#F7941D]
                        `
                    }
                  `}
                >
                  {item.label}

                  {active && (
                    <span className="ml-auto size-1.5 rounded-full bg-[#F7941D] shadow-[0_0_7px_rgba(247,148,29,0.8)]" />
                  )}
                </Link>
              );
            })}

            {(() => {
              const active = isNavActive("/contact");

              return (
                <Link
                  to="/contact"
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={`
                    flex
                    items-center
                    rounded-lg
                    px-3
                    py-3
                    text-sm
                    font-semibold
                    transition-all
                    duration-200
                    ${
                      active
                        ? `
                          bg-[#F7941D]/10
                          text-[#F7941D]
                          shadow-[inset_3px_0_0_#F7941D]
                        `
                        : `
                          text-foreground/80
                          hover:bg-[#F7941D]/5
                          hover:text-[#F7941D]
                        `
                    }
                  `}
                >
                  Contact
                  {active && (
                    <span className="ml-auto size-1.5 rounded-full bg-[#F7941D] shadow-[0_0_7px_rgba(247,148,29,0.8)]" />
                  )}
                </Link>
              );
            })()}
          </div>
        </nav>
      )}

      {/* SCROLL PROGRESS BAR */}
      <div
        aria-hidden="true"
        className="
          pointer-events-none
          absolute
          bottom-0
          left-0
          z-[60]
          h-[2px]
          w-full
          overflow-hidden
        "
      >
        <div
          className="
            h-full
            bg-[#F7941D]
            shadow-[0_0_7px_rgba(247,148,29,0.55)]
            transition-[width]
            duration-100
            ease-out
          "
          style={{
            width: `${scrollProgress}%`,
          }}
        />
      </div>

      {/* SIGN-IN DRAWER */}
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

        <SheetContent side="right" className="z-[100] w-[min(100%,380px)] overflow-y-auto p-6 sm:max-w-md">
          <SignInSheet />
        </SheetContent>
      </Sheet>
    </header>
  );
}
