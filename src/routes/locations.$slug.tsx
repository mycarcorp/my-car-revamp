import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { VehicleCard } from "@/components/VehicleCard";
import { featuredVehiclesQuery, serviceAreaQuery, siteSettingsQuery } from "@/lib/queries";

export const Route = createFileRoute("/locations/$slug")({
  loader: async ({ context, params }) => {
    const [area] = await Promise.all([
      context.queryClient.ensureQueryData(serviceAreaQuery(params.slug)),
      context.queryClient.ensureQueryData(featuredVehiclesQuery()),
    ]);
    if (!area) throw notFound();
    return { area };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Area unavailable — MyCar" }, { name: "robots", content: "noindex" }] };
    }
    const a = loaderData.area;
    const title = `Used Cars in ${a.name}, ${a.state} — MyCar`;
    const description =
      a.intro ?? `Shop inspected used cars, trucks and SUVs available to ${a.name}, ${a.state} buyers.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: LocationPage,
  errorComponent: () => <div role="alert" className="mx-auto max-w-5xl px-4 py-12">Unable to load this service area. Please refresh.</div>,
  notFoundComponent: () => <div className="mx-auto max-w-5xl px-4 py-12">Service area unavailable. <Link to="/locations">See areas we serve</Link></div>,
});

function LocationPage() {
  const { area } = Route.useLoaderData();
  const { data: settings } = useQuery(siteSettingsQuery());
  const { data: vehicles } = useQuery(featuredVehiclesQuery());

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="font-display text-4xl font-bold">
        Used cars in {area.name}, {area.state}
      </h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">{area.intro}</p>
      {area.body && (
        <p className="mt-4 max-w-2xl whitespace-pre-line text-muted-foreground">{area.body}</p>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <Button asChild>
          <Link to="/search">Browse inventory</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/schedule">Book a visit</Link>
        </Button>
      </div>

      {vehicles && vehicles.length > 0 && (
        <section className="mt-14">
          <h2 className="font-display text-2xl font-bold">Available now</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {vehicles.slice(0, 4).map((v) => (
              <VehicleCard key={v.id} vehicle={v} settings={settings} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
