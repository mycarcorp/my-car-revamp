import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Play, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import {
  createGalleryUploadFn,
  listGalleryFn,
  saveGalleryFn,
  type GalleryCta,
  type GalleryItem,
} from "@/lib/home-gallery.functions";
import { GALLERY_CTAS } from "@/components/home/CustomerGallery";
import { HeroEditor } from "@/components/admin/HeroEditor";

export const Route = createFileRoute("/admin/gallery")({
  head: () => ({
    meta: [
      { title: "Customer Gallery — MyCar Admin" },
      { name: "description", content: "Manage customer photos and videos shown on the homepage." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Customer Gallery — MyCar Admin" },
      { property: "og:description", content: "Manage homepage customer gallery." },
    ],
  }),
  component: AdminGallery,
});

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

function AdminGallery() {
  const { session } = useAuth();
  const token = session?.access_token ?? "";
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  useEffect(() => {
    listGalleryFn()
      .then(setItems)
      .catch(() => toast.error("Could not load the gallery."))
      .finally(() => setLoading(false));
  }, []);

  async function persist(next: GalleryItem[]) {
    setSaving(true);
    try {
      setItems(await saveGalleryFn({ data: { accessToken: token, items: next } }));
      toast.success("Gallery saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  async function addFiles(files: FileList | File[]) {
    const list = [...files].filter((f) => /^(image|video)\//.test(f.type));
    if (!list.length) return;
    const added: GalleryItem[] = [];
    try {
      for (const [i, file] of list.entries()) {
        const { uploadUrl, key, url } = await createGalleryUploadFn({ data: { accessToken: token, contentType: file.type } });
        await put(uploadUrl, file, (n) => setProgress(`Uploading ${i + 1}/${list.length} — ${n}%`));
        added.push({
          id: crypto.randomUUID(),
          type: file.type.startsWith("video/") ? "video" : "photo",
          key,
          url,
          title: "",
          caption: "",
          cta: "none",
        });
      }
      await persist([...items, ...added]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setProgress(null);
    }
  }

  const update = (id: string, patch: Partial<GalleryItem>) =>
    setItems((cur) => cur.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const move = (index: number, dir: number) =>
    setItems((cur) => {
      const next = [...cur];
      const j = index + dir;
      if (j < 0 || j >= next.length) return cur;
      [next[index], next[j]] = [next[j]!, next[index]!];
      return next;
    });

  return (
    <div className="space-y-8 pb-10">
      <AdminPageHeader
        title="Gallery"
        subtitle="Homepage hero and real customer photos & videos."
      />

      <section className="space-y-3 px-4">
        <div>
          <h2 className="font-display text-lg font-bold">Hero section editor</h2>
          <p className="text-xs text-muted-foreground">Live preview of the real homepage banner on desktop and mobile.</p>
        </div>
        <HeroEditor token={token} />
      </section>

      <section className="space-y-3 px-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-bold">Gallery management</h2>
            <p className="text-xs text-muted-foreground">
              {items.length} item{items.length === 1 ? "" : "s"} in the “Real customers. Real keys.” slider.
            </p>
          </div>
          <Button size="sm" onClick={() => persist(items)} disabled={saving || loading}>
            {saving && <Loader2 className="size-4 animate-spin" />} Save gallery
          </Button>
        </div>

      <label
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void addFiles(e.dataTransfer.files);
        }}
        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-card px-6 py-8 text-center transition hover:border-accent"
      >
        <span className="flex size-10 items-center justify-center rounded-full bg-muted"><Upload className="size-5 text-muted-foreground" /></span>
        <span className="text-sm font-semibold">{progress ?? "Drop photos or videos here, or click to choose"}</span>
        <span className="text-xs text-muted-foreground">Videos upload directly, so long clips are fine.</span>
        <input type="file" accept="image/*,video/*" multiple className="sr-only" onChange={(e) => e.target.files && void addFiles(e.target.files)} />
      </label>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No gallery items yet. The homepage hides this section until you add some.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item, index) => (
            <div key={item.id} className="grid gap-4 rounded-2xl border border-border bg-card p-4 md:grid-cols-[180px_minmax(0,1fr)_auto]">
              <div className="relative aspect-video overflow-hidden rounded-xl bg-muted">
                {item.type === "video" ? (
                  <>
                    <video src={item.url} muted preload="metadata" className="h-full w-full object-cover" />
                    <Play className="absolute left-2 top-2 size-4 text-background" />
                  </>
                ) : (
                  <img src={item.url} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <div className="grid min-w-0 gap-2">
                <Input placeholder="Title (e.g. The Johnson family's new SUV)" value={item.title} onChange={(e) => update(item.id, { title: e.target.value })} />
                <Textarea rows={2} placeholder="Short caption" value={item.caption} onChange={(e) => update(item.id, { caption: e.target.value })} />
                <Select value={item.cta} onValueChange={(v) => update(item.id, { cta: v as GalleryCta })}>
                  <SelectTrigger className="w-full sm:w-64"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(GALLERY_CTAS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v ? `Button: ${v.label}` : "No button"}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 md:flex-col">
                <Button size="icon" variant="outline" aria-label="Move up" onClick={() => move(index, -1)}><ArrowUp className="size-4" /></Button>
                <Button size="icon" variant="outline" aria-label="Move down" onClick={() => move(index, 1)}><ArrowDown className="size-4" /></Button>
                <Button size="icon" variant="outline" aria-label="Delete" onClick={() => persist(items.filter((i) => i.id !== item.id))}><Trash2 className="size-4 text-destructive" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
