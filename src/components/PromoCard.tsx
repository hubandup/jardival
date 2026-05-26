import { useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, Sparkles, ImageOff } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export interface PromoCardData {
  id: string;
  slug?: string | null;
  name: string;
  imagePath?: string | null;
  price?: number | null;
  oldPrice?: number | null;
  discount?: number | null;
  promoLabel?: string | null; // ex: "2+1", "Offre spéciale"
  matchScore?: number | null; // 0..1
  isRasterized?: boolean | null; // image reconstituée par fallback
}

const formatPrice = (v?: number | null) =>
  v === null || v === undefined
    ? null
    : new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency: "EUR",
        minimumFractionDigits: 2,
      }).format(v);

const buildBadge = (p: PromoCardData): string | null => {
  if (p.promoLabel) return p.promoLabel;
  if (p.discount && p.discount > 0) return `-${p.discount}%`;
  return null;
};

/**
 * Format reel mobile (9:16). Image native HD + overlays + CTA "Voir en magasin".
 * Pensé pour le scroll vertical snap (parent gère snap-y / snap-mandatory).
 */
export const PromoCard = ({ promo }: { promo: PromoCardData }) => {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  const price = formatPrice(promo.price);
  const oldPrice = formatPrice(promo.oldPrice);
  const badge = buildBadge(promo);
  const uncertain =
    typeof promo.matchScore === "number" && promo.matchScore < 0.5;
  const target = `/magasins?promo=${encodeURIComponent(
    promo.slug ?? promo.id,
  )}&geo=1`;

  const showImage = promo.imagePath && !imgError;

  return (
    <article className="relative mx-auto flex aspect-[9/16] w-full max-w-md snap-start snap-always flex-col overflow-hidden rounded-2xl bg-foreground/5">
      {/* Image / fallback */}
      <div className="absolute inset-0">
        {showImage ? (
          <>
            {!imgLoaded && <Skeleton className="absolute inset-0 rounded-none" />}
            <img
              src={promo.imagePath!}
              alt={promo.name}
              loading="lazy"
              decoding="async"
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgError(true)}
              className="h-full w-full object-cover"
            />
          </>
        ) : (
          // Fallback : couleur dominante marque (vert Jardival) + icône
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[hsl(120,46%,33%)] text-white/80">
            <ImageOff className="h-10 w-10" aria-hidden />
            <span className="text-xs uppercase tracking-widest">
              Image indisponible
            </span>
          </div>
        )}
        {/* Dégradé bas pour lisibilité */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
      </div>

      {/* Badges haut */}
      <div className="relative z-10 flex items-start justify-between gap-2 p-3">
        {badge ? (
          <span className="inline-flex items-center rounded-full bg-[hsl(120,46%,33%)] px-3 py-1 text-sm font-bold text-white shadow">
            {badge}
          </span>
        ) : (
          <span />
        )}
        {uncertain && (
          <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/95 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white shadow">
            <Sparkles className="h-3 w-3" />
            match IA
          </span>
        )}
      </div>

      <div className="flex-1" />

      {/* Overlay bas */}
      <div className="relative z-10 space-y-2 p-4 pb-20 text-white">
        <h3 className="line-clamp-2 font-display text-lg font-semibold leading-tight">
          {promo.name}
        </h3>
        {(price || oldPrice) && (
          <div className="flex items-end gap-2">
            {price && (
              <span className="font-display text-2xl font-bold text-accent">{price}</span>
            )}
            {oldPrice && (
              <span className="pb-1 text-xs text-white/70 line-through">
                {oldPrice}
              </span>
            )}
          </div>
        )}
      </div>

      {/* CTA fixe en bas */}
      <Link
        to={target}
        className="absolute inset-x-3 bottom-3 z-20 flex items-center justify-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-bold text-[hsl(120,46%,20%)] shadow-lg transition-transform active:scale-95"
      >
        <MapPin className="h-4 w-4" />
        Voir en magasin
      </Link>
    </article>
  );
};

export default PromoCard;
