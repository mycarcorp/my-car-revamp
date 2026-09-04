import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LeadForm } from "@/components/LeadForm";
import { siteSettingsQuery } from "@/lib/queries";
import { monthlyPayment } from "@/lib/format";

export const Route = createFileRoute("/finance")({
  head: () => ({
    meta: [
      { title: "Car Financing in Fredericksburg, VA — MyCar" },
      {
        name: "description",
        content:
          "Start a financing request with MyCar in Fredericksburg, VA. Share your budget and our finance team matches you with lenders. No credit pull to submit.",
      },
      { property: "og:title", content: "Car Financing — MyCar Fredericksburg" },
      {
        property: "og:description",
        content: "Share your budget and our finance team matches you with lenders. No credit pull.",
      },
    ],
  }),
  component: FinancePage,
});

function FinancePage() {
  const { data: settings } = useQuery(siteSettingsQuery());
  const [employment, setEmployment] = useState("employed");
  const [income, setIncome] = useState("3000-5000");
  const [desired, setDesired] = useState("");
  const [interest, setInterest] = useState("");

  const [price, setPrice] = useState(22000);
  const [down, setDown] = useState(2000);
  const [term, setTerm] = useState(72);
  const apr = Number(settings?.finance_apr ?? 8.9);
  const estimate = monthlyPayment(price * 100, {
    apr,
    termMonths: term,
    downPercent: price > 0 ? (down / price) * 100 : 0,
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="font-display text-4xl font-bold">Financing</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Tell us what fits your budget and our finance team lines up lenders for your situation.
        Submitting this form is a request for help — it is not a credit application and no credit
        bureau is contacted.
      </p>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_380px]">
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="font-display text-xl font-bold">Start your request</h2>
          <div className="mt-6">
            <LeadForm
              leadType="finance"
              submitLabel="Send finance request"
              successTitle="Finance request received"
              successBody="Our finance manager will call to walk through options and next steps."
              messageLabel="Anything else we should know?"
              collectDetails={() => ({
                employment,
                income_band: income,
                desired_payment: desired,
                vehicle_of_interest: interest,
                vehicle_price: price,
                down_payment: down,
                loan_term: term,
                apr,
              })}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Employment status</Label>
                  <Select value={employment} onValueChange={setEmployment}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="employed">Employed</SelectItem>
                      <SelectItem value="self-employed">Self-employed</SelectItem>
                      <SelectItem value="retired">Retired</SelectItem>
                      <SelectItem value="military">Active military</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Monthly income</Label>
                  <Select value={income} onValueChange={setIncome}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="under-2000">Under $2,000</SelectItem>
                      <SelectItem value="2000-3000">$2,000 – $3,000</SelectItem>
                      <SelectItem value="3000-5000">$3,000 – $5,000</SelectItem>
                      <SelectItem value="5000-8000">$5,000 – $8,000</SelectItem>
                      <SelectItem value="8000-plus">$8,000+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="desired">Target monthly payment</Label>
                  <Input
                    id="desired"
                    value={desired}
                    onChange={(e) => setDesired(e.target.value)}
                    placeholder="$450"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="interest">Vehicle of interest</Label>
                  <Input
                    id="interest"
                    value={interest}
                    onChange={(e) => setInterest(e.target.value)}
                    placeholder="Stock # or model"
                  />
                </div>
              </div>
            </LeadForm>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-xl border border-border bg-surface p-6">
            <h2 className="font-display text-lg font-bold">Payment estimator</h2>
            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="price">Vehicle price</Label>
                <Input
                  id="price"
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="down">Down payment</Label>
                <Input
                  id="down"
                  type="number"
                  value={down}
                  onChange={(e) => setDown(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>Term</Label>
                <Select value={String(term)} onValueChange={(v) => setTerm(Number(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[36, 48, 60, 72, 84].map((t) => (
                      <SelectItem key={t} value={String(t)}>
                        {t} months
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="mt-5 font-display text-3xl font-extrabold text-primary">${estimate}/mo</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Based on {apr}% APR. {settings?.finance_disclosure}
            </p>
          </div>

          <div className="rounded-xl border border-border p-6 text-sm text-muted-foreground">
            <h3 className="font-semibold text-foreground">What happens next</h3>
            <ol className="mt-3 list-decimal space-y-2 pl-4">
              <li>We review your request and call to confirm details.</li>
              <li>Our finance manager submits you to the lenders that fit your profile.</li>
              <li>You complete the full credit application with us in person or by secure link.</li>
            </ol>
          </div>
        </aside>
      </div>
    </div>
  );
}
