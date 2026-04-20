
-- =============================================
-- 1. ROLES SYSTEM
-- =============================================
CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to avoid recursive RLS
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Helper: is the user any kind of admin?
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin', 'admin')
  )
$$;

-- RLS for user_roles
CREATE POLICY "Users view own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "Super admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- =============================================
-- 2. PROFILES
-- =============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "Update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid());

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- 3. SHARED updated_at TRIGGER
-- =============================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =============================================
-- 4. STORES
-- =============================================
CREATE TABLE public.stores (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  postal_code TEXT,
  city TEXT NOT NULL,
  department TEXT NOT NULL,
  latitude NUMERIC NOT NULL,
  longitude NUMERIC NOT NULL,
  phone TEXT,
  hours JSONB,
  services TEXT[],
  image TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Stores public read" ON public.stores
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Admins manage stores" ON public.stores
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER stores_updated_at
  BEFORE UPDATE ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =============================================
-- 5. PROMOTIONS
-- =============================================
CREATE TABLE public.promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  price NUMERIC,
  original_price NUMERIC,
  image TEXT,
  starts_at DATE,
  ends_at DATE,
  store_ids TEXT[],
  display_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Promotions public read" ON public.promotions
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Admins manage promotions" ON public.promotions
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER promotions_updated_at
  BEFORE UPDATE ON public.promotions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =============================================
-- 6. CATALOGUES
-- =============================================
CREATE TABLE public.catalogues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  cover_image TEXT,
  pdf_url TEXT,
  starts_at DATE,
  ends_at DATE,
  display_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.catalogues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Catalogues public read" ON public.catalogues
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Admins manage catalogues" ON public.catalogues
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER catalogues_updated_at
  BEFORE UPDATE ON public.catalogues
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =============================================
-- 7. STORAGE BUCKETS
-- =============================================
INSERT INTO storage.buckets (id, name, public) VALUES
  ('store-images', 'store-images', true),
  ('promo-images', 'promo-images', true),
  ('catalogues', 'catalogues', true)
ON CONFLICT (id) DO NOTHING;

-- Public read on all three buckets
CREATE POLICY "Public read store-images" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'store-images');

CREATE POLICY "Public read promo-images" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'promo-images');

CREATE POLICY "Public read catalogues" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'catalogues');

-- Admin write on all three buckets
CREATE POLICY "Admins write store-images" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'store-images' AND public.is_admin(auth.uid()))
  WITH CHECK (bucket_id = 'store-images' AND public.is_admin(auth.uid()));

CREATE POLICY "Admins write promo-images" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'promo-images' AND public.is_admin(auth.uid()))
  WITH CHECK (bucket_id = 'promo-images' AND public.is_admin(auth.uid()));

CREATE POLICY "Admins write catalogues" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'catalogues' AND public.is_admin(auth.uid()))
  WITH CHECK (bucket_id = 'catalogues' AND public.is_admin(auth.uid()));
