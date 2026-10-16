import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ImageIcon,
  Images,
  Loader2,
  MonitorSmartphone,
  Play,
  Save,
  Trash2,
  Upload,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
      { title: "Homepage Media — MyCar Admin" },
      { name: "description", content: "Manage the homepage hero and customer gallery." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Homepage Media — MyCar Admin" },
      { property: "og:description", content: "Manage homepage media." },
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
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Could not upload ${file.name}.`));
    xhr.onerror = () => reject(new Error(`Could not upload ${file.name}.`));
    xhr.send(file);
  });
}

function AdminGallery() {
  const { session } = useAuth();
  const token = session?.access_token ?? "";
  const [activeTab, setActiveTab] = useState("hero");
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const itemsRef = useRef<GalleryItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Keep the latest edited items available during asynchronous uploads.
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    let cancelled = false;
    listGalleryFn()
      .then((result) => {
        if (!cancelled) {
          setItems(result);
          itemsRef.current = result;
          setDirty(false);
        }
      })
      .catch(() => {
        if (!cancelled) toast.error("Could not load the gallery.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function persist(next: GalleryItem[]) {
    if (!token) {
      toast.error("Your admin session has expired. Please sign in again.");
      return false;
    }
    setSaving(true);
    try {
      const saved = await saveGalleryFn({ data: { accessToken: token, items: next } });
      setItems(saved);
      itemsRef.current = saved;
      setDirty(false);
      toast.success("Gallery saved successfully");
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the gallery.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function addFiles(files: FileList | File[]) {
    if (uploading || saving || loading) return;
    if (!token) {
      toast.error("Your admin session has expired. Please sign in again.");
      return;
    }
    const valid = Array.from(files).filter((file) => /^(image|video)\//.test(file.type));
    if (!valid.length) {
      toast.error("Please choose an image or video file.");
      return;
    }
    setUploading(true);
    const added: GalleryItem[] = [];
    try {
      for (const [index, file] of valid.entries()) {
        setProgress(`Uploading ${index + 1} of ${valid.length} · 0%`);
        const { uploadUrl, key, url } = await createGalleryUploadFn({
          data: { accessToken: token, contentType: file.type },
        });
        await put(uploadUrl, file, (percentage) => {
          setProgress(`Uploading ${index + 1} of ${valid.length} · ${percentage}%`);
        });
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
      setProgress("Saving uploaded media…");
      await persist([...itemsRef.current, ...added]);
    } catch (error) {
      // Preserve successfully uploaded files in the editor if a later upload fails.
      if (added.length) {
        setItems((current) => [...current, ...added]);
        setDirty(true);
      }
      toast.error(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploading(false);
      setProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }
  const update = (id: string, patch: Partial<GalleryItem>) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
    setDirty(true);
  };

  const move = (index: number, direction: number) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= items.length) return;
    setItems((current) => {
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex]!, next[index]!];
      return next;
    });
    setDirty(true);
  };

  const remove = async (id: string) => {
    if (!window.confirm("Remove this item from the homepage gallery?")) return;
    await persist(items.filter((item) => item.id !== id));
  };

  const photoCount = items.filter((item) => item.type === "photo").length;
  const videoCount = items.filter((item) => item.type === "video").length;
  const busy = saving || uploading;

  return (
    <div className="min-w-0 space-y-6 pb-12">
      <AdminPageHeader
        title="Homepage media"
        subtitle="Manage your storefront hero and real customer experiences from one place."
      />

      <div className="space-y-6 px-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Images className="size-6" />
              </div>
              <div>
                <h2 className="font-display text-lg font-bold text-foreground">Storefront media center</h2>
                <p className="text-sm text-muted-foreground">
                  A consistent look across desktop, mobile, and your customer gallery.
                </p>
              </div>
            </div>
            <a
              href="https://www.mycarcorp.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center rounded-lg border border-border bg-background px-3 text-sm font-semibold text-foreground transition hover:bg-muted"
            >
              View live website ↗
            </a>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-5">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-xl bg-muted p-1 sm:inline-grid sm:w-auto sm:min-w-[410px]">
            <TabsTrigger
              value="hero"
              className="min-w-0 gap-2 rounded-lg px-3 py-3 text-sm font-semibold data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm"
            >
              <MonitorSmartphone className="size-4 shrink-0" />
              <span>Hero Section</span>
            </TabsTrigger>
            <TabsTrigger
              value="gallery"
              className="min-w-0 gap-2 rounded-lg px-3 py-3 text-sm font-semibold data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm"
            >
              <Images className="size-4 shrink-0" />
              <span>Customer Gallery</span>
              {!loading && (
                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                  {items.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="hero" className="mt-0 space-y-4 outline-none">
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-5">
                <div>
                  <h3 className="font-display text-xl font-bold text-foreground">Hero section editor</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Edit the homepage banner and review its desktop and mobile previews before publishing.
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground">
                  <MonitorSmartphone className="size-3.5" /> Desktop &amp; mobile
                </span>
              </div>
              <div className="min-w-0">
                <HeroEditor token={token} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="gallery" className="mt-0 space-y-5 outline-none">
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { label: "Total media", count: items.length, Icon: Images },
                { label: "Photos", count: photoCount, Icon: ImageIcon },
                { label: "Videos", count: videoCount, Icon: Video },
              ].map(({ label, count, Icon }) => (
                <div
                  key={label}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm"
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                    <Icon className="size-5" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">{label}</p>
                    <p className="font-display text-2xl font-bold tabular-nums text-foreground">
                      {loading ? "—" : count}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border p-4 sm:p-6">
                <div className="min-w-0">
                  <h3 className="font-display text-xl font-bold text-foreground">Customer stories</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Photos and videos featured in “Real customers. Real keys.”
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {dirty && (
                    <span className="rounded-full bg-accent/15 px-2.5 py-1 text-xs font-semibold text-accent-foreground">
                      Unsaved edits
                    </span>
                  )}
                  {!dirty && !loading && !busy && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <CheckCircle2 className="size-3.5" /> Saved
                    </span>
                  )}
                  <Button
                    onClick={() => void persist(items)}
                    disabled={loading || busy || !dirty || !token}
                    className="gap-2"
                  >
                    {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                    Save gallery
                  </Button>
                </div>
              </div>
              <div className="space-y-5 p-4 sm:p-6">
                <div
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    void addFiles(event.dataTransfer.files);
                  }}
                  className="rounded-xl border-2 border-dashed border-border bg-surface p-6 text-center transition-colors hover:border-primary/40 sm:p-9"
                >
                  <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    {uploading ? <Loader2 className="size-6 animate-spin" /> : <Upload className="size-6" />}
                  </div>
                  <h4 className="mt-3 text-base font-bold text-foreground">
                    {progress ?? "Add customer photos and videos"}
                  </h4>
                  <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                    Drag files here or browse your device. Images and videos upload directly to your gallery.
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    disabled={busy || loading || !token}
                    className="sr-only"
                    onChange={(event) => {
                      if (event.target.files) void addFiles(event.target.files);
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-4 gap-2"
                    disabled={busy || loading || !token}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="size-4" /> Choose files
                  </Button>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center gap-2 rounded-xl bg-muted/60 p-12 text-sm text-muted-foreground">
                    <Loader2 className="size-5 animate-spin" /> Loading gallery…
                  </div>
                ) : items.length === 0 ? (
                  <div className="rounded-xl border border-border p-10 text-center">
                    <Images className="mx-auto size-9 text-muted-foreground" />
                    <h4 className="mt-3 font-semibold text-foreground">No customer media yet</h4>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Upload a customer photo or video to start your homepage gallery.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="text-sm font-bold text-foreground">Gallery items ({items.length})</h4>
                      <p className="text-xs text-muted-foreground">
                        Use the arrows to change the display order, then save.
                      </p>
                    </div>
                    {items.map((item, index) => (
                      <article
                        key={item.id}
                        className="grid min-w-0 gap-4 rounded-xl border border-border bg-background p-4 transition-shadow hover:shadow-sm lg:grid-cols-[210px_minmax(0,1fr)_auto]"
                      >
                        <div className="min-w-0">
                          <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
                            {item.type === "video" ? (
                              <>
                                <video
                                  src={item.url}
                                  controls
                                  preload="metadata"
                                  className="h-full w-full object-cover"
                                />
                                <span className="pointer-events-none absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-foreground/80 px-2 py-1 text-[10px] font-bold text-background">
                                  <Play className="size-3" /> Video
                                </span>
                              </>
                            ) : (
                              <img
                                src={item.url}
                                alt={item.title || `Customer photo ${index + 1}`}
                                loading="lazy"
                                className="h-full w-full object-cover"
                              />
                            )}
                          </div>
                          <p className="mt-2 text-xs font-medium text-muted-foreground">
                            Item {index + 1} · {item.type === "video" ? "Video" : "Photo"}
                          </p>
                        </div>
                        <div className="grid min-w-0 content-start gap-3">
                          <div>
                            <label
                              htmlFor={`gallery-title-${item.id}`}
                              className="mb-1.5 block text-xs font-semibold text-foreground"
                            >
                              Title
                            </label>
                            <Input
                              id={`gallery-title-${item.id}`}
                              value={item.title}
                              onChange={(event) => update(item.id, { title: event.target.value })}
                              placeholder="e.g. The Johnson family's new SUV"
                            />
                          </div>
                          <div>
                            <label
                              htmlFor={`gallery-caption-${item.id}`}
                              className="mb-1.5 block text-xs font-semibold text-foreground"
                            >
                              Caption
                            </label>
                            <Textarea
                              id={`gallery-caption-${item.id}`}
                              rows={2}
                              value={item.caption}
                              onChange={(event) => update(item.id, { caption: event.target.value })}
                              placeholder="Add a short customer story"
                            />
                          </div>
                          <div>
                            <span className="mb-1.5 block text-xs font-semibold text-foreground">
                              Call-to-action button
                            </span>
                            <Select
                              value={item.cta}
                              onValueChange={(value) => update(item.id, { cta: value as GalleryCta })}
                            >
                              <SelectTrigger className="w-full sm:max-w-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(GALLERY_CTAS).map(([key, value]) => (
                                  <SelectItem key={key} value={key}>
                                    {value ? value.label : "No button"}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="flex items-start gap-2 border-t border-border pt-3 lg:flex-col lg:border-l lg:border-t-0 lg:pl-3 lg:pt-0">
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            aria-label={`Move item ${index + 1} up`}
                            title="Move up"
                            disabled={busy || index === 0}
                            onClick={() => move(index, -1)}
                          >
                            <ArrowUp className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            aria-label={`Move item ${index + 1} down`}
                            title="Move down"
                            disabled={busy || index === items.length - 1}
                            onClick={() => move(index, 1)}
                          >
                            <ArrowDown className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            aria-label={`Remove item ${index + 1}`}
                            title="Remove item"
                            disabled={busy}
                            onClick={() => void remove(item.id)}
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
