import { createFileRoute } from "@tanstack/react-router";
import { BlogEditor } from "@/components/admin/BlogEditor";

export const Route = createFileRoute("/admin/blog/$id/edit")({
  head: () => ({
    meta: [
      { title: "Edit blog post — MyCar admin" },
      { name: "description", content: "Edit a MyCar blog article." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EditPost,
});

function EditPost() {
  const { id } = Route.useParams();
  return <BlogEditor postId={Number(id)} />;
}
