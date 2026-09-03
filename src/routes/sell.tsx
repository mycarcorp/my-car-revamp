import { createFileRoute } from "@tanstack/react-router";
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

export const Route = createFileRoute("/sell")({
  head: () => ({
    meta: [
      { title: "Sell or Trade Your Car in Fredericksburg, VA — MyCar" },
      {
        name: "description",
        content:
          "Send MyCar your VIN or plate, mileage and condition and our buyers respond with a real offer — usually the same business day. Trade it in or sell outright.",
      },
      { property: "og:title", content: "Sell or Trade Your Car — MyCar Fredericksburg" },
      {
        property: "og:description",
        content: "Send your VIN, mileage and condition; our buyers respond with a real offer.",
      },
    ],
  }),
  component: SellPage,
});

function SellPage() {
  const [vin, setVin] = useState("");
  const [plate, setPlate] = useState("");
  const [ymm, setYmm] = useState("");
  const [mileage, setMileage] = useState("");
  const [zip, setZip] = useState("");
  const [condition, setCondition] = useState("good");
  const [title, setTitle] = useState("clean");
  const [intent, setIntent] = useState("trade");

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="font-display text-4xl font-bold">Sell or trade your car</h1>
      <p className="mt-3 text-muted-foreground">
        We appraise every vehicle by hand rather than spitting out an algorithm number. Send the
        details below and our buyer responds with a real figure, typically the same business day.
      </p>

      <div className="mt-10 rounded-xl border border-border bg-card p-6">
        <LeadForm
          leadType="trade"
          submitLabel="Request my offer"
          successTitle="Appraisal request received"
          successBody="Our buyer will review your vehicle and respond with a number, usually within one business day."
          messageLabel="Damage, service history or anything else we should know"
          collectDetails={() => ({
            vin,
            plate,
            year_make_model: ymm,
            mileage,
            zip,
            condition,
            title_status: title,
            intent,
          })}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="vin">VIN</Label>
              <Input id="vin" value={vin} onChange={(e) => setVin(e.target.value)} placeholder="17 characters" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plate">Or license plate</Label>
              <Input id="plate" value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="VA plate" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="ymm">Or year, make, model and trim</Label>
              <Input
                id="ymm"
                value={ymm}
                onChange={(e) => setYmm(e.target.value)}
                placeholder="2019 Toyota RAV4 XLE"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mileage">Mileage</Label>
              <Input id="mileage" value={mileage} onChange={(e) => setMileage(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zip">ZIP code</Label>
              <Input id="zip" value={zip} onChange={(e) => setZip(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Condition</Label>
              <Select value={condition} onValueChange={setCondition}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="excellent">Excellent</SelectItem>
                  <SelectItem value="good">Good</SelectItem>
                  <SelectItem value="fair">Fair</SelectItem>
                  <SelectItem value="rough">Rough / not running</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Title status</Label>
              <Select value={title} onValueChange={setTitle}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="clean">Clean, in hand</SelectItem>
                  <SelectItem value="lien">Clean, lien payoff</SelectItem>
                  <SelectItem value="salvage">Salvage or rebuilt</SelectItem>
                  <SelectItem value="lost">Lost title</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>What are you looking to do?</Label>
              <Select value={intent} onValueChange={setIntent}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="trade">Trade toward a vehicle from your lot</SelectItem>
                  <SelectItem value="sell">Sell outright for cash</SelectItem>
                  <SelectItem value="undecided">Not sure yet</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </LeadForm>
      </div>
    </div>
  );
}
