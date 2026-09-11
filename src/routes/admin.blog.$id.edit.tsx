import { createFileRoute } from "@tanstack/react-router";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
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

  return (
    <div className="min-w-0">
      <AdminPageHeader title="Edit blog post" subtitle="Update this article and publish when ready." />
      <BlogEditor postId={Number(id)} />
    </div>
  );
}
