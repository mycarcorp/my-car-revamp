import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LeadForm } from "@/components/LeadForm";
import { siteSettingsQuery } from "@/lib/queries";

export const Route = createFileRoute("/schedule")({
  head: () => ({
    meta: [
      {
        title: "Book a Test Drive or Appraisal — MyCar Fredericksburg, VA",
      },
      {
        name: "description",
        content:
          "Reserve a time at MyCar in Fredericksburg for a test drive, trade appraisal or financing consultation. Pick a day and time that works for you.",
      },
      {
        property: "og:title",
        content: "Book a Visit — MyCar Fredericksburg",
      },
      {
        property: "og:description",
        content: "Reserve a test drive, trade appraisal or financing consultation.",
      },
    ],
  }),
  component: SchedulePage,
});

const TIMES = ["9:30 AM", "11:00 AM", "1:00 PM", "2:30 PM", "4:00 PM", "5:30 PM"];

function SchedulePage() {
  const { data: settings } = useQuery(siteSettingsQuery());
  const hours = (settings?.hours ?? {}) as Record<string, string>;

  const [type, setType] = useState("test_drive");
  const [date, setDate] = useState("");
  const [time, setTime] = useState(TIMES[0]);
  const [vehicle, setVehicle] = useState("");

  return (
    <div className="min-h-screen bg-surface">
      <div className="mx-auto grid max-w-6xl items-start gap-8 px-4 py-12 lg:grid-cols-[0.75fr_1.4fr] lg:px-12">
        {/* Showroom information — left side */}
        <aside className="order-2 rounded-xl border border-border bg-card p-6 text-sm shadow-sm lg:order-1">
          <h2 className="font-display text-lg font-bold">Showroom hours</h2>

          <ul className="mt-4 space-y-2 text-muted-foreground">
            <li className="flex items-center justify-between gap-4">
              <span>Mon–Fri</span>
              <span className="font-medium text-foreground">{hours["mon_fri"] ?? "—"}</span>
            </li>

            <li className="flex items-center justify-between gap-4">
              <span>Saturday</span>
              <span className="font-medium text-foreground">{hours["sat"] ?? "—"}</span>
            </li>

            <li className="flex items-center justify-between gap-4">
              <span>Sunday</span>
              <span className="font-medium text-foreground">{hours["sun"] ?? "—"}</span>
            </li>
          </ul>

          <div className="mt-6 border-t border-border pt-5">
            <p className="text-muted-foreground">{settings?.address_line}</p>

            <p className="mt-2 font-semibold text-foreground">{settings?.phone}</p>
          </div>
        </aside>

        {/* Appointment form — right side */}
        <div
          className="
            order-1 rounded-xl border border-border bg-card p-6 shadow-sm
            lg:order-2 lg:p-8
            [&_button[type='submit']]:ml-auto
            [&_button[type='submit']]:flex
          "
        >
          <LeadForm
            leadType="appointment"
            submitLabel="Request appointment"
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

                <Select value={type} onValueChange={setType}>
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

                <Input id="date" type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
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
  );
}
