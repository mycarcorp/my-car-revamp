                <h2 className="font-display text-xl font-bold text-slate-950">Send us a message</h2>
                <p className="mt-1 text-sm text-slate-600">Share your question and our team will follow up.</p>
              </div>
            </div>

            <div className="p-5 sm:p-6 [&_button[type=submit]]:h-11 [&_button[type=submit]]:w-full [&_button[type=submit]]:bg-[#F7941D] [&_button[type=submit]]:font-semibold [&_button[type=submit]]:text-black [&_button[type=submit]]:hover:bg-[#E88612] [&_input]:h-10 [&_textarea]:min-h-[96px]">
              <LeadForm
                leadType="contact"
                submitLabel="Send message"
                messageLabel="How can we help?"
                successTitle="Message sent"
                successBody="We reply during business hours, usually within a couple of hours."
              />
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-4 flex items-center gap-3 px-1">
                <div className="flex size-10 items-center justify-center rounded-xl bg-slate-900 text-white">
                  <Headphones className="size-5" />
                </div>
                <div>
                  <h2 className="font-semibold text-slate-950">Contact our team</h2>
                  <p className="text-xs text-slate-500">Choose the easiest way to reach us.</p>
                </div>
              </div>

              <div className="space-y-2.5">
                <ContactCard
                  icon={Phone}
                  label="Call us"
                  value={phone}
                  href={`tel:${phoneHref}`}
                  iconClass="bg-[#809C61]/15 text-[#61794A]"
                />
                <ContactCard
                  icon={Mail}
                  label="Email us"
                  value={email}
                  href={`mailto:${email}`}
                  iconClass="bg-[#EDBA2B]/15 text-[#A87500]"
                />
                <ContactCard
                  icon={MapPin}
                  label="Visit the dealership"
                  value={address}
                  href={mapHref}
                  external
                  iconClass="bg-[#D25B4C]/12 text-[#B44538]"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                <Clock3 className="size-4 text-[#F7941D]" />
                Business hours
              </div>
              <div className="mt-4 space-y-2 text-sm">
                <HoursRow label="Monday–Friday" value={hours["mon_fri"] ?? "—"} />
                <HoursRow label="Saturday" value={hours["sat"] ?? "—"} />
                <HoursRow label="Sunday" value={hours["sun"] ?? "—"} />
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl bg-[#07111b] p-5 text-white shadow-sm">
              <div className="flex items-center gap-4">
                <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-white/10">
                  <CarFront className="size-8 text-[#F7941D]" />
                </div>
                <div>
                  <p className="font-semibold">Looking for a specific car?</p>
                  <p className="mt-1 text-xs leading-5 text-slate-300">
                    Tell us the make and model in your message and we&apos;ll check the lot.
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}

function ContactCard({
  icon: Icon,
  label,
  value,
  href,
  iconClass,
  external = false,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  href: string;
  iconClass: string;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 transition-all hover:-translate-y-0.5 hover:border-[#F7941D]/60 hover:bg-white hover:shadow-sm"
    >
      <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${iconClass}`}>
        <Icon className="size-[18px]" />
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] font-medium text-slate-500">{label}</span>
        <span className="mt-0.5 block truncate text-sm font-semibold text-slate-900 group-hover:text-[#C96500]">
          {value}
        </span>
      </span>
    </a>
  );
}

function HoursRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-2 last:border-0 last:pb-0">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-800">{value}</span>
    </div>
  );
