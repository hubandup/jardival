// Orchestrateur : pour une liste de promos détectées par Gemini (texte + position),
// produit pour chacune un image_url à plat dans Supabase Storage.
//
// Flux :
//   1) extractNativeImages(pdfUrl) — tente l'extraction des images natives du PDF.
//   2a) Si des images natives existent : matchImagesToPromos(...) puis upload de
//       chaque blob natif dans le bucket promo-images.
//   2b) Si aucune image native (PDF entièrement rasterisé) : FALLBACK — on dérive
//       une bbox grossière depuis la `position` de chaque promo (chaque zone 3×3
//       devient une bbox de ~333×333 dans le repère 0..1000), puis on appelle
//       cropAndUploadPromoImages (rasterize + crop) comme dans l'ancien pipeline.
//
// Le caller est responsable de fusionner les image_url retournés dans son state.
import { uploadAndGetUrl } from "@/lib/storageUpload";
import { extractNativeImages, type NativePageImage } from "@/lib/pdfImageExtract";
import { matchImagesToPromos } from "@/lib/matchPromosToImages";
import { cropAndUploadPromoImages } from "@/lib/pdfImageCrop";
import type { Bbox, PositionZone, WorkflowPromo } from "@/types/catalogue";

export interface PromoImageOutput {
  promoIndex: number;
  imageUrl: string | null;
  /** "native" : image extraite du PDF, qualité originale.
   *  "fallback-crop" : crop d'une page rasterisée, qualité dégradée.
   *  null : aucune image n'a pu être associée. */
  source: "native" | "fallback-crop" | null;
  error?: string;
}

export interface ExtractPromoImagesResult {
  outputs: PromoImageOutput[];
  /** true si au moins une partie du pipeline a utilisé le fallback rasterize+crop. */
  usedFallback: boolean;
  /** true si la pipeline native a renvoyé partiellement (timeout global avant la fin). */
  nativePartial: boolean;
  /** Stats utiles pour log/UI : combien d'images natives matchées, combien manquées. */
  stats: {
    promosTotal: number;
    matchedNative: number;
    fallbackCropped: number;
    failed: number;
  };
}

export type ExtractPhase =
  | "native-extracting"
  | "native-matching"
  | "fallback-cropping"
  | "partial-fallback-cropping";

// =============================================
// Position 3×3 → bbox grossière dans le repère 0..1000 utilisé par les bboxes
// =============================================
const ZONE_BBOX_1K: Record<PositionZone, Bbox> = {
  // [ymin, xmin, ymax, xmax]
  "haut-gauche": [0, 0, 333, 333],
  "haut-centre": [0, 333, 333, 667],
  "haut-droite": [0, 667, 333, 1000],
  "milieu-gauche": [333, 0, 667, 333],
  "milieu-centre": [333, 333, 667, 667],
  "milieu-droite": [333, 667, 667, 1000],
  "bas-gauche": [667, 0, 1000, 333],
  "bas-centre": [667, 333, 1000, 667],
  "bas-droite": [667, 667, 1000, 1000],
};

export function bboxFromPosition(position: PositionZone | null | undefined): Bbox | null {
  if (!position) return null;
  return ZONE_BBOX_1K[position] ?? null;
}

// =============================================
// Upload helpers
// =============================================
async function uploadNativeImage(
  promoTitle: string,
  promoIndex: number,
  image: NativePageImage
): Promise<string> {
  // Le blob natif est déjà encodé en JPEG par extractNativeImages.
  const path = `extracted-native/${Date.now()}-${promoIndex}.jpg`;
  const file = new File([image.blob], path.split("/").pop() ?? "img.jpg", {
    type: image.blob.type || "image/jpeg",
  });
  return uploadAndGetUrl("promo-images", path, file, {
    contentType: image.blob.type || "image/jpeg",
  });
}

// =============================================
// Orchestration principale
// =============================================
export async function extractPromoImages(
  pdfAbsoluteUrl: string,
  promos: WorkflowPromo[],
  onProgress?: (done: number, total: number) => void,
  onPhase?: (phase: ExtractPhase) => void
): Promise<ExtractPromoImagesResult> {
  const outputs: PromoImageOutput[] = promos.map((_, i) => ({
    promoIndex: i,
    imageUrl: null,
    source: null,
  }));

  // === Tentative 1 : images natives ===
  onPhase?.("native-extracting");
  let native: Awaited<ReturnType<typeof extractNativeImages>> | null = null;
  try {
    native = await extractNativeImages(pdfAbsoluteUrl);
  } catch (e) {
    console.warn("[extractPromoImages] extractNativeImages a échoué, bascule fallback", e);
  }

  const nativePartial = !!native?.timedOut;
  let matchedNative = 0;

  // Toujours tenter le matching si on a au moins une image native — même en
  // cas de timeout partiel, on utilise ce qu'on a et on complète au fallback.
  if (native && native.images.length > 0) {
    onPhase?.("native-matching");
    const result = matchImagesToPromos(promos, native.images, native.pageDimensions);
    let done = 0;
    const total = result.matches.filter((m) => m.imageIndex !== null).length;
    for (const m of result.matches) {
      if (m.imageIndex === null) continue;
      const img = native.images[m.imageIndex];
      try {
        const url = await uploadNativeImage(promos[m.promoIndex].title, m.promoIndex, img);
        outputs[m.promoIndex] = { promoIndex: m.promoIndex, imageUrl: url, source: "native" };
        matchedNative++;
      } catch (e) {
        outputs[m.promoIndex] = {
          promoIndex: m.promoIndex,
          imageUrl: null,
          source: null,
          error: e instanceof Error ? e.message : "upload natif échoué",
        };
      }
      done++;
      onProgress?.(done, total);
    }
  }

  // === Tentative 2 : fallback rasterize + crop pour les promos sans image ===
  // Couvre 3 cas : (1) PDF entièrement rasterisé (0 image native), (2) timeout
  // partiel (certaines pages traitées, d'autres non), (3) promos avec position
  // mais sans image native isolable sur leur page.
  let fallbackCropped = 0;
  const promosNeedingFallback = promos
    .map((p, idx) => ({ p, idx }))
    .filter(({ idx }) => outputs[idx].imageUrl === null);

  if (promosNeedingFallback.length > 0) {
    onPhase?.(nativePartial && matchedNative > 0 ? "partial-fallback-cropping" : "fallback-cropping");
    const tasks = promosNeedingFallback
      .map(({ p, idx }) => {
        const bbox = p.bbox_2d ?? bboxFromPosition(p.position);
        if (!bbox || !p.page_number) return null;
        return {
          idx,
          pageNumber: p.page_number,
          bbox,
          filename: `${idx}-${p.title}`,
        };
      })
      .filter((t): t is { idx: number; pageNumber: number; bbox: Bbox; filename: string } => t !== null);

    if (tasks.length) {
      const cropResults = await cropAndUploadPromoImages(
        pdfAbsoluteUrl,
        tasks.map((t) => ({ pageNumber: t.pageNumber, bbox: t.bbox, filename: t.filename })),
        onProgress,
        { scale: 3, format: "jpeg", quality: 0.92 }
      );
      const byFilename = new Map(cropResults.map((r) => [r.filename, r]));
      for (const t of tasks) {
        const r = byFilename.get(t.filename);
        if (r?.publicUrl) {
          outputs[t.idx] = {
            promoIndex: t.idx,
            imageUrl: r.publicUrl,
            source: "fallback-crop",
          };
          fallbackCropped++;
        } else if (outputs[t.idx].imageUrl === null) {
          outputs[t.idx] = {
            promoIndex: t.idx,
            imageUrl: null,
            source: null,
            error: r?.error ?? "crop fallback échoué",
          };
        }
      }
    }
  }

  const failed = outputs.filter((o) => o.imageUrl === null).length;
  const usedFallback = fallbackCropped > 0;

  return {
    outputs,
    usedFallback,
    nativePartial,
    stats: {
      promosTotal: promos.length,
      matchedNative,
      fallbackCropped,
      failed,
    },
  };
}
