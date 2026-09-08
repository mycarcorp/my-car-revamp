import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Eye, Pencil, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/useAuth";
import { formatDate } from "@/lib/format";
import {
  createLegacyPost,
  deleteLegacyPost,
  listLegacyPosts,
  updateLegacyPost,
  type LegacyBlogPost,
} from "@/lib/legacy-blog.functions";

export const Route = createFileRoute("/admin/blog")({
  component: AdminBlog,
});

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

type Draft = {
  id: number | null;
  title: string;
  slug: string;
  category: string;
  excerpt: string;
  body: string;
  image_url: string;
  author_name: string;
  author_initials: string;
  author_color: string;
  read_time: string;
  published: boolean;
};

const emptyDraft = (): Draft => ({
  id: null,
  title: "",
  slug: "",
  category: "",
  excerpt: "",
  body: "",
  image_url: "",
  author_name: "",
  author_initials: "",
  author_color: "#1b3a5c",
  read_time: "",
  published: false,
});

const draftFrom = (p: LegacyBlogPost): Draft => ({
  id: p.id,
  title: p.title ?? "",
  slug: p.slug ?? "",
  category: p.category ?? "",
  excerpt: p.excerpt ?? "",
  body: p.body ?? "",
  image_url: p.image_url ?? "",
  author_name: p.author_name ?? "",
  author_initials: p.author_initials ?? "",
  author_color: p.author_color ?? "#1b3a5c",
  read_time: p.read_time != null ? String(p.read_time) : "",
  published: p.status === "published",
});

function AdminBlog() {
  const { session } = useAuth();
  const accessToken = session?.access_token ?? "";
  const queryClient = useQueryClient();

  const [draft, setDraft] = useState<Draft | null>(null);
  const [viewing, setViewing] = useState<LegacyBlogPost | null>(null);
  const [deleting, setDeleting] = useState<LegacyBlogPost | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "mc_blog"],
    enabled: Boolean(accessToken),
    queryFn: () => listLegacyPosts({ data: { accessToken } }),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin", "mc_blog"] });

  const save = useMutation({
    mutationFn: async (d: Draft) => {
      const payload = {
        accessToken,
        title: d.title,
        slug: d.slug || slugify(d.title),
        category: d.category || null,
        excerpt: d.excerpt || null,
        body: d.body,
        image_url: d.image_url || null,
        author_name: d.author_name || null,
        author_initials: d.author_initials || null,
        author_color: d.author_color || null,
        read_time: d.read_time || null,
        status: d.published ? "published" : "draft",
      };
      return d.id ? updateLegacyPost({ data: { ...payload, id: d.id } }) : createLegacyPost({ data: payload });
    },
    onSuccess: (_r, d) => {
      setDraft(null);
      void refresh();
      toast.success(d.id ? "Post updated." : "Post created.");
    },
    onError: (e: Error) => toast.error(e.message || "Could not save this post."),
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteLegacyPost({ data: { accessToken, id } }),
    onSuccess: () => {
      setDeleting(null);
      void refresh();
      toast.success("Post deleted.");
    },
    onError: (e: Error) => toast.error(e.message || "Could not delete this post."),
  });

  const togglePublish = useMutation({
    mutationFn: (p: LegacyBlogPost) =>
      updateLegacyPost({
        data: {
          accessToken,
          id: p.id,
          title: p.title,
          slug: p.slug,
          category: p.category,
          excerpt: p.excerpt,
          body: p.body,
          image_url: p.image_url,
          author_name: p.author_name,
          author_initials: p.author_initials,
          author_color: p.author_color,
          read_time: p.read_time,
          status: p.status === "published" ? "draft" : "published",
        },
      }),
    onSuccess: () => void refresh(),
    onError: (e: Error) => toast.error(e.message || "Could not update this post."),
  });

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Blogs</h1>
          <p className="text-sm text-muted-foreground">
            Create, view, edit and delete posts. Everything is saved to your blog table.
          </p>
        </div>
        <Button onClick={() => setDraft(emptyDraft())}>
          <Plus className="size-4" /> New post
        </Button>
      </div>

      {isLoading ? (
        <div className="mt-6 h-24 animate-pulse rounded-lg bg-muted" />
      ) : error ? (
        <p className="mt-6 rounded-lg border border-destructive/40 bg-background p-6 text-sm">
          {(error as Error).message || "Couldn't load posts."}
        </p>
      ) : (data ?? []).length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">No posts yet.</p>
      ) : (
        <ul className="mt-6 divide-y divide-border rounded-lg border border-border bg-background">
          {data!.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate font-medium">{p.title}</p>
                <p className="text-xs text-muted-foreground">
                  /{p.slug}
                  {p.category ? ` · ${p.category}` : ""}
                  {p.status === "published" ? ` · published ${formatDate(p.published_at)}` : " · draft"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Published</span>
                  <Switch checked={p.status === "published"} onCheckedChange={() => togglePublish.mutate(p)} />
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" aria-label="View post" onClick={() => setViewing(p)}>
                    <Eye className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="Edit post" onClick={() => setDraft(draftFrom(p))}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="Delete post" onClick={() => setDeleting(p)}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Create / edit */}
      <Dialog open={draft !== null} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Edit post" : "New post"}</DialogTitle>
            <DialogDescription>Fill in the details and save.</DialogDescription>
          </DialogHeader>
          {draft && (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!draft.title.trim()) return;
                save.mutate(draft);
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    required
                    value={draft.title}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Slug</Label>
                  <Input
                    id="slug"
                    placeholder={slugify(draft.title)}
                    value={draft.slug}
                    onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Input
                    id="category"
                    value={draft.category}
                    onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="read">Read time (minutes)</Label>
                  <Input
                    id="read"
                    inputMode="numeric"
                    value={draft.read_time}
                    onChange={(e) => setDraft({ ...draft, read_time: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="author">Author</Label>
                  <Input
                    id="author"
                    value={draft.author_name}
                    onChange={(e) => setDraft({ ...draft, author_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="initials">Author initials</Label>
                  <Input
                    id="initials"
                    maxLength={4}
                    value={draft.author_initials}
                    onChange={(e) => setDraft({ ...draft, author_initials: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="author_color">Author color</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="author_color"
                      type="color"
                      className="h-9 w-14 cursor-pointer p-1"
                      value={draft.author_color || "#1b3a5c"}
                      onChange={(e) => setDraft({ ...draft, author_color: e.target.value })}
                    />
                    <Input
                      aria-label="Author color hex"
                      maxLength={7}
                      placeholder="#1b3a5c"
                      value={draft.author_color}
                      onChange={(e) => setDraft({ ...draft, author_color: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="image">Cover image URL</Label>
                <Input
                  id="image"
                  value={draft.image_url}
                  onChange={(e) => setDraft({ ...draft, image_url: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="excerpt">Excerpt</Label>
                <Textarea
                  id="excerpt"
                  rows={2}
                  value={draft.excerpt}
                  onChange={(e) => setDraft({ ...draft, excerpt: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="body">Body</Label>
                <Textarea
                  id="body"
                  rows={10}
                  value={draft.body}
                  onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="published"
                  checked={draft.published}
                  onCheckedChange={(v) => setDraft({ ...draft, published: v })}
                />
                <Label htmlFor="published">Published</Label>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDraft(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending ? "Saving…" : draft.id ? "Save changes" : "Create post"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* View */}
      <Dialog open={viewing !== null} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewing?.title}</DialogTitle>
            <DialogDescription>
              /{viewing?.slug}
              {viewing?.author_name ? ` · ${viewing.author_name}` : ""}
              {viewing?.status === "published"
                ? ` · published ${formatDate(viewing?.published_at ?? null)}`
                : " · draft"}
            </DialogDescription>
          </DialogHeader>
          {viewing?.image_url && (
            <img
              src={viewing.image_url}
              alt={viewing.title}
              className="w-full rounded-md object-cover"
              loading="lazy"
            />
          )}
          {viewing?.excerpt && <p className="text-sm text-muted-foreground">{viewing.excerpt}</p>}
          <div
            className="prose prose-sm max-w-none dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: viewing?.body ?? "" }}
          />
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <AlertDialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this post?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleting?.title}” will be permanently removed. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (deleting) remove.mutate(deleting.id);
              }}
            >
              {remove.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
