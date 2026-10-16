import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { MapPin } from "lucide-react";
import { serviceAreasQuery } from "@/lib/queries";

export const Route = createFileRoute("/locations/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(serviceAreasQuery()),
  errorComponent: () => <div role="alert" className="mx-auto max-w-5xl px-4 py-12">Unable to load service areas. Please refresh.</div>,
  notFoundComponent: () => <div className="mx-auto max-w-5xl px-4 py-12">Service area unavailable.</div>,
  head: () => ({
    meta: [
      { title: "Areas We Serve — MyCar Used Cars near Fredericksburg, VA" },
      {
        name: "description",
        content:
          "MyCar serves Fredericksburg, Spotsylvania, Stafford, King George, Richmond and Northern Virginia with inspected used cars, trucks and SUVs.",
      },
      { property: "og:title", content: "Areas We Serve — MyCar" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        property: "og:description",
        content: "Used vehicles for Fredericksburg, Spotsylvania, Stafford, King George and beyond.",
      },
    ],
  }),
  component: LocationsIndex,
});

function LocationsIndex() {
  const { data: areas } = useSuspenseQuery(serviceAreasQuery());

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="font-display text-4xl font-bold">Areas we serve</h1>
      <p className="mt-3 text-muted-foreground">
        One lot in Fredericksburg, customers across the region. Here's where our buyers come from.
      </p>
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {(areas ?? []).map((a) => (
          <Link
            key={a.id}
            to="/locations/$slug"
            params={{ slug: a.slug }}
            className="card-lift rounded-xl border border-border bg-card p-6"
          >
            <div className="flex items-center gap-2 font-display text-lg font-semibold">
              <MapPin className="size-4 text-accent" /> {a.name}, {a.state}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{a.intro}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
