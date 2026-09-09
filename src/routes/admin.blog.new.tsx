import { createFileRoute } from "@tanstack/react-router";
import { BlogEditor } from "@/components/admin/BlogEditor";

export const Route = createFileRoute("/admin/blog/new")({
  head: () => ({
    meta: [
      { title: "New blog post — MyCar admin" },
      { name: "description", content: "Write a new MyCar blog article." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <BlogEditor />,
});
