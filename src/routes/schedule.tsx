import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LeadForm } from "@/components/LeadForm";
import { PageHero } from "@/components/PageHero";
import { siteSettingsQuery } from "@/lib/queries";

export const Route = createFileRoute("/schedule")({
  head: () => ({
    meta: [
      { title: "Book a Test Drive or Appraisal — MyCar Fredericksburg, VA" },
      {
        name: "description",
        content:
          "Reserve a time at MyCar in Fredericksburg for a test drive, trade appraisal or financing consultation. Pick a day and time that works for you.",
      },
      { property: "og:title", content: "Book a Visit — MyCar Fredericksburg" },
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
    <div className="bg-surface">
      
     
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Appointment type</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="test_drive">Test drive</SelectItem>
                    <SelectItem value="trade_appraisal">Trade appraisal</SelectItem>
                    <SelectItem value="financing">Financing consultation</SelectItem>
                    <SelectItem value="general">General visit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="vehicle">Vehicle (optional)</Label>
                <Input
                  id="vehicle"
                  value={vehicle}
                  onChange={(e) => setVehicle(e.target.value)}
                  placeholder="Stock # or model"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Preferred date</Label>
                <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Preferred time</Label>
                <Select value={time ?? ""} onValueChange={setTime}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIMES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </LeadForm>
        </div>

        <aside className="rounded-xl border border-border bg-surface p-6 text-sm">
          <h2 className="font-display text-lg font-bold">Showroom hours</h2>
          <ul className="mt-3 space-y-1 text-muted-foreground">
            <li>Mon–Fri: {hours["mon_fri"] ?? "—"}</li>
            <li>Saturday: {hours["sat"] ?? "—"}</li>
            <li>Sunday: {hours["sun"] ?? "—"}</li>
          </ul>
          <p className="mt-4 text-muted-foreground">{settings?.address_line}</p>
          <p className="mt-1 font-semibold text-foreground">{settings?.phone}</p>
        </aside>
      </div>
    </div>
  );
}
