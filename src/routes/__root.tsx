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
import { useEffect, useLayoutEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider } from "@/hooks/useAuth";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Toaster } from "@/components/ui/sonner";
import { AnalyticsConsentManager } from "@/components/AnalyticsConsentManager";
import { captureAttribution } from "@/lib/attribution";
import { configureAnalytics, trackMetaPageView, trackPageView } from "@/lib/analytics";
import { beginVisit, trackPath } from "@/lib/visitor-personalization";

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
      { name: "twitter:card", content: "summary_large_image" },
    ],
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

  const searchStr = useRouterState({ select: (s) => s.location.searchStr });
  // Admin hero-editor preview frame loads "/" — never count it as a visit.
  const skipTracking = isAdmin || searchStr.includes("heroPreview=1");
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
    const widgetId = "6a43bb0bbd10bf7f08bff1e7";
    const selector = `script[data-widget-id="${widgetId}"]`;

    if (isAdmin) {
      document.querySelector(selector)?.remove();
      return;
    }

    if (document.querySelector(selector)) return;
    // Chat is not a conversion tracker: keep its initialization out of the
    // first render while leaving Meta/attribution event timing unchanged.
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled || document.querySelector(selector)) return;
      const script = document.createElement("script");
      script.src = "https://widgets.leadconnectorhq.com/loader.js";
      script.async = true;
      script.dataset["resourcesUrl"] = "https://widgets.leadconnectorhq.com/chat-widget/loader.js";
      script.dataset["widgetId"] = widgetId;
      document.body.appendChild(script);
    }, 1500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isAdmin]);

  return (
    <QueryClientProvider client={queryClient}>
      {isAdmin && (
        <style>{`
          #chat-widget-container,
          #lc_chat_widget,
          [data-widget-id="6a43bb0bbd10bf7f08bff1e7"],
          iframe[src*="leadconnectorhq.com"],
          iframe[src*="leadconnector"] {
            display: none !important;
          }
        `}</style>
      )}
      <AuthProvider>
        <div className="flex min-h-screen flex-col">
          {!isAdmin && <SiteHeader />}
          <main className="flex-1">
            {/* Required: nested routes render here. */}
            <Outlet />
          </main>
          {!isAdmin && <SiteFooter />}
        </div>
        <Toaster />
      </AuthProvider>
      <AnalyticsConsentManager pathname={pathname} />
    </QueryClientProvider>
  );
}
