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
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider } from "@/hooks/useAuth";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Toaster } from "@/components/ui/sonner";
import { captureAttribution } from "@/lib/attribution";

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
        <noscript>
          <img
            height="1"
            width="1"
            style={{ display: "none" }}
            alt=""
            src="https://www.facebook.com/tr?id=913977571315979&ev=PageView&noscript=1"
          />
        </noscript>
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
  useEffect(() => {
    if (!isAdmin) captureAttribution();
  }, [pathname, searchStr, isAdmin]);

  useEffect(() => {
    if (isAdmin) return;
    const w = window as unknown as { fbq?: (...args: unknown[]) => void };
    if (!w.fbq) {
      /* eslint-disable */
      // Meta Pixel base code
      (function (f: any, b: Document, e: string, v: string) {
        if (f.fbq) return;
        const n: any = (f.fbq = function (...args: unknown[]) {
          n.callMethod ? n.callMethod.apply(n, args) : n.queue.push(args);
        });
        if (!f._fbq) f._fbq = n;
        n.push = n;
        n.loaded = true;
        n.version = "2.0";
        n.queue = [];
        const t = b.createElement(e) as HTMLScriptElement;
        t.async = true;
        t.src = v;
        const s = b.getElementsByTagName(e)[0];
        s?.parentNode?.insertBefore(t, s);
      })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
      /* eslint-enable */
      const fbq = (window as unknown as Record<string, unknown>)["fbq"] as
        | ((...args: unknown[]) => void)
        | undefined;
      fbq?.("init", "913977571315979");
    }
    w.fbq?.("track", "PageView");
  }, [pathname, isAdmin]);

  useEffect(() => {
    const widgetId = "6a43bb0bbd10bf7f08bff1e7";
    const selector = `script[data-widget-id="${widgetId}"]`;

    if (isAdmin) {
      document.querySelector(selector)?.remove();
      return;
    }

    if (document.querySelector(selector)) return;

    const script = document.createElement("script");
    script.src = "https://widgets.leadconnectorhq.com/loader.js";
    script.async = true;
    script.dataset["resourcesUrl"] = "https://widgets.leadconnectorhq.com/chat-widget/loader.js";
    script.dataset["widgetId"] = widgetId;
    document.body.appendChild(script);
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
    </QueryClientProvider>
  );
}
