import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CHAT_EXCLUDED_ROUTES,
  CHAT_WIDGET_HIDE_CSS,
  CHAT_WIDGET_ID,
  CHAT_WIDGET_LOAD_DELAY_MS,
  createBrowserChatWidgetEnv,
  createChatWidgetManager,
  isChatWidgetAllowed,
  type ChatWidgetEnv,
} from "./chat-widget";

/** A page: one document with at most one widget script, manual timers and a reload counter. */
function fakePage(options: { scriptPresent?: boolean } = {}) {
  let script = options.scriptPresent ?? false;
  let nextId = 1;
  const timers = new Map<number, { callback: () => void; at: number }>();
  let clock = 0;
  const calls = { add: 0, remove: 0, reload: 0 };
  const env: ChatWidgetEnv = {
    hasScript: () => script,
    addScript: () => { script = true; calls.add += 1; },
    removeScript: () => { script = false; calls.remove += 1; },
    setTimer: (callback, delayMs) => { const id = nextId++; timers.set(id, { callback, at: clock + delayMs }); return id; },
    clearTimer: (handle) => { timers.delete(handle as number); },
    reload: () => { calls.reload += 1; },
  };
  return {
    env,
    calls,
    scriptPresent: () => script,
    pendingTimers: () => timers.size,
    advance(ms: number) {
      clock += ms;
      for (const [id, timer] of [...timers]) {
        if (timer.at <= clock) {
          timers.delete(id);
          timer.callback();
        }
      }
    },
  };
}

describe("chat widget route rules", () => {
  it("allows the public pages", () => {
    for (const path of [
      "/", "/search", "/inventory/2019-honda-civic", "/contact", "/schedule", "/sell", "/lease-to-own", "/privacy", "/terms",
      "/blog", "/blog/some-post", "/locations", "/locations/fredericksburg", "/sitemap.xml",
    ]) {
      expect(isChatWidgetAllowed(path), path).toBe(true);
    }
  });

  it("excludes every sensitive route and all of its children", () => {
    const paths = [
      "/admin", "/admin/customers", "/admin/marketing", "/admin/blog/123/edit",
      "/staff", "/staff/dms", "/staff/dms/deal/9",
      "/my", "/my/purchases", "/my/purchases/42",
      "/account", "/account/settings",
      "/finance", "/finance/anything",
      "/lease-to-own/apply", "/lease-to-own/apply/step-2",
      "/lease-to-own/portal", "/lease-to-own/portal/documents",
      "/auth", "/auth/callback",
      "/reset-password", "/reset-password/token",
    ];
    for (const path of paths) expect(isChatWidgetAllowed(path), path).toBe(false);
    for (const route of CHAT_EXCLUDED_ROUTES) expect(isChatWidgetAllowed(route), route).toBe(false);
  });

  it("matches whole segments only, so unrelated public paths stay allowed", () => {
    for (const path of [
      "/mystery", "/my-cars", "/authors", "/authentic", "/administrator", "/staffing", "/finance-tips", "/financed",
      "/accounting", "/account-help", "/lease-to-own/applying", "/lease-to-own/apply-now", "/lease-to-own/portalx", "/reset-passwords",
      "/blog/my", "/inventory/admin", "/search/finance",
    ]) {
      expect(isChatWidgetAllowed(path), path).toBe(true);
    }
  });

  it("ignores case, trailing and doubled slashes, encoded characters and query text in the path", () => {
    for (const path of ["/Admin", "/ADMIN/", "//admin", "/admin//customers", "/%61dmin", "/my/", "/Finance/", "/lease-to-own//apply", "/auth?x=1", "/finance#top"]) {
      expect(isChatWidgetAllowed(path), path).toBe(false);
    }
    expect(isChatWidgetAllowed("/%E0%A4%A")).toBe(true); // undecodable text: compared as written, not a sensitive route
  });

  it("excludes the admin hero preview frame but not a normal home page", () => {
    expect(isChatWidgetAllowed("/", "?heroPreview=1")).toBe(false);
    expect(isChatWidgetAllowed("/", "?utm_source=google")).toBe(true);
    expect(isChatWidgetAllowed("/", "")).toBe(true);
  });

  it("survives unexpected input", () => {
    for (const value of ["", undefined, null, 7, {}] as unknown[]) expect(() => isChatWidgetAllowed(value as string)).not.toThrow();
  });
});

describe("chat widget lifecycle", () => {
  afterEach(() => vi.restoreAllMocks());

  it("loads once, after the delay, on public pages (home, inventory, contact)", () => {
    const page = fakePage();
    const chat = createChatWidgetManager(page.env);
    expect(chat.sync(isChatWidgetAllowed("/"))).toBe("pending");
    expect(page.scriptPresent()).toBe(false);
    page.advance(CHAT_WIDGET_LOAD_DELAY_MS - 1);
    expect(page.scriptPresent()).toBe(false);
    page.advance(1);
    expect(page.scriptPresent()).toBe(true);
    // Moving between public pages never adds another script or timer.
    for (const path of ["/inventory/2019-honda-civic", "/contact", "/search", "/"]) {
      expect(chat.sync(isChatWidgetAllowed(path))).toBe("running");
    }
    page.advance(10_000);
    expect(page.calls).toEqual({ add: 1, remove: 0, reload: 0 });
  });

  it("repeated syncs before the delay schedule one load", () => {
    const page = fakePage();
    const chat = createChatWidgetManager(page.env);
    for (let index = 0; index < 5; index += 1) chat.sync(true);
    expect(page.pendingTimers()).toBe(1);
    page.advance(CHAT_WIDGET_LOAD_DELAY_MS);
    expect(page.calls.add).toBe(1);
  });

  it("never starts on a sensitive route that is loaded directly", () => {
    for (const path of ["/finance", "/my/purchases/1", "/staff/dms", "/auth/callback", "/lease-to-own/apply", "/admin"]) {
      const page = fakePage();
      const chat = createChatWidgetManager(page.env);
      expect(chat.needsReload(isChatWidgetAllowed(path))).toBe(false);
      expect(chat.sync(isChatWidgetAllowed(path)), path).toBe("idle");
      page.advance(60_000);
      expect(page.calls, path).toEqual({ add: 0, remove: 0, reload: 0 });
      expect(page.pendingTimers()).toBe(0);
    }
  });

  it("cancels a pending start when the visitor reaches a sensitive route first, without reloading", () => {
    const page = fakePage();
    const chat = createChatWidgetManager(page.env);
    chat.sync(true);
    page.advance(500);
    expect(chat.sync(isChatWidgetAllowed("/finance"))).toBe("idle");
    page.advance(60_000);
    expect(page.calls).toEqual({ add: 0, remove: 0, reload: 0 });
  });

  it("removes the script and reloads exactly once when a visitor with a running widget reaches a sensitive route", () => {
    const page = fakePage();
    const chat = createChatWidgetManager(page.env);
    chat.sync(true);
    page.advance(CHAT_WIDGET_LOAD_DELAY_MS);
    expect(chat.needsReload(isChatWidgetAllowed("/my/purchases"))).toBe(true);
    expect(chat.needsReload(isChatWidgetAllowed("/contact"))).toBe(false);
    expect(chat.sync(isChatWidgetAllowed("/my/purchases"))).toBe("reload");
    expect(page.calls).toEqual({ add: 1, remove: 1, reload: 1 });
    // Further renders on the same route, or other sensitive routes, never reload twice.
    chat.sync(false);
    chat.sync(isChatWidgetAllowed("/admin"));
    expect(page.calls.reload).toBe(1);
  });

  it("unloads the widget for every sensitive route when it was running", () => {
    for (const path of ["/admin/customers", "/staff/dms", "/my", "/account", "/finance", "/lease-to-own/apply", "/lease-to-own/portal", "/auth", "/reset-password"]) {
      const page = fakePage();
      const chat = createChatWidgetManager(page.env);
      chat.sync(true);
      page.advance(CHAT_WIDGET_LOAD_DELAY_MS);
      expect(chat.sync(isChatWidgetAllowed(path)), path).toBe("reload");
      expect(page.calls.reload, path).toBe(1);
      expect(page.scriptPresent(), path).toBe(false);
    }
  });

  it("handles a script that was already on the page without adding a second one", () => {
    const page = fakePage({ scriptPresent: true });
    const chat = createChatWidgetManager(page.env);
    expect(chat.sync(true)).toBe("running");
    page.advance(10_000);
    expect(page.calls.add).toBe(0);

    const late = fakePage();
    const lateChat = createChatWidgetManager(late.env);
    lateChat.sync(true);
    // Something else adds the script during the delay.
    late.env.addScript();
    late.advance(CHAT_WIDGET_LOAD_DELAY_MS);
    expect(late.calls.add).toBe(1);
  });

  it("survives repeated transitions across page loads, loading once per public visit and never on sensitive ones", () => {
    // Each page load is a fresh document and manager; a reload starts the next iteration.
    const journey = ["/", "/inventory/x", "/finance", "/contact", "/my/purchases", "/", "/sell", "/staff/dms", "/", "/auth"];
    let page = fakePage();
    let chat = createChatWidgetManager(page.env);
    let loads = 0;
    let reloads = 0;
    for (const path of journey) {
      const allowed = isChatWidgetAllowed(path);
      const outcome = chat.sync(allowed);
      if (outcome === "reload") {
        reloads += 1;
        expect(page.scriptPresent()).toBe(false);
        page = fakePage(); // the reload gives a fresh document
        chat = createChatWidgetManager(page.env);
        expect(chat.sync(allowed)).toBe("idle"); // and the sensitive page starts no widget
      } else if (allowed) {
        page.advance(CHAT_WIDGET_LOAD_DELAY_MS);
        if (page.calls.add === 1 && page.calls.add > loads) loads = page.calls.add;
        expect(page.calls.add).toBeLessThanOrEqual(1);
      } else {
        expect(page.scriptPresent()).toBe(false);
      }
    }
    expect(reloads).toBeGreaterThan(0);
  });

  it("dispose only cancels a pending start", () => {
    const page = fakePage();
    const chat = createChatWidgetManager(page.env);
    chat.sync(true);
    chat.dispose();
    page.advance(60_000);
    expect(page.calls).toEqual({ add: 0, remove: 0, reload: 0 });

    const running = fakePage();
    const runningChat = createChatWidgetManager(running.env);
    runningChat.sync(true);
    running.advance(CHAT_WIDGET_LOAD_DELAY_MS);
    runningChat.dispose();
    expect(running.calls).toEqual({ add: 1, remove: 0, reload: 0 });
  });
});

describe("browser environment", () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubDom() {
    const widget: Array<Record<string, unknown>> = [];
    const other = { id: "unrelated-page-element", removed: false, remove() { this.removed = true; } };
    const body = { appendChild: vi.fn((node: Record<string, unknown>) => { widget.push(node); }) };
    vi.stubGlobal("document", {
      body,
      createElement: vi.fn(() => ({ dataset: {} as Record<string, string>, async: false, src: "" })),
      querySelector: vi.fn((selector: string) => {
        if (!selector.includes("data-widget-id")) return null;
        const node = widget[0];
        return node ? { remove: () => { widget.length = 0; } } : null;
      }),
    });
    vi.stubGlobal("window", {
      setTimeout: vi.fn(() => 7),
      clearTimeout: vi.fn(),
      location: { reload: vi.fn() },
    });
    return { widget, other, body };
  }

  it("adds one LeadConnector script with the existing widget ID and removes only that script", () => {
    const dom = stubDom();
    const env = createBrowserChatWidgetEnv();
    expect(env.hasScript()).toBe(false);
    env.addScript();
    expect(dom.widget).toHaveLength(1);
    expect(dom.widget[0]).toMatchObject({
      src: "https://widgets.leadconnectorhq.com/loader.js",
      async: true,
      dataset: { resourcesUrl: "https://widgets.leadconnectorhq.com/chat-widget/loader.js", widgetId: CHAT_WIDGET_ID },
    });
    expect(env.hasScript()).toBe(true);
    env.removeScript();
    expect(dom.widget).toHaveLength(0);
    expect(dom.other.removed).toBe(false);
  });

  it("reloads through window.location", () => {
    stubDom();
    createBrowserChatWidgetEnv().reload();
    expect((window as unknown as { location: { reload: ReturnType<typeof vi.fn> } }).location.reload).toHaveBeenCalledTimes(1);
  });
});

describe("integration boundaries", () => {
  const read = (file: string) => readFileSync(file, "utf8");

  it("keeps the widget script and ID in one module, out of the root route", () => {
    const root = read("src/routes/__root.tsx");
    expect(root).not.toContain("widgets.leadconnectorhq.com");
    expect(root).not.toContain(CHAT_WIDGET_ID);
    expect(root).toContain("createChatWidgetManager");
    expect(read("src/lib/chat-widget.ts")).toContain("widgets.leadconnectorhq.com/loader.js");
  });

  it("does not touch GA4 or Meta from the chat module", () => {
    const source = read("src/lib/chat-widget.ts");
    for (const forbidden of ["dataLayer", "gtag", "fbq", "analytics", "localStorage"]) expect(source).not.toContain(forbidden);
  });

  it("only skips analytics for a chat reload, and only when the widget was already running", () => {
    const root = read("src/routes/__root.tsx");
    expect(root).toContain("chatManager.current?.needsReload(chatAllowed)");
    expect(root).toContain('searchStr.includes("heroPreview=1") || chatReloading');
    const page = fakePage();
    const chat = createChatWidgetManager(page.env);
    for (const path of ["/", "/finance", "/my", "/admin", "/contact"]) expect(chat.needsReload(isChatWidgetAllowed(path)), path).toBe(false);
  });

  it("keeps the sign-in drawer's own chat hiding rule", () => {
    const header = read("src/components/SiteHeader.tsx");
    expect(header).toContain("{signInOpen && (");
    expect(header).toContain('iframe[src*="leadconnectorhq.com"]');
    expect(header).toContain("display: none !important");
  });

  it("hides the widget's elements while a sensitive page is shown", () => {
    for (const selector of ["#chat-widget-container", "chat-widget", 'iframe[src*="leadconnectorhq.com"]', `[data-widget-id="${CHAT_WIDGET_ID}"]`]) {
      expect(CHAT_WIDGET_HIDE_CSS).toContain(selector);
    }
    expect(read("src/routes/__root.tsx")).toContain("{!chatAllowed && <style>{CHAT_WIDGET_HIDE_CSS}</style>}");
  });
});

describe("with the real TanStack Router and route tree", () => {
  async function locationFor(url: string) {
    const { createMemoryHistory, createRootRoute, createRoute, createRouter } = await import("@tanstack/react-router");
    const root = createRootRoute();
    const home = createRoute({ getParentRoute: () => root, path: "/" });
    const splat = createRoute({ getParentRoute: () => root, path: "$" });
    const router = createRouter({ routeTree: root.addChildren([home, splat]), history: createMemoryHistory({ initialEntries: [url] }) });
    await router.load();
    return { pathname: router.state.location.pathname, searchStr: router.state.location.searchStr };
  }

  it("decides on the pathname and search string the router actually reports", async () => {
    const cases: Array<[string, boolean]> = [
      ["/", true],
      ["/contact?utm_source=google", true],
      ["/inventory/2019-honda-civic", true],
      ["/finance", false],
      ["/finance/", false],
      ["/Finance", false],
      ["/my/purchases/42?tab=docs", false],
      ["/admin/customers#top", false],
      ["/%61dmin", false],
      ["/lease-to-own/apply?step=2", false],
      ["/lease-to-own/portal/", false],
      ["/staff/dms", false],
      ["/auth/callback?code=abc", false],
      ["/reset-password?token=abc", false],
      ["/account", false],
      ["/mystery", true],
      ["/authors", true],
      ["/?heroPreview=1", false],
      ["/?utm_source=google&heroPreview=1", false],
    ];
    for (const [url, allowed] of cases) {
      const { pathname, searchStr } = await locationFor(url);
      expect(isChatWidgetAllowed(pathname, searchStr), `${url} -> ${pathname}${searchStr}`).toBe(allowed);
    }
  });

  it("covers every route in the generated route tree, so a new route forces a deliberate decision", () => {
    const tree = readFileSync("src/routeTree.gen.ts", "utf8");
    const paths = [...new Set([...tree.matchAll(/fullPath: '([^']+)'/g)].map((match) => match[1]!))];
    expect(paths.length).toBeGreaterThan(20);
    const sample = (path: string) => path.replace(/\$[A-Za-z]*/g, "sample");
    const sensitiveRoots = ["/admin", "/staff", "/my", "/account", "/finance", "/lease-to-own/apply", "/lease-to-own/portal", "/auth", "/reset-password"];
    const isSensitive = (path: string) => sensitiveRoots.some((root) => path === root || path.startsWith(`${root}/`));
    const publicRoutes = paths.filter((path) => !isSensitive(path) && !path.startsWith("/api/")).sort();
    // Public pages where chat is intentionally available. Add a route here only after deciding it holds no sensitive data.
    expect(publicRoutes).toEqual(["/", "/blog/", "/blog/$slug", "/contact", "/inventory/$slug", "/lease-to-own/", "/locations/", "/locations/$slug", "/privacy", "/schedule", "/search", "/sell", "/sitemap.xml", "/terms"].sort());
    for (const path of paths.filter((value) => !value.startsWith("/api/"))) {
      expect(isChatWidgetAllowed(sample(path)), path).toBe(!isSensitive(path));
    }
  });
});

describe("reload safety", () => {
  it("cannot loop: after a reload the new page has no widget, so many renders on the sensitive route reload nothing", () => {
    const before = fakePage();
    const chatBefore = createChatWidgetManager(before.env);
    chatBefore.sync(true);
    before.advance(CHAT_WIDGET_LOAD_DELAY_MS);
    expect(chatBefore.sync(isChatWidgetAllowed("/finance"))).toBe("reload");

    // The reload creates a new document: new page state, new manager.
    const after = fakePage();
    const chatAfter = createChatWidgetManager(after.env);
    for (let render = 0; render < 20; render += 1) {
      expect(chatAfter.needsReload(false)).toBe(false);
      expect(chatAfter.sync(false)).toBe("idle");
      after.advance(5_000);
    }
    expect(after.calls).toEqual({ add: 0, remove: 0, reload: 0 });
    expect(before.calls.reload).toBe(1);
  });

  it("keeps analytics on for every visit that is not a widget-teardown reload", () => {
    const page = fakePage();
    const chat = createChatWidgetManager(page.env);
    chat.sync(true);
    page.advance(CHAT_WIDGET_LOAD_DELAY_MS);
    // Widget running: public pages, including the ones that carry attribution and Meta tracking, are never skipped.
    for (const path of ["/", "/inventory/2019-honda-civic", "/contact", "/schedule", "/sell", "/lease-to-own"]) {
      expect(chat.needsReload(isChatWidgetAllowed(path)), path).toBe(false);
    }
    // Only the one transition that reloads the page is skipped, and the reloaded page tracks it normally.
    expect(chat.needsReload(isChatWidgetAllowed("/finance"))).toBe(true);
    expect(createChatWidgetManager(fakePage().env).needsReload(isChatWidgetAllowed("/finance"))).toBe(false);
  });
});
