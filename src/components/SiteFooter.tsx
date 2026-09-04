import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { siteSettingsQuery, serviceAreasQuery } from "@/lib/queries";
import { BrandLogo } from "@/components/BrandLogo";


export function SiteFooter() {
  const { data: settings } = useQuery(siteSettingsQuery());
  const { data: areas } = useQuery(serviceAreasQuery());
  const hours = (settings?.hours ?? {}) as Record<string, string>;

  return (
    <footer className="mt-20 border-t border-border bg-surface">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 md:grid-cols-4">
        <div>
          <span className="rounded bg-primary px-2 py-1 font-display text-lg font-extrabold text-primary-foreground">
            My<span className="text-accent">Car</span>
          </span>
          <p className="mt-4 text-sm text-muted-foreground">
            My Car Business Services LLC — independent used-vehicle dealership serving
            Fredericksburg and the surrounding Virginia counties.
          </p>
          <p className="mt-4 text-sm font-semibold">{settings?.phone}</p>
          <p className="text-sm text-muted-foreground">{settings?.address_line}</p>
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide">Shop</h3>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li><Link to="/search" className="hover:text-primary">All inventory</Link></li>
            <li><Link to="/finance" className="hover:text-primary">Financing</Link></li>
            <li><Link to="/sell" className="hover:text-primary">Sell or trade</Link></li>
            <li><Link to="/schedule" className="hover:text-primary">Book a visit</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide">Company</h3>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li><Link to="/about" className="hover:text-primary">About us</Link></li>
            <li><Link to="/blog" className="hover:text-primary">Blog</Link></li>
            <li><Link to="/contact" className="hover:text-primary">Contact</Link></li>
            <li>
              <a
                href="https://mycarcareservices.com"
                className="hover:text-primary"
                rel="noreferrer noopener"
                target="_blank"
              >
                MyCar Care Services
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide">Areas we serve</h3>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            {(areas ?? []).slice(0, 6).map((a) => (
              <li key={a.id}>
                <Link
                  to="/locations/$slug"
                  params={{ slug: a.slug }}
                  className="hover:text-primary"
                >
                  Used cars in {a.name}
                </Link>
              </li>
            ))}
          </ul>
          <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide">Hours</h3>
          <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
            <li>Mon–Fri: {hours["mon_fri"] ?? "—"}</li>
            <li>Sat: {hours["sat"] ?? "—"}</li>
            <li>Sun: {hours["sun"] ?? "—"}</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="mx-auto max-w-7xl px-4 py-6 text-xs text-muted-foreground">
          © {new Date().getFullYear()} My Car Business Services LLC. Payment figures shown on this
          site are estimates only and are not an offer of credit. Vehicle availability, pricing, and
          equipment are subject to change and must be confirmed with the dealership.
        </div>
      </div>
    </footer>
  );
}
