      </section>

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="grid items-stretch gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(480px,1.1fr)]">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="relative min-h-[190px] overflow-hidden sm:min-h-[220px]">
              <img
                src="https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=1200&q=85"
                alt="Cars available at MyCar in Fredericksburg"
                className="absolute inset-0 h-full w-full object-cover"
                width={1200}
                height={700}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#F9B45D]">Real people. Real help.</p>
                <h2 className="mt-1 font-display text-xl font-bold">Reach the team that works the lot</h2>
              </div>
            </div>

            <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <ContactAction
                icon={Phone}
                label="Call us"
                value={phone}
                href={`tel:${phoneHref}`}
                accent="bg-[#809C61]/15 text-[#61794A]"
              />
              <ContactAction
                icon={Mail}
                label="Email us"
                value={email}
                href={`mailto:${email}`}
                accent="bg-[#EDBA2B]/15 text-[#A87500]"
              />
              <ContactAction
                icon={MapPin}
                label="Visit us"
                value={address}
                href={mapHref}
                external
                accent="bg-[#D25B4C]/12 text-[#B44538]"
              />

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-200/70 text-slate-700">
                    <Clock3 className="size-[18px]" />
                  </span>
                  <div>
                    <p className="text-xs font-medium text-slate-500">Business hours</p>
                    <p className="mt-0.5 text-sm font-semibold text-slate-900">
                      Mon–Fri: {hours["mon_fri"] ?? "—"}
                    </p>
                  </div>
                </div>
                <div className="mt-3 space-y-1 border-t border-slate-200 pt-3 text-xs text-slate-600">
                  <p>Saturday: {hours["sat"] ?? "—"}</p>
                  <p>Sunday: {hours["sun"] ?? "—"}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-start gap-3 border-b border-slate-200 px-5 py-4 sm:px-6">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#F7941D]/15 text-[#D96F00]">
                <MessageCircle className="size-5" />
              </span>
              <div>
                <h2 className="font-display text-xl font-bold text-slate-950">Send us a message</h2>
                <p className="mt-1 text-sm text-slate-600">Tell us what you need and we&apos;ll follow up during business hours.</p>
              </div>
            </div>

            <div className="p-4 sm:p-6 [&_button[type=submit]]:h-11 [&_button[type=submit]]:w-full [&_button[type=submit]]:bg-[#F7941D] [&_button[type=submit]]:font-semibold [&_button[type=submit]]:text-black [&_button[type=submit]]:hover:bg-[#E88612] [&_input]:h-10 [&_textarea]:min-h-[96px]">
              <LeadForm
                leadType="contact"
                submitLabel="Send message"
                messageLabel="How can we help?"
                successTitle="Message sent"
                successBody="We reply during business hours, usually within a couple of hours."
              />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function ContactAction({
  icon: Icon,
  label,
  value,
  href,
  external = false,
  accent,
}: {
  icon: typeof Phone;
  label: string;
  value: string;
  href: string;
  external?: boolean;
  accent: string;
}) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      className="group flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:-translate-y-0.5 hover:border-[#F7941D]/60 hover:bg-white hover:shadow-sm"
    >
      <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${accent}`}>
        <Icon className="size-[18px]" />
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-medium text-slate-500">{label}</span>
        <span className="mt-0.5 block truncate text-sm font-semibold text-slate-900 group-hover:text-[#C96500]">
          {value}
        </span>
      </span>
    </a>
  );
}
