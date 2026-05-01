import { supabase } from "@/integrations/supabase/client";

export async function uploadAndGetUrl(
  bucket: string,
  path: string,
  file: File | Blob,
  options?: { contentType?: string }
): Promise<string> {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, options?.contentType ? { contentType: options.contentType } : undefined);
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
