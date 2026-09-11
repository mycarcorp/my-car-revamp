import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/app-client";
import { APP_SUPABASE_URL } from "@/integrations/supabase/runtime-config";
import {
  ArrowLeft,
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronUp,
  ChevronDown,
  ExternalLink,
  Italic,
  Link2,
  Link2Off,
  Plus,
  Table2,
  Trash2,
  Underline,
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
  sanitizeHtml,
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

const TYPE_LABEL: Record<BlockType, string> = {
  h1: "H1",
  h2: "H2",
  h3: "H3",
  h4: "H4",
  p: "Body",
  table: "Table",
};

const SECTION_TYPES: BlockType[] = ["h1", "h2", "h3", "h4", "p"];
const ADD_SECTION_TYPES: BlockType[] = [...SECTION_TYPES, "table"];

const BLOG_COVER_BUCKET = "blog photo";
const BLOG_COVER_PREFIX = "blog-covers";

const buildBlogCoverPath = (file: File, fallbackTitle: string) => {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const base = slugify(fallbackTitle || "blog-cover");
  return `${BLOG_COVER_PREFIX}/${base || "blog-cover"}-${Date.now()}.${ext}`;
};

const encodeStoragePath = (value: string) =>
  value
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

const uploadBlogCover = async (file: File, fallbackTitle: string) => {
  const path = buildBlogCoverPath(file, fallbackTitle);
  const { error } = await supabase.storage
    .from(BLOG_COVER_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type || "image/jpeg" });

  if (error) throw new Error(`Cover image upload failed: ${error.message}`);

  return `${APP_SUPABASE_URL}/storage/v1/object/public/${encodeURIComponent(BLOG_COVER_BUCKET)}/${encodeStoragePath(path)}`;
};

const fragmentToHtml = (fragment: DocumentFragment | null) => {
  if (!fragment) return "";
  const wrapper = document.createElement("div");
  wrapper.appendChild(fragment.cloneNode(true));
  return wrapper.innerHTML;
};

const splitPlainTextIntoParagraphs = (text: string) =>
  text
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n+/)
    .map((segment) => segment.trim())
    .filter(Boolean);

type PastedBlock = { type: BlockType; html: string; style?: Partial<HeadingStyle> };

const readPastedStyle = (node: Element): Partial<HeadingStyle> => {
  const style = node.getAttribute("style") ?? "";
  const result: Partial<HeadingStyle> = {};
  style.split(";").forEach((declaration) => {
    const [rawKey, ...rawValue] = declaration.split(":");
    const value = rawValue.join(":").trim();
    if (!value) return;
    const key = rawKey?.trim().toLowerCase();
    if (key === "font-size") result.fontSize = value;
    if (key === "font-weight") result.fontWeight = Number(value) || 400;
    if (key === "line-height") result.lineHeight = Number.parseFloat(value) || 1.5;
    if (key === "text-align" && ["left", "center", "right"].includes(value)) {
      result.textAlign = value as HeadingStyle["textAlign"];
    }
    if (key === "color") result.color = value;
    if (key === "background-color") result.backgroundColor = value;
    if (key === "margin-top") result.marginTop = value;
    if (key === "margin-bottom") result.marginBottom = value;
    if (key === "padding-left") result.paddingLeft = value;
  });
  return result;
};

const extractPastedBlocks = (clipboardData: DataTransfer | null): PastedBlock[] => {
  const html = clipboardData?.getData("text/html");
  const plain = clipboardData?.getData("text/plain");

  if (html) {
    const temp = document.createElement("div");
    temp.innerHTML = html;
    const parsed: PastedBlock[] = [];

    const tables = Array.from(temp.querySelectorAll("table"));
    if (tables.length) {
      tables.forEach((table) => {
        parsed.push({
          type: "table",
          html: sanitizeHtml(table.outerHTML),
        });
      });
      return parsed;
    }

    const collect = (node: Element) => {
      const tag = node.tagName.toLowerCase();
      if (["h1", "h2", "h3", "h4", "p", "ul", "ol", "blockquote"].includes(tag)) {
        parsed.push({
          type: tag === "h1" || tag === "h2" || tag === "h3" || tag === "h4" ? tag : "p",
          html: tag === "ul" || tag === "ol" || tag === "blockquote" ? node.outerHTML : node.innerHTML,
          style: readPastedStyle(node),
        });
        return;
      }
      Array.from(node.children).forEach(collect);
      if (!node.children.length && node.textContent?.trim()) {
        parsed.push({ type: "p", html: node.innerHTML });
      }
    };
    Array.from(temp.children).forEach(collect);
    if (parsed.length > 0) return parsed;
  }

  return plain ? splitPlainTextIntoParagraphs(plain).map((html) => ({ type: "p", html })) : [];
};

const getPresetStyle = (presetId: string, type: keyof HeadingStyles): HeadingStyle => {
  const base = DEFAULT_HEADING_STYLES[type];

  switch (presetId) {
    case "plain":
      return { ...base, fontWeight: 500, lineHeight: 1.4 };
    case "muted":
      return { ...base, color: "#5b6471" };
    case "eyebrow":
      return { ...base, fontSize: type === "h1" ? "28px" : type === "h2" ? "24px" : "20px", fontWeight: 700, lineHeight: 1.2 };
    case "quote":
      return { ...base, fontSize: type === "h1" ? "40px" : type === "h2" ? "32px" : "24px", fontWeight: 500, lineHeight: 1.4, color: "#1f2937" };
    case "display":
      return { ...base, fontSize: type === "h1" ? "64px" : type === "h2" ? "48px" : "36px", fontWeight: type === "h1" ? 800 : type === "h2" ? 800 : 700, lineHeight: type === "h1" ? 1.1 : type === "h2" ? 1.1 : 1.2 };
    case "highlight":
      return { ...base, fontSize: type === "h1" ? "52px" : type === "h2" ? "38px" : "28px", fontWeight: 700, lineHeight: 1.2, color: "#1b3a5c" };
    case "overline":
      return { ...base, fontSize: type === "h1" ? "26px" : type === "h2" ? "22px" : "18px", fontWeight: 800, lineHeight: 1.1 };
    default:
      return base;
  }
};

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
  onFocus,
  onSplit,
  onPasteBlocks,
  onTableAction,
}: {
  block: Block;
  styles: HeadingStyles;
  onChange: (html: string) => void;
  onType: (type: BlockType) => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
  registerRef: (el: HTMLDivElement | null) => void;
  onFocus?: (id: string, type: BlockType) => void;
  onSplit?: (payload: { beforeHtml: string; afterHtml: string; currentType: BlockType }) => void;
  onPasteBlocks?: (payload: { id: string; pieces: PastedBlock[] }) => void;
  onTableAction?: (action: "add-row" | "remove-row" | "add-column" | "remove-column" | "delete-table") => void;
}) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const style: HeadingStyle = {
    ...(block.type === "p"
      ? { fontSize: "18px", fontWeight: 400, lineHeight: 1.75, textAlign: "left" as const, color: "inherit" }
      : styles[block.type as keyof HeadingStyles]),
    ...(block.style ?? {}),
  };

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    if (el.innerHTML !== block.html) {
      el.innerHTML = block.html;
    }
  }, [block.html, block.id, block.type]);

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => onChange((e.currentTarget as HTMLDivElement).innerHTML);

  return (
    <div className="group relative">
      <div className="absolute -left-2 top-1 flex -translate-x-full items-center gap-1 opacity-0 transition group-focus-within:opacity-100 group-hover:opacity-100">
        {block.type === "table" ? (
          <>
            <button type="button" onClick={() => onTableAction?.("add-row")} className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] text-foreground">
              + Row
            </button>
            <button type="button" onClick={() => onTableAction?.("remove-row")} className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] text-foreground">
              - Row
            </button>
            <button type="button" onClick={() => onTableAction?.("add-column")} className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] text-foreground">
              + Col
            </button>
            <button type="button" onClick={() => onTableAction?.("remove-column")} className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] text-foreground">
              - Col
            </button>
          </>
        ) : (
          <select
            aria-label="Section type"
            className="rounded border border-border bg-background px-1 py-0.5 text-xs"
            value={block.type}
            onChange={(e) => onType(e.target.value as BlockType)}
          >
            {SECTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        )}
        <button type="button" aria-label="Move section up" onClick={() => onMove(-1)} className="p-1">
          <ChevronUp className="size-3.5" />
        </button>
        <button type="button" aria-label="Move section down" onClick={() => onMove(1)} className="p-1">
          <ChevronDown className="size-3.5" />
        </button>
        {block.type === "table" ? (
          <button type="button" aria-label="Delete table" onClick={() => onTableAction?.("delete-table")} className="p-1">
            <Trash2 className="size-3.5 text-destructive" />
          </button>
        ) : (
          <button type="button" aria-label="Delete section" onClick={onDelete} className="p-1">
            <Trash2 className="size-3.5 text-destructive" />
          </button>
        )}
      </div>

      <div
        ref={(node) => {
          contentRef.current = node;
          registerRef(node);
        }}
        data-block-id={block.id}
        data-block-type={block.type}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-label={`${TYPE_LABEL[block.type]} section`}
        onInput={handleInput}
        onBlur={handleInput}
        onFocus={() => onFocus?.(block.id, block.type)}
        onKeyDown={(e) => {
          if (block.type === "table" || e.key !== "Enter") return;
          const selection = window.getSelection();
          if (!selection || selection.rangeCount === 0 || !contentRef.current) return;

          const range = selection.getRangeAt(0);
          if (!contentRef.current.contains(range.startContainer)) return;

          e.preventDefault();

          const beforeRange = range.cloneRange();
          beforeRange.selectNodeContents(contentRef.current);
          beforeRange.setEnd(range.startContainer, range.startOffset);

          const afterRange = range.cloneRange();
          afterRange.selectNodeContents(contentRef.current);
          afterRange.setStart(range.startContainer, range.startOffset);

          onSplit?.({
            beforeHtml: fragmentToHtml(beforeRange.cloneContents()),
            afterHtml: fragmentToHtml(afterRange.cloneContents()),
            currentType: block.type,
          });
        }}
        onPaste={(e) => {
          const pieces = extractPastedBlocks(e.clipboardData);
          const hasStructuredContent = pieces.some(
            (piece) => piece.type !== "p" || /<(ul|ol|blockquote)\b/i.test(piece.html),
          );
          if (pieces.length <= 1 && !hasStructuredContent) return;

          e.preventDefault();
          onPasteBlocks?.({ id: block.id, pieces });
        }}
        className="prose-blog min-h-[1.6em] rounded px-1 py-0.5 outline-none focus:bg-muted/40"
        style={
          block.type === "table"
            ? {
                overflowX: "auto",
                border: "1px solid hsl(var(--border))",
                borderRadius: "0.75rem",
                backgroundColor: "rgba(148, 163, 184, 0.04)",
              }
            : style
              ? {
                  fontSize: style.fontSize,
                  fontWeight: style.fontWeight,
                  lineHeight: style.lineHeight,
                  textAlign: style.textAlign,
                  color: style.color,
                  backgroundColor: style.backgroundColor ?? "transparent",
                  marginTop: style.marginTop,
                  marginBottom: style.marginBottom,
                  paddingLeft: style.paddingLeft,
                }
              : { fontSize: "18px", lineHeight: 1.75 }
        }
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
          {ADD_SECTION_TYPES.map((t) => (
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

export function BlogEditor({ postId }: { postId?: number }) {
  const { session } = useAuth();
  const accessToken = session?.access_token ?? "";
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [sidebarTab, setSidebarTab] = useState<"post" | "design">("post");
  const [activeBlock, setActiveBlock] = useState<{ id: string; type: BlockType } | null>(null);
  const [colorMode, setColorMode] = useState<"text" | "background">("text");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [blocks, setBlocks] = useState<Block[]>([makeBlock("p")]);
  const [category, setCategory] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [coverPickerKey, setCoverPickerKey] = useState(0);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const titleInputRef = useRef<HTMLTextAreaElement | null>(null);
  const [coverUploading, setCoverUploading] = useState(false);
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

  const sectionRefs = useRef<Map<string, HTMLDivElement>>(new Map());
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

  useEffect(() => {
    const el = titleInputRef.current;
    if (!el) return;

    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [title]);

  const effectiveSlug = slugTouched && slug ? slugify(slug) : slugify(title);
  const activeType: keyof HeadingStyles =
    activeBlock?.type === "h1" || activeBlock?.type === "h2" || activeBlock?.type === "h3" || activeBlock?.type === "h4"
      ? activeBlock.type
      : "h1";

  /* ----------------------------- block helpers ---------------------------- */

  const updateBlock = (id: string, html: string) =>
    setBlocks((b) => b.map((x) => (x.id === id ? { ...x, html } : x)));

  const makeTableMarkup = (rows = 2, cols = 2) => {
    const table = document.createElement("table");
    table.style.width = "100%";
    table.style.borderCollapse = "collapse";
    table.style.border = "1px solid hsl(var(--border))";
    table.style.tableLayout = "fixed";

    const body = document.createElement("tbody");
    for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
      const tr = document.createElement("tr");
      for (let colIndex = 0; colIndex < cols; colIndex += 1) {
        const cell = document.createElement("td");
        cell.style.border = "1px solid hsl(var(--border))";
        cell.style.padding = "0.7rem";
        cell.style.verticalAlign = "top";
        cell.textContent = `Cell ${rowIndex + 1}.${colIndex + 1}`;
        tr.appendChild(cell);
      }
      body.appendChild(tr);
    }
    table.appendChild(body);
    return table.outerHTML;
  };

  const insertTableAt = (index: number) => {
    const rawRows = window.prompt("Number of rows", "2");
    const rawCols = window.prompt("Number of columns", "2");
    const rows = Math.max(1, Number.parseInt(rawRows ?? "", 10) || 2);
    const cols = Math.max(1, Number.parseInt(rawCols ?? "", 10) || 2);

    insertAt(index, "table", rows, cols);
  };

  const updateActiveBlockStyle = (patch: Partial<HeadingStyle>) => {
    if (!activeBlock) return;
    setBlocks((current) =>
      current.map((block) =>
        block.id === activeBlock.id ? { ...block, style: { ...(block.style ?? {}), ...patch } } : block,
      ),
    );
  };

  const selectedBlock = activeBlock ? blocks.find((block) => block.id === activeBlock.id) : null;
  const selectedStyle: HeadingStyle = {
    ...(selectedBlock?.type === "p"
      ? { fontSize: "18px", fontWeight: 400, lineHeight: 1.75, textAlign: "left" as const, color: "#111111" }
      : styles[activeType]),
    ...(selectedBlock?.style ?? {}),
  };

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

  const focusBlockById = (id: string) => {
    const el = sectionRefs.current.get(id);
    if (!el) return;
    el.focus();

    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(range);
  };

  const insertAt = (index: number, type: BlockType, rows = 2, cols = 2) => {
    const next = makeBlock(type, type === "table" ? makeTableMarkup(rows, cols) : "");
    setBlocks((b) => {
      const copy = [...b];
      copy.splice(index, 0, next);
      return copy;
    });
    if (type === "table") {
      window.requestAnimationFrame(() => {
        focusBlockById(next.id);
        setActiveBlock({ id: next.id, type });
      });
    }
  };

  const splitBlockAtSelection = ({
    beforeHtml,
    afterHtml,
    currentType,
  }: {
    beforeHtml: string;
    afterHtml: string;
    currentType: BlockType;
  }) => {
    const trimmedBefore = beforeHtml.trim();
    const trimmedAfter = afterHtml.trim();

    if (!trimmedBefore && !trimmedAfter) {
      return;
    }

    const nextId = makeBlock(currentType).id;

    setBlocks((b) => {
      const index = b.findIndex((x) => x.id === activeBlock?.id);
      if (index < 0) return b;

      const current = b[index];
      if (!current) return b;

      const before = sanitizeHtml(trimmedBefore || "");
      const after = sanitizeHtml(trimmedAfter || "");

      if (!before && !after) return b;

      const updated = [...b];
      updated[index] = { ...current, html: before || "<br>" };

      const next: Block = {
        id: nextId,
        type: currentType,
        html: after || "",
      };

      updated.splice(index + 1, 0, next);
      return updated;
    });

    window.requestAnimationFrame(() => {
      focusBlockById(nextId);
      setActiveBlock({ id: nextId, type: currentType });
    });
  };

  const handleTableAction = (id: string, action: "add-row" | "remove-row" | "add-column" | "remove-column" | "delete-table") => {
    if (action === "delete-table") {
      removeBlock(id);
      return;
    }

    setBlocks((b) =>
      b.map((block) => {
        if (block.id !== id || block.type !== "table") return block;

        const wrapper = document.createElement("div");
        wrapper.innerHTML = sanitizeHtml(block.html || "");
        const table = wrapper.querySelector("table");
        if (!table) return block;

        const rows = Array.from(table.querySelectorAll("tr"));
        const rowCount = rows.length;

        if (action === "add-row") {
          const newRow = document.createElement("tr");
          const cellCount = Math.max(1, rows[0]?.children.length ?? 1);
          for (let columnIndex = 0; columnIndex < cellCount; columnIndex += 1) {
            const cell = document.createElement("td");
            cell.style.border = "1px solid hsl(var(--border))";
            cell.style.padding = "0.7rem";
            cell.style.verticalAlign = "top";
            cell.textContent = "Cell";
            newRow.appendChild(cell);
          }
          const targetBody = table.querySelector("tbody") ?? table;
          targetBody.appendChild(newRow);
        }

        if (action === "remove-row") {
          if (rowCount > 1) {
            const lastRow = rows[rowCount - 1];
            lastRow?.remove();
          }
        }

        if (action === "add-column") {
          rows.forEach((row) => {
            const cell = document.createElement("td");
            cell.style.border = "1px solid hsl(var(--border))";
            cell.style.padding = "0.7rem";
            cell.style.verticalAlign = "top";
            cell.textContent = "Cell";
            row.appendChild(cell);
          });
        }

        if (action === "remove-column") {
          const columnCount = Math.max(1, rows[0]?.children.length ?? 1);
          if (columnCount > 1) {
            rows.forEach((row) => {
              const lastCell = row.lastElementChild;
              lastCell?.remove();
            });
          }
        }

        return { ...block, html: table.outerHTML };
      }),
    );
  };

  const handlePasteBlocks = ({ id, pieces }: { id: string; pieces: PastedBlock[] }) => {
    if (pieces.length === 0) return;

    setBlocks((b) => {
      const index = b.findIndex((x) => x.id === id);
      if (index < 0) return b;

      const current = b[index];
      if (!current) return b;

      const existing = sanitizeHtml(current.html || "");
      const first = pieces[0];
      const firstPiece = sanitizeHtml(first?.html ?? "") || existing;
      const remainder = pieces
        .slice(1)
        .map((piece) => ({ ...piece, html: sanitizeHtml(piece.html) }))
        .filter((piece) => piece.html);

      const nextBlocks = [...b];
      nextBlocks.splice(
        index,
        1,
        {
          ...current,
          type: first?.type ?? current.type,
          html: firstPiece,
          ...(first?.style && Object.keys(first.style).length ? { style: first.style } : {}),
        },
        ...remainder.map((piece) => ({
          ...makeBlock(piece.type, piece.html),
          ...(piece.style && Object.keys(piece.style).length ? { style: piece.style } : {}),
        })),
      );
      return nextBlocks;
    });
  };

  const handleCoverUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setCoverUploading(true);
      const uploadedUrl = await uploadBlogCover(file, title || "Blog post");
      setImageUrl(uploadedUrl);
      toast.success("Cover image uploaded.");
      setCoverPickerKey((v) => v + 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Cover image upload failed.");
    } finally {
      setCoverUploading(false);
      event.target.value = "";
    }
  };

  const clearCoverImage = () => {
    setImageUrl("");
    setCoverPickerKey((v) => v + 1);
  };

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
      const ancestor =
        range.commonAncestorContainer.nodeType === 1
          ? (range.commonAncestorContainer as Element)
          : range.commonAncestorContainer.parentElement;
      const selectionBlock = ancestor?.closest("[data-block-id]") as HTMLElement | null;
      if (selectionBlock?.dataset["blockId"] && selectionBlock.dataset["blockType"]) {
        setActiveBlock({
          id: selectionBlock.dataset["blockId"],
          type: selectionBlock.dataset["blockType"] as BlockType,
        });
      }
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
    <div className="min-h-screen overflow-hidden">
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
      </div>

      <div className="grid gap-8 px-6 py-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:h-[calc(100vh-73px)] lg:min-h-0 lg:overflow-hidden">
        {/* Canvas */}
        <div className="mx-auto h-full w-full max-w-3xl min-h-0 overflow-y-auto pr-1">
          <>
            <textarea
              ref={titleInputRef}
              value={title}
              rows={1}
              onChange={(e) => {
                setTitle(e.target.value);
                if (!slugTouched) setSlug(slugify(e.target.value));
              }}
              placeholder="Add title"
              aria-label="Post title"
              className="w-full resize-none border-0 bg-transparent font-display text-4xl font-bold leading-tight outline-none placeholder:text-muted-foreground/50"
              style={{ overflow: "hidden" }}
            />
            <div className="mt-4 h-px w-full bg-border" />

            <div ref={canvasRef} className="mt-2">
              <AddSection onAdd={(t) => (t === "table" ? insertTableAt(0) : insertAt(0, t))} />
              {blocks.map((b, i) => (
                <div key={b.id}>
                  <SectionEditor
                    block={b}
                    styles={styles}
                    onChange={(html) => updateBlock(b.id, html)}
                    onType={(t) => changeType(b.id, t)}
                    onDelete={() => removeBlock(b.id)}
                    onMove={(d) => moveBlock(b.id, d)}
                    registerRef={(el) => {
                      if (el) {
                        sectionRefs.current.set(b.id, el);
                      } else {
                        sectionRefs.current.delete(b.id);
                      }
                    }}
                    onFocus={(id, type) => setActiveBlock({ id, type })}
                    onSplit={splitBlockAtSelection}
                    onPasteBlocks={handlePasteBlocks}
                    onTableAction={(action) => handleTableAction(b.id, action)}
                  />
                  <AddSection onAdd={(t) => (t === "table" ? insertTableAt(i + 1) : insertAt(i + 1, t))} />
                </div>
              ))}
            </div>
          </>
        </div>

        {/* Settings sidebar */}
        <aside className="flex h-full w-full flex-col overflow-hidden border border-border bg-white shadow-sm lg:sticky lg:top-[73px] lg:h-[calc(100vh-73px)] lg:w-[320px] lg:self-stretch">
          <div className="flex gap-1 border-b border-border bg-muted/50 p-1">
            {(["post", "design"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setSidebarTab(item)}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-medium capitalize transition-colors ${
                  sidebarTab === item
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {item}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {sidebarTab === "post" ? (
              <>
                <section className="border-b border-border bg-background p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Post</h3>
                  <div className="mt-3 space-y-3">
                    <div className="space-y-2">
                      <Label>Cover image</Label>

                      <input
                        key={coverPickerKey}
                        ref={coverInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleCoverUpload}
                      />

                      {!imageUrl ? (
                        <button
                          type="button"
                          onClick={() => coverInputRef.current?.click()}
                          disabled={coverUploading}
                          className="flex h-28 w-full cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 text-center text-sm text-muted-foreground transition hover:border-primary hover:bg-muted/50"
                        >
                          <span className="font-medium text-foreground">{coverUploading ? "Uploading…" : "Upload Image"}</span>
                          <span className="mt-1 text-xs">Blog cover / featured image</span>
                        </button>
                      ) : (
                        <div className="overflow-hidden rounded-xl border border-border bg-muted/20">
                          <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
                            <img src={imageUrl} alt="Cover preview" className="h-full w-full object-cover" />
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                              <p className="text-lg font-semibold text-white">{title || "Blog Post Title"}</p>
                            </div>
                          </div>
                          <div className="flex gap-2 p-3">
                            <Button type="button" variant="outline" size="sm" onClick={() => coverInputRef.current?.click()}>
                              Replace
                            </Button>
                            <Button type="button" variant="ghost" size="sm" onClick={clearCoverImage}>
                              Remove
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
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
                        onValueChange={(v) =>
                          v === "__add" ? setNewCategory("") : setCategory(v === "__none" ? "" : v)
                        }
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

              <section className="border-b border-border bg-background p-4">
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

              <section className="bg-background p-4">
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
            </>
          ) : (
            <>
              <section className="border-b border-border bg-background p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Styles
                </h3>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {[
                    { id: "default", label: "Default" },
                    { id: "plain", label: "Plain" },
                    { id: "muted", label: "Muted" },
                    { id: "eyebrow", label: "Eyebrow" },
                    { id: "quote", label: "Quote" },
                    { id: "display", label: "Display" },
                    { id: "highlight", label: "Highlight" },
                    { id: "overline", label: "Overline" },
                  ].map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() =>
                        updateActiveBlockStyle(getPresetStyle(preset.id, activeType))
                      }
                      className="rounded-md border border-border bg-muted/40 px-2 py-3 text-left text-sm font-medium text-foreground transition hover:border-primary hover:bg-muted"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </section>

              <section className="border-b border-border bg-background p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Color</h3>
                <div className="mt-3 space-y-3">
                  <div className="flex gap-1 rounded-md border border-border bg-muted/50 p-1">
                    {(["text", "background"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setColorMode(mode)}
                        className={`flex-1 rounded-md px-2 py-1.5 text-sm capitalize transition-colors ${
                          colorMode === mode ? "bg-background text-foreground" : "text-muted-foreground"
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      className="h-9 w-14 cursor-pointer p-1"
                      value={
                        colorMode === "text"
                          ? selectedStyle.color
                          : selectedStyle.backgroundColor ?? "#ffffff"
                      }
                      onChange={(e) =>
                        updateActiveBlockStyle(
                          colorMode === "text"
                            ? { color: e.target.value }
                            : { backgroundColor: e.target.value },
                        )
                      }
                    />
                    <Input
                      value={
                        colorMode === "text"
                          ? selectedStyle.color
                          : selectedStyle.backgroundColor ?? "#ffffff"
                      }
                      onChange={(e) =>
                        updateActiveBlockStyle(
                          colorMode === "text"
                            ? { color: e.target.value }
                            : { backgroundColor: e.target.value },
                        )
                      }
                    />
                  </div>
                </div>
              </section>

              <section className="bg-background p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Typography
                </h3>
                <div className="mt-3 space-y-3">
                  <div className="flex gap-2">
                    {[
                      { label: "S", size: "32px" },
                      { label: "M", size: "40px" },
                      { label: "L", size: "48px" },
                      { label: "XL", size: "64px" },
                    ].map((sizePreset) => (
                      <button
                        key={sizePreset.label}
                        type="button"
                        onClick={() =>
                          updateActiveBlockStyle({ fontSize: sizePreset.size })
                        }
                        className="flex-1 rounded-md border border-border bg-muted/40 px-2 py-2 text-sm font-medium transition hover:border-primary"
                      >
                        {sizePreset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            </>
          )}
          </div>
        </aside>
      </div>

      {/* Floating formatting toolbar */}
      {toolbar && (
        <div
          className="absolute z-30 flex items-center gap-1 rounded-md border border-border bg-background p-1 shadow-lg"
          style={{ top: toolbar.top, left: toolbar.left }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Insert table"
            onClick={() => {
              const currentIndex = activeBlock ? blocks.findIndex((block) => block.id === activeBlock.id) : -1;
              insertTableAt(currentIndex >= 0 ? currentIndex + 1 : 0);
            }}
          >
            <Table2 className="size-4" />
          </Button>
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
            aria-label="Underline"
            onClick={() => exec("underline")}
          >
            <Underline className="size-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Align left"
            onClick={() => updateActiveBlockStyle({ textAlign: "left" })}
          >
            <AlignLeft className="size-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Align center"
            onClick={() => updateActiveBlockStyle({ textAlign: "center" })}
          >
            <AlignCenter className="size-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Align right"
            onClick={() => updateActiveBlockStyle({ textAlign: "right" })}
          >
            <AlignRight className="size-4" />
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
