import { useEffect, useMemo, useRef, useState } from "react";
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
import { ALLOWED_VIDEO_TYPES, MAX_VIDEOS, MAX_VIDEO_BYTES, isVideoUrl } from "@/lib/vehicle-media";

import { VIN_RE, vehicleSlug } from "@/lib/inventory-csv";
import { saveLegacyInventoryRow } from "@/lib/legacy-inventory.functions";
import { createMediaUploadFn, saveVehiclePhotosFn, type PhotoOrderInput } from "@/lib/vehicle-photos.functions";
import { decodeVin, type VinDecodedVehicle } from "@/lib/vin-decoder.functions";

const VIN_CACHE_PREFIX = "vehicle-vin-decode:v3:";
const VIN_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const VIN_DECODE_TIMEOUT_MS = 15_000;
const MAX_CONCURRENT_UPLOADS = 3;

type CachedVin = { savedAt: number; value: VinDecodedVehicle };
const vinMemoryCache = new Map<string, VinDecodedVehicle>();

function getCachedVin(vin: string): VinDecodedVehicle | null {
  const memoryValue = vinMemoryCache.get(vin);
  if (memoryValue) return memoryValue;

  try {
    const raw = localStorage.getItem(`${VIN_CACHE_PREFIX}${vin}`);
    if (!raw) return null;
    const cached = JSON.parse(raw) as CachedVin;
    if (!cached?.savedAt || Date.now() - cached.savedAt > VIN_CACHE_TTL_MS) {
      localStorage.removeItem(`${VIN_CACHE_PREFIX}${vin}`);
      return null;
    }
    if (cached.value) vinMemoryCache.set(vin, cached.value);
    return cached.value ?? null;
  } catch {
    return null;
  }
}

function cacheVin(vin: string, value: VinDecodedVehicle) {
  vinMemoryCache.set(vin, value);
  try {
    localStorage.setItem(
      `${VIN_CACHE_PREFIX}${vin}`,
      JSON.stringify({ savedAt: Date.now(), value } satisfies CachedVin),
    );
  } catch {
    // Decoding still works if browser storage is unavailable.
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  async function runWorker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index]!, index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => runWorker()));
  return results;
}

function isVideoDraft(draft: PhotoDraft): boolean {
  return draft.kind === "new" ? draft.file.type.startsWith("video/") : isVideoUrl(draft.url);
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

function matchBodyStyle(text: string | undefined, doors: string | undefined): BodyStyle | undefined {
  const t = (text ?? "").toLowerCase();
  if (!t) return undefined;
  if (t.includes("convertible") || t.includes("cabriolet") || t.includes("roadster")) return "Convertible";
  if (t.includes("pickup") || t.includes("truck")) return "Truck";
  if (t.includes("minivan")) return "Minivan";
  if (t.includes("van")) return "Van";
  if (t.includes("wagon") || t.includes("estate")) return "Wagon";
  if (t.includes("hatchback") || t.includes("liftback")) return "Hatchback";
  if (t.includes("coupe")) return "Coupe";
  if (t.includes("sport utility") || t.includes("suv") || t.includes("crossover")) return "SUV";
  if (t.includes("sedan") || t.includes("saloon")) return "Sedan";
  if (doors === "2") return "Coupe";
  return BODY_STYLES.find((option) => t.includes(option.toLowerCase()));
}

function applyDecodedVehicle(form: FormState, decoded: VinDecodedVehicle): FormState {
  const body = matchBodyStyle(decoded.bodyStyle ?? decoded.vehicleType, decoded.doors);
  const fuelText =
    `${decoded.electrification ?? ""} ${decoded.fuelType ?? ""} ${decoded.fuelTypeSecondary ?? ""}`.toLowerCase();
  const fuel =
    fuelText.includes("plug-in") || fuelText.includes("plug in")
      ? "Plug-in Hybrid"
      : fuelText.includes("hybrid")
        ? "Hybrid"
        : fuelText.includes("electric") && !fuelText.includes("gas")
          ? "Electric"
          : fuelText.includes("diesel")
            ? "Diesel"
            : fuelText.includes("gasoline") || fuelText.includes("petrol") || fuelText.includes("flexible")
              ? "Gas"
              : FUEL_TYPES.find((option) => fuelText.includes(option.toLowerCase()));
  const dt = decoded.drivetrain?.toLowerCase() ?? "";
  const drivetrain =
    dt.includes("all") || dt.includes("4wd") || dt.includes("4x4")
      ? "AWD/4WD"
      : dt.includes("rear")
        ? "RWD"
        : dt.includes("front")
          ? "FWD"
          : undefined;

  const extraFeatures = [
    decoded.doors ? `${decoded.doors} doors` : null,
    decoded.seats ? `${decoded.seats} seats` : null,
    decoded.mpgCity && decoded.mpgHighway ? `${decoded.mpgCity} city / ${decoded.mpgHighway} hwy MPG` : null,
  ].filter((v): v is string => Boolean(v));
  const decodedFeatures = [...decoded.features, ...extraFeatures];
  const existingFeatures = form.features
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const mergedFeatures = Array.from(new Set([...existingFeatures, ...decodedFeatures]));

  const year = decoded.year ? String(decoded.year) : form.year;
  const make = decoded.make ?? form.make;
  const model = decoded.model ?? form.model;
  const trim = decoded.trim ?? form.trim;

  return {
    ...form,
    vin: decoded.vin,
    stock_number: form.stock_number.trim() || decoded.vin.slice(-8),
    year,
    make,
    model,
    trim,
    body_style: body ?? form.body_style,
    fuel_type: fuel ?? form.fuel_type,
    drivetrain: drivetrain ?? form.drivetrain,
    transmission: decoded.transmission ?? form.transmission,
    engine: decoded.engine ?? form.engine,
    mpg_combined: decoded.mpgCombined ? String(decoded.mpgCombined) : form.mpg_combined,
    description: decoded.description || form.description.trim() || "",
    features: mergedFeatures.join("\n"),
    slug: form.slug.trim() || vehicleSlug({ year: Number(year), make, model, trim, vin: decoded.vin }),
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
  const [uploadLabel, setUploadLabel] = useState<string | null>(null);
  const [decoding, setDecoding] = useState(false);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [draggedPhotoIndex, setDraggedPhotoIndex] = useState<number | null>(null);
  const decodeRequestId = useRef(0);

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
    setUploadLabel(null);
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
    const incoming = Array.from(list);
    let photoRoom = MAX_PHOTOS - photos.filter((p) => !isVideoDraft(p)).length;
    let videoRoom = MAX_VIDEOS - photos.filter((p) => isVideoDraft(p)).length;
    const accepted: File[] = [];
    let rejected = 0;

    for (const file of incoming) {
      const isVideo = file.type.startsWith("video/");
      if (isVideo) {
        if (!ALLOWED_VIDEO_TYPES.includes(file.type) || file.size > MAX_VIDEO_BYTES || videoRoom <= 0) {
          rejected++;
          continue;
        }
        videoRoom--;
      } else {
        if (
          !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
          file.size > MAX_PHOTO_BYTES ||
          photoRoom <= 0
        ) {
          rejected++;
          continue;
        }
        photoRoom--;
      }
      accepted.push(file);
    }

    if (rejected > 0) {
      toast.warning(
        `Photos: JPG, PNG or WebP under 10 MB (up to ${MAX_PHOTOS}). Videos: MP4, WebM or MOV up to 5 GB (up to ${MAX_VIDEOS}).`,
      );
    }

    setPhotos((p) => [
      ...p,
      ...accepted.map((file) => ({
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
    const requestId = ++decodeRequestId.current;
    try {
      const cached = getCachedVin(vin);
      const decoded =
        cached ??
        (await withTimeout(
          decodeVin({ data: { accessToken: session.access_token, vin } }),
          VIN_DECODE_TIMEOUT_MS,
          "VIN decoding is taking too long. Please try again.",
        ));
      if (requestId !== decodeRequestId.current) return;
      if (!cached) cacheVin(vin, decoded);
      setForm((current) => applyDecodedVehicle(current, decoded));
      toast.success(cached ? "VIN details loaded instantly." : "VIN decoded. Review the details before saving.");
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
      const originalMedia = existing.map((item) => item.url);
      const currentExistingMedia = photos
        .filter((item): item is Extract<PhotoDraft, { kind: "existing" }> => item.kind === "existing")
        .map((item) => item.url);
      const hasNewMedia = photos.some((item) => item.kind === "new");
      const mediaChanged =
        hasNewMedia ||
        originalMedia.length !== currentExistingMedia.length ||
        originalMedia.some((url, index) => url !== currentExistingMedia[index]);

      const pendingUploads = photos
        .map((item, mediaIndex) => ({ item, mediaIndex }))
        .filter(
          (
            entry,
          ): entry is {
            item: Extract<PhotoDraft, { kind: "new" }>;
            mediaIndex: number;
          } => entry.item.kind === "new",
        );

      setUploadLabel(
        pendingUploads.length > 0
          ? `Saving and uploading ${pendingUploads.length} file${pendingUploads.length === 1 ? "" : "s"}…`
          : "Saving changes…",
      );

      // Saving vehicle data and uploading media do not depend on one another,
      // so start them together instead of waiting for each network step.
      const vehicleSavePromise = saveLegacyInventoryRow({
        data: { accessToken: session.access_token, vehicle: payload },
      });

      let completedUploads = 0;
      const uploadedMediaPromise = mapWithConcurrency(
        pendingUploads,
        MAX_CONCURRENT_UPLOADS,
        async ({ item, mediaIndex }) => {
          const { uploadUrl, key } = await createMediaUploadFn({
            data: {
              accessToken: session.access_token,
              vin,
              contentType: item.file.type,
            },
          });
          const response = await fetch(uploadUrl, {
            method: "PUT",
            headers: { "content-type": item.file.type, "x-upsert": "true" },
            body: item.file,
          });
          if (!response.ok) {
            throw new Error(`Could not upload ${item.file.name}. Please try again.`);
          }
          completedUploads += 1;
          setUploadLabel(`Uploading media… ${completedUploads}/${pendingUploads.length}`);
          return {
            mediaIndex,
            key,
            media: isVideoDraft(item) ? ("video" as const) : ("photo" as const),
          };
        },
      );

      const [, uploadedMedia] = await Promise.all([vehicleSavePromise, uploadedMediaPromise]);

      if (mediaChanged) {
        const uploadedByIndex = new Map(uploadedMedia.map((item) => [item.mediaIndex, item]));
        const order: PhotoOrderInput[] = photos.map((item, mediaIndex) => {
          const media = isVideoDraft(item) ? ("video" as const) : ("photo" as const);
          if (item.kind === "existing") {
            return { kind: "keep", url: item.url, media };
          }
          return {
            kind: "new",
            index: -1,
            media,
            uploadedKey: uploadedByIndex.get(mediaIndex)!.key,
          };
        });

        setUploadLabel("Finalizing media…");
        await saveVehiclePhotosFn({
          data: {
            accessToken: session.access_token,
            vin,
            altBase: title,
            order,
            newPhotos: [],
          },
        });
      }
      toast.success(vehicle ? "Vehicle updated." : "Vehicle added.");
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save this vehicle.");
    } finally {
      setUploadLabel(null);
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{vehicle ? "Edit vehicle" : "Add vehicle"}</DialogTitle>
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
        <Field label="Equipment (one per line)">
          <Textarea rows={3} value={form.features} onChange={(e) => set("features", e.target.value)} />
        </Field>

        <div className="flex items-center gap-3">
          <Switch id="featured" checked={form.is_featured} onCheckedChange={(v) => set("is_featured", v)} />
          <Label htmlFor="featured">Feature this vehicle on the homepage</Label>
        </div>

        <div className="space-y-3 rounded-lg border border-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Photos &amp; videos</p>
              <p className="text-xs text-muted-foreground">
                Up to {MAX_PHOTOS} photos and {MAX_VIDEOS} videos. The first photo is the main image.
              </p>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted">
              <Upload className="size-4" />
              Add media
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
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
              {isDraggingFiles ? "Drop photos or videos here" : "Drag and drop vehicle photos or videos"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              or click to browse JPG, PNG, WebP under 10 MB — or MP4, WebM, MOV videos up to 5 GB
            </p>
            <input
              id="vehicle-photo-upload"
              type="file"
              accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
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
                  {isVideoDraft(p) ? (
                    <video
                      src={p.kind === "existing" ? p.url : p.previewUrl}
                      className="h-24 w-full bg-black object-cover"
                      muted
                      playsInline
                      preload="metadata"
                      controls
                    />
                  ) : (
                    <img
                      src={p.kind === "existing" ? p.url : p.previewUrl}
                      alt={`Photo ${i + 1}`}
                      className="h-24 w-full object-cover"
                    />
                  )}

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
            {uploadLabel ?? (vehicle ? "Save changes" : "Add vehicle")}
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
