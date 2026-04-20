import { Product } from "@/types/product";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useMediaAlt } from "@/hooks/useMedia";

interface Props {
  product: Product;
  featured?: boolean;
}

export const ProductCard = ({ product, featured = false }: Props) => {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const alt = useMediaAlt(product.image, product.name);

  return (
    <Link
      to={`/produit/${encodeURIComponent(product.slug || product.id)}`}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all duration-300 hover:-translate-y-1 hover:shadow-card"
    >
      <div className="relative aspect-square overflow-hidden bg-muted">
        {!errored ? (
          <img
            src={product.image}
            alt={alt}
            loading="lazy"
            onLoad={() => setLoaded(true)}
            onError={() => setErrored(true)}
            className={`h-full w-full object-contain p-4 transition-all duration-500 group-hover:scale-105 ${loaded ? "opacity-100" : "opacity-0"}`}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">Image indisponible</div>
        )}

        <div className="absolute left-3 top-3 flex flex-col gap-1.5">
          {product.discount > 0 && (
            <Badge className="bg-gradient-promo border-0 text-accent-foreground shadow-soft font-semibold">
              -{product.discount}%
            </Badge>
          )}
          {product.isNew && (
            <Badge variant="outline" className="border-primary bg-background text-primary font-semibold">
              Nouveau
            </Badge>
          )}
        </div>

        {featured && (
          <div className="absolute right-3 top-3">
            <Badge className="bg-foreground text-background border-0">Best</Badge>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {product.category}
        </p>
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground min-h-[2.5rem]">
          {product.name}
        </h3>
        <p className="text-[11px] text-muted-foreground">Réf. {product.ref}</p>

        <div className="mt-auto flex items-baseline gap-2 pt-2">
          {product.price > 0 ? (
            <>
              <span className="font-display text-xl font-semibold text-foreground">
                {product.price.toFixed(2)}€
              </span>
              {product.oldPrice && product.oldPrice > product.price && (
                <span className="text-sm text-muted-foreground line-through">
                  {product.oldPrice.toFixed(2)}€
                </span>
              )}
            </>
          ) : (
            <span className="font-display text-sm font-semibold text-primary">
              Offre en magasin
            </span>
          )}
        </div>
      </div>
    </Link>
  );
};
