import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Loader2, Tag, MapPin, ChevronUp } from "lucide-react";
import { usePromotions, useCatalogues } from "@/hooks/usePromotions";
import { CATALOGUE_PROMOS } from "@/data/cataloguePromos";
import { promotionToProduct } from "@/lib/promotion";
import type { Product } from "@/types/product";

const formatPrice = (price?: number | null) => {
  if (price === null || price === undefined) return null;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(price);
};

/**
 * Vue "reels" plein écran, mobile uniquement.
 * Snap vertical : une promo = un écran. Header reste sticky au-dessus.
 */
export const MobilePromoReels = () => {
  const { data: dbPromos, isLoading } = usePromotions();
  const { data: catalogues } = useCatalogues();
  const activeCatalogue = catalogues?.[0];

  const promos = useMemo<Product[]>(() => {
    if (dbPromos && dbPromos.length > 0) {
      return dbPromos.map(promotionToProduct);
    }
    return CATALOGUE_PROMOS;
  }, [dbPromos]);

  const validityLabel = activeCatalogue?.ends_at
    ? `Jusqu'au ${new Date(activeCatalogue.ends_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`
    : null;

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Chargement…
      </div>
    );
  }

  return (
    <div
      className="relative h-[calc(100dvh-4rem)] snap-y snap-mandatory overflow-y-scroll overscroll-contain scroll-smooth"
      style={{ scrollbarWidth: "none" }}
      aria-label="Promotions Jardival"
    >
      <style>{`
        .reels-scroll::-webkit-scrollbar { display: none; }
      `}</style>

      {promos.map((p, idx) => {
        const price = formatPrice(p.price);
        const oldPrice = formatPrice(p.oldPrice);
        const slug = (p as Product & { slug?: string }).slug;
        const link = slug ? `/promotions/${slug}` : `/promotions`;

        return (
          <article
            key={`${p.id}-${idx}`}
            className="reels-scroll relative flex h-[calc(100dvh-4rem)] w-full snap-start snap-always flex-col overflow-hidden bg-black"
          >
            {/* Image plein écran */}
            {p.image ? (
              <img
                src={p.image}
                alt={p.name}
                className="absolute inset-0 h-full w-full object-cover"
                loading={idx < 2 ? "eager" : "lazy"}
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-accent/30" />
            )}

            {/* Voile pour la lisibilité */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(180deg, hsl(0 0% 0% / 0.15) 0%, hsl(0 0% 0% / 0) 25%, hsl(0 0% 0% / 0) 50%, hsl(0 0% 0% / 0.85) 100%)",
              }}
              aria-hidden
            />

            {/* Badges en haut */}
            <div className="relative z-10 flex items-start justify-between gap-2 p-4">
              {validityLabel && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-foreground backdrop-blur">
                  <Tag className="h-3 w-3" />
                  {validityLabel}
                </span>
              )}
              {p.discount > 0 && (
                <span className="inline-flex items-center rounded-full bg-accent px-3 py-1 text-sm font-bold text-accent-foreground shadow-card">
                  -{p.discount}%
                </span>
              )}
            </div>

            {/* Compteur position */}
            <div className="relative z-10 mx-auto -mt-2 inline-flex rounded-full bg-black/40 px-2.5 py-0.5 text-[10px] font-medium text-white/80 backdrop-blur">
              {idx + 1} / {promos.length}
            </div>

            <div className="flex-1" />

            {/* Bloc d'infos en bas */}
            <div className="relative z-10 space-y-3 p-5 pb-8 text-white">
              {p.category && (
                <span className="inline-block text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70">
                  {p.category}
                </span>
              )}
              <h2 className="font-display text-2xl font-semibold leading-tight">
                {p.name}
              </h2>
              {(p as Product & { description?: string }).description && (
                <p className="line-clamp-2 text-sm text-white/80">
                  {(p as Product & { description?: string }).description}
                </p>
              )}

              <div className="flex items-end gap-3 pt-1">
                {price && (
                  <span className="font-display text-3xl font-bold">{price}</span>
                )}
                {oldPrice && (
                  <span className="pb-1 text-sm text-white/60 line-through">
                    {oldPrice}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <Link
                  to={link}
                  className="inline-flex flex-1 items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-foreground shadow-card transition-transform active:scale-95"
                >
                  Voir l'offre
                </Link>
                <Link
                  to="/magasins"
                  aria-label="Trouver un magasin"
                  className="inline-flex items-center justify-center rounded-full border border-white/30 bg-white/10 px-4 py-3 text-sm font-semibold text-white backdrop-blur transition-transform active:scale-95"
                >
                  <MapPin className="h-4 w-4" />
                </Link>
              </div>
            </div>

            {/* Indicateur swipe (1ère slide uniquement) */}
            {idx === 0 && promos.length > 1 && (
              <div className="pointer-events-none absolute bottom-2 left-1/2 z-20 -translate-x-1/2 animate-bounce text-white/70">
                <ChevronUp className="h-5 w-5 rotate-180" />
              </div>
            )}
          </article>
        );
      })}

      {/* Slide finale : voir toutes les promos */}
      <div className="relative flex h-[calc(100dvh-4rem)] w-full snap-start snap-always flex-col items-center justify-center gap-6 bg-gradient-to-br from-primary to-accent p-6 text-center text-primary-foreground">
        <h2 className="font-display text-3xl font-semibold">
          C'est tout pour aujourd'hui&nbsp;!
        </h2>
        <p className="max-w-xs text-primary-foreground/80">
          Retrouve l'intégralité du catalogue ou trouve ton magasin Jardival.
        </p>
        <div className="flex w-full max-w-xs flex-col gap-3">
          <Link
            to="/promotions"
            className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-foreground shadow-card"
          >
            Toutes les promotions
          </Link>
          <Link
            to="/catalogue"
            className="rounded-full border border-white/40 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur"
          >
            Feuilleter le catalogue
          </Link>
          <Link
            to="/magasins"
            className="rounded-full border border-white/40 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur"
          >
            Trouver un magasin
          </Link>
        </div>
      </div>
    </div>
  );
};
