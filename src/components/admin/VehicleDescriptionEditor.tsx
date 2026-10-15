import { useEffect, useState } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import {
  Bold,
  Heading2,
  Heading3,
  Italic,
  LayoutTemplate,
  Link2,
  List,
  ListOrdered,
  Pilcrow,
  Redo2,
  Table as TableIcon,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DESCRIPTION_TEMPLATE, descriptionToSafeHtml } from "@/lib/vehicle-description";

type Props = { value: string; onChange: (html: string) => void };

export function VehicleDescriptionEditor({ value, onChange }: Props) {
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: { openOnClick: false, autolink: true },
      }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: descriptionToSafeHtml(value),
    editorProps: {
      attributes: {
        class: "vehicle-description min-h-[220px] max-h-[480px] overflow-y-auto px-4 py-3 text-sm outline-none",
      },
    },
    onUpdate: ({ editor: e }) => onChange(e.isEmpty ? "" : e.getHTML()),
  });

  // Sync external changes (dialog reopened, VIN decode) without fighting the typist.
  useEffect(() => {
    if (!editor || editor.isFocused) return;
    const next = descriptionToSafeHtml(value);
    const current = editor.isEmpty ? "" : editor.getHTML();
    if (next !== current) editor.commands.setContent(next, { emitUpdate: false });
  }, [editor, value]);

  return (
    <div className="overflow-hidden rounded-md border border-input bg-background">
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-2">
        <div className="flex">
          {(["edit", "preview"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-3 py-2 text-xs font-semibold capitalize ${tab === t ? "border-b-2 border-primary text-foreground" : "text-muted-foreground"}`}
            >
              {t}
            </button>
          ))}
        </div>
        {editor && tab === "edit" && editor.isEmpty && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={() => editor.commands.setContent(DESCRIPTION_TEMPLATE, { emitUpdate: true })}
          >
            <LayoutTemplate className="size-3" /> Insert section outline
          </Button>
        )}
      </div>
      {tab === "edit" ? (
        <>
          {editor && <Toolbar editor={editor} />}
          <EditorContent editor={editor} />
        </>
      ) : (
        <div
          className="vehicle-description max-h-[480px] min-h-[220px] overflow-y-auto px-4 py-3 text-sm"
          dangerouslySetInnerHTML={{
            __html: descriptionToSafeHtml(value) || "<p><em>Nothing to preview yet.</em></p>",
          }}
        />
      )}
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      p: e.isActive("paragraph"),
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      ul: e.isActive("bulletList"),
      ol: e.isActive("orderedList"),
      link: e.isActive("link"),
      table: e.isActive("table"),
      undo: e.can().undo(),
      redo: e.can().redo(),
    }),
  });
  const chain = () => editor.chain().focus();
  const items: Array<{ label: string; icon: typeof Bold; active?: boolean; disabled?: boolean; run: () => void }> = [
    { label: "Undo", icon: Undo2, disabled: !state.undo, run: () => chain().undo().run() },
    { label: "Redo", icon: Redo2, disabled: !state.redo, run: () => chain().redo().run() },
    { label: "Paragraph", icon: Pilcrow, active: state.p, run: () => chain().setParagraph().run() },
    { label: "Heading 2", icon: Heading2, active: state.h2, run: () => chain().toggleHeading({ level: 2 }).run() },
    { label: "Heading 3", icon: Heading3, active: state.h3, run: () => chain().toggleHeading({ level: 3 }).run() },
    { label: "Bold", icon: Bold, active: state.bold, run: () => chain().toggleBold().run() },
    { label: "Italic", icon: Italic, active: state.italic, run: () => chain().toggleItalic().run() },
    { label: "Bullet list", icon: List, active: state.ul, run: () => chain().toggleBulletList().run() },
    { label: "Numbered list", icon: ListOrdered, active: state.ol, run: () => chain().toggleOrderedList().run() },
    {
      label: "Link",
      icon: Link2,
      active: state.link,
      run: () => {
        const prev = editor.getAttributes("link")["href"] as string | undefined;
        const url = window.prompt("Link URL (leave empty to remove)", prev ?? "https://");
        if (url === null) return;
        if (!url.trim()) chain().extendMarkRange("link").unsetLink().run();
        else chain().extendMarkRange("link").setLink({ href: url.trim() }).run();
      },
    },
    {
      label: "Insert table",
      icon: TableIcon,
      run: () => chain().insertTable({ rows: 3, cols: 2, withHeaderRow: true }).run(),
    },
  ];
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-border px-1 py-1">
      {items.map(({ label, icon: Icon, active, disabled, run }) => (
        <Button
          key={label}
          type="button"
          size="icon"
          variant={active ? "secondary" : "ghost"}
          className="size-8"
          title={label}
          aria-label={label}
          disabled={disabled}
          onClick={run}
        >
          <Icon className="size-4" />
        </Button>
      ))}
      {state.table && (
        <div className="ml-1 flex flex-wrap gap-1 text-xs">
          <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => chain().addRowAfter().run()}>
            + Row
          </Button>
          <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => chain().addColumnAfter().run()}>
            + Column
          </Button>
          <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => chain().deleteRow().run()}>
            − Row
          </Button>
          <Button type="button" size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => chain().deleteTable().run()}>
            Delete table
          </Button>
        </div>
      )}
    </div>
  );
}
