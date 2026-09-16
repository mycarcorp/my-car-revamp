import { useEffect, useMemo, useState } from "react";
import { GripVertical, ImagePlus, Loader2, Plus, Trash2, Upload } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/app-client";
import { useAuth } from "@/hooks/useAuth";
import type { Database } from "@/integrations/supabase/types";
import { MAX_PHOTOS, MAX_PHOTO_BYTES, type PhotoDraft, type Vehicle, type VehiclePhoto } from "@/lib/admin-inventory";
import { VIN_RE, vehicleSlug } from "@/lib/inventory-csv";
import { saveLegacyInventoryRow } from "@/lib/legacy-inventory.functions";
import { saveVehiclePhotosFn, type PhotoOrderInput } from "@/lib/vehicle-photos.functions";
import { decodeVin, type VinDecodedVehicle } from "@/lib/vin-decoder.functions";

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the selected image."));
    reader.readAsDataURL(file);
  });
}

type BodyStyle = Database["public"]["Enums"]["body_style"];
type FuelType = Database["public"]["Enums"]["fuel_type"];
type Drivetrain = Database["public"]["Enums"]["drivetrain"];
type VehicleStatus = Database["public"]["Enums"]["vehicle_status"];

export const BODY_STYLES: BodyStyle[] = [
  "SUV",
  "Sedan",
  "Truck",
  "Coupe",
  "Hatchback",
  "Convertible",
  "Minivan",
  "Wagon",
  "Van",
];
export const FUEL_TYPES: FuelType[] = ["Gas", "Electric", "Hybrid", "Plug-in Hybrid", "Diesel"];
export const DRIVETRAINS: Drivetrain[] = ["AWD/4WD", "FWD", "RWD"];
export const STATUSES: VehicleStatus[] = ["available", "pending", "sold", "draft"];

type FormState = {
  vin: string;
  stock_number: string;
  year: string;
  make: string;
  model: string;
  trim: string;
  body_style: BodyStyle;
  mileage: string;
  price: string;
  exterior_color: string;
  interior_color: string;
  transmission: string;
  engine: string;
  fuel_type: string;
  drivetrain: string;
  mpg_combined: string;
  description: string;
  features: string;
  status: VehicleStatus;
  is_featured: boolean;
  slug: string;
};

const empty: FormState = {
  vin: "",
  stock_number: "",
  year: String(new Date().getFullYear()),
  make: "",
  model: "",
  trim: "",
  body_style: "SUV",
  mileage: "",
  price: "",
  exterior_color: "",
  interior_color: "",
  transmission: "",
  engine: "",
  fuel_type: "none",
  drivetrain: "none",
  mpg_combined: "",
  description: "",
  features: "",
  status: "available",
  is_featured: false,
  slug: "",
};

function applyDecodedVehicle(form: FormState, decoded: VinDecodedVehicle): FormState {
  const body = BODY_STYLES.find((option) => decoded.bodyStyle?.toLowerCase().includes(option.toLowerCase()));
  const fuelText = decoded.fuelType?.toLowerCase() ?? "";
  const fuel =
    fuelText.includes("plug-in") || fuelText.includes("plug in")
      ? "Plug-in Hybrid"
      : FUEL_TYPES.find((option) => fuelText.includes(option.toLowerCase()));
  const drivetrain =
    decoded.drivetrain?.toLowerCase().includes("all") || decoded.drivetrain?.toLowerCase().includes("4wd")
      ? "AWD/4WD"
      : decoded.drivetrain?.toLowerCase().includes("rear")
        ? "RWD"
        : decoded.drivetrain?.toLowerCase().includes("front")
          ? "FWD"
          : undefined;

  return {
    ...form,
    vin: decoded.vin,
    year: decoded.year ? String(decoded.year) : form.year,
    make: decoded.make ?? form.make,
    model: decoded.model ?? form.model,
    trim: decoded.trim ?? form.trim,
    body_style: body ?? form.body_style,
    fuel_type: fuel ?? form.fuel_type,
    drivetrain: drivetrain ?? form.drivetrain,
    transmission: decoded.transmission ?? form.transmission,
    engine: decoded.engine ?? form.engine,
  };
}

function fromVehicle(v: Vehicle): FormState {
  return {
    vin: v.vin,
    stock_number: v.stock_number,
    year: String(v.year),
    make: v.make,
    model: v.model,
    trim: v.trim ?? "",
    body_style: v.body_style,
    mileage: String(v.mileage),
    price: (Number(v.price_cents) / 100).toFixed(2),
    exterior_color: v.exterior_color ?? "",
    interior_color: v.interior_color ?? "",
    transmission: v.transmission ?? "",
    engine: v.engine ?? "",
    fuel_type: v.fuel_type ?? "none",
    drivetrain: v.drivetrain ?? "none",
    mpg_combined: v.mpg_combined === null ? "" : String(v.mpg_combined),
    description: v.description ?? "",
    features: (v.features ?? []).join("\n"),
    status: v.status,
    is_featured: v.is_featured,
    slug: v.slug,
  };
}

export function VehicleFormDialog({
  open,
  onOpenChange,
  vehicle,
  onSaved,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  vehicle: Vehicle | null;
  onSaved: () => void;
  onDelete?: () => void;
}) {
  const { session } = useAuth();
  const [form, setForm] = useState<FormState>(empty);
  const [photos, setPhotos] = useState<PhotoDraft[]>([]);
  const [existing, setExisting] = useState<VehiclePhoto[]>([]);
  const [saving, setSaving] = useState(false);
  const [decoding, setDecoding] = useState(false);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [draggedPhotoIndex, setDraggedPhotoIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(vehicle ? fromVehicle(vehicle) : empty);
    setPhotos((current) => {
      current.forEach((photo) => {
        if (photo.kind === "new") URL.revokeObjectURL(photo.previewUrl);
      });
      return [];
    });
    setExisting([]);
    setIsDraggingFiles(false);
    setDraggedPhotoIndex(null);
    if (!vehicle) return;
    void (async () => {
      const { data } = await supabase.from("vehicle_photos").select("*").eq("vehicle_id", vehicle.id).order("position");
      setExisting(data ?? []);
      setPhotos((data ?? []).map((p) => ({ kind: "existing" as const, id: p.id, url: p.url, alt: p.alt })));
    })();
  }, [open, vehicle]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const title = useMemo(
    () => `${form.year} ${form.make} ${form.model} ${form.trim}`.trim(),
    [form.year, form.make, form.model, form.trim],
  );

  function addFiles(list: FileList | File[] | null) {
    if (!list) return;
    const room = MAX_PHOTOS - photos.length;
    const files = Array.from(list)
      .filter((f) => ["image/jpeg", "image/png", "image/webp"].includes(f.type) && f.size <= MAX_PHOTO_BYTES)
      .slice(0, Math.max(0, room));
    if (files.length < list.length) {
      toast.warning(`Use JPG, PNG, or WebP files under 10 MB. Up to ${MAX_PHOTOS} photos per vehicle.`);
    }
    setPhotos((p) => [
      ...p,
      ...files.map((file) => ({
        kind: "new" as const,
        file,
        previewUrl: URL.createObjectURL(file),
      })),
    ]);
  }

  function removePhoto(index: number) {
    setPhotos((current) => {
      const photo = current[index];
      if (photo?.kind === "new") URL.revokeObjectURL(photo.previewUrl);
      return current.filter((_, photoIndex) => photoIndex !== index);
    });
  }

  function moveTo(from: number, to: number) {
    setPhotos((current) => {
      if (from === to || from < 0 || to < 0 || from >= current.length || to >= current.length) {
        return current;
      }

      const next = [...current];
      const [moved] = next.splice(from, 1);
      if (!moved) return current;
      next.splice(to, 0, moved);
      return next;
    });
  }

  function move(index: number, delta: number) {
    setPhotos((p) => {
      const next = [...p];
      const target = index + delta;
      if (target < 0 || target >= next.length) return p;
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  }

  async function decodeCurrentVin() {
    const vin = form.vin.replace(/\s+/g, "").toUpperCase();
    if (!VIN_RE.test(vin)) {
      toast.error("Enter a valid 17-character VIN first.");
      return;
    }
    if (!session?.access_token) {
      toast.error("Your session has expired. Please sign in again.");
      return;
    }
    setDecoding(true);
    try {
      const decoded = await decodeVin({ data: { accessToken: session.access_token, vin } });
      setForm((current) => applyDecodedVehicle(current, decoded));
      toast.success("VIN decoded. Review the details before saving.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not decode this VIN.");
    } finally {
      setDecoding(false);
    }
  }

  async function submit() {
    const vin = form.vin.trim().toUpperCase();
    if (!VIN_RE.test(vin)) {
      toast.error("Enter a valid 17-character VIN.");
      return;
    }
    const year = Number(form.year);
    const mileage = Number(form.mileage);
    const price = Number(form.price);
    if (!form.make.trim() || !form.model.trim()) {
      toast.error("Make and model are required.");
      return;
    }
    if (!Number.isFinite(year) || year < 1900) {
      toast.error("Enter a valid year.");
      return;
    }
    if (!Number.isFinite(mileage) || mileage < 0) {
      toast.error("Enter a valid mileage.");
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      toast.error("Enter a valid price.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        vin,
        stock_number: form.stock_number.trim() || vin.slice(-8),
        year,
        make: form.make.trim(),
        model: form.model.trim(),
        trim: form.trim.trim() || null,
        body_style: form.body_style,
        mileage,
        price_cents: Math.round(price * 100),
        exterior_color: form.exterior_color.trim() || null,
        interior_color: form.interior_color.trim() || null,
        transmission: form.transmission.trim() || null,
        engine: form.engine.trim() || null,
        fuel_type: form.fuel_type === "none" ? null : (form.fuel_type as FuelType),
        drivetrain: form.drivetrain === "none" ? null : (form.drivetrain as Drivetrain),
        mpg_combined: form.mpg_combined ? Number(form.mpg_combined) : null,
        description: form.description.trim() || null,
        features: form.features
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        status: form.status,
        is_featured: form.is_featured,
        slug: form.slug.trim() || vehicleSlug({ year, make: form.make, model: form.model, trim: form.trim, vin }),
      };

      if (!session?.access_token) throw new Error("Your session has expired. Please sign in again.");
      const saved = (await saveLegacyInventoryRow({
        data: { accessToken: session.access_token, vehicle: payload },
      })) as unknown as Vehicle;

      const newPhotos: Array<{ dataUrl: string; contentType?: string }> = [];
      const order: PhotoOrderInput[] = [];
      for (const p of photos) {
        if (p.kind === "existing") {
          order.push({ kind: "keep", url: p.url });
        } else {
          order.push({ kind: "new", index: newPhotos.length });
          newPhotos.push({ dataUrl: await fileToDataUrl(p.file), contentType: p.file.type });
        }
      }
      await saveVehiclePhotosFn({
        data: {
          accessToken: session.access_token,
          vin,
          altBase: title,
          order,
          newPhotos,
        },
      });
      toast.success(vehicle ? "Vehicle updated." : "Vehicle added.");
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save this vehicle.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{vehicle ? "Edit vehicle" : "Add vehicle"}</DialogTitle>
          <DialogDescription>
            New vehicles start as drafts. Details appear on public inventory only when published as available.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="VIN">
            <div className="flex gap-2">
              <Input
                value={form.vin}
                onChange={(e) => set("vin", e.target.value.replace(/\s+/g, "").toUpperCase())}
                maxLength={17}
                className="min-w-0 flex-1"
              />
              <Button type="button" variant="outline" onClick={() => void decodeCurrentVin()} disabled={decoding}>
                {decoding ? <Loader2 className="size-4 animate-spin" /> : "Decode"}
              </Button>
            </div>
          </Field>
          <Field label="Stock number">
            <Input value={form.stock_number} onChange={(e) => set("stock_number", e.target.value)} />
          </Field>
          <Field label="Year">
            <Input type="number" value={form.year} onChange={(e) => set("year", e.target.value)} />
          </Field>
          <Field label="Make">
            <Input value={form.make} onChange={(e) => set("make", e.target.value)} />
          </Field>
          <Field label="Model">
            <Input value={form.model} onChange={(e) => set("model", e.target.value)} />
          </Field>
          <Field label="Trim">
            <Input value={form.trim} onChange={(e) => set("trim", e.target.value)} />
          </Field>
          <Field label="Body style">
            <Choice value={form.body_style} options={BODY_STYLES} onChange={(v) => set("body_style", v as BodyStyle)} />
          </Field>
          <Field label="Mileage">
            <Input type="number" value={form.mileage} onChange={(e) => set("mileage", e.target.value)} />
          </Field>
          <Field label="Price (USD)">
            <Input type="number" step="0.01" value={form.price} onChange={(e) => set("price", e.target.value)} />
          </Field>
          <Field label="Status">
            <Choice value={form.status} options={STATUSES} onChange={(v) => set("status", v as VehicleStatus)} />
          </Field>
          <Field label="Fuel type">
            <Choice value={form.fuel_type} options={FUEL_TYPES} allowNone onChange={(v) => set("fuel_type", v)} />
          </Field>
          <Field label="Drivetrain">
            <Choice value={form.drivetrain} options={DRIVETRAINS} allowNone onChange={(v) => set("drivetrain", v)} />
          </Field>
          <Field label="Transmission">
            <Input value={form.transmission} onChange={(e) => set("transmission", e.target.value)} />
          </Field>
          <Field label="Engine">
            <Input value={form.engine} onChange={(e) => set("engine", e.target.value)} />
          </Field>
          <Field label="Exterior color">
            <Input value={form.exterior_color} onChange={(e) => set("exterior_color", e.target.value)} />
          </Field>
          <Field label="Interior color">
            <Input value={form.interior_color} onChange={(e) => set("interior_color", e.target.value)} />
          </Field>
          <Field label="Combined MPG">
            <Input type="number" value={form.mpg_combined} onChange={(e) => set("mpg_combined", e.target.value)} />
          </Field>
          <Field label="URL slug">
            <Input value={form.slug} placeholder="auto-generated" onChange={(e) => set("slug", e.target.value)} />
          </Field>
        </div>

        <Field label="Description">
          <Textarea rows={4} value={form.description} onChange={(e) => set("description", e.target.value)} />
        </Field>
        <Field label="Features (one per line)">
          <Textarea rows={3} value={form.features} onChange={(e) => set("features", e.target.value)} />
        </Field>

        <div className="flex items-center gap-3">
          <Switch id="featured" checked={form.is_featured} onCheckedChange={(v) => set("is_featured", v)} />
          <Label htmlFor="featured">Feature this vehicle on the homepage</Label>
        </div>

        <div className="space-y-3 rounded-lg border border-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Photos</p>
              <p className="text-xs text-muted-foreground">Up to {MAX_PHOTOS}. The first photo is the main image.</p>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted">
              <Upload className="size-4" />
              Add photos
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          <div
            role="button"
            tabIndex={0}
            aria-label="Drop vehicle photos here or click to browse"
            onDragEnter={(event) => {
              if (!event.dataTransfer.types.includes("Files")) return;
              event.preventDefault();
              event.stopPropagation();
              setIsDraggingFiles(true);
            }}
            onDragOver={(event) => {
              if (!event.dataTransfer.types.includes("Files")) return;
              event.preventDefault();
              event.stopPropagation();
              event.dataTransfer.dropEffect = "copy";
              setIsDraggingFiles(true);
            }}
            onDragLeave={(event) => {
              if (!event.dataTransfer.types.includes("Files")) return;
              event.preventDefault();
              event.stopPropagation();
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                setIsDraggingFiles(false);
              }
            }}
            onDrop={(event) => {
              if (!event.dataTransfer.types.includes("Files")) return;
              event.preventDefault();
              event.stopPropagation();
              setIsDraggingFiles(false);
              addFiles(event.dataTransfer.files);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                document.getElementById("vehicle-photo-upload")?.click();
              }
            }}
            onClick={() => document.getElementById("vehicle-photo-upload")?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors ${
              isDraggingFiles
                ? "border-[#F7941D] bg-[#F7941D]/10"
                : "border-border bg-muted/30 hover:border-[#F7941D]/60 hover:bg-muted/50"
            }`}
          >
            <ImagePlus className={`mb-2 size-8 ${isDraggingFiles ? "text-[#F7941D]" : "text-muted-foreground"}`} />
            <p className="text-sm font-semibold text-foreground">
              {isDraggingFiles ? "Drop photos here" : "Drag and drop vehicle photos"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">or click to browse JPG, PNG, or WebP files under 10 MB</p>
            <input
              id="vehicle-photo-upload"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={(event) => {
                addFiles(event.target.files);
                event.target.value = "";
              }}
            />
          </div>

          {photos.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground">No photos yet.</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-3">
              {photos.map((p, i) => (
                <li
                  key={p.kind === "existing" ? p.id : p.previewUrl}
                  draggable
                  onDragStart={(event) => {
                    setDraggedPhotoIndex(i);
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", String(i));
                  }}
                  onDragOver={(event) => {
                    if (draggedPhotoIndex === null) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                  }}
                  onDrop={(event) => {
                    if (draggedPhotoIndex === null) return;
                    event.preventDefault();
                    event.stopPropagation();
                    moveTo(draggedPhotoIndex, i);
                    setDraggedPhotoIndex(null);
                  }}
                  onDragEnd={() => setDraggedPhotoIndex(null)}
                  className={`overflow-hidden rounded-md border bg-background transition ${
                    draggedPhotoIndex === i ? "scale-[0.98] border-[#F7941D] opacity-60" : "border-border"
                  }`}
                >
                  <img
                    src={p.kind === "existing" ? p.url : p.previewUrl}
                    alt={`Photo ${i + 1}`}
                    className="h-24 w-full object-cover"
                  />
                  <div className="flex items-center justify-between gap-1 p-1">
                    <span className="flex items-center gap-1 pl-1 text-xs text-muted-foreground">
                      <GripVertical className="size-3" />#{i + 1}
                      {i === 0 ? " · Main" : ""}
                    </span>
                    <div className="flex">
                      <Button size="icon" variant="ghost" onClick={() => move(i, -1)} aria-label="Move earlier">
                        <GripVertical className="size-3 rotate-180" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => move(i, 1)} aria-label="Move later">
                        <GripVertical className="size-3" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => removePhoto(i)} aria-label="Remove photo">
                        <Trash2 className="size-3 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter className="grid grid-cols-3 items-center">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          {vehicle && onDelete ? (
            <Button
              type="button"
              variant="ghost"
              className="justify-self-center text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={onDelete}
              disabled={saving}
            >
              <Trash2 className="size-4" />
              Delete
            </Button>
          ) : (
            <span />
          )}
          <Button onClick={() => void submit()} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            {vehicle ? "Save changes" : "Add vehicle"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Choice({
  value,
  options,
  onChange,
  allowNone,
}: {
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
  allowNone?: boolean;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {allowNone && <SelectItem value="none">Not specified</SelectItem>}
        {options.map((o) => (
          <SelectItem key={o} value={o} className="capitalize">
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
