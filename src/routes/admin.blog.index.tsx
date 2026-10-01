import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type KeyboardEvent, type MouseEvent } from "react";
import { toast } from "sonner";
import { ExternalLink, Pencil, Star, Trash2, Plus, Search } from "lucide-react";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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

import { escapeHtml, normalizeCta, normalizeHeadingStyles, sanitizeHtml, type HeadingStyle } from "@/lib/blog-content";

import {
  deleteLegacyPost,
  getBlogSchemaStatus,
  listLegacyPosts,
  setFeaturedLegacyPost,
  updateLegacyPost,
  type LegacyBlogPost,
} from "@/lib/legacy-blog.functions";

import { listAutoseoAdminPosts, type AutoseoAdminPost } from "@/lib/autoseo-blog.functions";

/* -------------------------------------------------------------------------- */
/* ROUTE                                                                      */
/* -------------------------------------------------------------------------- */

export const Route = createFileRoute("/admin/blog/")({
  head: () => ({
    meta: [
      {
        title: "Blog posts — MyCar admin",
      },
      {
        name: "description",
        content: "Manage MyCar blog articles.",
      },
      {
        name: "robots",
        content: "noindex",
      },
    ],
  }),

  component: AdminBlog,
});

/* -------------------------------------------------------------------------- */
/* TYPES                                                                      */
/* -------------------------------------------------------------------------- */

type Row =
  | {
      source: "manual";
      slug: string;
      date: string | null;
      post: LegacyBlogPost;
    }
  | {
      source: "autoseo";
      slug: string;
      date: string | null;
      post: AutoseoAdminPost;
    };

type Preview =
  | {
      source: "manual";
      post: LegacyBlogPost;
    }
  | {
      source: "autoseo";
      post: AutoseoAdminPost;
    };

type Faq = {
  question: string;
  answer: string;
};

type ExtendedAutoseoPost = AutoseoAdminPost & {
  faq_schema?: Faq[] | null;
  infographic_url?: string | null;
};

const FILTERS = ["all", "manual", "autoseo", "published", "draft"] as const;

type Filter = (typeof FILTERS)[number];

const FILTER_LABEL: Record<Filter, string> = {
  all: "All",
  manual: "Manual",
  autoseo: "AutoSEO",
  published: "Published",
  draft: "Draft",
};

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

const recent = (...dates: Array<string | null | undefined>): string | null =>
  dates.find((date) => Boolean(date)) ?? null;

const autoseoStatus = (post: AutoseoAdminPost): string =>
  (post.status ?? "").trim() || (post.published_at ? "published" : "draft");

const getAutoseoFaqs = (post: AutoseoAdminPost): Faq[] => {
  const extended = post as ExtendedAutoseoPost;

  return Array.isArray(extended.faq_schema)
    ? extended.faq_schema.filter((faq) => Boolean(faq && faq.question && faq.answer))
    : [];
};

/* -------------------------------------------------------------------------- */
/* PUBLIC AUTOSEO ARTICLE STYLES                                              */
/* -------------------------------------------------------------------------- */

const AUTOSEO_PROSE_CSS = [
  ".admin-autoseo-article{max-width:720px;}",
  ".admin-autoseo-article h2{font-size:1.5rem;font-weight:700;margin-top:1.75rem;margin-bottom:.6rem;}",
  ".admin-autoseo-article h3{font-size:1.25rem;font-weight:700;margin-top:1.5rem;margin-bottom:.5rem;}",
  ".admin-autoseo-article p{font-size:1rem;line-height:1.75;margin-bottom:1rem;color:hsl(var(--muted-foreground));}",
  ".admin-autoseo-article ul{list-style:disc;padding-left:1.5rem;margin-bottom:1rem;}",
  ".admin-autoseo-article ol{list-style:decimal;padding-left:1.5rem;margin-bottom:1rem;}",
  ".admin-autoseo-article li{margin-bottom:.5rem;}",
  ".admin-autoseo-article blockquote{border-left:4px solid hsl(var(--primary));padding-left:1rem;font-style:italic;color:hsl(var(--muted-foreground));margin:1.25rem 0;}",
  ".admin-autoseo-article code{background:rgba(148,163,184,.18);padding:2px 6px;border-radius:4px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.9em;}",
  ".admin-autoseo-article pre{background:#0f172a;color:#f1f5f9;padding:1rem;border-radius:.5rem;overflow-x:auto;margin:1.25rem 0;}",
  ".admin-autoseo-article pre code{background:transparent;padding:0;color:inherit;}",
  ".admin-autoseo-article table{width:100%;border-collapse:collapse;margin:1.5rem 0;}",
  ".admin-autoseo-article th,.admin-autoseo-article td{border:1px solid hsl(var(--border));padding:.65rem;text-align:left;}",
  ".admin-autoseo-article tbody tr:nth-child(even){background:rgba(148,163,184,.06);}",
  ".admin-autoseo-article .table-scroll{overflow-x:auto;}",
  ".admin-autoseo-article img{max-width:100%;height:auto;border-radius:.5rem;display:block;margin:1.5rem auto;}",
  ".admin-autoseo-article a{color:hsl(var(--primary));text-decoration:none;}",
  ".admin-autoseo-article a:hover{text-decoration:underline;}",
].join("");

/* -------------------------------------------------------------------------- */
/* MANUAL ARTICLE HEADING STYLE HELPER                                        */
/* -------------------------------------------------------------------------- */

const headingRule = (selector: string, style: HeadingStyle) =>
  `${selector}{
    font-size:${style.fontSize};
    font-weight:${style.fontWeight};
    line-height:${style.lineHeight};
    text-align:${style.textAlign};
    color:${style.color};
    background-color:${style.backgroundColor ?? "transparent"};
    ${style.marginTop ? `margin-top:${style.marginTop};` : ""}
    ${style.marginBottom ? `margin-bottom:${style.marginBottom};` : ""}
    ${style.paddingLeft ? `padding-left:${style.paddingLeft};` : ""}
  }`;

/* -------------------------------------------------------------------------- */
/* ADMIN BLOG                                                                 */
/* -------------------------------------------------------------------------- */

function AdminBlog() {
  const { session } = useAuth();

  const accessToken = session?.access_token ?? "";

  const queryClient = useQueryClient();

  const [preview, setPreview] = useState<Preview | null>(null);

  const [deleting, setDeleting] = useState<LegacyBlogPost | null>(null);

  const [filter, setFilter] = useState<Filter>("all");

  const [term, setTerm] = useState("");

  /* ---------------------------------------------------------------------- */
  /* QUERIES                                                                */
  /* ---------------------------------------------------------------------- */

  const manualQuery = useQuery({
    queryKey: ["admin", "mc_blog"],

    enabled: Boolean(accessToken),

    queryFn: () =>
      listLegacyPosts({
        data: {
          accessToken,
        },
      }),
  });

  const autoseoQuery = useQuery({
    queryKey: ["admin", "autoseo_blog"],

    enabled: Boolean(accessToken),

    queryFn: () =>
      listAutoseoAdminPosts({
        data: {
          accessToken,
        },
      }),
  });

  const { data: schema } = useQuery({
    queryKey: ["admin", "mc_blog", "schema"],

    enabled: Boolean(accessToken),

    queryFn: () =>
      getBlogSchemaStatus({
        data: {
          accessToken,
        },
      }),

    refetchOnMount: "always",

    staleTime: 0,
  });

  /* ---------------------------------------------------------------------- */
  /* HELPERS                                                                */
  /* ---------------------------------------------------------------------- */

  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: ["admin", "mc_blog"],
    });

  const stopRowClick = (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
  };

  const openManualPost = (post: LegacyBlogPost) => {
    setPreview({
      source: "manual",
      post,
    });
  };

  const openAutoseoPost = (post: AutoseoAdminPost) => {
    setPreview({
      source: "autoseo",
      post,
    });
  };

  const handleManualRowKeyDown = (event: KeyboardEvent<HTMLLIElement>, post: LegacyBlogPost) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();

      openManualPost(post);
    }
  };

  const handleAutoseoRowKeyDown = (event: KeyboardEvent<HTMLLIElement>, post: AutoseoAdminPost) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();

      openAutoseoPost(post);
    }
  };

  /* ---------------------------------------------------------------------- */
  /* MUTATIONS                                                              */
  /* ---------------------------------------------------------------------- */

  const remove = useMutation({
    mutationFn: (id: number) =>
      deleteLegacyPost({
        data: {
          accessToken,
          id,
        },
      }),

    onSuccess: () => {
      setDeleting(null);

      void refresh();

      toast.success("Post deleted.");
    },

    onError: (error: Error) => toast.error(error.message || "Could not delete this post."),
  });

  const togglePublish = useMutation({
    mutationFn: (post: LegacyBlogPost) =>
      updateLegacyPost({
        data: {
          accessToken,

          id: post.id,

          title: post.title,

          slug: post.slug,

          category: post.category,

          excerpt: post.excerpt,

          body: post.body,

          image_url: post.image_url,

          author_name: post.author_name,

          author_initials: post.author_initials,

          author_color: post.author_color,

          read_time: post.read_time,

          status: post.status === "published" ? "draft" : "published",

          meta_title: (post.meta_title as string) ?? null,

          meta_description: (post.meta_description as string) ?? null,

          primary_cta: post.primary_cta ?? null,

          heading_styles: post.heading_styles ?? null,
        },
      }),

    onSuccess: () => {
      void refresh();
    },

    onError: (error: Error) => toast.error(error.message || "Could not update this post."),
  });

  const featurePost = useMutation({
    mutationFn: (id: number) =>
      setFeaturedLegacyPost({
        data: {
          accessToken,
          id,
        },
      }),

    onSuccess: () => {
      void refresh();

      toast.success("Featured post updated.");
    },

    onError: (error: Error) => toast.error(error.message || "Could not feature this post."),
  });

  /* ---------------------------------------------------------------------- */
  /* COMBINE POSTS                                                          */
  /* ---------------------------------------------------------------------- */

  const rows = useMemo<Row[]>(() => {
    const manual = manualQuery.data ?? [];

    const autoseo = autoseoQuery.data ?? [];

    const seen = new Set<string>();

    const output: Row[] = [];

    for (const post of manual) {
      const slug = (post.slug ?? "").toLowerCase();

      if (slug) {
        seen.add(slug);
      }

      output.push({
        source: "manual",

        slug: post.slug,

        date: recent(post.updated_at, post.published_at, post.created_at),

        post,
      });
    }

    for (const post of autoseo) {
      const slug = (post.slug ?? "").toLowerCase();

      if (slug && seen.has(slug)) {
        continue;
      }

      if (slug) {
        seen.add(slug);
      }

      output.push({
        source: "autoseo",

        slug: post.slug,

        date: recent(post.updated_at, post.published_at, post.created_at),

        post,
      });
    }

    return output.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  }, [manualQuery.data, autoseoQuery.data]);

  /* ---------------------------------------------------------------------- */
  /* FILTERS                                                                */
  /* ---------------------------------------------------------------------- */

  const visible = useMemo(() => {
    const query = term.trim().toLowerCase();

    return rows.filter((row) => {
      const status =
        row.source === "manual" ? (row.post.status === "published" ? "published" : "draft") : autoseoStatus(row.post);

      if (filter === "manual" && row.source !== "manual") {
        return false;
      }

      if (filter === "autoseo" && row.source !== "autoseo") {
        return false;
      }

      if (filter === "published" && status !== "published") {
        return false;
      }

      if (filter === "draft" && status === "published") {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = [row.post.title, row.slug, row.source, status].join(" ").toLowerCase();

      return haystack.includes(query);
    });
  }, [rows, filter, term]);

  const isLoading = manualQuery.isLoading || autoseoQuery.isLoading;

  /* ---------------------------------------------------------------------- */
  /* RENDER                                                                 */
  /* ---------------------------------------------------------------------- */

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
        {/* Featured warning */}

        {schema && !schema.hasFeaturedColumn && (
          <p className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            Featured posts are unavailable until the legacy blog migration is applied.
          </p>
        )}

        {/* Manual error */}

        {manualQuery.error && (
          <p className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            Manual posts couldn't be loaded ({(manualQuery.error as Error).message}
            ). AutoSEO articles below are unaffected.
          </p>
        )}

        {/* AutoSEO error */}

        {autoseoQuery.error && (
          <p className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            AutoSEO articles couldn't be loaded ({(autoseoQuery.error as Error).message}
            ). Your manual posts below are unaffected.
          </p>
        )}

        {/* Search + filters */}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

            <Input
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Search title, slug, source or status"
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap gap-1 rounded-lg border border-border p-1">
            {FILTERS.map((item) => (
              <Button
                key={item}
                size="sm"
                variant={filter === item ? "default" : "ghost"}
                onClick={() => setFilter(item)}
              >
                {FILTER_LABEL[item]}
              </Button>
            ))}
          </div>
        </div>

        {/* Posts */}

        {isLoading ? (
          <div className="mt-6 space-y-2">
            <div className="h-20 animate-pulse rounded-lg bg-muted" />

            <div className="h-20 animate-pulse rounded-lg bg-muted" />

            <div className="h-20 animate-pulse rounded-lg bg-muted" />
          </div>
        ) : visible.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">No posts to show.</p>
        ) : (
          <ul className="mt-6 divide-y divide-border overflow-hidden rounded-lg border border-border bg-background">
            {visible.map((row) =>
              row.source === "manual" ? (
                <li
                  key={`manual-${row.post.id}`}
                  role="button"
                  tabIndex={0}
                  aria-label={`Preview ${row.post.title}`}
                  onClick={() => openManualPost(row.post)}
                  onKeyDown={(event) => handleManualRowKeyDown(event, row.post)}
                  className="
                      group
                      flex
                      cursor-pointer
                      flex-wrap
                      items-center
                      justify-between
                      gap-3
                      p-4
                      outline-none
                      transition-all
                      duration-200
                      hover:bg-muted/50
                      focus-visible:bg-muted/50
                      focus-visible:ring-2
                      focus-visible:ring-inset
                      focus-visible:ring-primary
                    "
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate font-medium">
                      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        Manual
                      </span>

                      <span className="truncate">{row.post.title}</span>
                    </p>

                    <p className="mt-1 text-xs text-muted-foreground">
                      /{row.post.slug}
                      {row.post.category ? ` · ${row.post.category}` : ""}
                      {row.post.status === "published"
                        ? ` · published ${formatDate(row.post.published_at)}`
                        : " · draft"}
                    </p>

                    <p className="mt-1 text-xs text-muted-foreground/70 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                      Click anywhere on this row to view the article.
                    </p>
                  </div>

                  <div className="flex items-center gap-3" onClick={stopRowClick}>
                    <Button
                      variant={row.post.is_featured ? "default" : "ghost"}
                      size="icon"
                      aria-label={row.post.is_featured ? "Featured post" : "Make featured post"}
                      disabled={!schema?.hasFeaturedColumn || row.post.status !== "published" || featurePost.isPending}
                      title={
                        !schema?.hasFeaturedColumn
                          ? "Apply the featured-post migration first"
                          : row.post.is_featured
                            ? "Featured post"
                            : "Make featured post"
                      }
                      onClick={(event) => {
                        event.stopPropagation();

                        featurePost.mutate(row.post.id);
                      }}
                    >
                      <Star className={`size-4 ${row.post.is_featured ? "fill-current" : ""}`} />
                    </Button>

                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">Published</span>

                      <Switch
                        checked={row.post.status === "published"}
                        disabled={togglePublish.isPending}
                        onClick={(event) => {
                          event.stopPropagation();
                        }}
                        onCheckedChange={() => togglePublish.mutate(row.post)}
                      />
                    </div>

                    <Button variant="ghost" size="icon" aria-label="Edit post" title="Edit post" asChild>
                      <Link
                        to="/admin/blog/$id/edit"
                        params={{
                          id: String(row.post.id),
                        }}
                        onClick={(event) => {
                          event.stopPropagation();
                        }}
                      >
                        <Pencil className="size-4" />
                      </Link>
                    </Button>

                    {row.post.status === "published" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Open live article"
                        title="Open live article"
                        asChild
                      >
                        <Link
                          to="/blog/$slug"
                          params={{
                            slug: row.post.slug,
                          }}
                          target="_blank"
                          onClick={(event) => {
                            event.stopPropagation();
                          }}
                        >
                          <ExternalLink className="size-4" />
                        </Link>
                      </Button>
                    )}

                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Delete post"
                      title="Delete post"
                      onClick={(event) => {
                        event.stopPropagation();

                        setDeleting(row.post);
                      }}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </li>
              ) : (
                <li
                  key={`autoseo-${row.post.id}`}
                  role="button"
                  tabIndex={0}
                  aria-label={`Preview ${row.post.title}`}
                  onClick={() => openAutoseoPost(row.post)}
                  onKeyDown={(event) => handleAutoseoRowKeyDown(event, row.post)}
                  className="
                      group
                      flex
                      cursor-pointer
                      flex-wrap
                      items-center
                      justify-between
                      gap-3
                      p-4
                      outline-none
                      transition-all
                      duration-200
                      hover:bg-muted/50
                      focus-visible:bg-muted/50
                      focus-visible:ring-2
                      focus-visible:ring-inset
                      focus-visible:ring-primary
                    "
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    {row.post.hero_image_url ? (
                      <img
                        src={row.post.hero_image_url}
                        alt={row.post.hero_image_alt ?? row.post.title}
                        loading="lazy"
                        className="size-12 shrink-0 rounded-md object-cover transition-transform duration-200 group-hover:scale-[1.04]"
                      />
                    ) : null}

                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 truncate font-medium">
                        <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          AutoSEO
                        </span>

                        <span className="truncate">{row.post.title}</span>
                      </p>

                      <p className="mt-1 text-xs text-muted-foreground">
                        /{row.post.slug}
                        {" · "}
                        {autoseoStatus(row.post)}
                        {row.post.published_at ? ` · published ${formatDate(row.post.published_at)}` : ""}
                        {row.post.updated_at ? ` · updated ${formatDate(row.post.updated_at)}` : ""}
                        {row.post.language ? ` · ${row.post.language}` : ""}
                        {row.post.reading_time ? ` · ${row.post.reading_time} min read` : ""}
                      </p>

                      <p className="mt-1 text-xs text-muted-foreground/70 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                        Click anywhere on this row to view the article.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1" onClick={stopRowClick}>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Open live article"
                      title="Open live article"
                      asChild
                    >
                      <Link
                        to="/blog/$slug"
                        params={{
                          slug: row.post.slug,
                        }}
                        target="_blank"
                        onClick={(event) => {
                          event.stopPropagation();
                        }}
                      >
                        <ExternalLink className="size-4" />
                      </Link>
                    </Button>
                  </div>
                </li>
              ),
            )}
          </ul>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* ARTICLE-ONLY PREVIEW MODAL                                       */}
        {/* ---------------------------------------------------------------- */}

        <Dialog
          open={preview !== null}
          onOpenChange={(open) => {
            if (!open) {
              setPreview(null);
            }
          }}
        >
          <DialogContent
            className="
              h-[94vh]
              w-[96vw]
              max-w-[1280px]
              overflow-hidden
              p-0
            "
          >
            <DialogHeader className="sr-only">
              <DialogTitle>{preview?.post.title ?? "Article preview"}</DialogTitle>

              <DialogDescription>Article preview</DialogDescription>
            </DialogHeader>

            <div className="h-full overflow-y-auto bg-background">
              {preview?.source === "manual" ? (
                <ManualArticlePreview post={preview.post} />
              ) : preview?.source === "autoseo" ? (
                <AutoseoArticlePreview post={preview.post} allPosts={autoseoQuery.data ?? []} />
              ) : null}
            </div>
          </DialogContent>
        </Dialog>

        {/* ---------------------------------------------------------------- */}
        {/* DELETE                                                          */}
        {/* ---------------------------------------------------------------- */}

        <AlertDialog
          open={deleting !== null}
          onOpenChange={(open) => {
            if (!open) {
              setDeleting(null);
            }
          }}
        >
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
                onClick={(event) => {
                  event.preventDefault();

                  if (deleting) {
                    remove.mutate(deleting.id);
                  }
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

/* -------------------------------------------------------------------------- */
/* AUTOSEO ARTICLE PREVIEW                                                    */
/* -------------------------------------------------------------------------- */

function AutoseoArticlePreview({ post, allPosts }: { post: AutoseoAdminPost; allPosts: AutoseoAdminPost[] }) {
  const extended = post as ExtendedAutoseoPost;

  const faqs = getAutoseoFaqs(post);

  const html = (post.content_html ?? "")
    .replace(/<table\b/gi, '<div class="table-scroll"><table')
    .replace(/<\/table>/gi, "</table></div>")
    .replace(/<img\b(?![^>]*onerror)/gi, `<img onerror="this.style.display='none'" `);

  const related = allPosts.filter((candidate) => candidate.id !== post.id && candidate.slug !== post.slug).slice(0, 3);

  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <style
        dangerouslySetInnerHTML={{
          __html: AUTOSEO_PROSE_CSS,
        }}
      />

      {post.hero_image_url && (
        <img
          src={post.hero_image_url}
          alt={post.hero_image_alt ?? post.title}
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
          className="mt-2 max-h-[400px] w-full rounded-xl object-cover"
        />
      )}

      <h1 className="mt-7 font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{post.title}</h1>

      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {formatDate(post.published_at)}

        {post.reading_time ? ` · ${post.reading_time} min read` : ""}
      </p>

      <div
        className="admin-autoseo-article mt-8 text-foreground/90"
        dangerouslySetInnerHTML={{
          __html: html,
        }}
      />

      {extended.infographic_url && (
        <img
          src={extended.infographic_url}
          alt={`${post.title} infographic`}
          loading="lazy"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
          className="mt-10 w-full rounded-xl border border-border"
        />
      )}

      {faqs.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-2xl font-bold">Frequently Asked Questions</h2>

          <Accordion type="single" collapsible defaultValue="faq-0" className="mt-4">
            {faqs.map((faq, index) => (
              <AccordionItem key={`${index}-${faq.question}`} value={`faq-${index}`}>
                <AccordionTrigger className="cursor-pointer text-left font-semibold">{faq.question}</AccordionTrigger>

                <AccordionContent className="text-sm leading-6 text-muted-foreground">{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      )}

      {related.length > 0 && (
        <section className="mt-14">
          <h2 className="font-display text-2xl font-bold">Related articles</h2>

          <div className="mt-4 space-y-3">
            {related.map((article) => (
              <div key={article.id} className="flex items-center gap-4 rounded-xl border border-border bg-card p-3">
                {article.hero_image_url ? (
                  <img
                    src={article.hero_image_url}
                    alt={article.hero_image_alt ?? article.title}
                    loading="lazy"
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                    className="h-16 w-24 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <div className="h-16 w-24 shrink-0 rounded-lg bg-muted" />
                )}

                <div>
                  <p className="font-semibold leading-snug">{article.title}</p>

                  <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
                    {formatDate(article.published_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/* MANUAL ARTICLE PREVIEW                                                     */
/* -------------------------------------------------------------------------- */

function ManualArticlePreview({ post }: { post: LegacyBlogPost }) {
  const styles = normalizeHeadingStyles(post.heading_styles);

  const cta = normalizeCta(post.primary_cta);

  const bodyHtml = /<(h1|h2|h3|h4|p|ul|ol|blockquote|table)[\s>]/i.test(post.body ?? "")
    ? sanitizeHtml(post.body ?? "")
    : String(post.body ?? "")
        .split(/\n\s*\n/)
        .filter((paragraph) => paragraph.trim())
        .map((paragraph) => `<p>${escapeHtml(paragraph.trim()).replace(/\n/g, "<br>")}</p>`)
        .join("");

  const responsiveBodyHtml = bodyHtml
    .replace(/<table\b/gi, '<div class="admin-blog-table-wrap"><table')
    .replace(/<\/table>/gi, "</table></div>");

  const css = [
    headingRule(".admin-blog-body h1", styles.h1),

    headingRule(".admin-blog-body h2", styles.h2),

    headingRule(".admin-blog-body h3", styles.h3),

    headingRule(".admin-blog-body h4", styles.h4),

    ".admin-blog-body h1,.admin-blog-body h2,.admin-blog-body h3,.admin-blog-body h4{margin-top:1.6em;margin-bottom:.5em;}",

    ".admin-blog-body p{margin-bottom:1.1em;line-height:1.75;}",

    ".admin-blog-body a{color:hsl(var(--primary));text-decoration:underline;}",

    ".admin-blog-body ul,.admin-blog-body ol{margin:0 0 1.1em 1.25em;list-style:disc;}",

    ".admin-blog-body .admin-blog-table-wrap{margin:1.5em 0;overflow-x:auto;border:1px solid hsl(var(--border));border-radius:.75rem;background:rgba(148,163,184,.04);-webkit-overflow-scrolling:touch;}",

    ".admin-blog-body table{width:100%;min-width:640px;border-collapse:collapse;table-layout:fixed;}",

    ".admin-blog-body th,.admin-blog-body td{padding:.75rem;border:1px solid hsl(var(--border));vertical-align:top;text-align:left;}",

    ".admin-blog-body th{font-weight:700;background:rgba(148,163,184,.06);}",

    ".admin-blog-body td p,.admin-blog-body th p{margin:0;}",

    ".admin-blog-body td ul,.admin-blog-body td ol,.admin-blog-body th ul,.admin-blog-body th ol{margin:.5em 0 0 1.1rem;}",
  ].join("");

  return (
    <article className="w-full overflow-x-hidden">
      <style
        dangerouslySetInnerHTML={{
          __html: css,
        }}
      />

      {/* Hero */}

      <div className="mx-auto max-w-6xl px-4 pt-8 sm:px-8 lg:px-12">
        <div className="relative aspect-[16/7] min-h-[280px] overflow-hidden rounded-2xl bg-muted">
          {post.image_url && (
            <img
              src={post.image_url}
              alt={post.title}
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/20" />

          <div className="relative flex h-full items-end p-6 sm:p-10 lg:p-14">
            <div className="max-w-4xl text-left text-white">
              {post.category && (
                <span className="inline-flex rounded-full border border-white/40 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-white/90 backdrop-blur-sm">
                  {post.category}
                </span>
              )}

              <h1 className="mt-4 font-display text-4xl font-bold leading-none tracking-tight sm:text-5xl lg:text-7xl">
                {post.title}
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}

      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-12 sm:px-8 lg:grid-cols-[minmax(0,720px)_280px] lg:px-12">
        <div
          className="admin-blog-body text-base text-foreground/90"
          dangerouslySetInnerHTML={{
            __html: responsiveBodyHtml,
          }}
        />

        <aside className="space-y-8">
          {cta.enabled && (cta.headline || cta.button_text) && (
            <div className="rounded-xl border border-border bg-card p-6">
              {cta.headline && <h2 className="font-display text-2xl font-bold">{cta.headline}</h2>}

              {cta.button_text && cta.url && (
                <a
                  href={cta.url}
                  {...(/^https?:/i.test(cta.url)
                    ? {
                        target: "_blank",
                        rel: "noopener noreferrer",
                      }
                    : {})}
                  className="mt-5 inline-flex cursor-pointer items-center rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
                >
                  {cta.button_text}
                </a>
              )}
            </div>
          )}

          <div className="rounded-xl border border-border bg-card p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              About this article
            </p>

            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Practical guidance from the MyCar team in Fredericksburg, Virginia.
            </p>
          </div>
        </aside>
      </div>

      {/* Meta */}

      <div className="mx-auto max-w-6xl px-4 pb-12 sm:px-8 lg:px-12">
        <div className="max-w-[720px] text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {formatDate(post.published_at)}

          {post.author_name ? ` · ${post.author_name}` : ""}

          {post.read_time ? ` · ${post.read_time} min read` : ""}
        </div>
      </div>
    </article>
  );
}
