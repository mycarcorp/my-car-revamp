-- ENUMS
CREATE TYPE public.app_role AS ENUM ('owner','editor','shopper');
CREATE TYPE public.vehicle_status AS ENUM ('available','pending','sold','draft');
CREATE TYPE public.body_style AS ENUM ('SUV','Sedan','Truck','Coupe','Hatchback','Convertible','Minivan','Wagon','Van');
CREATE TYPE public.fuel_type AS ENUM ('Gas','Electric','Hybrid','Plug-in Hybrid','Diesel');
CREATE TYPE public.drivetrain AS ENUM ('AWD/4WD','FWD','RWD');
CREATE TYPE public.lead_type AS ENUM ('finance','trade','appointment','contact','availability');
CREATE TYPE public.lead_status AS ENUM ('new','contacted','working','won','lost');
CREATE TYPE public.appointment_type AS ENUM ('test_drive','trade_appraisal','financing','general');

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile" ON public.profiles FOR ALL TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE TRIGGER t_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('owner','editor'))
$$;
CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "owner manages roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'owner')) WITH CHECK (public.has_role(auth.uid(),'owner'));

-- VEHICLES
CREATE TABLE public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vin TEXT NOT NULL UNIQUE,
  stock_number TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  year INT NOT NULL,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  trim TEXT,
  body_style public.body_style NOT NULL,
  mileage INT NOT NULL DEFAULT 0,
  price_cents BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  prior_price_cents BIGINT,
  exterior_color TEXT,
  interior_color TEXT,
  transmission TEXT,
  drivetrain public.drivetrain,
  fuel_type public.fuel_type,
  engine TEXT,
  mpg_combined INT,
  description TEXT,
  features TEXT[] NOT NULL DEFAULT '{}',
  history_report_url TEXT,
  status public.vehicle_status NOT NULL DEFAULT 'available',
  is_featured BOOLEAN NOT NULL DEFAULT false,
  date_received DATE NOT NULL DEFAULT current_date,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_vehicles_status ON public.vehicles(status);
CREATE INDEX idx_vehicles_make_model ON public.vehicles(make, model);
CREATE INDEX idx_vehicles_price ON public.vehicles(price_cents);
GRANT SELECT ON public.vehicles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicles TO authenticated;
GRANT ALL ON public.vehicles TO service_role;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public reads live vehicles" ON public.vehicles FOR SELECT TO anon, authenticated USING (status <> 'draft' OR public.is_staff(auth.uid()));
CREATE POLICY "staff manage vehicles" ON public.vehicles FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER t_vehicles_updated BEFORE UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.vehicle_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  alt TEXT,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_photos_vehicle ON public.vehicle_photos(vehicle_id, position);
GRANT SELECT ON public.vehicle_photos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_photos TO authenticated;
GRANT ALL ON public.vehicle_photos TO service_role;
ALTER TABLE public.vehicle_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public reads photos" ON public.vehicle_photos FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "staff manage photos" ON public.vehicle_photos FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- LEADS
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_type public.lead_type NOT NULL,
  status public.lead_status NOT NULL DEFAULT 'new',
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  message TEXT,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users ON DELETE SET NULL,
  assigned_to UUID REFERENCES auth.users ON DELETE SET NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  internal_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_leads_status ON public.leads(status, created_at DESC);
GRANT INSERT ON public.leads TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone submits a lead" ON public.leads FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "staff read leads" ON public.leads FOR SELECT TO authenticated USING (public.is_staff(auth.uid()) OR user_id = auth.uid());
CREATE POLICY "staff update leads" ON public.leads FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "owner deletes leads" ON public.leads FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'owner'));
CREATE TRIGGER t_leads_updated BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- APPOINTMENTS
CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  appointment_type public.appointment_type NOT NULL DEFAULT 'general',
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  confirmed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT INSERT ON public.appointments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone books" ON public.appointments FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "staff read appointments" ON public.appointments FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff manage appointments" ON public.appointments FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER t_appt_updated BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- BLOG
CREATE TABLE public.blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  excerpt TEXT,
  body TEXT NOT NULL DEFAULT '',
  cover_image_url TEXT,
  author_name TEXT,
  published BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.blog_posts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blog_posts TO authenticated;
GRANT ALL ON public.blog_posts TO service_role;
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public reads published posts" ON public.blog_posts FOR SELECT TO anon, authenticated USING (published OR public.is_staff(auth.uid()));
CREATE POLICY "staff manage posts" ON public.blog_posts FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER t_posts_updated BEFORE UPDATE ON public.blog_posts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- SERVICE AREAS
CREATE TABLE public.service_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'VA',
  intro TEXT,
  body TEXT,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.service_areas TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_areas TO authenticated;
GRANT ALL ON public.service_areas TO service_role;
ALTER TABLE public.service_areas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public reads areas" ON public.service_areas FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "staff manage areas" ON public.service_areas FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- COLLECTIONS
CREATE TABLE public.collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  filter_query TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  position INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.collections TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collections TO authenticated;
GRANT ALL ON public.collections TO service_role;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public reads collections" ON public.collections FOR SELECT TO anon, authenticated USING (active OR public.is_staff(auth.uid()));
CREATE POLICY "staff manage collections" ON public.collections FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- SITE SETTINGS
CREATE TABLE public.site_settings (
  id INT PRIMARY KEY DEFAULT 1,
  dealership_name TEXT NOT NULL DEFAULT 'MyCar',
  phone TEXT NOT NULL DEFAULT '(540) 426-3322',
  email TEXT NOT NULL DEFAULT 'sales@mycarcorp.com',
  address_line TEXT NOT NULL DEFAULT 'Fredericksburg, VA',
  hours JSONB NOT NULL DEFAULT '{}'::jsonb,
  social JSONB NOT NULL DEFAULT '{}'::jsonb,
  trust_badges JSONB NOT NULL DEFAULT '[]'::jsonb,
  finance_apr NUMERIC NOT NULL DEFAULT 8.9,
  finance_term_months INT NOT NULL DEFAULT 72,
  finance_down_percent NUMERIC NOT NULL DEFAULT 10,
  finance_disclosure TEXT NOT NULL DEFAULT 'Estimate only. Not an offer of credit. Actual terms depend on approved credit, taxes, title, and fees.',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);
GRANT SELECT ON public.site_settings TO anon;
GRANT SELECT, INSERT, UPDATE ON public.site_settings TO authenticated;
GRANT ALL ON public.site_settings TO service_role;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public reads settings" ON public.site_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "owner updates settings" ON public.site_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'owner')) WITH CHECK (public.has_role(auth.uid(),'owner'));

-- SAVED VEHICLES / SEARCHES
CREATE TABLE public.saved_vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, vehicle_id)
);
GRANT SELECT, INSERT, DELETE ON public.saved_vehicles TO authenticated;
GRANT ALL ON public.saved_vehicles TO service_role;
ALTER TABLE public.saved_vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own saved vehicles" ON public.saved_vehicles FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  query TEXT NOT NULL,
  alerts_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_searches TO authenticated;
GRANT ALL ON public.saved_searches TO service_role;
ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own saved searches" ON public.saved_searches FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

INSERT INTO public.site_settings (id, hours, social, trust_badges) VALUES (1,
 '{"mon_fri":"9:00 AM - 7:00 PM","sat":"9:00 AM - 6:00 PM","sun":"Closed"}'::jsonb,
 '{"facebook":"","instagram":""}'::jsonb,
 '[{"label":"Family owned in Fredericksburg","enabled":true},{"label":"Every vehicle inspected before sale","enabled":true},{"label":"Financing for all credit types","enabled":true},{"label":"Trade-ins welcome","enabled":true}]'::jsonb);

INSERT INTO public.service_areas (slug, name, intro, position) VALUES
 ('fredericksburg','Fredericksburg','Our home lot. Used cars, trucks and SUVs minutes from downtown Fredericksburg.',1),
 ('spotsylvania','Spotsylvania','Serving Spotsylvania County drivers with inspected, reconditioned used vehicles.',2),
 ('stafford','Stafford','Used vehicle sales and financing for Stafford County commuters.',3),
 ('king-george','King George','Quality pre-owned inventory a short drive from King George.',4),
 ('richmond','Richmond','Richmond-area shoppers travel to us for straightforward used-car pricing.',5),
 ('northern-virginia','Northern Virginia','Northern Virginia buyers save on the same inventory without the metro markup.',6);

INSERT INTO public.collections (slug, title, description, filter_query, position) VALUES
 ('under-20k','Cars under $20K','Great rides with quality you can count on — at a price you will love.','?priceMax=20000',1),
 ('price-drops','Recent price drops','Vehicles we have repriced in the last 30 days.','?deal=price-drop',2),
 ('fuel-efficient','Go the distance','Vehicles rated 40 MPG/MPGe or greater.','?mpgMin=40',3),
 ('trucks','Work-ready trucks','Pickups inspected and ready for the job site.','?body=Truck',4);