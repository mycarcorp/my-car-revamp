import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { siteSettingsQuery } from "@/lib/queries";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About MyCar — Independent Dealer in Fredericksburg, VA" },
      {
        name: "description",
        content:
          "My Car Business Services LLC is an independent used-vehicle dealership in Fredericksburg, Virginia handling retail sales, wholesale acquisition and trade-ins.",
      },
      { property: "og:title", content: "About MyCar — Fredericksburg, VA" },
      {
        property: "og:description",
        content:
          "An independent Fredericksburg used-vehicle dealership handling retail sales, wholesale acquisition and trade-ins.",
      },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  const { data: settings } = useQuery(siteSettingsQuery());

  return (
    <div className="mx-auto max-w-3xl px-4 py-14">
      <h1 className="font-display text-4xl font-bold">About MyCar</h1>
      <div className="mt-6 space-y-5 text-muted-foreground">
        <p>
          My Car Business Services LLC is an independent used-vehicle dealership based in
          Fredericksburg, Virginia. We buy, recondition and sell pre-owned cars, trucks and SUVs, and
          we acquire vehicles at wholesale for resale to retail customers across the region.
        </p>
        <p>
          We are not a national chain. Every vehicle on the lot is inspected before it is listed, the
          price on the listing is the price we work from, and the person who answers the phone is the
          person who can actually tell you about the car.
        </p>
        <p>
          Need service rather than a vehicle? Our sister operation,{" "}
          <a
            className="font-medium text-primary hover:underline"
            href="https://mycarcareservices.com"
            target="_blank"
            rel="noreferrer noopener"
          >
            MyCar Care Services
          </a>
          , handles maintenance and repair.
        </p>
      </div>

      <div className="mt-10 rounded-xl border border-border bg-surface p-6">
        <h2 className="font-display text-xl font-bold">Visit us</h2>
        <p className="mt-2 text-sm text-muted-foreground">{settings?.address_line}</p>
        <p className="text-sm font-semibold">{settings?.phone}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/search">Browse inventory</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/schedule">Book a visit</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
