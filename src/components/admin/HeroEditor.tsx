import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, CircleDot, Eye, Loader2, Monitor, Move, RotateCcw, Smartphone, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DEFAULT_FRAME, DEFAULT_OVERLAY } from "@/components/home/HeroMedia";
import {
  createHeroUploadFn,
  getHeroConfigFn,
  saveHeroConfigFn,
  type HeroConfig,
  type HeroFrame,
  type HeroSettings,
} from "@/lib/home-gallery.functions";

type EditDevice = "desktop" | "mobile";
/** Real viewport sizes the live homepage is rendered at inside the preview frame. */
const DEVICES: { id: EditDevice; label: string; width: number; height: number; icon: typeof Monitor }[] = [
  { id: "desktop", label: "Desktop", width: 1440, height: 860, icon: Monitor },
  { id: "mobile", label: "Mobile", width: 390, height: 844, icon: Smartphone },
];

function put(url: string, file: File, onProgress: (n: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", file.type);
    xhr.setRequestHeader("x-upsert", "true");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`Could not upload ${file.name}.`)));
    xhr.onerror = () => reject(new Error(`Could not upload ${file.name}.`));
    xhr.send(file);
  });
}

const freshSettings = (key: string, url: string): HeroSettings => ({
  imageKey: key,
  imageUrl: url,
  frames: { desktop: { ...DEFAULT_FRAME }, tablet: { ...DEFAULT_FRAME }, mobile: { ...DEFAULT_FRAME } },
  overlay: { ...DEFAULT_OVERLAY },
});

/**
 * Renders the real homepage ("/?heroPreview=1") at the device's true width in a frame,
 * scaled to fit, and streams draft settings into it. Same component, styles and breakpoints as live.
 */
function LiveHeroPreview({
  s,
  device,
  maxHeight,
  onDrag,
}: {
  s: HeroSettings;
  device: EditDevice;
  maxHeight?: number;
  onDrag?: (dx: number, dy: number) => void;
}) {
  const dev = DEVICES.find((d) => d.id === device)!;
  const wrap = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [scale, setScale] = useState(0.4);
  const [ready, setReady] = useState(false);
  const drag = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const fit = () => {
      const byW = el.clientWidth / dev.width;
      const byH = maxHeight ? maxHeight / dev.height : 1;
      setScale(Math.min(1, byW, byH));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [dev.width, dev.height, maxHeight]);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin === window.location.origin && e.data?.type === "mycar-hero-ready" && e.source === frame.current?.contentWindow) setReady(true);
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  useEffect(() => {
    if (ready) frame.current?.contentWindow?.postMessage({ type: "mycar-hero-preview", settings: s }, window.location.origin);
  }, [s, ready]);

  return (
    <div ref={wrap} className="w-full">
      <div
        className={`relative mx-auto overflow-hidden border border-border bg-muted shadow-sm ${device === "mobile" ? "rounded-[1.75rem] border-4" : "rounded-xl"}`}
        style={{ width: dev.width * scale, height: dev.height * scale }}
      >
        <iframe
          ref={frame}
          title={`${dev.label} homepage preview`}
          src="/?heroPreview=1"
          tabIndex={-1}
          className="pointer-events-none absolute left-0 top-0 border-0 bg-background"
          style={{ width: dev.width, height: dev.height, transform: `scale(${scale})`, transformOrigin: "top left" }}
        />
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-muted text-xs text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading homepage…
          </div>
        )}
        {onDrag && (
          <div
            className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing"
            onPointerDown={(e) => {
              drag.current = { x: e.clientX, y: e.clientY };
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (!drag.current) return;
              const dx = ((e.clientX - drag.current.x) / (dev.width * scale)) * 100;
              const dy = ((e.clientY - drag.current.y) / (dev.height * scale)) * 100;
              drag.current = { x: e.clientX, y: e.clientY };
              onDrag(dx, dy);
            }}
            onPointerUp={() => (drag.current = null)}
          />
        )}
      </div>
      <p className="mt-2 text-center text-[11px] text-muted-foreground">
        {dev.label} · {dev.width}×{dev.height}px · shown at {Math.round(scale * 100)}%
      </p>
    </div>
  );
}

export function HeroEditor({ token }: { token: string }) {
  const [cfg, setCfg] = useState<HeroConfig | null>(null);
  const [s, setS] = useState<HeroSettings | null>(null);
  const [device, setDevice] = useState<EditDevice>("desktop");
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    getHeroConfigFn()
      .then((c) => {
        setCfg(c);
        setS(c.draft ?? c.published ?? (c.images[0] ? freshSettings(c.images[0].key, c.images[0].url) : null));
      })
      .catch(() => toast.error("Could not load the hero settings."));
  }, []);

  const status = useMemo(() => {
    if (!cfg || !s) return null;
    const same = (a: unknown) => JSON.stringify(a) === JSON.stringify(s);
    if (same(cfg.published)) return { label: "Live", tone: "live" as const };
    if (same(cfg.draft)) return { label: "Draft saved — not live", tone: "draft" as const };
    return { label: "Unsaved changes", tone: "dirty" as const };
  }, [cfg, s]);

  const frame = s?.frames[device] ?? DEFAULT_FRAME;
  // Desktop settings also drive tablet widths so in-between screens match desktop.
  const setFrame = (patch: Partial<HeroFrame>) =>
    setS((cur) => {
      if (!cur) return cur;
      const next = { ...cur.frames[device], ...patch };
      return { ...cur, frames: { ...cur.frames, [device]: next, ...(device === "desktop" ? { tablet: next } : {}) } };
    });
  const setOverlay = (patch: Partial<HeroSettings["overlay"]>) =>
    setS((cur) => (cur ? { ...cur, overlay: { ...cur.overlay, ...patch } } : cur));
  const clamp = (n: number) => Math.min(100, Math.max(0, n));

  async function save(next: HeroConfig, msg: string) {
    setBusy(msg);
    try {
      const saved = await saveHeroConfigFn({ data: { accessToken: token, config: next } });
      setCfg(saved);
      toast.success(msg);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(null);
    }
  }

  async function upload(files: FileList | null) {
    const file = [...(files ?? [])].find((f) => f.type.startsWith("image/"));
    if (!file || !cfg) return;
    try {
      const { uploadUrl, key, url } = await createHeroUploadFn({ data: { accessToken: token, contentType: file.type } });
      await put(uploadUrl, file, (n) => setBusy(`Uploading ${n}%`));
      const next = { ...cfg, images: [...cfg.images, { id: crypto.randomUUID(), key, url, name: file.name }] };
      const nextS = s ? { ...s, imageKey: key, imageUrl: url } : freshSettings(key, url);
      setS(nextS);
      await save({ ...next, draft: nextS }, "Photo uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
      setBusy(null);
    }
  }

  if (!cfg) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading hero editor…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          {status && (
            <Badge variant={status.tone === "live" ? "default" : status.tone === "draft" ? "secondary" : "outline"} className="gap-1">
              {status.tone === "live" ? <CheckCircle2 className="size-3" /> : <CircleDot className="size-3" />} {status.label}
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">
            {cfg.published ? "A custom hero is live." : "The homepage uses the built-in hero photo."} Nothing changes until you publish.
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" disabled={!s || !!busy || !cfg.published} onClick={() => setS(cfg.published)}>
            <RotateCcw className="size-4" /> Revert to live
          </Button>
          <Button size="sm" variant="outline" disabled={!s || !!busy} onClick={() => setPreview(true)}><Eye className="size-4" /> Preview</Button>
          <Button size="sm" variant="outline" disabled={!s || !!busy} onClick={() => save({ ...cfg, draft: s }, "Draft saved")}>Save draft</Button>
          <Button size="sm" disabled={!s || !!busy} onClick={() => save({ ...cfg, draft: s, published: s }, "Hero published")}>
            {busy && !busy.startsWith("Uploading") && <Loader2 className="size-4 animate-spin" />} Publish
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        {/* Preview */}
        <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex rounded-full border border-border bg-muted p-1">
              {DEVICES.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDevice(d.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${device === d.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <d.icon className="size-3.5" /> {d.label}
                </button>
              ))}
            </div>
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Move className="size-3.5" /> Drag the photo to reposition</span>
          </div>
          {s ? (
            <div className="rounded-xl bg-muted/50 p-3">
              <LiveHeroPreview
                key={device}
                s={s}
                device={device}
                maxHeight={device === "mobile" ? 620 : undefined}
                onDrag={(dx, dy) => setFrame({ x: clamp(frame.x - dx), y: clamp(frame.y - dy) })}
              />
            </div>
          ) : (
            <div className="flex h-64 items-center justify-center rounded-xl border-2 border-dashed border-border text-sm text-muted-foreground">
              Upload a photo to start designing the hero.
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="space-y-4">
          <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
            <h3 className="text-sm font-bold">Hero photos</h3>
            <div className="grid grid-cols-3 gap-2">
              {cfg.images.map((img) => (
                <div key={img.id} className={`group relative aspect-[4/3] overflow-hidden rounded-lg border-2 ${s?.imageKey === img.key ? "border-accent" : "border-transparent"}`}>
                  <button type="button" className="h-full w-full" title={img.name} onClick={() => setS((cur) => (cur ? { ...cur, imageKey: img.key, imageUrl: img.url } : freshSettings(img.key, img.url)))}>
                    <img src={img.url} alt={img.name} className="h-full w-full object-cover" />
                  </button>
                  {cfg.published?.imageKey === img.key ? (
                    <span className="absolute bottom-1 left-1 rounded bg-card px-1 text-[9px] font-bold uppercase">Live</span>
                  ) : (
                    <button
                      type="button"
                      aria-label="Remove photo"
                      className="absolute right-1 top-1 rounded-full bg-card p-1 opacity-0 shadow transition group-hover:opacity-100"
                      onClick={() => {
                        const images = cfg.images.filter((i) => i.id !== img.id);
                        const draft = s?.imageKey === img.key ? null : s;
                        setS(draft);
                        void save({ ...cfg, images, draft }, "Photo removed");
                      }}
                    >
                      <Trash2 className="size-3 text-destructive" />
                    </button>
                  )}
                </div>
              ))}
              <label
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); void upload(e.dataTransfer.files); }}
                className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border text-center text-[11px] text-muted-foreground transition hover:border-accent hover:text-foreground"
              >
                <Upload className="size-4" /> {busy?.startsWith("Uploading") ? busy : "Add / replace"}
                <input type="file" accept="image/*" className="sr-only" onChange={(e) => void upload(e.target.files)} />
              </label>
            </div>
          </div>

          {s && (
            <>
              <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold">{DEVICES.find((d) => d.id === device)!.label} position</h3>
                  <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setFrame({ ...DEFAULT_FRAME })}><RotateCcw className="size-3.5" /> Reset</Button>
                </div>
                <div className="space-y-1.5"><Label className="text-xs">Fit</Label>
                  <Select value={frame.fit} onValueChange={(v) => setFrame({ fit: v as HeroFrame["fit"], zoom: v === "contain" ? 1 : frame.zoom })}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cover">Fill the frame</SelectItem>
                      <SelectItem value="contain">Show full photo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Ctl label="Left / right" value={frame.x} onChange={(x) => setFrame({ x })} />
                <Ctl label="Up / down" value={frame.y} onChange={(y) => setFrame({ y })} />
                <Ctl label="Zoom" value={frame.zoom} min={1} max={3} step={0.05} suffix="×" onChange={(zoom) => setFrame({ zoom })} />
                <p className="text-[11px] text-muted-foreground">Desktop and mobile each keep their own position.</p>
              </div>

              <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold">Shading</h3>
                  <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setOverlay({ ...DEFAULT_OVERLAY })}><RotateCcw className="size-3.5" /> Reset</Button>
                </div>
                <div className="space-y-1.5"><Label className="text-xs">Gradient</Label>
                  <Select value={s.overlay.direction} onValueChange={(v) => setOverlay({ direction: v as HeroSettings["overlay"]["direction"] })}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="both">Left side and bottom</SelectItem>
                      <SelectItem value="left">Left side only</SelectItem>
                      <SelectItem value="bottom">Bottom only</SelectItem>
                      <SelectItem value="none">None</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Ctl label="Left shade" value={s.overlay.left} suffix="%" onChange={(left) => setOverlay({ left })} />
                <Ctl label="Bottom shade" value={s.overlay.bottom} suffix="%" onChange={(bottom) => setOverlay({ bottom })} />
                <Ctl label="Overall darkness" value={s.overlay.shadow} suffix="%" onChange={(shadow) => setOverlay({ shadow })} />
              </div>
            </>
          )}
        </div>
      </div>

      <Dialog open={preview} onOpenChange={setPreview}>
        <DialogContent className="max-w-6xl">
          <DialogHeader><DialogTitle>Preview — not published yet</DialogTitle></DialogHeader>
          {s && (
            <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_240px] md:items-start">
              <LiveHeroPreview s={s} device="desktop" />
              <LiveHeroPreview s={s} device="mobile" maxHeight={520} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Ctl({ label, value, onChange, min = 0, max = 100, step = 1, suffix = "%" }: { label: string; value: number; onChange: (n: number) => void; min?: number; max?: number; step?: number; suffix?: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs"><Label className="text-xs">{label}</Label><span className="tabular-nums text-muted-foreground">{suffix === "×" ? value.toFixed(2) : Math.round(value)}{suffix}</span></div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={([v]) => onChange(v ?? value)} />
    </div>
  );
}
