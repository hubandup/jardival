-- =============================================
-- MULTI-TENANCY : organizations + scoping des données catalogue
-- =============================================
-- Crée la table organizations, attache catalogues + stats + rejets,
-- backfill toutes les lignes existantes vers une organisation "Jardival".
-- =============================================

-- 1. Table organizations
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- 2. Membership : rattache un user à une (ou plusieurs) organisation(s).
CREATE TABLE public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

CREATE INDEX idx_org_members_user ON public.organization_members(user_id);
CREATE INDEX idx_org_members_org ON public.organization_members(organization_id);

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- Helper SECURITY DEFINER : retourne true si l'utilisateur appartient à l'organisation.
CREATE OR REPLACE FUNCTION public.is_org_member(_user_id UUID, _organization_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id AND organization_id = _organization_id
  )
$$;

-- 3. Seed : organisation Jardival par défaut
INSERT INTO public.organizations (name, slug)
VALUES ('Jardival', 'jardival');

-- Récupère son id pour les backfills
DO $$
DECLARE
  v_org_id UUID;
BEGIN
  SELECT id INTO v_org_id FROM public.organizations WHERE slug = 'jardival';

  -- Tous les admins existants deviennent membres de Jardival.
  INSERT INTO public.organization_members (organization_id, user_id)
  SELECT v_org_id, ur.user_id
  FROM public.user_roles ur
  WHERE ur.role IN ('super_admin', 'admin')
  ON CONFLICT DO NOTHING;

  -- Attache catalogues
  ALTER TABLE public.catalogues ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
  UPDATE public.catalogues SET organization_id = v_org_id WHERE organization_id IS NULL;
  ALTER TABLE public.catalogues ALTER COLUMN organization_id SET NOT NULL;
  CREATE INDEX idx_catalogues_org ON public.catalogues(organization_id);

  -- Attache catalogue_extraction_stats
  ALTER TABLE public.catalogue_extraction_stats
    ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
  UPDATE public.catalogue_extraction_stats SET organization_id = v_org_id WHERE organization_id IS NULL;
  ALTER TABLE public.catalogue_extraction_stats ALTER COLUMN organization_id SET NOT NULL;
  CREATE INDEX idx_extraction_stats_org ON public.catalogue_extraction_stats(organization_id);
END $$;

-- 4. Nouvelle table catalogue_extraction_rejections
CREATE TABLE public.catalogue_extraction_rejections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  catalogue_id UUID REFERENCES public.catalogues(id) ON DELETE SET NULL,
  bbox JSONB NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rejections_org_created ON public.catalogue_extraction_rejections(organization_id, created_at DESC);

ALTER TABLE public.catalogue_extraction_rejections ENABLE ROW LEVEL SECURITY;

-- 5. RLS policies
-- organizations : un membre voit son orga, un admin global gère tout
CREATE POLICY "Members read their organization"
  ON public.organizations
  FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), id) OR public.is_admin(auth.uid()));

CREATE POLICY "Super admins manage organizations"
  ON public.organizations
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- organization_members : un user voit ses propres rattachements ; super_admin gère
CREATE POLICY "Users read own memberships"
  ON public.organization_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins manage memberships"
  ON public.organization_members
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- catalogues : public read inchangé. On remplace la policy admin par une policy scopée org.
DROP POLICY IF EXISTS "Admins manage catalogues" ON public.catalogues;
CREATE POLICY "Org admins manage catalogues"
  ON public.catalogues
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) AND public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_admin(auth.uid()) AND public.is_org_member(auth.uid(), organization_id));

-- catalogue_extraction_stats
DROP POLICY IF EXISTS "Admins manage extraction stats" ON public.catalogue_extraction_stats;
CREATE POLICY "Org admins manage extraction stats"
  ON public.catalogue_extraction_stats
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) AND public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_admin(auth.uid()) AND public.is_org_member(auth.uid(), organization_id));

-- catalogue_extraction_rejections
CREATE POLICY "Org admins manage rejections"
  ON public.catalogue_extraction_rejections
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) AND public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_admin(auth.uid()) AND public.is_org_member(auth.uid(), organization_id));
