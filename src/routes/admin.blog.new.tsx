import { createFileRoute } from "@tanstack/react-router";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { BlogEditor } from "@/components/admin/BlogEditor";

export const Route = createFileRoute("/admin/blog/new")({
  head: () => ({
    meta: [
      { title: "New blog post — MyCar admin" },
      { name: "description", content: "Write a new MyCar blog article." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <div className="min-w-0">
      <AdminPageHeader title="New blog post" subtitle="Create a new article for the site." />
      <BlogEditor />
    </div>
  ),
});
