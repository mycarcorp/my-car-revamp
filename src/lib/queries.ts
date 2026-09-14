import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/app-client";
import type { Database } from "@/integrations/supabase/types";
import { listPublicLegacyInventoryRows } from "@/lib/legacy-inventory.functions";

export type Vehicle = Database["public"]["Tables"]["vehicles"]["Row"];
export type VehiclePhoto = Database["public"]["Tables"]["vehicle_photos"]["Row"];
export type SiteSettings = Database["public"]["Tables"]["site_settings"]["Row"];
export type BlogPost = Database["public"]["Tables"]["blog_posts"]["Row"];
export type Collection = Database["public"]["Tables"]["collections"]["Row"];
export type ServiceArea = Database["public"]["Tables"]["service_areas"]["Row"];
export type Lead = Database["public"]["Tables"]["leads"]["Row"];

export type VehicleWithPhotos = Vehicle & { vehicle_photos: VehiclePhoto[] };

export type SearchFilters = {
  q?: string;
  make?: string;
  model?: string;
  body?: string;
  fuel?: string;
  drivetrain?: string;
  color?: string;
  priceMin?: number;
  priceMax?: number;
  paymentMax?: number;
  yearMin?: number;
  yearMax?: number;
  mileageMax?: number;
  mpgMin?: number;
  deal?: string;
  sort?: string;
  page?: number;
};

export const PAGE_SIZE = 24;

function applyFilters(
  builder: ReturnType<ReturnType<typeof supabase.from>["select"]>,
  f: SearchFilters,
) {
  let q = builder as any;
  q = q.in("status", ["available", "pending"]);
  if (f.q) q = q.or(`make.ilike.%${f.q}%,model.ilike.%${f.q}%,trim.ilike.%${f.q}%`);
  if (f.make) q = q.eq("make", f.make);
  if (f.model) q = q.eq("model", f.model);
  if (f.body) q = q.eq("body_style", f.body);
  if (f.fuel) q = q.eq("fuel_type", f.fuel);
  if (f.drivetrain) q = q.eq("drivetrain", f.drivetrain);
  if (f.color) q = q.eq("exterior_color", f.color);
  if (f.priceMin) q = q.gte("price_cents", f.priceMin * 100);
  if (f.priceMax) q = q.lte("price_cents", f.priceMax * 100);
  if (f.yearMin) q = q.gte("year", f.yearMin);
  if (f.yearMax) q = q.lte("year", f.yearMax);
  if (f.mileageMax) q = q.lte("mileage", f.mileageMax);
  if (f.mpgMin) q = q.gte("mpg_combined", f.mpgMin);
  if (f.deal === "price-drop") q = q.not("prior_price_cents", "is", null);
  return q;
}

function applySort(q: any, sort?: string) {
  switch (sort) {
    case "price-asc":
      return q.order("price_cents", { ascending: true });
    case "price-desc":
      return q.order("price_cents", { ascending: false });
    case "mileage-asc":
      return q.order("mileage", { ascending: true });
    case "newest":
      return q.order("year", { ascending: false });
    case "oldest":
      return q.order("year", { ascending: true });
    default:
      return q
        .order("is_featured", { ascending: false })
        .order("date_received", { ascending: false });
  }
}

export const vehicleSearchQuery = (filters: SearchFilters) =>
  queryOptions({
    queryKey: ["vehicles", "search", filters],
    queryFn: async () => {
      const page = filters.page ?? 1;
      const data = await listPublicLegacyInventoryRows({
        data: { ...filters, page, pageSize: PAGE_SIZE },
      });
      return { vehicles: data.vehicles as unknown as VehicleWithPhotos[], count: data.count, page };
    },
  });

export const facetsQuery = () =>
  queryOptions({
    queryKey: ["vehicles", "facets"],
    queryFn: async () => {
      const data = await listPublicLegacyInventoryRows({ data: { page: 1, pageSize: 10000 } });
      const rows = data.vehicles;
      const tally = (key: keyof (typeof rows)[number]) => {
        const map = new Map<string, number>();
        for (const r of rows) {
          const v = r[key];
          if (typeof v === "string" && v) map.set(v, (map.get(v) ?? 0) + 1);
        }
        return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([value, count]) => ({ value, count }));
      };
      return {
        total: rows.length,
        makes: tally("make"),
        models: tally("model"),
        bodies: tally("body_style"),
        fuels: tally("fuel_type"),
        drivetrains: tally("drivetrain"),
        colors: tally("exterior_color"),
      };
    },
  });

export const featuredVehiclesQuery = () =>
  queryOptions({
    queryKey: ["vehicles", "featured"],
    queryFn: async () => {
      const data = await listPublicLegacyInventoryRows({ data: { page: 1, pageSize: 8 } });
      return data.vehicles as unknown as VehicleWithPhotos[];
    },
  });

export const vehicleBySlugQuery = (slug: string) =>
  queryOptions({
    queryKey: ["vehicle", slug],
    queryFn: async () => {
      const data = await listPublicLegacyInventoryRows({ data: { slug, page: 1, pageSize: 1 } });
      return (data.vehicles[0] as unknown as VehicleWithPhotos | undefined) ?? null;
    },
  });

export const similarVehiclesQuery = (bodyStyle: string, excludeId: string) =>
  queryOptions({
    queryKey: ["vehicles", "similar", bodyStyle, excludeId],
    queryFn: async () => {
      const data = await listPublicLegacyInventoryRows({
        data: { body: bodyStyle, excludeId, page: 1, pageSize: 4 },
      });
      return data.vehicles as unknown as VehicleWithPhotos[];
    },
  });

export const siteSettingsQuery = () =>
  queryOptions({
    queryKey: ["site-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("site_settings").select("*").eq("id", 1).maybeSingle();
      if (error) throw error;
      return data as SiteSettings | null;
    },
    staleTime: 5 * 60 * 1000,
  });

export const collectionsQuery = () =>
  queryOptions({
    queryKey: ["collections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("collections")
        .select("*")
        .eq("active", true)
        .order("position");
      if (error) throw error;
      return (data ?? []) as Collection[];
    },
  });

export const serviceAreasQuery = () =>
  queryOptions({
    queryKey: ["service-areas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("service_areas").select("*").order("position");
      if (error) throw error;
      return (data ?? []) as ServiceArea[];
    },
  });

export const serviceAreaQuery = (slug: string) =>
  queryOptions({
    queryKey: ["service-area", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_areas")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return (data as ServiceArea | null) ?? null;
    },
  });

export const blogListQuery = () =>
  queryOptions({
    queryKey: ["blog", "list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("published", true)
        .order("published_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as BlogPost[];
    },
  });

export const blogPostQuery = (slug: string) =>
  queryOptions({
    queryKey: ["blog", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return (data as BlogPost | null) ?? null;
    },
  });
