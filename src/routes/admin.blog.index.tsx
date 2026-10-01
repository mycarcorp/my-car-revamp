import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { toast } from "sonner";
import {
  ExternalLink,
  Pencil,
  Star,
  Trash2,
  Plus,
  Search,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  Flag,
} from "lucide-react";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

import {
  approveAutoseoPostAdmin,
  flagAutoseoPostAdmin,
  listAutoseoAdminPosts,
  scanAutoseoQualityAdmin,
  setAutoseoPublishedAdmin,
  setFeaturedAutoseoPostAdmin,
  updateAutoseoAdminPost,
  type AutoseoAdminPost,
  type AutoseoQualityResult,
  type AutoseoQualityStatus,
  type AutoseoRiskLevel,
} from "@/lib/autoseo-blog.functions";

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

type QualityIssueFocus = {
  code: string;
  message: string;
  severity: "blocking" | "warning";
  matchedText: string | null;
  requiresSource: boolean;
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

const autoseoQualityStatus = (post: AutoseoAdminPost): AutoseoQualityStatus => post.quality_status ?? "pending";

const autoseoRiskLevel = (post: AutoseoAdminPost): AutoseoRiskLevel => post.risk_level ?? "medium";

const qualityStatusLabel = (status: AutoseoQualityStatus): string => {
  switch (status) {
    case "approved":
      return "Approved";
    case "needs_review":
      return "Needs Review";
    case "flagged":
      return "Flagged";
    default:
      return "Pending";
  }
};

const riskLabel = (risk: AutoseoRiskLevel): string => {
  switch (risk) {
    case "high":
      return "High Risk";
    case "low":
      return "Low Risk";
    default:
      return "Medium Risk";
  }
};

const qualityStatusClass = (status: AutoseoQualityStatus): string => {
  switch (status) {
    case "approved":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "needs_review":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "flagged":
      return "border-red-200 bg-red-50 text-red-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
};

const riskClass = (risk: AutoseoRiskLevel): string => {
  switch (risk) {
    case "high":
      return "border-red-200 bg-red-50 text-red-700";
    case "low":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    default:
      return "border-amber-200 bg-amber-50 text-amber-800";
  }
};

const getAutoseoFaqs = (post: AutoseoAdminPost): Faq[] => {
  const extended = post as ExtendedAutoseoPost;

  return Array.isArray(extended.faq_schema)
    ? extended.faq_schema.filter((faq) => Boolean(faq && faq.question && faq.answer))
    : [];
};

/* -------------------------------------------------------------------------- */
/* PUBLIC AUTOSEO ARTICLE STYLES                                              */

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

  const [editingAutoseo, setEditingAutoseo] = useState<AutoseoAdminPost | null>(null);

  const [editingIssue, setEditingIssue] = useState<QualityIssueFocus | null>(null);

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

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["admin", "mc_blog"],
      }),
      queryClient.invalidateQueries({
        queryKey: ["admin", "autoseo_blog"],
      }),
    ]);
  };

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

  const toggleAutoseoPublish = useMutation({
    mutationFn: (post: AutoseoAdminPost) =>
      setAutoseoPublishedAdmin({
        data: {
          accessToken,
          id: post.id,
          published: autoseoStatus(post) !== "published",
        },
      }),
    onSuccess: () => {
      void refresh();
      toast.success("AutoSEO publish status updated.");
    },
    onError: (error: Error) => toast.error(error.message || "Could not update AutoSEO publish status."),
  });

  const featureAutoseoPost = useMutation({
    mutationFn: (id: number) =>
      setFeaturedAutoseoPostAdmin({
        data: {
          accessToken,
          id,
        },
      }),
    onSuccess: () => {
      void refresh();
      toast.success("Featured AutoSEO post updated.");
    },
    onError: (error: Error) => toast.error(error.message || "Could not feature this AutoSEO post."),
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
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    {row.post.image_url ? (
                      <img
                        src={row.post.image_url}
                        alt={row.post.title}
                        loading="lazy"
                        onError={(event) => {
                          event.currentTarget.style.display = "none";
                        }}
                        className="size-12 shrink-0 rounded-md object-cover transition-transform duration-200 group-hover:scale-[1.04]"
                      />
                    ) : (
                      <div className="size-12 shrink-0 rounded-md bg-muted" />
                    )}

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

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${qualityStatusClass(
                            autoseoQualityStatus(row.post),
                          )}`}
                        >
                          {qualityStatusLabel(autoseoQualityStatus(row.post))}
                        </span>

                        <span
                          className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${riskClass(
                            autoseoRiskLevel(row.post),
                          )}`}
                        >
                          {riskLabel(autoseoRiskLevel(row.post))}
                        </span>

                        {row.post.requires_human_review && (
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                            Human review required
                          </span>
                        )}
                      </div>

                      <p className="mt-1 text-xs text-muted-foreground/70 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                        Click anywhere on this row to view the article and quality review.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3" onClick={stopRowClick}>
                    <Button
                      variant={row.post.is_featured ? "default" : "ghost"}
                      size="icon"
                      aria-label={row.post.is_featured ? "Featured AutoSEO post" : "Make featured AutoSEO post"}
                      title={
                        autoseoQualityStatus(row.post) !== "approved"
                          ? "Approve this article before featuring it"
                          : row.post.is_featured
                            ? "Featured AutoSEO post"
                            : "Make featured AutoSEO post"
                      }
                      disabled={
                        autoseoStatus(row.post) !== "published" ||
                        autoseoQualityStatus(row.post) !== "approved" ||
                        featureAutoseoPost.isPending
                      }
                      onClick={(event) => {
                        event.stopPropagation();
                        featureAutoseoPost.mutate(row.post.id);
                      }}
                    >
                      <Star className={`size-4 ${row.post.is_featured ? "fill-current" : ""}`} />
                    </Button>

                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">Published</span>

                      <Switch
                        checked={autoseoStatus(row.post) === "published"}
                        disabled={
                          toggleAutoseoPublish.isPending ||
                          (autoseoStatus(row.post) !== "published" && autoseoQualityStatus(row.post) !== "approved")
                        }
                        title={
                          autoseoStatus(row.post) !== "published" && autoseoQualityStatus(row.post) !== "approved"
                            ? "Quality review approval is required before publishing"
                            : undefined
                        }
                        onClick={(event) => {
                          event.stopPropagation();
                        }}
                        onCheckedChange={() => toggleAutoseoPublish.mutate(row.post)}
                      />

                      {autoseoStatus(row.post) !== "published" && autoseoQualityStatus(row.post) !== "approved" && (
                        <span className="text-xs font-medium text-amber-700">Locked</span>
                      )}
                    </div>
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

            <div className="flex h-full min-h-0 flex-col bg-background">
              {preview && (
                <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-background px-5 py-3 pr-14">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{preview.post.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {preview.source === "manual" ? "Manual" : "AutoSEO"} · /blog/{preview.post.slug}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {preview.source === "manual" ? (
                      <>
                        <Button variant="outline" size="sm" asChild>
                          <Link
                            to="/admin/blog/$id/edit"
                            params={{ id: String(preview.post.id) }}
                            onClick={() => setPreview(null)}
                          >
                            <Pencil className="size-4" />
                            Edit
                          </Link>
                        </Button>

                        {preview.post.status === "published" && (
                          <Button variant="outline" size="sm" asChild>
                            <Link to="/blog/$slug" params={{ slug: preview.post.slug }} target="_blank">
                              <ExternalLink className="size-4" />
                              Open live
                            </Link>
                          </Button>
                        )}

                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            const post = preview.post;
                            setPreview(null);
                            setDeleting(post);
                          }}
                        >
                          <Trash2 className="size-4" />
                          Delete
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const post = preview.post;
                            setEditingIssue(null);
                            setPreview(null);
                            setEditingAutoseo(post);
                          }}
                        >
                          <Pencil className="size-4" />
                          Edit
                        </Button>

                        {autoseoStatus(preview.post) === "published" && (
                          <Button variant="outline" size="sm" asChild>
                            <Link to="/blog/$slug" params={{ slug: preview.post.slug }} target="_blank">
                              <ExternalLink className="size-4" />
                              Open live
                            </Link>
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              <div className="min-h-0 flex-1 overflow-y-auto">
                {preview?.source === "manual" ? (
                  <ManualArticlePreview post={preview.post} />
                ) : preview?.source === "autoseo" ? (
                  <>
                    <AutoseoQualityReviewPanel
                      post={preview.post}
                      accessToken={accessToken}
                      reviewer={session?.user?.email ?? "MyCar staff"}
                      onEdit={() => {
                        const post = preview.post;
                        setEditingIssue(null);
                        setPreview(null);
                        setEditingAutoseo(post);
                      }}
                      onEditIssue={(issue) => {
                        const post = preview.post;
                        setEditingIssue(issue);
                        setPreview(null);
                        setEditingAutoseo(post);
                      }}
                      onChanged={async () => {
                        setPreview(null);
                        await refresh();
                      }}
                    />

                    <AutoseoArticlePreview post={preview.post} allPosts={autoseoQuery.data ?? []} />
                  </>
                ) : null}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* ---------------------------------------------------------------- */}
        {/* AUTOSEO EDITOR                                                   */}
        {/* ---------------------------------------------------------------- */}

        <Dialog
          open={editingAutoseo !== null}
          onOpenChange={(open) => {
            if (!open) {
              setEditingAutoseo(null);
              setEditingIssue(null);
            }
          }}
        >
          <DialogContent className="max-h-[94vh] w-[96vw] max-w-5xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit AutoSEO article</DialogTitle>
              <DialogDescription>
                Changes save directly to the MyCar AutoSEO article stored in the website database.
              </DialogDescription>
            </DialogHeader>

            {editingAutoseo && (
              <AutoseoEditForm
                key={editingAutoseo.id}
                post={editingAutoseo}
                accessToken={accessToken}
                focusIssue={editingIssue}
                onSaved={async () => {
                  const editedPost = editingAutoseo;

                  setEditingAutoseo(null);
                  setEditingIssue(null);

                  await refresh();

                  const refreshedPosts = queryClient.getQueryData<AutoseoAdminPost[]>(["admin", "autoseo_blog"]) ?? [];

                  const refreshedPost =
                    refreshedPosts.find((candidate) => candidate.id === editedPost.id) ?? editedPost;

                  setPreview({
                    source: "autoseo",
                    post: refreshedPost,
                  });
                }}
                onCancel={() => {
                  setEditingAutoseo(null);
                  setEditingIssue(null);
                }}
              />
            )}
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
/* AUTOSEO QUALITY REVIEW                                                     */
/* -------------------------------------------------------------------------- */

function AutoseoQualityReviewPanel({
  post,
  accessToken,
  reviewer,
  onEdit,
  onEditIssue,
  onChanged,
}: {
  post: AutoseoAdminPost;
  accessToken: string;
  reviewer: string;
  onEdit: () => void;
  onEditIssue: (issue: QualityIssueFocus) => void;
  onChanged: () => void | Promise<void>;
}) {
  const [notes, setNotes] = useState(post.review_notes ?? "");
  const [scanResult, setScanResult] = useState<AutoseoQualityResult | null>(null);

  const storedStatus = autoseoQualityStatus(post);
  const storedRisk = autoseoRiskLevel(post);
  const storedFlags = Array.isArray(post.quality_flags) ? post.quality_flags : [];
  const storedSources = Array.isArray(post.source_urls) ? post.source_urls : [];

  const scan = useMutation({
    mutationFn: () =>
      scanAutoseoQualityAdmin({
        data: {
          accessToken,
          id: post.id,
          title: post.title,
          slug: post.slug,
          content_html: post.content_html ?? null,
          meta_description: post.meta_description ?? null,
          meta_keywords: post.meta_keywords ?? null,
          tags: post.tags ?? null,
        },
      }),
    onSuccess: (result) => {
      setScanResult(result);
      toast.success("Quality scan completed.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Could not run the quality scan.");
    },
  });

  const approve = useMutation({
    mutationFn: () =>
      approveAutoseoPostAdmin({
        data: {
          accessToken,
          id: post.id,
          reviewer,
          notes: notes.trim() || null,
        },
      }),
    onSuccess: async () => {
      toast.success("AutoSEO article approved. It can now be published.");
      await onChanged();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Could not approve this AutoSEO article.");
    },
  });

  const flag = useMutation({
    mutationFn: () =>
      flagAutoseoPostAdmin({
        data: {
          accessToken,
          id: post.id,
          reviewer,
          notes: notes.trim() || null,
        },
      }),
    onSuccess: async () => {
      toast.success("AutoSEO article flagged and kept unpublished.");
      await onChanged();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Could not flag this AutoSEO article.");
    },
  });

  const effectiveStatus = scanResult?.status ?? storedStatus;
  const effectiveRisk = scanResult?.riskLevel ?? storedRisk;
  const effectiveFlags = scanResult?.flags ?? storedFlags;
  const effectiveSources = scanResult?.sourceUrls ?? storedSources;
  const effectiveHumanReview = scanResult?.requiresHumanReview ?? Boolean(post.requires_human_review);

  const busy = scan.isPending || approve.isPending || flag.isPending;

  return (
    <section className="border-b border-border bg-muted/20 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              {effectiveStatus === "approved" ? (
                <ShieldCheck className="size-5 text-emerald-600" />
              ) : (
                <ShieldAlert className="size-5 text-amber-600" />
              )}

              <h2 className="font-display text-xl font-bold">AutoSEO Quality Review</h2>
            </div>

            <p className="mt-1 text-sm text-muted-foreground">
              Publishing and featuring are locked until this article passes the mandatory quality gate.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${qualityStatusClass(effectiveStatus)}`}
            >
              {qualityStatusLabel(effectiveStatus)}
            </span>

            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${riskClass(effectiveRisk)}`}>
              {riskLabel(effectiveRisk)}
            </span>

            {effectiveHumanReview && (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                Human review required
              </span>
            )}
          </div>
        </div>

        {scanResult && (
          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            This is the latest live scan result. Approve or Flag to save the review decision.
          </div>
        )}

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-background p-4">
            <h3 className="text-sm font-semibold">Quality issues</h3>

            {effectiveFlags.length > 0 ? (
              <div className="mt-3 space-y-2">
                {effectiveFlags.map((item, index) => (
                  <div
                    key={`${item.code}-${index}`}
                    className={`rounded-lg border p-3 text-sm ${
                      item.severity === "blocking"
                        ? "border-red-200 bg-red-50 text-red-900"
                        : "border-amber-200 bg-amber-50 text-amber-900"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{item.severity === "blocking" ? "Blocking" : "Warning"}</span>
                      <span className="text-xs opacity-70">{item.code}</span>
                    </div>

                    <p className="mt-1 leading-6">{item.message}</p>

                    {item.matched_text && (
                      <p className="mt-2 rounded bg-background/70 px-2 py-1 text-xs">Matched: “{item.matched_text}”</p>
                    )}

                    {item.requires_source && (
                      <p className="mt-2 text-xs font-semibold">Authoritative source required.</p>
                    )}

                    <div className="mt-3">
                      <Button
                        type="button"
                        size="sm"
                        variant={item.severity === "blocking" ? "destructive" : "outline"}
                        onClick={() =>
                          onEditIssue({
                            code: item.code,
                            message: item.message,
                            severity: item.severity,
                            matchedText: item.matched_text ?? null,
                            requiresSource: Boolean(item.requires_source),
                          })
                        }
                      >
                        <Pencil className="size-3.5" />
                        {item.matched_text ? "Go to issue" : "Review in editor"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">No quality flags are currently stored or detected.</p>
            )}
          </div>

          <div className="rounded-xl border border-border bg-background p-4">
            <h3 className="text-sm font-semibold">Detected sources</h3>

            {effectiveSources.length > 0 ? (
              <div className="mt-3 space-y-2">
                {effectiveSources.map((url) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block break-all rounded-lg border border-border px-3 py-2 text-sm text-primary hover:bg-muted/50"
                  >
                    {url}
                  </a>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                No external source links were detected in this article.
              </p>
            )}

            <div className="mt-5 border-t border-border pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Last review</p>
              <p className="mt-2 text-sm">
                {post.reviewed_by ? post.reviewed_by : "Not reviewed yet"}
                {post.reviewed_at ? ` · ${formatDate(post.reviewed_at)}` : ""}
              </p>

              {post.review_notes && <p className="mt-2 text-sm leading-6 text-muted-foreground">{post.review_notes}</p>}
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-border bg-background p-4">
          <label className="text-sm font-semibold" htmlFor={`review-notes-${post.id}`}>
            Reviewer notes
          </label>

          <Textarea
            id={`review-notes-${post.id}`}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Add what you verified, corrected, sourced, or why this article should remain unpublished."
            className="mt-2 min-h-[100px]"
          />

          <p className="mt-2 text-xs text-muted-foreground">Reviewer: {reviewer}</p>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" onClick={() => scan.mutate()} disabled={busy}>
            <RefreshCw className={`size-4 ${scan.isPending ? "animate-spin" : ""}`} />
            {scan.isPending ? "Scanning…" : "Run Quality Scan"}
          </Button>

          <Button type="button" variant="outline" onClick={onEdit} disabled={busy}>
            <Pencil className="size-4" />
            Edit Article
          </Button>

          <Button
            type="button"
            variant="destructive"
            onClick={() => flag.mutate()}
            disabled={busy || !notes.trim()}
            title={!notes.trim() ? "Add reviewer notes before flagging this article" : undefined}
          >
            <Flag className="size-4" />
            {flag.isPending ? "Flagging…" : "Flag / Keep Unpublished"}
          </Button>

          <Button
            type="button"
            onClick={() => approve.mutate()}
            disabled={busy || effectiveFlags.some((item) => item.severity === "blocking")}
            title={
              effectiveFlags.some((item) => item.severity === "blocking")
                ? "Resolve blocking quality issues before approval"
                : undefined
            }
          >
            <ShieldCheck className="size-4" />
            {approve.isPending ? "Approving…" : "Approve Article"}
          </Button>
        </div>

        {effectiveFlags.some((item) => item.severity === "blocking") && (
          <p className="mt-3 text-sm font-medium text-red-700">
            Approval is locked until all blocking quality issues are corrected and the article is rescanned.
          </p>
        )}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* AUTOSEO EDIT FORM                                                         */
/* -------------------------------------------------------------------------- */

function AutoseoEditForm({
  post,
  accessToken,
  focusIssue,
  onSaved,
  onCancel,
}: {
  post: AutoseoAdminPost;
  accessToken: string;
  focusIssue: QualityIssueFocus | null;
  onSaved: () => void | Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(post.title ?? "");
  const [slug, setSlug] = useState(post.slug ?? "");
  const [contentHtml, setContentHtml] = useState(post.content_html ?? "");
  const [heroImageUrl, setHeroImageUrl] = useState(post.hero_image_url ?? "");
  const [heroImageAlt, setHeroImageAlt] = useState(post.hero_image_alt ?? "");
  const [infographicUrl, setInfographicUrl] = useState((post as ExtendedAutoseoPost).infographic_url ?? "");
  const [metaDescription, setMetaDescription] = useState(post.meta_description ?? "");
  const [metaKeywords, setMetaKeywords] = useState(post.meta_keywords ?? "");
  const [tags, setTags] = useState(post.tags ?? "");
  const [language, setLanguage] = useState(post.language ?? "en");
  const [faqJson, setFaqJson] = useState(JSON.stringify(getAutoseoFaqs(post), null, 2));

  const titleRef = useRef<HTMLInputElement | null>(null);
  const contentHtmlRef = useRef<HTMLTextAreaElement | null>(null);
  const metaDescriptionRef = useRef<HTMLTextAreaElement | null>(null);
  const metaKeywordsRef = useRef<HTMLInputElement | null>(null);
  const tagsRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!focusIssue) {
      return;
    }

    const matchedText = focusIssue.matchedText?.trim();

    const candidates: Array<{
      value: string;
      element: HTMLInputElement | HTMLTextAreaElement | null;
      label: string;
    }> = [
      {
        value: title,
        element: titleRef.current,
        label: "Title",
      },
      {
        value: contentHtml,
        element: contentHtmlRef.current,
        label: "Article HTML",
      },
      {
        value: metaDescription,
        element: metaDescriptionRef.current,
        label: "Meta description",
      },
      {
        value: metaKeywords,
        element: metaKeywordsRef.current,
        label: "Meta keywords",
      },
      {
        value: tags,
        element: tagsRef.current,
        label: "Tags",
      },
    ];

    const focusElement = (element: HTMLInputElement | HTMLTextAreaElement | null, start?: number, end?: number) => {
      if (!element) {
        return;
      }

      element.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });

      window.setTimeout(() => {
        element.focus();

        if (typeof start === "number" && typeof end === "number") {
          element.setSelectionRange(start, end);
        }
      }, 250);
    };

    if (matchedText) {
      const needle = matchedText.toLowerCase();

      for (const candidate of candidates) {
        const index = candidate.value.toLowerCase().indexOf(needle);

        if (index >= 0) {
          focusElement(candidate.element, index, index + matchedText.length);

          return;
        }
      }
    }

    // If the exact scanner text is not present anymore, still take the
    // reviewer to the main article editor so the issue can be investigated.
    focusElement(contentHtmlRef.current);
  }, [focusIssue, title, contentHtml, metaDescription, metaKeywords, tags]);

  const save = useMutation({
    mutationFn: async () => {
      let faqSchema: Faq[] | null = null;

      const rawFaq = faqJson.trim();

      if (rawFaq) {
        let parsed: unknown;

        try {
          parsed = JSON.parse(rawFaq);
        } catch {
          throw new Error("FAQ JSON is invalid.");
        }

        if (!Array.isArray(parsed)) {
          throw new Error("FAQ JSON must be an array.");
        }

        faqSchema = parsed
          .map((item) => {
            const candidate = item as Partial<Faq>;
            return {
              question: String(candidate?.question ?? "").trim(),
              answer: String(candidate?.answer ?? "").trim(),
            };
          })
          .filter((item) => item.question && item.answer);
      }

      if (!title.trim()) {
        throw new Error("Title is required.");
      }

      if (!slug.trim()) {
        throw new Error("Slug is required.");
      }

      await updateAutoseoAdminPost({
        data: {
          accessToken,
          id: post.id,
          title: title.trim(),
          slug: slug.trim(),
          content_html: contentHtml,
          content_markdown: post.content_markdown ?? null,
          hero_image_url: heroImageUrl.trim() || null,
          hero_image_alt: heroImageAlt.trim() || null,
          infographic_url: infographicUrl.trim() || null,
          meta_description: metaDescription.trim() || null,
          meta_keywords: metaKeywords.trim() || null,
          tags: tags.trim() || null,
          faq_schema: faqSchema,
          language: language.trim() || "en",
        },
      });
    },

    onSuccess: async () => {
      toast.success("AutoSEO article updated.");
      await onSaved();
    },

    onError: (error: Error) => {
      toast.error(error.message || "Could not update the AutoSEO article.");
    },
  });

  return (
    <div className="space-y-6">
      {focusIssue && (
        <div
          className={`rounded-xl border p-4 ${
            focusIssue.severity === "blocking"
              ? "border-red-200 bg-red-50 text-red-900"
              : "border-amber-200 bg-amber-50 text-amber-900"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide opacity-70">Fixing quality issue</p>

              <p className="mt-1 font-semibold">
                {focusIssue.severity === "blocking" ? "Blocking" : "Warning"} · {focusIssue.code}
              </p>
            </div>

            {focusIssue.matchedText && (
              <span className="rounded-md bg-background/70 px-2 py-1 text-xs font-medium">
                Matched: “{focusIssue.matchedText}”
              </span>
            )}
          </div>

          <p className="mt-3 text-sm leading-6">{focusIssue.message}</p>

          {focusIssue.requiresSource && (
            <p className="mt-2 text-xs font-semibold">This claim requires an authoritative source.</p>
          )}

          <p className="mt-3 text-xs">
            The matching text is automatically selected below when it can be found. Correct it, save the article, then
            run the quality scan again.
          </p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium">Title</label>
          <Input ref={titleRef} value={title} onChange={(event) => setTitle(event.target.value)} />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Slug</label>
          <Input value={slug} onChange={(event) => setSlug(event.target.value)} />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Article HTML</label>
        <Textarea
          ref={contentHtmlRef}
          value={contentHtml}
          onChange={(event) => setContentHtml(event.target.value)}
          className="min-h-[360px] font-mono text-xs"
        />
        <p className="text-xs text-muted-foreground">This is the HTML rendered in the public AutoSEO article.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium">Hero image URL</label>
          <Input value={heroImageUrl} onChange={(event) => setHeroImageUrl(event.target.value)} />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Hero image alt text</label>
          <Input value={heroImageAlt} onChange={(event) => setHeroImageAlt(event.target.value)} />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Infographic URL</label>
        <Input value={infographicUrl} onChange={(event) => setInfographicUrl(event.target.value)} />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Meta description</label>
        <Textarea
          ref={metaDescriptionRef}
          value={metaDescription}
          onChange={(event) => setMetaDescription(event.target.value)}
          className="min-h-[100px]"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium">Meta keywords</label>
          <Input ref={metaKeywordsRef} value={metaKeywords} onChange={(event) => setMetaKeywords(event.target.value)} />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Tags</label>
          <Input ref={tagsRef} value={tags} onChange={(event) => setTags(event.target.value)} />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Language</label>
        <Input value={language} onChange={(event) => setLanguage(event.target.value)} />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">FAQ schema</label>
        <Textarea
          value={faqJson}
          onChange={(event) => setFaqJson(event.target.value)}
          className="min-h-[180px] font-mono text-xs"
          placeholder={'[\n  {"question":"Question?","answer":"Answer."}\n]'}
        />
      </div>

      <div className="flex justify-end gap-3 border-t border-border pt-4">
        <Button variant="outline" type="button" onClick={onCancel} disabled={save.isPending}>
          Cancel
        </Button>

        <Button type="button" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save AutoSEO article"}
        </Button>
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
        </div>
      </div>
    </article>
  );
}
