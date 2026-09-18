import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Eye, Pencil, Star, Trash2, Plus, Search } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  setFeaturedLegacyPost,
  updateLegacyPost,
  type LegacyBlogPost,
} from "@/lib/legacy-blog.functions";
import { listAutoseoAdminPosts, type AutoseoAdminPost } from "@/lib/autoseo-blog.functions";

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

type Row =
  | { source: "manual"; slug: string; date: string | null; post: LegacyBlogPost }
  | { source: "autoseo"; slug: string; date: string | null; post: AutoseoAdminPost };

const FILTERS = ["all", "manual", "autoseo", "published", "draft"] as const;
type Filter = (typeof FILTERS)[number];

const FILTER_LABEL: Record<Filter, string> = {
  all: "All",
  manual: "Manual",
  autoseo: "AutoSEO",
  published: "Published",
  draft: "Draft",
};

const recent = (...dates: Array<string | null | undefined>): string | null =>
  dates.find((d) => Boolean(d)) ?? null;

const autoseoStatus = (p: AutoseoAdminPost): string =>
  (p.status ?? "").trim() || (p.published_at ? "published" : "draft");

function AdminBlog() {
  const { session } = useAuth();
  const accessToken = session?.access_token ?? "";
  const queryClient = useQueryClient();

  const [viewing, setViewing] = useState<LegacyBlogPost | null>(null);
  const [details, setDetails] = useState<AutoseoAdminPost | null>(null);
  const [deleting, setDeleting] = useState<LegacyBlogPost | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [term, setTerm] = useState("");

  const manualQuery = useQuery({
    queryKey: ["admin", "mc_blog"],
    enabled: Boolean(accessToken),
    queryFn: () => listLegacyPosts({ data: { accessToken } }),
  });

  const autoseoQuery = useQuery({
    queryKey: ["admin", "autoseo_blog"],
    enabled: Boolean(accessToken),
    queryFn: () => listAutoseoAdminPosts({ data: { accessToken } }),
  });

  const { data: schema } = useQuery({
    queryKey: ["admin", "mc_blog", "schema"],
    enabled: Boolean(accessToken),
    queryFn: () => getBlogSchemaStatus({ data: { accessToken } }),
    refetchOnMount: "always",
    staleTime: 0,
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

  const featurePost = useMutation({
    mutationFn: (id: number) => setFeaturedLegacyPost({ data: { accessToken, id } }),
    onSuccess: () => {
      void refresh();
      toast.success("Featured post updated.");
    },
    onError: (e: Error) => toast.error(e.message || "Could not feature this post."),
  });

  const rows = useMemo<Row[]>(() => {
    const manual = manualQuery.data ?? [];
    const autoseo = autoseoQuery.data ?? [];
    const seen = new Set<string>();
    const out: Row[] = [];

    for (const post of manual) {
      const slug = (post.slug ?? "").toLowerCase();
      if (slug) seen.add(slug);
      out.push({
        source: "manual",
        slug: post.slug,
        date: recent(post.updated_at, post.published_at, post.created_at),
        post,
      });
    }
    for (const post of autoseo) {
      const slug = (post.slug ?? "").toLowerCase();
      if (slug && seen.has(slug)) continue; // manual wins
      if (slug) seen.add(slug);
      out.push({
        source: "autoseo",
        slug: post.slug,
        date: recent(post.updated_at, post.published_at, post.created_at),
        post,
      });
    }

    return out.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  }, [manualQuery.data, autoseoQuery.data]);

  const visible = useMemo(() => {
    const q = term.trim().toLowerCase();
    return rows.filter((row) => {
      const status =
        row.source === "manual"
          ? row.post.status === "published"
            ? "published"
            : "draft"
          : autoseoStatus(row.post);

      if (filter === "manual" && row.source !== "manual") return false;
      if (filter === "autoseo" && row.source !== "autoseo") return false;
      if (filter === "published" && status !== "published") return false;
      if (filter === "draft" && status === "published") return false;

      if (!q) return true;
      const haystack = [row.post.title, row.slug, row.source, status].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, filter, term]);

  const isLoading = manualQuery.isLoading || autoseoQuery.isLoading;

  return (
    <div className="w-full">
      <AdminPageHeader
        title="Blog"
        actions={
          <Button asChild size="sm">
            <Link to="/admin/blog/new">
              <Plus className="size-4" />
              New post
            </Link>
          </Button>
        }
      />

      <div className="p-6">
        {schema && !schema.hasFeaturedColumn && (
          <p className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            Featured posts are unavailable until the legacy blog migration is applied.
          </p>
        )}

        {manualQuery.error && (
          <p className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            Manual posts couldn't be loaded ({(manualQuery.error as Error).message}). AutoSEO
            articles below are unaffected.
          </p>
        )}
        {autoseoQuery.error && (
          <p className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            AutoSEO articles couldn't be loaded ({(autoseoQuery.error as Error).message}). Your
            manual posts below are unaffected.
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search title, slug, source or status"
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-1 rounded-lg border border-border p-1">
            {FILTERS.map((f) => (
              <Button
                key={f}
                size="sm"
                variant={filter === f ? "default" : "ghost"}
                onClick={() => setFilter(f)}
              >
                {FILTER_LABEL[f]}
              </Button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="mt-6 space-y-2">
            <div className="h-20 animate-pulse rounded-lg bg-muted" />
            <div className="h-20 animate-pulse rounded-lg bg-muted" />
            <div className="h-20 animate-pulse rounded-lg bg-muted" />
          </div>
        ) : visible.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">No posts to show.</p>
        ) : (
          <ul className="mt-6 divide-y divide-border rounded-lg border border-border bg-background">
            {visible.map((row) =>
              row.source === "manual" ? (
                <li
                  key={`manual-${row.post.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 p-4"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 truncate font-medium">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        Manual
                      </span>
                      {row.post.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      /{row.post.slug}
                      {row.post.category ? ` · ${row.post.category}` : ""}
                      {row.post.status === "published"
                        ? ` · published ${formatDate(row.post.published_at)}`
                        : " · draft"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      variant={row.post.is_featured ? "default" : "ghost"}
                      size="icon"
                      aria-label={row.post.is_featured ? "Featured post" : "Make featured post"}
                      disabled={
                        !schema?.hasFeaturedColumn ||
                        row.post.status !== "published" ||
                        featurePost.isPending
                      }
                      title={
                        !schema?.hasFeaturedColumn
                          ? "Apply the featured-post migration first"
                          : undefined
                      }
                      onClick={() => featurePost.mutate(row.post.id)}
                    >
                      <Star className={`size-4 ${row.post.is_featured ? "fill-current" : ""}`} />
                    </Button>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">Published</span>
                      <Switch
                        checked={row.post.status === "published"}
                        onCheckedChange={() => togglePublish.mutate(row.post)}
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="View post"
                        onClick={() => setViewing(row.post)}
                      >
                        <Eye className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label="Edit post" asChild>
                        <Link to="/admin/blog/$id/edit" params={{ id: String(row.post.id) }}>
                          <Pencil className="size-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Delete post"
                        onClick={() => setDeleting(row.post)}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </li>
              ) : (
                <li
                  key={`autoseo-${row.post.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 p-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {row.post.hero_image_url ? (
                      <img
                        src={row.post.hero_image_url}
                        alt={row.post.hero_image_alt ?? row.post.title}
                        className="size-12 shrink-0 rounded-md object-cover"
                        loading="lazy"
                      />
                    ) : null}
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 truncate font-medium">
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          AutoSEO
                        </span>
                        {row.post.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        /{row.post.slug} · {autoseoStatus(row.post)}
                        {row.post.published_at ? ` · published ${formatDate(row.post.published_at)}` : ""}
                        {row.post.updated_at ? ` · updated ${formatDate(row.post.updated_at)}` : ""}
                        {row.post.language ? ` · ${row.post.language}` : ""}
                        {row.post.reading_time ? ` · ${row.post.reading_time} min read` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground/80">
                        Managed by AutoSEO. Edit this article in AutoSEO.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="View details"
                      title="View details"
                      onClick={() => setDetails(row.post)}
                    >
                      <Eye className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label="View live" title="View live" asChild>
                      <Link to="/blog/$slug" params={{ slug: row.post.slug }} target="_blank">
                        <ExternalLink className="size-4" />
                      </Link>
                    </Button>
                  </div>
                </li>
              ),
            )}
          </ul>
        )}

        {/* Manual post preview */}
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

        {/* AutoSEO details */}
        <Dialog open={details !== null} onOpenChange={(o) => !o && setDetails(null)}>
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{details?.title}</DialogTitle>
              <DialogDescription>
                /{details?.slug} · Managed by AutoSEO. Edit this article in AutoSEO.
              </DialogDescription>
            </DialogHeader>
            {details?.hero_image_url && (
              <img
                src={details.hero_image_url}
                alt={details.hero_image_alt ?? details.title}
                className="w-full rounded-md object-cover"
                loading="lazy"
              />
            )}
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-muted-foreground">Status</dt>
              <dd>{details ? autoseoStatus(details) : ""}</dd>
              <dt className="text-muted-foreground">Published</dt>
              <dd>{formatDate(details?.published_at ?? null)}</dd>
              <dt className="text-muted-foreground">Updated</dt>
              <dd>{formatDate(details?.updated_at ?? null)}</dd>
              <dt className="text-muted-foreground">Language</dt>
              <dd>{details?.language ?? "—"}</dd>
              <dt className="text-muted-foreground">Reading time</dt>
              <dd>{details?.reading_time ? `${details.reading_time} min` : "—"}</dd>
            </dl>
            {details?.meta_description && (
              <p className="text-sm text-muted-foreground">{details.meta_description}</p>
            )}
            <div
              className="prose prose-sm max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(details?.content_html ?? "") }}
            />
          </DialogContent>
        </Dialog>

        {/* Delete (manual only) */}
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
    </div>
  );
}
