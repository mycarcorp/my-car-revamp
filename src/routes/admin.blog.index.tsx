import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Eye, Pencil, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { sanitizeHtml } from "@/lib/blog-content";
import {
  deleteLegacyPost,
  getBlogSchemaStatus,
  listLegacyPosts,
  updateLegacyPost,
  type LegacyBlogPost,
} from "@/lib/legacy-blog.functions";

export const Route = createFileRoute("/admin/blog/")({
  head: () => ({
    meta: [
      { title: "Blog posts — MyCar admin" },
      { name: "description", content: "Manage MyCar blog articles." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminBlog,
});

function AdminBlog() {
  const { session } = useAuth();
  const accessToken = session?.access_token ?? "";
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [viewing, setViewing] = useState<LegacyBlogPost | null>(null);
  const [deleting, setDeleting] = useState<LegacyBlogPost | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "mc_blog"],
    enabled: Boolean(accessToken),
    queryFn: () => listLegacyPosts({ data: { accessToken } }),
  });

  const { data: schema } = useQuery({
    queryKey: ["admin", "mc_blog", "schema"],
    enabled: Boolean(accessToken),
    queryFn: () => getBlogSchemaStatus({ data: { accessToken } }),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin", "mc_blog"] });

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
          meta_title: (p.meta_title as string) ?? null,
          meta_description: (p.meta_description as string) ?? null,
          primary_cta: p.primary_cta ?? null,
          heading_styles: p.heading_styles ?? null,
        },
      }),
    onSuccess: () => void refresh(),
    onError: (e: Error) => toast.error(e.message || "Could not update this post."),
  });

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Blog</h1>
          <p className="text-sm text-muted-foreground">
            Write, publish and manage articles. Everything is saved to your blog table.
          </p>
        </div>
        <Button onClick={() => void navigate({ to: "/admin/blog/new" })}>
          <Plus className="size-4" /> Add Blog Post
        </Button>
      </div>

      {schema && (!schema.hasSeoColumns || !schema.hasCategoriesTable) && (
        <p className="mt-4 rounded-lg border border-amber-400/50 bg-amber-50 p-4 text-sm text-amber-900">
          The SEO, CTA and design settings can't be saved yet because the extra blog fields haven't been
          added to the database. Run the setup script in{" "}
          <code>supabase/migrations_legacy/2026_mc_blog_editor.sql</code> once, then reload this page.
          Everything else already works.
        </p>
      )}

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
                  {p.status === "published"
                    ? ` · published ${formatDate(p.published_at)}`
                    : " · draft"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Published</span>
                  <Switch
                    checked={p.status === "published"}
                    onCheckedChange={() => togglePublish.mutate(p)}
                  />
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" aria-label="View post" onClick={() => setViewing(p)}>
                    <Eye className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="Edit post" asChild>
                    <Link to="/admin/blog/$id/edit" params={{ id: String(p.id) }}>
                      <Pencil className="size-4" />
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Delete post"
                    onClick={() => setDeleting(p)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

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
            className="prose prose-sm max-w-none whitespace-pre-line dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(viewing?.body ?? "") }}
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
