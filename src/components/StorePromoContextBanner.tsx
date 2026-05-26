import { Link } from "react-router-dom";
import { X, Tag } from "lucide-react";
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
  return (
    <aside className="sticky top-16 z-30 border-b border-border bg-accent text-accent-foreground shadow-card">
      <div className="container-px mx-auto flex max-w-7xl items-center gap-3 py-2.5 md:gap-4 md:py-3">
        {promo.image && (
          <img
            src={promo.image}
            alt=""
            className="h-14 w-14 shrink-0 rounded-lg bg-white object-contain shadow-sm md:h-16 md:w-16"
            loading="eager"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider opacity-80">
            <Tag className="h-3 w-3" /> Promotion sélectionnée
          </p>
          <p className="truncate font-display text-sm font-semibold md:text-base">
            {promo.name}
          </p>
          <p className="flex items-center gap-2 text-xs">
            {price && <span className="font-bold">{price}</span>}
            {oldPrice && <span className="opacity-70 line-through">{oldPrice}</span>}
            <span className="opacity-80">
              · {matchingCount} magasin{matchingCount > 1 ? "s" : ""} sur {totalCount}
            </span>
          </p>
        </div>
        <Link
          to={clearHref}
          aria-label="Voir tous les magasins"
          className="rounded-full p-2 transition-colors hover:bg-accent-foreground/10"
        >
          <X className="h-4 w-4" />
        </Link>
      </div>
    </aside>
  );
};
