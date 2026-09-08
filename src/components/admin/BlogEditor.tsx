import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Bold,
  ChevronUp,
  ChevronDown,
  ExternalLink,
  Italic,
  Link2,
  Link2Off,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { formatDate } from "@/lib/format";
import {
  DEFAULT_CTA,
  DEFAULT_HEADING_STYLES,
  blocksToHtml,
  htmlToBlocks,
  makeBlock,
  normalizeCta,
  normalizeHeadingStyles,
  readTimeFromHtml,
  slugify,
  type Block,
  type BlockType,
  type HeadingStyle,
  type HeadingStyles,
  type PrimaryCta,
} from "@/lib/blog-content";
import {
  addBlogCategory,
  createLegacyPost,
  getLegacyPost,
  listBlogCategories,
  updateLegacyPost,
} from "@/lib/legacy-blog.functions";

const TYPE_LABEL: Record<BlockType, string> = { h1: "H1", h2: "H2", h3: "H3", p: "Body" };

/* -------------------------------------------------------------------------- */
/* Single editable section                                                     */
/* -------------------------------------------------------------------------- */

function SectionEditor({
  block,
  styles,
  onChange,
  onType,
  onDelete,
  onMove,
  registerRef,
}: {
  block: Block;
  styles: HeadingStyles;
  onChange: (html: string) => void;
  onType: (type: BlockType) => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
  registerRef: (el: HTMLDivElement | null) => void;
}) {
  const initial = useMemo(() => block.html, [block.id, block.type]); // eslint-disable-line react-hooks/exhaustive-deps
  const style: HeadingStyle | null = block.type === "p" ? null : styles[block.type];

  return (
    <div className="group relative">
      <div className="absolute -left-2 top-1 flex -translate-x-full items-center gap-1 opacity-0 transition group-focus-within:opacity-100 group-hover:opacity-100">
        <select
          aria-label="Section type"
          className="rounded border border-border bg-background px-1 py-0.5 text-xs"
          value={block.type}
          onChange={(e) => onType(e.target.value as BlockType)}
        >
          {(["h1", "h2", "h3", "p"] as BlockType[]).map((t) => (
            <option key={t} value={t}>
              {TYPE_LABEL[t]}
            </option>
          ))}
        </select>
        <button type="button" aria-label="Move section up" onClick={() => onMove(-1)} className="p-1">
          <ChevronUp className="size-3.5" />
        </button>
        <button type="button" aria-label="Move section down" onClick={() => onMove(1)} className="p-1">
          <ChevronDown className="size-3.5" />
        </button>
        <button type="button" aria-label="Delete section" onClick={onDelete} className="p-1">
          <Trash2 className="size-3.5 text-destructive" />
        </button>
      </div>

      <div
        ref={registerRef}
        data-block-id={block.id}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-label={`${TYPE_LABEL[block.type]} section`}
        onInput={(e) => onChange((e.target as HTMLDivElement).innerHTML)}
        onBlur={(e) => onChange((e.target as HTMLDivElement).innerHTML)}
        className="prose-blog min-h-[1.6em] rounded px-1 py-0.5 outline-none focus:bg-muted/40"
        style={
          style
            ? {
                fontSize: style.fontSize,
                fontWeight: style.fontWeight,
                lineHeight: style.lineHeight,
                textAlign: style.textAlign,
                color: style.color,
              }
            : { fontSize: "18px", lineHeight: 1.75 }
        }
        dangerouslySetInnerHTML={{ __html: initial }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Add-section divider                                                         */
/* -------------------------------------------------------------------------- */

function AddSection({ onAdd }: { onAdd: (type: BlockType) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="group relative py-3">
      <div className="h-px w-full bg-border" />
      {open ? (
        <div className="absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 gap-1 rounded-lg border border-border bg-background p-1 shadow-md">
          {(["h1", "h2", "h3", "p"] as BlockType[]).map((t) => (
            <Button
              key={t}
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                onAdd(t);
                setOpen(false);
              }}
            >
              {TYPE_LABEL[t]}
            </Button>
          ))}
          <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground opacity-0 transition hover:text-foreground group-hover:opacity-100 focus:opacity-100"
        >
          <Plus className="size-3.5" /> Add Section
        </button>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Main editor                                                                 */
/* -------------------------------------------------------------------------- */

type Tab = "content" | "design";

export function BlogEditor({ postId }: { postId?: number }) {
  const { session } = useAuth();
  const accessToken = session?.access_token ?? "";
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<Tab>("content");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [blocks, setBlocks] = useState<Block[]>([makeBlock("p")]);
  const [category, setCategory] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [authorInitials, setAuthorInitials] = useState("");
  const [authorColor, setAuthorColor] = useState("#1b3a5c");
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [cta, setCta] = useState<PrimaryCta>(DEFAULT_CTA);
  const [styles, setStyles] = useState<HeadingStyles>(DEFAULT_HEADING_STYLES);
  const [status, setStatus] = useState("draft");
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState<string | null>(null);

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [toolbar, setToolbar] = useState<{ top: number; left: number } | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const savedRange = useRef<Range | null>(null);
  const [activeLink, setActiveLink] = useState<string | null>(null);

  const loaded = useRef(false);

  const { data: existing, isLoading } = useQuery({
    queryKey: ["admin", "mc_blog", postId],
    enabled: Boolean(accessToken && postId),
    queryFn: () => getLegacyPost({ data: { accessToken, id: postId! } }),
  });

  const { data: categories } = useQuery({
    queryKey: ["admin", "mc_blog_categories"],
    enabled: Boolean(accessToken),
    queryFn: () => listBlogCategories({ data: { accessToken } }),
  });

  useEffect(() => {
    if (!existing || loaded.current) return;
    loaded.current = true;
    setTitle(existing.title ?? "");
    setSlug(existing.slug ?? "");
    setSlugTouched(true);
    setBlocks(htmlToBlocks(existing.body));
    setCategory(existing.category ?? "");
    setExcerpt(existing.excerpt ?? "");
    setImageUrl(existing.image_url ?? "");
    setAuthorName(existing.author_name ?? "");
    setAuthorInitials(existing.author_initials ?? "");
    setAuthorColor(existing.author_color ?? "#1b3a5c");
    setMetaTitle((existing.meta_title as string) ?? "");
    setMetaDescription((existing.meta_description as string) ?? "");
    setCta(normalizeCta(existing.primary_cta));
    setStyles(normalizeHeadingStyles(existing.heading_styles));
    setStatus(existing.status ?? "draft");
    setPublishedAt(existing.published_at ?? null);
  }, [existing]);

  const effectiveSlug = slugTouched && slug ? slugify(slug) : slugify(title);

  /* ----------------------------- block helpers ---------------------------- */

  const updateBlock = (id: string, html: string) =>
    setBlocks((b) => b.map((x) => (x.id === id ? { ...x, html } : x)));

  const changeType = (id: string, type: BlockType) =>
    setBlocks((b) => b.map((x) => (x.id === id ? { ...x, type } : x)));

  const removeBlock = (id: string) =>
    setBlocks((b) => (b.length === 1 ? [makeBlock("p")] : b.filter((x) => x.id !== id)));

  const moveBlock = (id: string, dir: -1 | 1) =>
    setBlocks((b) => {
      const i = b.findIndex((x) => x.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= b.length) return b;
      const copy = [...b];
      const [item] = copy.splice(i, 1);
      copy.splice(j, 0, item!);
      return copy;
    });

  const insertAt = (index: number, type: BlockType) =>
    setBlocks((b) => {
      const copy = [...b];
      copy.splice(index, 0, makeBlock(type));
      return copy;
    });

  /* -------------------------- selection / linking ------------------------- */

  useEffect(() => {
    const onSelect = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
        if (!linkOpen) setToolbar(null);
        return;
      }
      const range = sel.getRangeAt(0);
      if (!canvasRef.current?.contains(range.commonAncestorContainer)) return;
      const rect = range.getBoundingClientRect();
      savedRange.current = range.cloneRange();
      setToolbar({ top: rect.top + window.scrollY - 44, left: rect.left + window.scrollX });
      const node = range.commonAncestorContainer as HTMLElement;
      const anchor = (node.nodeType === 1 ? node : node.parentElement)?.closest("a");
      setActiveLink(anchor?.getAttribute("href") ?? null);
    };
    document.addEventListener("selectionchange", onSelect);
    return () => document.removeEventListener("selectionchange", onSelect);
  }, [linkOpen]);

  const restoreRange = () => {
    const sel = window.getSelection();
    if (savedRange.current && sel) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
  };

  const syncBlockFromDom = () => {
    const el = (window.getSelection()?.anchorNode as HTMLElement | null)?.parentElement?.closest(
      "[data-block-id]",
    ) as HTMLElement | null;
    if (el) updateBlock(el.dataset["blockId"]!, el.innerHTML);
  };

  const exec = (cmd: string, value?: string) => {
    restoreRange();
    document.execCommand(cmd, false, value);
    syncBlockFromDom();
  };

  const applyLink = () => {
    const url = linkUrl.trim();
    if (!url) return;
    restoreRange();
    document.execCommand("createLink", false, url);
    // Mark external links safe.
    canvasRef.current?.querySelectorAll("a").forEach((a) => {
      const href = a.getAttribute("href") ?? "";
      if (/^https?:/i.test(href)) {
        a.setAttribute("target", "_blank");
        a.setAttribute("rel", "noopener noreferrer");
      } else {
        a.removeAttribute("target");
        a.removeAttribute("rel");
      }
    });
    canvasRef.current?.querySelectorAll<HTMLElement>("[data-block-id]").forEach((el) => {
      updateBlock(el.dataset["blockId"]!, el.innerHTML);
    });
    setLinkOpen(false);
    setLinkUrl("");
    setToolbar(null);
  };

  const removeLink = () => {
    exec("unlink");
    setActiveLink(null);
  };

  /* -------------------------------- saving -------------------------------- */

  const save = useMutation({
    mutationFn: async (nextStatus: "draft" | "published") => {
      if (!title.trim()) throw new Error("A title is required.");
      const body = blocksToHtml(blocks);
      const payload = {
        accessToken,
        title: title.trim(),
        slug: effectiveSlug,
        category: category || null,
        excerpt: excerpt || null,
        body,
        image_url: imageUrl || null,
        author_name: authorName || null,
        author_initials: authorInitials || null,
        author_color: authorColor || null,
        read_time: readTimeFromHtml(body),
        status: nextStatus,
        meta_title: metaTitle || null,
        meta_description: metaDescription || null,
        primary_cta: cta,
        heading_styles: styles,
      };
      return postId
        ? await updateLegacyPost({ data: { ...payload, id: postId } })
        : await createLegacyPost({ data: payload });
    },
    onSuccess: (post, nextStatus) => {
      setStatus(nextStatus);
      setPublishedAt(post.published_at ?? null);
      void queryClient.invalidateQueries({ queryKey: ["admin", "mc_blog"] });
      toast.success(nextStatus === "published" ? "Post published." : "Draft saved.");
      if (!postId) void navigate({ to: "/admin/blog/$id/edit", params: { id: String(post.id) } });
    },
    onError: (e: Error) => toast.error(e.message || "Could not save this post."),
  });

  const addCategoryMut = useMutation({
    mutationFn: (name: string) => addBlogCategory({ data: { accessToken, name } }),
    onSuccess: (r) => {
      setCategory(r.name);
      setNewCategory(null);
      void queryClient.invalidateQueries({ queryKey: ["admin", "mc_blog_categories"] });
      toast.success("Category added.");
    },
    onError: (e: Error) => toast.error(e.message || "Could not add that category."),
  });

  if (postId && isLoading) {
    return <div className="p-10 text-sm text-muted-foreground">Loading post…</div>;
  }

  const categoryOptions = [...new Set([...(categories ?? []), ...(category ? [category] : [])])];

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <div className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3">
          <Button variant="ghost" size="sm" onClick={() => void navigate({ to: "/admin/blog" })}>
            <ArrowLeft className="size-4" /> Blog Posts
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {status === "published" ? `Published ${formatDate(publishedAt)}` : "Draft"}
            </span>
            <Button variant="outline" disabled={save.isPending} onClick={() => save.mutate("draft")}>
              Save Draft
            </Button>
            <Button disabled={save.isPending} onClick={() => save.mutate("published")}>
              Publish
            </Button>
          </div>
        </div>
        <div className="flex gap-6 px-6">
          {(["content", "design"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`-mb-px border-b-2 px-1 pb-2 text-sm font-medium capitalize ${
                tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-8 px-6 py-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Canvas */}
        <div className="mx-auto w-full max-w-3xl">
          {tab === "content" ? (
            <>
              <input
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (!slugTouched) setSlug(slugify(e.target.value));
                }}
                placeholder="Add title"
                aria-label="Post title"
                className="w-full border-0 bg-transparent font-display text-4xl font-bold outline-none placeholder:text-muted-foreground/50"
              />
              <div className="mt-4 h-px w-full bg-border" />

              <div ref={canvasRef} className="mt-2">
                <AddSection onAdd={(t) => insertAt(0, t)} />
                {blocks.map((b, i) => (
                  <div key={b.id}>
                    <SectionEditor
                      block={b}
                      styles={styles}
                      onChange={(html) => updateBlock(b.id, html)}
                      onType={(t) => changeType(b.id, t)}
                      onDelete={() => removeBlock(b.id)}
                      onMove={(d) => moveBlock(b.id, d)}
                      registerRef={() => {}}
                    />
                    <AddSection onAdd={(t) => insertAt(i + 1, t)} />
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="space-y-8">
              <h2 className="font-display text-xl font-bold">Design</h2>
              {(["h1", "h2", "h3"] as const).map((k) => (
                <div key={k} className="rounded-lg border border-border p-4">
                  <p className="font-semibold uppercase">{k}</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label>Font size</Label>
                      <Input
                        value={styles[k].fontSize}
                        onChange={(e) =>
                          setStyles({ ...styles, [k]: { ...styles[k], fontSize: e.target.value } })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Font weight</Label>
                      <Select
                        value={String(styles[k].fontWeight)}
                        onValueChange={(v) =>
                          setStyles({ ...styles, [k]: { ...styles[k], fontWeight: Number(v) } })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[300, 400, 500, 600, 700, 800].map((w) => (
                            <SelectItem key={w} value={String(w)}>
                              {w}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Line height</Label>
                      <Input
                        value={String(styles[k].lineHeight)}
                        onChange={(e) =>
                          setStyles({
                            ...styles,
                            [k]: { ...styles[k], lineHeight: Number(e.target.value) || 1.2 },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Alignment</Label>
                      <Select
                        value={styles[k].textAlign}
                        onValueChange={(v) =>
                          setStyles({
                            ...styles,
                            [k]: { ...styles[k], textAlign: v as HeadingStyle["textAlign"] },
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {["left", "center", "right"].map((a) => (
                            <SelectItem key={a} value={a}>
                              {a}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Text color</Label>
                      <div className="flex gap-2">
                        <Input
                          type="color"
                          className="h-9 w-14 cursor-pointer p-1"
                          value={styles[k].color}
                          onChange={(e) =>
                            setStyles({ ...styles, [k]: { ...styles[k], color: e.target.value } })
                          }
                        />
                        <Input
                          value={styles[k].color}
                          onChange={(e) =>
                            setStyles({ ...styles, [k]: { ...styles[k], color: e.target.value } })
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Settings sidebar */}
        <aside className="space-y-6 lg:sticky lg:top-32 lg:self-start">
          <section className="rounded-lg border border-border bg-background p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Post</h3>
            <div className="mt-3 space-y-3">
              <div className="space-y-1">
                <Label htmlFor="image">Featured image URL</Label>
                <Input id="image" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
                {imageUrl && (
                  <img src={imageUrl} alt="" className="mt-2 w-full rounded-md object-cover" />
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="author">Author</Label>
                <Input id="author" value={authorName} onChange={(e) => setAuthorName(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="initials">Initials</Label>
                  <Input
                    id="initials"
                    maxLength={4}
                    value={authorInitials}
                    onChange={(e) => setAuthorInitials(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="acolor">Author color</Label>
                  <Input
                    id="acolor"
                    type="color"
                    className="h-9 w-full cursor-pointer p-1"
                    value={authorColor}
                    onChange={(e) => setAuthorColor(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Category</Label>
                {newCategory === null ? (
                  <Select
                    value={category || "__none"}
                    onValueChange={(v) => (v === "__add" ? setNewCategory("") : setCategory(v === "__none" ? "" : v))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">No category</SelectItem>
                      {categoryOptions.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                      <SelectItem value="__add">+ Add Category</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="space-y-2">
                    <Input
                      autoFocus
                      placeholder="New category"
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setNewCategory(null)}>
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        disabled={!newCategory.trim() || addCategoryMut.isPending}
                        onClick={() => addCategoryMut.mutate(newCategory.trim())}
                      >
                        Add Category
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Status: {status === "published" ? "Published" : "Draft"}
                {publishedAt ? ` · ${formatDate(publishedAt)}` : ""}
                {" · "}
                {readTimeFromHtml(blocksToHtml(blocks))} min read
              </p>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-background p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">SEO</h3>
            <div className="mt-3 space-y-3">
              <div className="space-y-1">
                <Label htmlFor="slug">Slug</Label>
                <Input
                  id="slug"
                  value={slugTouched ? slug : effectiveSlug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setSlug(e.target.value);
                  }}
                  onBlur={() => setSlug(slugify(slug))}
                />
                <p className="break-all text-xs text-muted-foreground">
                  mycarcorporation.com/blog/{effectiveSlug || "…"}
                </p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="mtitle">Meta title</Label>
                <Input id="mtitle" value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="mdesc">Meta description</Label>
                <Textarea
                  id="mdesc"
                  rows={3}
                  value={metaDescription}
                  onChange={(e) => setMetaDescription(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="excerpt">Excerpt</Label>
                <Textarea
                  id="excerpt"
                  rows={3}
                  value={excerpt}
                  onChange={(e) => setExcerpt(e.target.value)}
                />
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-background p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Primary CTA
            </h3>
            <div className="mt-3 space-y-3">
              <div className="flex items-center gap-2">
                <Switch
                  id="cta"
                  checked={cta.enabled}
                  onCheckedChange={(v) => setCta({ ...cta, enabled: v })}
                />
                <Label htmlFor="cta">Enable CTA</Label>
              </div>
              <div className="space-y-1">
                <Label htmlFor="ctah">Headline</Label>
                <Input
                  id="ctah"
                  value={cta.headline}
                  onChange={(e) => setCta({ ...cta, headline: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ctab">Button text</Label>
                <Input
                  id="ctab"
                  value={cta.button_text}
                  onChange={(e) => setCta({ ...cta, button_text: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ctau">Button link</Label>
                <Input
                  id="ctau"
                  placeholder="/inventory"
                  value={cta.url}
                  onChange={(e) => setCta({ ...cta, url: e.target.value })}
                />
              </div>
            </div>
          </section>
        </aside>
      </div>

      {/* Floating formatting toolbar */}
      {tab === "content" && toolbar && (
        <div
          className="absolute z-30 flex items-center gap-1 rounded-md border border-border bg-background p-1 shadow-lg"
          style={{ top: toolbar.top, left: toolbar.left }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <Button type="button" size="icon" variant="ghost" aria-label="Bold" onClick={() => exec("bold")}>
            <Bold className="size-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Italic"
            onClick={() => exec("italic")}
          >
            <Italic className="size-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Insert link"
            onClick={() => {
              setLinkUrl(activeLink ?? "");
              setLinkOpen(true);
            }}
          >
            <Link2 className="size-4" />
          </Button>
          {activeLink && (
            <>
              <a
                href={activeLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex size-9 items-center justify-center rounded-md hover:bg-muted"
                aria-label="Open link"
              >
                <ExternalLink className="size-4" />
              </a>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="Remove link"
                onClick={removeLink}
              >
                <Link2Off className="size-4" />
              </Button>
            </>
          )}
          {linkOpen && (
            <div className="ml-1 flex items-center gap-1">
              <Input
                autoFocus
                value={linkUrl}
                placeholder="https://… or /inventory"
                className="h-8 w-56"
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    applyLink();
                  }
                }}
              />
              <Button type="button" size="sm" onClick={applyLink}>
                Apply
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
