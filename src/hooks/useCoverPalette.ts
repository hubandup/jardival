import { useEffect, useState } from "react";
import { extractCoverPalette, type HeroPalette } from "@/lib/coverPalette";

const cache = new Map<string, HeroPalette | null>();

export function useCoverPalette(imageUrl: string | null | undefined) {
  const [palette, setPalette] = useState<HeroPalette | null>(() =>
    imageUrl && cache.has(imageUrl) ? cache.get(imageUrl) ?? null : null,
  );

  useEffect(() => {
    if (!imageUrl) {
      setPalette(null);
      return;
    }
    if (cache.has(imageUrl)) {
      setPalette(cache.get(imageUrl) ?? null);
      return;
    }
    let cancelled = false;
    extractCoverPalette(imageUrl).then((p) => {
      if (cancelled) return;
      cache.set(imageUrl, p);
      setPalette(p);
    });
    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  return palette;
}
