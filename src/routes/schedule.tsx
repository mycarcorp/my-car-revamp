import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowRight, Banknote, CalendarCheck, CarFront, Clock3, Handshake, MapPin, MessagesSquare } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LeadForm } from "@/components/LeadForm";
import { siteSettingsQuery } from "@/lib/queries";

export const Route = createFileRoute("/schedule")({
  head: () => ({
    meta: [
      {
        title: "Schedule a Test Drive in Fredericksburg, VA | My Car",
      },
      {
        name: "description",
        content:
          "Schedule a test drive at My Car in Fredericksburg, VA. Choose a vehicle, preferred date and time, or request a trade appraisal or financing consultation.",
      },
      {
        property: "og:title",
        content: "Schedule a Test Drive in Fredericksburg, VA | My Car",
      },
      {
        property: "og:description",
        content:
          "Schedule a test drive at My Car in Fredericksburg, VA. Choose a vehicle, preferred date and time, or request a trade appraisal or financing consultation.",
      },
      {
        property: "og:url",
        content: "https://mycarcorp.com/schedule",
      },
      {
        property: "og:type",
        content: "website",
      },
    ],

    links: [
      {
        rel: "canonical",
        href: "https://mycarcorp.com/schedule",
      },
    ],
  }),

  component: SchedulePage,
});

const TIMES = ["9:30 AM", "11:00 AM", "1:00 PM", "2:30 PM", "4:00 PM", "5:30 PM"];

type AppointmentType = "test_drive" | "trade_appraisal" | "financing" | "general";

const APPOINTMENT_OPTIONS: {
  value: AppointmentType;
  title: string;
  description: string;
  cta: string;
  icon: typeof CarFront;
}[] = [
  {
    value: "test_drive",
    title: "Test Drive",
    description: "Get behind the wheel of a vehicle you're interested in and experience it in person.",
    cta: "Schedule a Test Drive",
    icon: CarFront,
  },
  {
    value: "trade_appraisal",
    title: "Trade Appraisal",
    description: "Bring your current vehicle and let our team review it for a potential trade-in.",
    cta: "Book an Appraisal",
    icon: Handshake,
  },
  {
    value: "financing",
    title: "Financing Consultation",
    description: "Meet with our team to discuss available financing options for your next vehicle.",
    cta: "Discuss Financing",
    icon: Banknote,
  },
  {
    value: "general",
    title: "General Visit",
    description: "Have questions or want to browse in person? Reserve a convenient time to stop by.",
    cta: "Plan My Visit",
    icon: MessagesSquare,
  },
];

function SchedulePage() {
  const { data: settings } = useQuery(siteSettingsQuery());

  const hours = (settings?.hours ?? {}) as Record<string, string>;

  const [type, setType] = useState<AppointmentType>("test_drive");
  const [date, setDate] = useState("");
  const [time, setTime] = useState(TIMES[0]);
  const [vehicle, setVehicle] = useState("");

  const today = new Date();
  const localToday = new Date(today.getTime() - today.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);

  const scrollToForm = () => {
    document.getElementById("appointment-form")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const chooseAppointment = (appointmentType: AppointmentType) => {
    setType(appointmentType);

    window.setTimeout(() => {
      scrollToForm();
    }, 80);
  };

  const phoneHref = settings?.phone ? `tel:${String(settings.phone).replace(/\D/g, "")}` : undefined;

  return (
    <div className="min-h-screen bg-background">
      {/* HERO */}
      <section
        className="relative isolate overflow-hidden bg-slate-950 bg-cover bg-center"
        style={{
          backgroundImage:
            'linear-gradient(90deg, rgba(3,12,22,0.94) 0%, rgba(3,12,22,0.82) 46%, rgba(3,12,22,0.46) 100%), url("https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=2000&q=88")',
        }}
      >
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_82%_42%,rgba(255,255,255,0.14),transparent_32%)]" />

        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-12 lg:py-28">
          <div className="max-w-3xl">
            <p className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/90 backdrop-blur-sm">
              Visit My Car
            </p>

            <h1 className="mt-5 font-display text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Schedule a Test Drive in Fredericksburg, VA
            </h1>

            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-200 sm:text-lg">
              Ready to take the next step? Test drive a vehicle, get your trade appraised, discuss financing, or
              schedule a convenient time to visit our Fredericksburg dealership.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={scrollToForm}
                className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#F7941D] px-6 py-3 text-sm font-bold text-slate-950 shadow-[0_12px_30px_rgba(247,148,29,0.28)] transition hover:bg-[#ea8718] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                Book an Appointment
                <ArrowRight className="size-4" />
              </button>

              <Link
                to="/search"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-white/30 bg-white/10 px-6 py-3 text-sm font-bold text-white backdrop-blur-sm transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                Browse Inventory
                <CarFront className="size-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* APPOINTMENT TYPES */}
      <section className="bg-white py-14 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-12">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Choose Your Visit</p>

            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              How can we help you?
            </h2>

            <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
              Select the reason for your visit and we&apos;ll take you directly to the appointment form with your choice
              already selected.
            </p>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {APPOINTMENT_OPTIONS.map((option) => {
              const Icon = option.icon;
              const selected = type === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => chooseAppointment(option.value)}
                  className={`group flex cursor-pointer flex-col rounded-2xl border p-6 text-left shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg ${
                    selected
                      ? "border-primary bg-primary/[0.04] ring-1 ring-primary/20"
                      : "border-border bg-card hover:border-primary/40"
                  }`}
                >
                  <div
                    className={`flex size-12 items-center justify-center rounded-xl transition ${
                      selected
                        ? "bg-primary text-primary-foreground"
                        : "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground"
                    }`}
                  >
                    <Icon className="size-6" />
                  </div>

                  <h3 className="mt-5 font-display text-xl font-bold text-foreground">{option.title}</h3>

                  <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">{option.description}</p>

                  <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary">
                    {option.cta}
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="border-y border-border bg-surface py-14 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-12">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Simple & Convenient</p>

            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight">Book your visit in three easy steps</h2>
          </div>

          <div className="mt-10 grid gap-8 md:grid-cols-3">
            <div className="text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
                1
              </div>

              <h3 className="mt-4 font-display text-lg font-bold">Choose Your Visit</h3>

              <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-muted-foreground">
                Tell us whether you&apos;re coming for a test drive, trade appraisal, financing consultation or general
                visit.
              </p>
            </div>

            <div className="text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
                2
              </div>

              <h3 className="mt-4 font-display text-lg font-bold">Pick a Date & Time</h3>

              <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-muted-foreground">
                Select the date and preferred appointment time that works best for your schedule.
              </p>
            </div>

            <div className="text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
                3
              </div>

              <h3 className="mt-4 font-display text-lg font-bold">We&apos;ll Confirm</h3>

              <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-muted-foreground">
                Our team will review your request and confirm the appointment with you by phone or email.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* DEALERSHIP INFO */}
      <section className="bg-white py-14 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-12">
          <div className="grid overflow-hidden rounded-2xl border border-border bg-card shadow-sm lg:grid-cols-[1.1fr_0.9fr]">
            <div className="p-6 sm:p-8 lg:p-10">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Visit Our Dealership</p>

              <h2 className="mt-3 font-display text-3xl font-bold tracking-tight">My Car in Fredericksburg, VA</h2>

              <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
                Schedule ahead and our team can be ready for your visit, whether you&apos;re coming to see a specific
                vehicle, discuss financing or get your current vehicle appraised.
              </p>

              <div className="mt-7 space-y-4">
                {settings?.address_line && (
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <MapPin className="size-5" />
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Address</p>

                      <p className="mt-1 font-medium text-foreground">{settings.address_line}</p>
                    </div>
                  </div>
                )}

                {settings?.phone && (
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <MessagesSquare className="size-5" />
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Call Us</p>

                      <a href={phoneHref} className="mt-1 block font-semibold text-foreground hover:text-primary">
                        {settings.phone}
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-border bg-slate-950 p-6 text-white sm:p-8 lg:border-l lg:border-t-0 lg:p-10">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-white/10">
                  <Clock3 className="size-5 text-[#F7941D]" />
                </div>

                <h2 className="font-display text-xl font-bold">Showroom Hours</h2>
              </div>

              <ul className="mt-6 space-y-4 text-sm text-slate-300">
                <li className="flex items-center justify-between gap-6 border-b border-white/10 pb-3">
                  <span>Monday – Friday</span>
                  <span className="font-semibold text-white">{hours["mon_fri"] ?? "—"}</span>
                </li>

                <li className="flex items-center justify-between gap-6 border-b border-white/10 pb-3">
                  <span>Saturday</span>
                  <span className="font-semibold text-white">{hours["sat"] ?? "—"}</span>
                </li>

                <li className="flex items-center justify-between gap-6">
                  <span>Sunday</span>
                  <span className="font-semibold text-white">{hours["sun"] ?? "—"}</span>
                </li>
              </ul>

              <button
                type="button"
                onClick={scrollToForm}
                className="mt-8 inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#F7941D] px-5 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-[#ea8718]"
              >
                Book an Appointment
                <ArrowRight className="size-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* APPOINTMENT FORM */}
      <section id="appointment-form" className="scroll-mt-20 border-t border-border bg-surface py-14 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-12">
          <div className="mx-auto mb-9 max-w-3xl text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CalendarCheck className="size-6" />
            </div>

            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-primary">Reserve Your Time</p>

            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Book Your Appointment
            </h2>

            <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
              Complete the form below with your preferred visit type, date and time. Our team will contact you to
              confirm your appointment.
            </p>
          </div>

          <div className="grid items-start gap-8 lg:grid-cols-[0.72fr_1.4fr]">
            {/* FORM SIDEBAR */}
            <aside className="order-2 rounded-2xl border border-border bg-card p-6 shadow-sm lg:order-1">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Your Visit</p>

              <h3 className="mt-2 font-display text-xl font-bold">What to expect</h3>

              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Choose your appointment details and we&apos;ll prepare for your visit before you arrive.
              </p>

              <div className="mt-6 space-y-3">
                {APPOINTMENT_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  const active = type === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setType(option.value)}
                      className={`flex w-full cursor-pointer items-center gap-3 rounded-xl border p-3 text-left transition ${
                        active
                          ? "border-primary bg-primary/[0.05]"
                          : "border-border hover:border-primary/40 hover:bg-muted/40"
                      }`}
                    >
                      <div
                        className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
                          active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <Icon className="size-4" />
                      </div>

                      <div className="min-w-0">
                        <p className={`text-sm font-semibold ${active ? "text-primary" : "text-foreground"}`}>
                          {option.title}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 border-t border-border pt-5 text-sm">
                {settings?.address_line && (
                  <p className="flex items-start gap-2 text-muted-foreground">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>{settings.address_line}</span>
                  </p>
                )}

                {settings?.phone && (
                  <a
                    href={phoneHref}
                    className="mt-3 flex items-center gap-2 font-semibold text-foreground transition hover:text-primary"
                  >
                    <MessagesSquare className="size-4 text-primary" />
                    {settings.phone}
                  </a>
                )}
              </div>
            </aside>

            {/* FORM */}
            <div
              className="
                order-1 rounded-2xl border border-border bg-card p-6 shadow-sm
                lg:order-2 lg:p-8
                [&_button[type='submit']]:ml-auto
                [&_button[type='submit']]:flex
              "
            >
              <div className="mb-6 border-b border-border pb-5">
                <h3 className="font-display text-xl font-bold text-foreground">Appointment Details</h3>

                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Tell us when you&apos;d like to visit and what we should prepare for you.
                </p>
              </div>

              <LeadForm
                leadType="appointment"
                submitLabel="Request Appointment"
                successTitle="Appointment requested"
                successBody="We'll confirm your time by phone or email shortly."
                messageLabel="Anything we should prepare?"
                collectDetails={() => ({
                  appointment_type: type,
                  preferred_date: date,
                  preferred_time: time,
                  vehicle,
                })}
              >
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="appointment-type">Appointment type</Label>

                    <Select value={type} onValueChange={(value) => setType(value as AppointmentType)}>
                      <SelectTrigger id="appointment-type">
                        <SelectValue />
                      </SelectTrigger>

                      <SelectContent>
                        <SelectItem value="test_drive">Test drive</SelectItem>

                        <SelectItem value="trade_appraisal">Trade appraisal</SelectItem>

                        <SelectItem value="financing">Financing consultation</SelectItem>

                        <SelectItem value="general">General visit</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="vehicle">
                      Vehicle <span className="font-normal text-muted-foreground">(optional)</span>
                    </Label>

                    <Input
                      id="vehicle"
                      value={vehicle}
                      onChange={(event) => setVehicle(event.target.value)}
                      placeholder="Stock # or model"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="date">Preferred date</Label>

                    <Input
                      id="date"
                      type="date"
                      min={localToday}
                      value={date}
                      onChange={(event) => setDate(event.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="preferred-time">Preferred time</Label>

                    <Select value={time ?? ""} onValueChange={setTime}>
                      <SelectTrigger id="preferred-time">
                        <SelectValue />
                      </SelectTrigger>

                      <SelectContent>
                        {TIMES.map((availableTime) => (
                          <SelectItem key={availableTime} value={availableTime}>
                            {availableTime}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </LeadForm>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
