import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { LeaseHero } from "@/components/lease-to-own/LeaseHero";
import { RideshareSimulator } from "@/components/lease-to-own/RideshareSimulator";
import { SafeguardsSection } from "@/components/lease-to-own/SafeguardsSection";
import { PackagesSection } from "@/components/lease-to-own/PackagesSection";
import { MechanicalSafeguard } from "@/components/lease-to-own/MechanicalSafeguard";
import { HowItWorks } from "@/components/lease-to-own/HowItWorks";
import { LeaseSectionNav } from "@/components/lease-to-own/LeaseSectionNav";
import { trackLeaseEvent } from "@/lib/analytics";
import { DEFAULT_TIER, VEHICLE_VALUE, type LeaseTierKey } from "@/lib/lease-to-own";

const TITLE = "Lease to Own Cars in Fredericksburg, VA | My Car Corp";
const DESCRIPTION =
  "Explore lease-to-own vehicle options at My Car Corp in Fredericksburg, VA. Compare payment plans, learn about vehicle protection, and start your application online.";
const URL = "https://mycarcorp.com/lease-to-own";

export const Route = createFileRoute("/lease-to-own/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: URL },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: "https://mycarcorp.com/" },
            { "@type": "ListItem", position: 2, name: "Lease to Own", item: URL },
          ],
        }),
      },
    ],
  }),
  component: LeaseToOwnPage,
});

function LeaseToOwnPage() {
  // Shared by the simulator and the package calculator so both reflect one vehicle.
  const [vehicleValue, setVehicleValue] = useState<number>(VEHICLE_VALUE.default);
  // The package the visitor last compared; carried into Get Pre-Approved.
  const [selectedTier, setSelectedTier] = useState<LeaseTierKey>(DEFAULT_TIER);

  useEffect(() => {
    trackLeaseEvent("lease_to_own_page_view");
  }, []);

  return (
    <>
      <LeaseSectionNav tier={selectedTier} vehicleValue={vehicleValue} />
      <LeaseHero />
      <RideshareSimulator vehicleValue={vehicleValue} onTierChange={setSelectedTier} />
      <SafeguardsSection />
      <PackagesSection vehicleValue={vehicleValue} onVehicleValueChange={setVehicleValue} />
      <MechanicalSafeguard />
      <HowItWorks />
      <nav aria-label="Related pages" className="mx-auto max-w-7xl px-4 pt-12">
        <p className="text-sm text-muted-foreground">
          Prefer a traditional auto loan? See{" "}
          <Link
            to="/finance"
            className="font-semibold text-primary underline-offset-2 hover:underline"
          >
            financing
          </Link>
          . Have a car to trade?{" "}
          <Link
            to="/sell"
            className="font-semibold text-primary underline-offset-2 hover:underline"
          >
            Get a trade-in offer
          </Link>
          . Questions?{" "}
          <Link
            to="/contact"
            className="font-semibold text-primary underline-offset-2 hover:underline"
          >
            Contact our Fredericksburg team
          </Link>{" "}
          or{" "}
          <Link
            to="/lease-to-own/portal"
            className="font-semibold text-primary underline-offset-2 hover:underline"
          >
            sign in to your Lease to Own portal
          </Link>
          .
        </p>
      </nav>
    </>
  );
}
