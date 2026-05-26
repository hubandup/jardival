import { Link } from "react-router-dom";
import { X, Tag, MapPin, AlertCircle } from "lucide-react";
import type { Product } from "@/types/product";

const fmt = (v?: number) =>
  v == null
    ? null
    : new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency: "EUR",
        minimumFractionDigits: 2,
      }).format(v);

export const StorePromoContextBanner = ({
  promo,
  matchingCount,
  totalCount,
  clearHref,
}: {
  promo: Product;
  matchingCount: number;
  totalCount: number;
  clearHref: string;
}) => {
  const price = fmt(promo.price);
  const oldPrice = fmt(promo.oldPrice);
  const hasStores = matchingCount > 0;
  const hasDiscount = promo.discount > 0;

  return (
    <aside
      className="sticky top-16 z-30 border-b border-border/60 bg-background/95 shadow-card backdrop-blur supports-[backdrop-filter]:bg-background/80 animate-fade-in"
      role="region"
      aria-label="Promotion sélectionnée"
    >
      {/* Liseré accent en haut, plus discret qu'un fond plein */}
      <div className="h-1 w-full bg-gradient-to-r from-accent via-accent/70 to-primary" />

      <div className="container-px mx-auto max-w-7xl py-3 md:py-4">
        <div className="flex items-stretch gap-3 md:gap-5">
          {/* Vignette produit */}
          <div className="relative shrink-0">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border border-border bg-white shadow-sm md:h-20 md:w-20">
              {promo.image ? (
                <img
                  src={promo.image}
                  alt=""
                  className="h-full w-full object-contain"
                  loading="eager"
                />
              ) : (
                <Tag className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            {hasDiscount && (
              <span className="absolute -right-1 -top-1 flex h-7 min-w-7 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-bold text-accent-foreground shadow-card">
                -{promo.discount}%
              </span>
            )}
          </div>

          {/* Infos produit */}
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
              <Tag className="h-3 w-3" />
              <span className="hidden sm:inline">Promotion sélectionnée</span>
              <span className="sm:hidden">Promo</span>
            </p>
            <h2 className="truncate font-display text-base font-semibold leading-tight text-foreground md:text-lg">
              {promo.name}
            </h2>
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              {price && (
                <span className="font-display text-lg font-bold text-accent md:text-xl">
                  {price}
                </span>
              )}
              {oldPrice && (
                <span className="text-sm text-muted-foreground line-through">
                  {oldPrice}
                </span>
              )}
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  hasStores
                    ? "bg-primary-soft text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {hasStores ? (
                  <>
                    <MapPin className="h-3 w-3" />
                    {matchingCount} magasin{matchingCount > 1 ? "s" : ""} sur {totalCount}
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-3 w-3" />
                    Aucun magasin renseigné
                  </>
                )}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Link
              to={clearHref}
              aria-label="Voir tous les magasins, retirer la promo"
              className="group flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:border-foreground/30 hover:bg-muted hover:text-foreground md:h-10 md:w-10"
            >
              <X className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {!hasStores && (
          <p className="mt-2 text-xs text-muted-foreground">
            Cette promotion n'est rattachée à aucun magasin spécifique — tous les magasins du réseau Jardival sont affichés.
          </p>
        )}
      </div>
    </aside>
  );
};
