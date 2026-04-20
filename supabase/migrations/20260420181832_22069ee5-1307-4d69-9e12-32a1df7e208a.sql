-- 1. Table media_assets
CREATE TABLE public.media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket text NOT NULL,
  path text NOT NULL,
  public_url text NOT NULL,
  mime_type text,
  size_bytes bigint,
  width integer,
  height integer,
  -- SEO / WordPress-style fields
  title text,
  alt text,
  description text,
  caption text,
  credit text,
  seo_slug text,
  tags text[] DEFAULT ARRAY[]::text[],
  -- bookkeeping
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT media_assets_bucket_path_unique UNIQUE (bucket, path)
);

CREATE INDEX media_assets_bucket_idx ON public.media_assets (bucket);
CREATE INDEX media_assets_tags_idx ON public.media_assets USING GIN (tags);
CREATE INDEX media_assets_url_idx ON public.media_assets (public_url);

-- updated_at trigger (re-use existing function)
CREATE TRIGGER media_assets_set_updated_at
BEFORE UPDATE ON public.media_assets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 2. RLS
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage media_assets"
ON public.media_assets
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Public read so the frontend can resolve alt text by URL without auth
CREATE POLICY "Media assets public read"
ON public.media_assets
FOR SELECT
TO anon, authenticated
USING (true);

-- 3. Bucket media (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true)
ON CONFLICT (id) DO NOTHING;

-- 4. Storage policies for the new bucket only
CREATE POLICY "Media bucket public read"
ON storage.objects
FOR SELECT
USING (bucket_id = 'media');

CREATE POLICY "Admins upload to media bucket"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'media' AND public.is_admin(auth.uid()));

CREATE POLICY "Admins update media bucket"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'media' AND public.is_admin(auth.uid()))
WITH CHECK (bucket_id = 'media' AND public.is_admin(auth.uid()));

CREATE POLICY "Admins delete from media bucket"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'media' AND public.is_admin(auth.uid()));