import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Facebook, Instagram, Linkedin, Youtube } from "lucide-react";
import { siteSettingsQuery, serviceAreasQuery } from "@/lib/queries";
import { BrandLogo } from "@/components/BrandLogo";

export function SiteFooter() {
  const { data: settings } = useQuery(siteSettingsQuery());
  const { data: areas } = useQuery(serviceAreasQuery());
  const hours = (settings?.hours ?? {}) as Record<string, string>;

  const socialButtonClass =
    "inline-flex size-9 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";

  return (
    <footer className="mt-20 border-t border-border bg-surface">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 md:grid-cols-4">
        <div>
          <BrandLogo className="h-12 w-auto" />

          <div className="mt-4 flex items-center gap-2" aria-label="MyCar social media links">
            <a
              href="https://www.facebook.com/mycarcorporation"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="MyCar Corporation on Facebook"
              title="Facebook"
              className={socialButtonClass}
            >
              <Facebook className="size-4" aria-hidden="true" />
            </a>

            <a
              href="https://www.instagram.com/mycarcorporation/?utm_source=ig_web_button_share_sheet"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="MyCar Corporation on Instagram"
              title="Instagram"
              className={socialButtonClass}
            >
              <Instagram className="size-4" aria-hidden="true" />
            </a>

            <a
              href="https://www.youtube.com/@MyCarCorporation"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="MyCar Corporation on YouTube"
              title="YouTube"
              className={socialButtonClass}
            >
              <Youtube className="size-4" aria-hidden="true" />
            </a>

            <a
              href="https://www.tiktok.com/@mycarcorporation?is_from_webapp=1&sender_device=pc"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="MyCar Corporation on TikTok"
              title="TikTok"
              className={socialButtonClass}
            >
              <svg
                viewBox="0 0 24 24"
                className="size-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M15 3v10.5a4.5 4.5 0 1 1-4.5-4.5" />
                <path d="M15 3c.7 2.2 2.3 3.8 4.5 4.5" />
              </svg>
            </a>

            <a
              href="https://www.linkedin.com/company/108650053/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="MyCar Corporation on LinkedIn"
              title="LinkedIn"
              className={socialButtonClass}
            >
              <Linkedin className="size-4" aria-hidden="true" />
            </a>

            <a
              href="https://x.com/MyCarCorp1"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="MyCar Corporation on X"
              title="X"
              className={socialButtonClass}
            >
              <svg viewBox="0 0 24 24" className="size-3.5" fill="currentColor" aria-hidden="true">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.657l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
              </svg>
            </a>
          </div>

          <p className="mt-4 text-sm text-muted-foreground">
            My Car Business Services LLC — independent used-vehicle dealership serving Fredericksburg and the
            surrounding Virginia counties.
          </p>

          <p className="mt-4 text-sm font-semibold">{settings?.phone}</p>

          <p className="text-sm text-muted-foreground">4720 Harrison Rd, Fredericksburg, VA 22408</p>
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide">Shop</h3>

          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li>
              <Link to="/search" className="hover:text-primary">
                All inventory
              </Link>
            </li>

            <li>
              <Link to="/finance" className="hover:text-primary">
                Financing
              </Link>
            </li>

            <li>
              <Link to="/sell" className="hover:text-primary">
                Sell or trade
              </Link>
            </li>

            <li>
              <Link to="/schedule" className="hover:text-primary">
                Book a visit
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide">Company</h3>

          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li>
              <Link to="/blog" className="hover:text-primary">
                Blog
              </Link>
            </li>

            <li>
              <Link to="/contact" className="hover:text-primary">
                Contact
              </Link>
            </li>

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
            {(areas ?? []).slice(0, 6).map((area) => (
              <li key={area.id}>
                <Link to="/locations/$slug" params={{ slug: area.slug }} className="hover:text-primary">
                  Used cars in {area.name}
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
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} My Car Business Services LLC.</span>

          <nav className="flex gap-4">
            <Link to="/privacy" className="hover:text-primary">
              Privacy Policy
            </Link>

            <Link to="/terms" className="hover:text-primary">
              Terms and Conditions
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
