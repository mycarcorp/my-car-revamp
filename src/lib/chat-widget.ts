/**
 * Visibility and lifecycle of the GoHighLevel (LeadConnector) chat widget.
 *
 * The widget is a third-party script that builds its own DOM and keeps its own state, so the site cannot
 * unload it in place. The only guaranteed teardown is a fresh page load, which is therefore what happens when
 * a visitor moves from a page where the widget is running to a sensitive route. A page that is loaded
 * directly on a sensitive route never starts the widget at all.
 */

export const CHAT_WIDGET_ID = "6a43bb0bbd10bf7f08bff1e7";
export const CHAT_WIDGET_SCRIPT_SELECTOR = `script[data-widget-id="${CHAT_WIDGET_ID}"]`;
export const CHAT_WIDGET_LOAD_DELAY_MS = 1500;

/** Elements the widget creates; used to hide it for the moment before a sensitive page is reloaded. */
export const CHAT_WIDGET_HIDE_CSS = `
  #chat-widget-container,
  #lc_chat_widget,
  chat-widget,
  div[data-chat-widget],
  [data-widget-id="${CHAT_WIDGET_ID}"],
  iframe[src*="leadconnectorhq.com"],
  iframe[src*="leadconnector"] {
    display: none !important;
  }
`;

/**
 * Route segments where customers or staff handle accounts, finances, documents or sign-in. Matching is by whole
 * path segment, so "/my" covers "/my/purchases/1" but never "/mystery", and "/auth" never matches "/authors".
 */
export const CHAT_EXCLUDED_ROUTES = [
  "/admin",
  "/staff",
  "/my",
  "/account",
  "/finance",
  "/lease-to-own/apply",
  "/lease-to-own/portal",
  "/auth",
  "/reset-password",
] as const;

function normalizePath(pathname: string): string {
  let path = typeof pathname === "string" ? pathname : "";
  path = path.split(/[?#]/, 1)[0] ?? "";
  try {
    path = decodeURIComponent(path);
  } catch {
    // An undecodable path is compared as written.
  }
  path = path.toLowerCase().replace(/\/{2,}/g, "/");
  if (path.length > 1) path = path.replace(/\/+$/, "");
  return path || "/";
}

export function isChatWidgetAllowed(pathname: string, search = ""): boolean {
  // The admin hero editor previews the home page in a frame; no chat there.
  if (typeof search === "string" && search.includes("heroPreview=1")) return false;
  const path = normalizePath(pathname);
  return !CHAT_EXCLUDED_ROUTES.some((route) => path === route || path.startsWith(`${route}/`));
}

export type ChatWidgetEnv = {
  hasScript(): boolean;
  addScript(): void;
  removeScript(): void;
  setTimer(callback: () => void, delayMs: number): unknown;
  clearTimer(handle: unknown): void;
  reload(): void;
};

export type ChatWidgetManager = {
  /** Start, keep or stop the widget for the current route. Returns what it did. */
  sync(allowed: boolean): "pending" | "running" | "idle" | "reload";
  /** True when moving to this route requires a page reload because the widget is already running. */
  needsReload(allowed: boolean): boolean;
  /** Cancel a pending start. Never reloads and never removes anything. */
  dispose(): void;
};

export function createChatWidgetManager(env: ChatWidgetEnv, delayMs: number = CHAT_WIDGET_LOAD_DELAY_MS): ChatWidgetManager {
  let started = false;
  let timer: unknown = null;
  let reloadRequested = false;

  const cancelTimer = () => {
    if (timer !== null) env.clearTimer(timer);
    timer = null;
  };
  const running = () => started || env.hasScript();

  return {
    sync(allowed) {
      if (allowed) {
        if (running()) return "running";
        if (timer !== null) return "pending";
        timer = env.setTimer(() => {
          timer = null;
          // Never a second script, even if one is already present.
          if (!env.hasScript()) env.addScript();
          started = true;
        }, delayMs);
        return "pending";
      }
      cancelTimer();
      if (!running()) return "idle";
      if (!reloadRequested) {
        reloadRequested = true;
        env.removeScript();
        env.reload();
      }
      return "reload";
    },
    needsReload(allowed) {
      return !allowed && running();
    },
    dispose() {
      cancelTimer();
    },
  };
}

export function createBrowserChatWidgetEnv(): ChatWidgetEnv {
  return {
    hasScript: () => document.querySelector(CHAT_WIDGET_SCRIPT_SELECTOR) !== null,
    addScript() {
      const script = document.createElement("script");
      script.src = "https://widgets.leadconnectorhq.com/loader.js";
      script.async = true;
      script.dataset["resourcesUrl"] = "https://widgets.leadconnectorhq.com/chat-widget/loader.js";
      script.dataset["widgetId"] = CHAT_WIDGET_ID;
      document.body.appendChild(script);
    },
    removeScript() {
      document.querySelector(CHAT_WIDGET_SCRIPT_SELECTOR)?.remove();
    },
    setTimer: (callback, delayMs) => window.setTimeout(callback, delayMs),
    clearTimer: (handle) => window.clearTimeout(handle as number),
    reload: () => window.location.reload(),
  };
}
