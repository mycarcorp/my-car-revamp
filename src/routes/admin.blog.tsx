import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/admin/blog")({
  component: AdminBlog,
});

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

function AdminBlog() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [body, setBody] = useState("");
  const [author, setAuthor] = useState("");
  const [cover, setCover] = useState("");
  const [saving, setSaving] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("blog_posts").insert({
      title,
      slug: slugify(title),
      excerpt: excerpt || null,
      body,
      author_name: author || null,
      cover_image_url: cover || null,
    });
    setSaving(false);
    if (error) return toast.error("Could not save this post.");
    setTitle("");
    setExcerpt("");
    setBody("");
    setCover("");
    void queryClient.invalidateQueries({ queryKey: ["admin", "posts"] });
    toast.success("Draft saved.");
  }

  async function togglePublish(id: string, published: boolean) {
    const { error } = await supabase
      .from("blog_posts")
      .update({ published, published_at: published ? new Date().toISOString() : null })
      .eq("id", id);
    if (error) return toast.error("Could not update this post.");
    void queryClient.invalidateQueries({ queryKey: ["admin", "posts"] });
    void queryClient.invalidateQueries({ queryKey: ["blog"] });
  }

  return (
    <div className="p-6">
      <h1 className="font-display text-2xl font-bold">Blog</h1>
      <p className="text-sm text-muted-foreground">Write, save as a draft, then publish when ready.</p>

      <form onSubmit={create} className="mt-6 space-y-4 rounded-lg border border-border bg-background p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="author">Author</Label>
            <Input id="author" value={author} onChange={(e) => setAuthor(e.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="cover">Cover image URL</Label>
          <Input id="cover" value={cover} onChange={(e) => setCover(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="excerpt">Excerpt</Label>
          <Textarea id="excerpt" rows={2} value={excerpt} onChange={(e) => setExcerpt(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="body">Body</Label>
          <Textarea id="body" rows={10} value={body} onChange={(e) => setBody(e.target.value)} />
        </div>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save draft"}
        </Button>
      </form>

      {isLoading ? (
        <div className="mt-6 h-20 animate-pulse rounded-lg bg-muted" />
      ) : error ? (
        <p className="mt-6 rounded-lg border border-destructive/40 bg-background p-6 text-sm">
          Couldn't load posts.
        </p>
      ) : data?.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">No posts yet.</p>
      ) : (
        <ul className="mt-6 divide-y divide-border rounded-lg border border-border bg-background">
          {data?.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-medium">{p.title}</p>
                <p className="text-xs text-muted-foreground">
                  /{p.slug} {p.published ? `· published ${formatDate(p.published_at)}` : "· draft"}
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Published</span>
                <Switch checked={p.published} onCheckedChange={(v) => togglePublish(p.id, v)} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
