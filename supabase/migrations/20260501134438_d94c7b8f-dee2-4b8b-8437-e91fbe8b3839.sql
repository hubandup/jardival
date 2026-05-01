-- Brouillons du workflow d'extraction de catalogue (1 par catalogue)
CREATE TABLE public.catalogue_extractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalogue_id uuid NOT NULL UNIQUE,
  step text NOT NULL DEFAULT 'upload',
  promos jsonb NOT NULL DEFAULT '[]'::jsonb,
  starts_at date,
  ends_at date,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalogue_extractions_step_check CHECK (step IN ('upload','zones','tableau','programmation','valide')),
  CONSTRAINT catalogue_extractions_status_check CHECK (status IN ('draft','validated'))
);

CREATE INDEX idx_catalogue_extractions_catalogue ON public.catalogue_extractions(catalogue_id);

ALTER TABLE public.catalogue_extractions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage catalogue_extractions"
ON public.catalogue_extractions
FOR ALL
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

CREATE TRIGGER trg_catalogue_extractions_updated_at
BEFORE UPDATE ON public.catalogue_extractions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();