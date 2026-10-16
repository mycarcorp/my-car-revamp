import { useEffect, useRef, useState } from "react";
import { Eye, Loader2, Monitor, RotateCcw, Search, Smartphone, Tablet, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { HeroMedia, DEFAULT_FRAME, DEFAULT_OVERLAY } from "@/components/home/HeroMedia";
import {
  createHeroUploadFn,
  getHeroConfigFn,
  saveHeroConfigFn,
  type HeroConfig,
  type HeroDevice,
  type HeroFrame,
  type HeroSettings,
} from "@/lib/home-gallery.functions";

const DEVICES: { id: HeroDevice; label: string; width: number; height: number; icon: typeof Monitor }[] = [
  { id: "desktop", label: "Desktop", width: 1280, height: 620, icon: Monitor },
  { id: "tablet", label: "Tablet", width: 820, height: 640, icon: Tablet },
  { id: "mobile", label: "Mobile", width: 390, height: 700, icon: Smartphone },
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

/** Mock of the homepage hero (menu bar, headline, search, buttons) at a real device width, scaled to fit. */
function HeroPreview({ s, device, onDrag }: { s: HeroSettings; device: HeroDevice; onDrag?: (dx: number, dy: number) => void }) {
  const dev = DEVICES.find((d) => d.id === device)!;
  const wrap = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const drag = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(Math.min(1, el.clientWidth / dev.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [dev.width]);
  const navH = 64;
  return (
    <div ref={wrap} className="w-full">
      <div className="mx-auto overflow-hidden rounded-xl border border-border shadow-sm" style={{ width: dev.width * scale, height: (dev.height + navH) * scale }}>
        <div style={{ width: dev.width, transform: `scale(${scale})`, transformOrigin: "top left" }}>
          <div className="flex items-center justify-between border-b border-border bg-card px-6" style={{ height: navH }}>
            <span className="font-display text-lg font-black">MyCar</span>
            {device !== "mobile" && <span className="text-sm text-muted-foreground">Shop · Financing · Sell or trade · Contact</span>}
            <span className="rounded-full bg-accent px-4 py-2 text-xs font-bold text-accent-foreground">Sign in</span>
          </div>
          <section
            className={`relative isolate overflow-hidden bg-primary ${onDrag ? "cursor-grab active:cursor-grabbing" : ""}`}
            style={{ height: dev.height }}
            onPointerDown={(e) => {
              if (!onDrag) return;
              drag.current = { x: e.clientX, y: e.clientY };
              (e.target as HTMLElement).setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (!drag.current || !onDrag) return;
              const dx = ((e.clientX - drag.current.x) / (dev.width * scale)) * 100;
              const dy = ((e.clientY - drag.current.y) / (dev.height * scale)) * 100;
              drag.current = { x: e.clientX, y: e.clientY };
              onDrag(dx, dy);
            }}
            onPointerUp={() => (drag.current = null)}
          >
            <HeroMedia src={s.imageUrl} alt="" frames={s.frames} overlay={s.overlay} device={device} />
            <div className="pointer-events-none px-8 pt-20">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary-foreground/80">Used cars, trucks &amp; SUVs in Fredericksburg, VA</p>
              <p className={`mt-4 font-display font-black leading-[0.92] tracking-[-0.05em] text-primary-foreground ${device === "mobile" ? "text-5xl" : "text-[5.2rem]"}`}>
                Right car.<span className="block text-accent">Right price.</span>
              </p>
              <div className="mt-8 flex max-w-md items-center gap-2 rounded-full bg-card p-1.5 pl-5">
                <Search className="size-5 text-muted-foreground" />
                <span className="flex-1 text-sm text-muted-foreground">Search make, model, or keyword</span>
                <span className="rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-accent-foreground">Search</span>
              </div>
              <div className="mt-4 flex gap-2">
                <span className="rounded-full bg-card px-4 py-2 text-xs font-bold">Financing</span>
                <span className="rounded-full bg-card px-4 py-2 text-xs font-bold">Sell or trade</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export function HeroEditor({ token }: { token: string }) {
  const [cfg, setCfg] = useState<HeroConfig | null>(null);
  const [s, setS] = useState<HeroSettings | null>(null);
  const [device, setDevice] = useState<HeroDevice>("desktop");
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

  const frame = s?.frames[device] ?? DEFAULT_FRAME;
  const setFrame = (patch: Partial<HeroFrame>) =>
    setS((cur) => (cur ? { ...cur, frames: { ...cur.frames, [device]: { ...cur.frames[device], ...patch } } } : cur));
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

  if (!cfg) return <p className="text-sm text-muted-foreground">Loading hero editor…</p>;

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-black">Homepage hero</h2>
          <p className="text-sm text-muted-foreground">
            {cfg.published ? "A custom hero is live." : "The homepage is using the built-in hero photo."} Changes go live only when you publish.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={!s || !!busy} onClick={() => setPreview(true)}><Eye className="size-4" /> Preview</Button>
          <Button variant="outline" disabled={!s || !!busy} onClick={() => save({ ...cfg, draft: s }, "Draft saved")}>Save draft</Button>
          <Button disabled={!s || !!busy} onClick={() => save({ ...cfg, draft: s, published: s }, "Hero published")}>
            {busy && <Loader2 className="size-4 animate-spin" />} Publish
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {cfg.images.map((img) => (
          <div key={img.id} className={`group relative h-20 w-32 overflow-hidden rounded-lg border-2 ${s?.imageKey === img.key ? "border-accent" : "border-border"}`}>
            <button type="button" className="h-full w-full" onClick={() => setS((cur) => (cur ? { ...cur, imageKey: img.key, imageUrl: img.url } : freshSettings(img.key, img.url)))}>
              <img src={img.url} alt={img.name} className="h-full w-full object-cover" />
            </button>
            {cfg.published?.imageKey !== img.key && (
              <button
                type="button"
                aria-label="Remove photo"
                className="absolute right-1 top-1 rounded-full bg-card p-1 opacity-0 shadow group-hover:opacity-100"
                onClick={() => {
                  const images = cfg.images.filter((i) => i.id !== img.id);
                  const draft = s?.imageKey === img.key ? null : s;
                  setS(draft);
                  void save({ ...cfg, images, draft }, "Photo removed");
                }}
              >
                <Trash2 className="size-3.5 text-destructive" />
              </button>
            )}
          </div>
        ))}
        <label
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); void upload(e.dataTransfer.files); }}
          className="flex h-20 w-32 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border text-xs text-muted-foreground hover:border-accent"
        >
          <Upload className="size-4" /> {busy?.startsWith("Uploading") ? busy : "Add photo"}
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => void upload(e.target.files)} />
        </label>
      </div>

      {!s ? (
        <p className="text-sm text-muted-foreground">Upload a photo to start designing the hero.</p>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-3">
            <div className="flex gap-2">
              {DEVICES.map((d) => (
                <Button key={d.id} size="sm" variant={device === d.id ? "default" : "outline"} onClick={() => setDevice(d.id)}>
                  <d.icon className="size-4" /> {d.label}
                </Button>
              ))}
            </div>
            <HeroPreview s={s} device={device} onDrag={(dx, dy) => setFrame({ x: clamp(frame.x - dx), y: clamp(frame.y - dy) })} />
            <p className="text-xs text-muted-foreground">Drag the photo to reposition it. Each device keeps its own position.</p>
          </div>

          <div className="space-y-5">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold">{DEVICES.find((d) => d.id === device)!.label} position</h3>
                <Button size="sm" variant="ghost" onClick={() => setFrame({ ...DEFAULT_FRAME })}><RotateCcw className="size-3.5" /> Reset</Button>
              </div>
              <div className="space-y-1.5"><Label>Fit</Label>
                <Select value={frame.fit} onValueChange={(v) => setFrame({ fit: v as HeroFrame["fit"], zoom: v === "contain" ? 1 : frame.zoom })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cover">Fill the frame</SelectItem>
                    <SelectItem value="contain">Show full photo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Ctl label="Left / right" value={frame.x} onChange={(x) => setFrame({ x })} />
              <Ctl label="Up / down" value={frame.y} onChange={(y) => setFrame({ y })} />
              <Ctl label="Zoom" value={frame.zoom} min={1} max={3} step={0.05} suffix="×" onChange={(zoom) => setFrame({ zoom })} />
            </div>
            <div className="space-y-3 border-t border-border pt-4">
              <h3 className="text-sm font-bold">Shading</h3>
              <div className="space-y-1.5"><Label>Gradient</Label>
                <Select value={s.overlay.direction} onValueChange={(v) => setOverlay({ direction: v as HeroSettings["overlay"]["direction"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
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
              <p className="text-xs text-muted-foreground">Keep shading light so the person stays sharp. Photos are never flipped, so logos stay readable.</p>
            </div>
          </div>
        </div>
      )}

      <Dialog open={preview} onOpenChange={setPreview}>
        <DialogContent className="max-w-6xl">
          <DialogHeader><DialogTitle>Preview (not published yet)</DialogTitle></DialogHeader>
          {s && (
            <div className="grid gap-4 md:grid-cols-[2fr_1.2fr_0.7fr] md:items-start">
              {DEVICES.map((d) => <HeroPreview key={d.id} s={s} device={d.id} />)}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function Ctl({ label, value, onChange, min = 0, max = 100, step = 1, suffix = "%" }: { label: string; value: number; onChange: (n: number) => void; min?: number; max?: number; step?: number; suffix?: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs"><Label>{label}</Label><span className="text-muted-foreground">{suffix === "×" ? value.toFixed(2) : Math.round(value)}{suffix}</span></div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={([v]) => onChange(v ?? value)} />
    </div>
  );
}
