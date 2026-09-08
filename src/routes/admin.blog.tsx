import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
import { supabase } from "@/integrations/supabase/app-client";
import { formatDate } from "@/lib/format";
import type { BlogPost } from "@/lib/queries";

export const Route = createFileRoute("/admin/blog")({
  component: AdminBlog,
});

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

type Draft = {
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  author_name: string;
  cover_image_url: string;
  published: boolean;
};

const emptyDraft: Draft = {
  title: "",
  slug: "",
  excerpt: "",
  body: "",
  author_name: "",
  cover_image_url: "",
  published: false,
};

function AdminBlog() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<BlogPost | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [viewing, setViewing] = useState<BlogPost | null>(null);
  const [deleting, setDeleting] = useState<BlogPost | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as BlogPost[];
    },
  });

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["admin", "posts"] });
    void queryClient.invalidateQueries({ queryKey: ["blog"] });
  }

  async function togglePublish(post: BlogPost, published: boolean) {
    const { error } = await supabase
      .from("blog_posts")
      .update({
        published,
        published_at: published ? (post.published_at ?? new Date().toISOString()) : null,
      })
      .eq("id", post.id);
    if (error) {
      toast.error("Could not update this post.");
      return;
    }
    refresh();
  }

  async function confirmDelete() {
    if (!deleting) return;
    const { error } = await supabase.from("blog_posts").delete().eq("id", deleting.id);
    if (error) {
      toast.error("Could not delete this post.");
      return;
    }
    setDeleting(null);
    refresh();
    toast.success("Post deleted.");
  }

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Blog</h1>
          <p className="text-sm text-muted-foreground">
            Write, save as a draft, then publish when ready.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          + New post
        </Button>
      </div>

      {isLoading ? (
        <div className="mt-6 h-20 animate-pulse rounded-lg bg-muted" />
      ) : error ? (
        <p className="mt-6 rounded-lg border border-destructive/40 bg-background p-6 text-sm">
          Couldn't load posts.
        </p>
      ) : (data?.length ?? 0) === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">No posts yet.</p>
      ) : (
        <ul className="mt-6 divide-y divide-border rounded-lg border border-border bg-background">
          {data?.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate font-medium">{p.title}</p>
                <p className="text-xs text-muted-foreground">
                  /{p.slug} {p.published ? `· published ${formatDate(p.published_at)}` : "· draft"}
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Published</span>
                <Switch checked={p.published} onCheckedChange={(v) => togglePublish(p, v)} />
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`View ${p.title}`}
                  onClick={() => setViewing(p)}
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Edit ${p.title}`}
                  onClick={() => {
                    setEditing(p);
                    setFormOpen(true);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Delete ${p.title}`}
                  onClick={() => setDeleting(p)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <PostFormDialog
        open={formOpen}
        post={editing}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) setEditing(null);
        }}
        onSaved={refresh}
      />

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{viewing?.title}</DialogTitle>
            <DialogDescription>
              /{viewing?.slug}
              {viewing?.published ? ` · published ${formatDate(viewing.published_at)}` : " · draft"}
            </DialogDescription>
          </DialogHeader>
          {viewing?.cover_image_url && (
            <img
              src={viewing.cover_image_url}
              alt={viewing.title}
              className="aspect-[16/9] w-full rounded-lg object-cover"
            />
          )}
          {viewing?.excerpt && <p className="text-sm text-muted-foreground">{viewing.excerpt}</p>}
          <div className="whitespace-pre-line text-sm leading-relaxed">{viewing?.body}</div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this post?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleting?.title}" will be removed permanently. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PostFormDialog({
  open,
  post,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  post: BlogPost | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft(
      post
        ? {
            title: post.title,
            slug: post.slug,
            excerpt: post.excerpt ?? "",
            body: post.body ?? "",
            author_name: post.author_name ?? "",
            cover_image_url: post.cover_image_url ?? "",
            published: post.published,
          }
        : emptyDraft,
    );
  }, [open, post]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const title = draft.title.trim();
    if (!title) return;
    const slug = slugify(draft.slug.trim() || title);
    if (!slug) {
      toast.error("Please give this post a valid web address.");
      return;
    }
    setSaving(true);
    const values = {
      title,
      slug,
      excerpt: draft.excerpt.trim() || null,
      body: draft.body,
      author_name: draft.author_name.trim() || null,
      cover_image_url: draft.cover_image_url.trim() || null,
      published: draft.published,
      published_at: draft.published ? (post?.published_at ?? new Date().toISOString()) : null,
    };

    const { error } = post
      ? await supabase.from("blog_posts").update(values).eq("id", post.id)
      : await supabase.from("blog_posts").insert(values);
    setSaving(false);

    if (error) {
      toast.error(
        error.message.includes("duplicate")
          ? "Another post already uses that web address."
          : "Could not save this post.",
      );
      return;
    }
    onOpenChange(false);
    onSaved();
    toast.success(post ? "Post updated." : "Post created.");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{post ? "Edit post" : "New post"}</DialogTitle>
          <DialogDescription>
            Fill in the details below, then save. Unpublished posts stay hidden from visitors.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={draft.title}
                onChange={(e) => set("title", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="author">Author</Label>
              <Input
                id="author"
                value={draft.author_name}
                onChange={(e) => set("author_name", e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">Web address</Label>
            <Input
              id="slug"
              placeholder={slugify(draft.title) || "my-post"}
              value={draft.slug}
              onChange={(e) => set("slug", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cover">Cover image URL</Label>
            <Input
              id="cover"
              value={draft.cover_image_url}
              onChange={(e) => set("cover_image_url", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="excerpt">Excerpt</Label>
            <Textarea
              id="excerpt"
              rows={2}
              value={draft.excerpt}
              onChange={(e) => set("excerpt", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="body">Body</Label>
            <Textarea
              id="body"
              rows={10}
              value={draft.body}
              onChange={(e) => set("body", e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
            <Switch
              id="published"
              checked={draft.published}
              onCheckedChange={(v) => set("published", v)}
            />
            <Label htmlFor="published">Published</Label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : post ? "Save changes" : "Create post"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
