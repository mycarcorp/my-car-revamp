-- Customer repair approvals sent from the MyCar Recon operations app.
-- Read and written only through server functions (service role) keyed by an unguessable token.
CREATE TABLE IF NOT EXISTS public.service_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  ro_no text NOT NULL,
  ro_ref text,
  customer_name text,
  customer_phone text,
  vehicle text NOT NULL,
  vin text,
  miles int,
  advisor text,
  shop_phone text,
  notes text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  media jsonb NOT NULL DEFAULT '[]'::jsonb,
  decisions jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','viewed','responded','cancelled')),
  signed_name text,
  viewed_at timestamptz,
  responded_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_service_approvals_ro ON public.service_approvals(ro_ref);
ALTER TABLE public.service_approvals ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.service_approvals TO service_role;
DROP POLICY IF EXISTS "staff read approvals" ON public.service_approvals;
CREATE POLICY "staff read approvals" ON public.service_approvals
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
DROP TRIGGER IF EXISTS t_service_approvals_updated ON public.service_approvals;
CREATE TRIGGER t_service_approvals_updated BEFORE UPDATE ON public.service_approvals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Private bucket: files are served only through /api/public/approval-media after a token check.
INSERT INTO storage.buckets (id, name, public)
VALUES ('approval-media', 'approval-media', false)
ON CONFLICT (id) DO NOTHING;
