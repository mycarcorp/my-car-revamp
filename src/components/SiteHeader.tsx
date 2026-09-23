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

  /**
   * Keep the appropriate parent navigation item active
   * even when the visitor is viewing a child page.
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

  /**
   * Top reading / page scroll progress indicator.
   */
  useEffect(() => {
    let animationFrame = 0;

    const updateScrollProgress = () => {
      cancelAnimationFrame(animationFrame);

      animationFrame = window.requestAnimationFrame(() => {
        const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;

        const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;

        const progress = scrollableHeight > 0 ? Math.min(100, Math.max(0, (scrollTop / scrollableHeight) * 100)) : 0;

        setScrollProgress(progress);
        setScrolled(scrollTop > 8);
      });
    };

    updateScrollProgress();

    window.addEventListener("scroll", updateScrollProgress, {
      passive: true,
    });

    window.addEventListener("resize", updateScrollProgress);

    /**
     * Recalculate if dynamic page content changes height.
     * Useful for inventory, blog articles, forms, images, etc.
     */
    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            updateScrollProgress();
          })
        : null;

    resizeObserver?.observe(document.documentElement);

    return () => {
      cancelAnimationFrame(animationFrame);

      window.removeEventListener("scroll", updateScrollProgress);

      window.removeEventListener("resize", updateScrollProgress);

      resizeObserver?.disconnect();
    };
  }, [pathname]);

  /**
   * Existing sign-in redirect logic.
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

  /**
   * Close the mobile navigation after route changes.
   */
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header
      className={`
        sticky top-0 z-50
        border-b border-border
        bg-background/95
        backdrop-blur-xl
        transition-shadow duration-300
        ${scrolled ? "shadow-[0_5px_20px_rgba(15,23,42,0.07)]" : ""}
      `}
    >
      {/* TOP SCROLL PROGRESS BAR */}
      <div
        aria-hidden="true"
        className="
          pointer-events-none
          absolute
          left-0
          top-0
          z-[70]
          h-[2px]
          w-full
          overflow-hidden
        "
      >
        <div
          className="
            h-full
            w-full
            origin-left
            bg-[#F7941D]
            will-change-transform
            transition-transform
            duration-75
            ease-linear
          "
          style={{
            transform: `scaleX(${scrollProgress / 100})`,
          }}
        />
      </div>

      {/* EXISTING BRAND ACCENT */}
      <div className="accent-bar h-1 w-full" />

      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
        {/* LOGO */}
        <Link
          to="/"
          aria-label="My Car home"
          className="
            flex
            items-center
            gap-2
            rounded-md
            transition-all
            duration-300
            ease-out
            hover:-translate-y-[1px]
            hover:scale-[1.015]
            focus-visible:outline-none
            focus-visible:ring-2
            focus-visible:ring-[#F7941D]/40
            focus-visible:ring-offset-2
          "
        >
          <BrandLogo className="h-12 w-auto" />
        </Link>

        {/* DESKTOP NAVIGATION */}
        <nav aria-label="Main navigation" className="ml-6 hidden items-center gap-5 lg:flex">
          {NAV.map((item) => {
            const active = isNavActive(item.to);

            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={`
                  group
                  relative
                  inline-flex
                  items-center
                  px-1
                  py-2
                  text-sm
                  font-semibold
                  transition-all
                  duration-300
                  ease-out
                  focus-visible:outline-none
                  focus-visible:ring-2
                  focus-visible:ring-[#F7941D]/35
                  focus-visible:ring-offset-2

                  ${
                    active
                      ? "text-[#F7941D]"
                      : `
                        text-foreground/80
                        hover:-translate-y-[2px]
                        hover:scale-[1.04]
                        hover:text-[#F7941D]
                      `
                  }
                `}
              >
                <span
                  className={`
                    transition-transform
                    duration-300
                    ease-out
                    ${active ? "" : "group-hover:drop-shadow-[0_3px_6px_rgba(247,148,29,0.18)]"}
                  `}
                >
                  {item.label}
                </span>

                {/* FULL-WIDTH ACTIVE / HOVER UNDERLINE */}
                <span
                  aria-hidden="true"
                  className={`
                    absolute
                    inset-x-0
                    bottom-0
                    h-[2px]
                    origin-center
                    rounded-full
                    bg-[#F7941D]
                    transition-transform
                    duration-300
                    ease-out
                    ${active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"}
                  `}
                />
              </Link>
            );
          })}
        </nav>

        {/* ACCOUNT / ACTIONS */}
        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <>
              {/* SAVED VEHICLES */}
              <Link
                to="/account"
                aria-label="Saved vehicles and account"
                className="
                  inline-flex
                  size-9
                  items-center
                  justify-center
                  rounded-full
                  text-primary
                  transition-all
                  duration-300
                  ease-out
                  hover:-translate-y-[1px]
                  hover:scale-110
                  hover:text-[#F7941D]
                  focus-visible:outline-none
                  focus-visible:ring-2
                  focus-visible:ring-[#F7941D]/40
                  focus-visible:ring-offset-2
                "
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
                      inline-flex
                      items-center
                      gap-1
                      rounded-full
                      border
                      border-primary/30
                      bg-background
                      p-1
                      shadow-sm
                      transition-all
                      duration-300
                      ease-out
                      hover:-translate-y-[1px]
                      hover:scale-[1.03]
                      hover:border-[#F7941D]/55
                      hover:shadow-md
                      focus-visible:outline-none
                      focus-visible:ring-2
                      focus-visible:ring-[#F7941D]/40
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
                duration-300
                ease-out
                hover:-translate-y-[1px]
                hover:scale-[1.025]
                hover:shadow-md
              "
            >
              <User2 className="size-4" />
              Sign in
            </Button>
          )}

          {!user && (
            <button
              type="button"
              className="
                inline-flex
                size-9
                items-center
                justify-center
                rounded-md
                border
                border-border
                text-foreground
                transition-all
                duration-300
                ease-out
                hover:-translate-y-[1px]
                hover:scale-105
                hover:border-[#F7941D]/50
                hover:text-[#F7941D]
                lg:hidden
              "
              onClick={() => setOpen((value) => !value)}
              aria-label={open ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={open}
            >
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          )}
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
          <div className="mx-auto max-w-7xl">
            {NAV.map((item) => {
              const active = isNavActive(item.to);

              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={`
                    group
                    relative
                    flex
                    items-center
                    py-3
                    text-sm
                    font-semibold
                    transition-all
                    duration-300
                    ease-out

                    ${
                      active
                        ? "text-[#F7941D]"
                        : `
                          text-foreground/80
                          hover:translate-x-1
                          hover:text-[#F7941D]
                        `
                    }
                  `}
                >
                  <span
                    className="
                      transition-transform
                      duration-300
                      group-hover:scale-[1.02]
                    "
                  >
                    {item.label}
                  </span>

                  {/* MOBILE FULL-WIDTH UNDERLINE */}
                  <span
                    aria-hidden="true"
                    className={`
                      absolute
                      inset-x-0
                      bottom-0
                      h-[2px]
                      origin-left
                      bg-[#F7941D]
                      transition-transform
                      duration-300
                      ease-out

                      ${active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"}
                    `}
                  />
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
                    group
                    relative
                    flex
                    items-center
                    py-3
                    text-sm
                    font-semibold
                    transition-all
                    duration-300
                    ease-out

                    ${
                      active
                        ? "text-[#F7941D]"
                        : `
                          text-foreground/80
                          hover:translate-x-1
                          hover:text-[#F7941D]
                        `
                    }
                  `}
                >
                  <span className="transition-transform duration-300 group-hover:scale-[1.02]">Contact</span>

                  <span
                    aria-hidden="true"
                    className={`
                      absolute
                      inset-x-0
                      bottom-0
                      h-[2px]
                      origin-left
                      bg-[#F7941D]
                      transition-transform
                      duration-300
                      ease-out

                      ${active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"}
                    `}
                  />
                </Link>
              );
            })()}
          </div>
        </nav>
      )}

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
