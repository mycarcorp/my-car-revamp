import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign In or Create an Account — MyCar" },
      { name: "robots", content: "noindex" },
      {
        name: "description",
        content:
          "Sign in to save vehicles, store searches and track the requests you've sent to MyCar in Fredericksburg, VA.",
      },
      { property: "og:title", content: "Sign In — MyCar" },
      { property: "og:description", content: "Save vehicles, store searches and track requests." },
    ],
  }),
  component: AuthRedirect,
});

function AuthRedirect() {
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    void navigate({ to: user ? "/search" : "/" });
  }, [user, navigate]);

  return <div className="min-h-[calc(100vh-5rem)] bg-surface" />;
}
