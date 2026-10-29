import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";

import appCss from "../styles.css?url";
import logoUrl from "@/assets/mycar-logo.png";
import socialImage from "@/assets/home-hero-dealership-v3.jpg";
import { absoluteUrl, buildDealerJsonLd, jsonLdScript } from "@/lib/seo";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider } from "@/hooks/useAuth";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Toaster } from "@/components/ui/sonner";
import { AnalyticsConsentManager } from "@/components/AnalyticsConsentManager";
import { captureAttribution } from "@/lib/attribution";
import { configureAnalytics, trackMetaPageView, trackPageView } from "@/lib/analytics";
import { beginVisit, trackPath } from "@/lib/visitor-personalization";
import {
  CHAT_WIDGET_HIDE_CSS,
  createBrowserChatWidgetEnv,
  createChatWidgetManager,
  isChatWidgetAllowed,
  type ChatWidgetManager,
} from "@/lib/chat-widget";

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

function NotFoundComponent() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          That page doesn't exist. The vehicle may have sold or the link may have changed.
        </p>
        <div className="mt-6">
          <Link
            to="/search"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Browse inventory
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. Try refreshing, or call us at (540) 426-3322.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "MyCar — Used Cars in Fredericksburg, VA" },
      {
        name: "description",
        content:
          "Independent used-vehicle dealership in Fredericksburg, Virginia. Shop inventory, get pre-qualified, and value your trade with MyCar.",
      },
      { name: "author", content: "My Car Business Services LLC" },
      { property: "og:title", content: "MyCar — Used Cars in Fredericksburg, VA" },
      {
        property: "og:description",
        content: "Shop inventory, get pre-qualified, and value your trade with MyCar.",
      },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "My Car" },
      { property: "og:locale", content: "en_US" },
      // Fallback preview image; pages with their own image (vehicles, articles) override it.
      { property: "og:image", content: absoluteUrl(socialImage) },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: absoluteUrl(socialImage) },
    ],
    // One dealership entity for the whole site; vehicle and article schema refer to it by @id.
    scripts: [jsonLdScript(buildDealerJsonLd(logoUrl))],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700;800&family=Inter:wght@400;500;600&display=swap",
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isAdmin = pathname.startsWith("/admin");
  // Customer approval links carry a private token: no site chrome and no analytics on them.
  const isApproval = pathname.startsWith("/approve/");

  const searchStr = useRouterState({ select: (s) => s.location.searchStr });
  // The chat widget never runs on account, finance, staff or sign-in routes. If it is already running when the
  // visitor arrives on one, the page is reloaded to unload it, and that render must not be counted as a visit.
  const chatAllowed = isChatWidgetAllowed(pathname, searchStr);
  const chatManager = useRef<ChatWidgetManager | null>(null);
  if (typeof window !== "undefined" && !chatManager.current) {
    chatManager.current = createChatWidgetManager(createBrowserChatWidgetEnv());
  }
  const chatReloading = chatManager.current?.needsReload(chatAllowed) ?? false;
  // Admin hero-editor preview frame loads "/" — never count it as a visit.
  const skipTracking = isAdmin || isApproval || searchStr.includes("heroPreview=1") || chatReloading;
  useIsomorphicLayoutEffect(() => {
    configureAnalytics(pathname, !skipTracking);
    if (!skipTracking) {
      captureAttribution();
      trackPageView(pathname);
    }
  }, [pathname, searchStr, skipTracking]);

  useEffect(() => {
    if (skipTracking) return;
    beginVisit();
    trackPath(pathname);
  }, [pathname, skipTracking]);

  useEffect(() => {
    if (!skipTracking) trackMetaPageView(pathname);
  }, [pathname, skipTracking]);

  useEffect(() => {
    // Chat is not a conversion tracker: its start is delayed so Meta/attribution event timing is unchanged.
    chatManager.current?.sync(chatAllowed);
  }, [chatAllowed]);

  useEffect(() => () => chatManager.current?.dispose(), []);

  return (
    <QueryClientProvider client={queryClient}>
      {!chatAllowed && <style>{CHAT_WIDGET_HIDE_CSS}</style>}
      <AuthProvider>
        <div className="flex min-h-screen flex-col">
          {!isAdmin && !isApproval && <SiteHeader />}
          <main className="flex-1">
            {/* Required: nested routes render here. */}
            <Outlet />
          </main>
          {!isAdmin && !isApproval && <SiteFooter />}
        </div>
        <Toaster />
      </AuthProvider>
      <AnalyticsConsentManager pathname={pathname} />
    </QueryClientProvider>
  );
}
