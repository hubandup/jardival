import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MediaAsset {
  id: string;
  bucket: string;
  path: string;
  public_url: string;
  mime_type: string | null;
  size_bytes: number | null;
  width: number | null;
  height: number | null;
  title: string | null;
  alt: string | null;
  description: string | null;
  caption: string | null;
  credit: string | null;
  seo_slug: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface MediaFilters {
  bucket?: string;
  q?: string;
  type?: "image" | "pdf" | "all";
  tag?: string;
}

export function useMediaAssets(filters: MediaFilters = {}) {
  return useQuery({
    queryKey: ["media_assets", filters],
    queryFn: async () => {
      let query = supabase
        .from("media_assets")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (filters.bucket && filters.bucket !== "all") {
        query = query.eq("bucket", filters.bucket);
      }
      if (filters.q) {
        const q = `%${filters.q}%`;
        query = query.or(
          `title.ilike.${q},alt.ilike.${q},description.ilike.${q},path.ilike.${q},seo_slug.ilike.${q}`,
        );
      }
      if (filters.type === "image") {
        query = query.like("mime_type", "image/%");
      } else if (filters.type === "pdf") {
        query = query.eq("mime_type", "application/pdf");
      }
      if (filters.tag) {
        query = query.contains("tags", [filters.tag]);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as MediaAsset[];
    },
  });
}

export function useUpdateMediaAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<MediaAsset> }) => {
      const { data, error } = await supabase
        .from("media_assets")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as MediaAsset;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["media_assets"] });
      qc.invalidateQueries({ queryKey: ["media_alt"] });
    },
  });
}

export function useDeleteMediaAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (asset: MediaAsset) => {
      // Try to delete the underlying file (only succeeds for buckets where the user has rights)
      await supabase.storage.from(asset.bucket).remove([asset.path]);
      const { error } = await supabase.from("media_assets").delete().eq("id", asset.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["media_assets"] }),
  });
}

export function useSyncMedia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("media-sync");
      if (error) throw error;
      return data as { scanned: number; inserted: number; errors: string[] };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["media_assets"] }),
  });
}

export function useUploadMedia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const ext = file.name.split(".").pop() ?? "bin";
      const slug = file.name
        .replace(/\.[^.]+$/, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
        .slice(0, 80);
      const path = `${Date.now()}-${slug || "file"}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("media")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage.from("media").getPublicUrl(path);

      const { data, error } = await supabase
        .from("media_assets")
        .insert({
          bucket: "media",
          path,
          public_url: urlData.publicUrl,
          mime_type: file.type || null,
          size_bytes: file.size,
          title: file.name.replace(/\.[^.]+$/, ""),
        })
        .select()
        .single();
      if (error) throw error;
      return data as MediaAsset;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["media_assets"] }),
  });
}

/**
 * Resolves the alt text registered in the media library for a given public URL.
 * Returns the stored alt, or `fallback` if no entry exists.
 */
export function useMediaAlt(url: string | undefined | null, fallback = "") {
  const { data } = useQuery({
    queryKey: ["media_alt", url],
    enabled: !!url,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!url) return null;
      const { data, error } = await supabase
        .from("media_assets")
        .select("alt,title")
        .eq("public_url", url)
        .maybeSingle();
      if (error) return null;
      return data;
    },
  });
  return data?.alt || data?.title || fallback;
}
