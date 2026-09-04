import { useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/app-client";
import { parseInventoryCsv, type ParsedCsv, type ParsedRow } from "@/lib/inventory-csv";

type Mode = "skip" | "update";

type Summary = {
  processed: number;
  added: number;
  updated: number;
  skipped: number;
  failed: { row: number; reason: string }[];
};

export function CsvImportDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onImported: () => void;
}) {
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [fileName, setFileName] = useState("");
  const [existingVins, setExistingVins] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<Mode>("skip");
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);

  function reset() {
    setParsed(null);
    setFileName("");
    setSummary(null);
    setMode("skip");
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("Please choose a .csv file.");
      return;
    }
    setSummary(null);
    setFileName(file.name);
    const text = await file.text();
    const result = parseInventoryCsv(text);
    setParsed(result);
    if (result.missingHeaders.length > 0) {
      toast.error(`Missing columns: ${result.missingHeaders.join(", ")}`);
      return;
    }
    const vins = result.rows.map((r) => r.vehicle?.vin).filter(Boolean) as string[];
    if (vins.length > 0) {
      const { data } = await supabase.from("vehicles").select("vin").in("vin", vins);
      setExistingVins(new Set((data ?? []).map((v) => v.vin)));
    } else setExistingVins(new Set());
  }

  const valid = (parsed?.rows ?? []).filter((r) => r.vehicle);
  const invalid = (parsed?.rows ?? []).filter((r) => !r.vehicle);
  const dupInFile = countDuplicateVins(valid);
  const existingCount = valid.filter((r) => existingVins.has(r.vehicle!.vin)).length;

  async function runImport() {
    if (!parsed) return;
    setBusy(true);
    const result: Summary = {
      processed: parsed.rows.length,
      added: 0,
      updated: 0,
      skipped: 0,
      failed: invalid.map((r) => ({ row: r.rowNumber, reason: r.errors.join("; ") })),
    };
    const seen = new Set<string>();

    for (const row of valid) {
      const v = row.vehicle!;
      if (seen.has(v.vin)) {
        result.skipped++;
        continue;
      }
      seen.add(v.vin);
      const exists = existingVins.has(v.vin);
      try {
        if (exists && mode === "skip") {
          result.skipped++;
          continue;
        }
        if (exists) {
          const { data, error } = await supabase
            .from("vehicles")
            .update(v)
            .eq("vin", v.vin)
            .select("id")
            .single();
          if (error) throw new Error(error.message);
          await replacePhotos(data.id, row);
          result.updated++;
        } else {
          const { data, error } = await supabase
            .from("vehicles")
            .insert(v)
            .select("id")
            .single();
          if (error) throw new Error(error.message);
          await replacePhotos(data.id, row);
          result.added++;
        }
      } catch (e) {
        result.failed.push({
          row: row.rowNumber,
          reason: e instanceof Error ? e.message : "Unknown error",
        });
      }
    }

    setSummary(result);
    setBusy(false);
    onImported();
    toast.success(`${result.added} added, ${result.updated} updated, ${result.skipped} skipped.`);
  }

  async function replacePhotos(vehicleId: string, row: ParsedRow) {
    if (row.photoUrls.length === 0) return;
    await supabase.from("vehicle_photos").delete().eq("vehicle_id", vehicleId);
    const v = row.vehicle!;
    await supabase.from("vehicle_photos").insert(
      row.photoUrls.map((url, i) => ({
        vehicle_id: vehicleId,
        url,
        position: i + 1,
        alt: `${v.year} ${v.make} ${v.model} — photo ${i + 1}`,
      })),
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import inventory from CSV</DialogTitle>
          <DialogDescription>
            Use the dealer inventory export. Rows are checked before anything is saved.
          </DialogDescription>
        </DialogHeader>

        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-border p-8 text-center hover:bg-muted/50">
          <Upload className="size-6 text-muted-foreground" />
          <span className="text-sm font-medium">{fileName || "Choose a .csv file"}</span>
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
        </label>

        {parsed && parsed.missingHeaders.length > 0 && (
          <p className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">
            This file is missing required columns: {parsed.missingHeaders.join(", ")}
          </p>
        )}

        {parsed && parsed.missingHeaders.length === 0 && !summary && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Total rows" value={parsed.rows.length} />
              <Stat label="Valid" value={valid.length} />
              <Stat label="Invalid" value={invalid.length} />
              <Stat label="Already in stock" value={existingCount + dupInFile} />
            </div>

            <div className="space-y-2">
              <Label>When a VIN already exists</Label>
              <RadioGroup value={mode} onValueChange={(v) => setMode(v as Mode)}>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="skip" id="skip" />
                  <Label htmlFor="skip" className="font-normal">
                    Skip existing vehicles
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="update" id="update" />
                  <Label htmlFor="update" className="font-normal">
                    Update existing vehicles
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="max-h-64 overflow-auto rounded-lg border border-border">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-muted text-muted-foreground">
                  <tr>
                    <th className="p-2">Row</th>
                    <th className="p-2">VIN</th>
                    <th className="p-2">Vehicle</th>
                    <th className="p-2">Price</th>
                    <th className="p-2">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {parsed.rows.map((r) => (
                    <tr key={r.rowNumber}>
                      <td className="p-2">{r.rowNumber}</td>
                      <td className="p-2 font-mono">{r.vehicle?.vin ?? "—"}</td>
                      <td className="p-2">
                        {r.vehicle
                          ? `${r.vehicle.year} ${r.vehicle.make} ${r.vehicle.model}`
                          : "—"}
                      </td>
                      <td className="p-2">
                        {r.vehicle ? `$${(r.vehicle.price_cents / 100).toLocaleString()}` : "—"}
                      </td>
                      <td className="p-2">
                        {!r.vehicle ? (
                          <span className="text-destructive">{r.errors.join("; ")}</span>
                        ) : existingVins.has(r.vehicle.vin) ? (
                          <span className="text-muted-foreground">
                            {mode === "skip" ? "Will skip" : "Will update"}
                          </span>
                        ) : (
                          <span className="text-primary">Will add</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {summary && (
          <div className="space-y-3 rounded-lg border border-border p-4 text-sm">
            <p className="font-medium">
              {summary.processed} rows processed · {summary.added} added · {summary.updated} updated
              · {summary.skipped} skipped · {summary.failed.length} failed
            </p>
            {summary.failed.length > 0 && (
              <ul className="max-h-40 space-y-1 overflow-auto text-xs text-destructive">
                {summary.failed.map((f) => (
                  <li key={f.row}>
                    Row {f.row}: {f.reason}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {summary ? "Close" : "Cancel"}
          </Button>
          {!summary && (
            <Button
              onClick={() => void runImport()}
              disabled={busy || !parsed || valid.length === 0 || parsed.missingHeaders.length > 0}
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              Import {valid.length} rows
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function countDuplicateVins(rows: ParsedRow[]): number {
  const seen = new Set<string>();
  let dupes = 0;
  for (const r of rows) {
    const vin = r.vehicle!.vin;
    if (seen.has(vin)) dupes++;
    else seen.add(vin);
  }
  return dupes;
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-display text-xl font-bold">{value}</p>
    </div>
  );
}
