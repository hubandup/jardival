import { Product } from "@/types/product";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useMediaAlt } from "@/hooks/useMedia";
import { sanitizeImageUrl } from "@/lib/imageUrl";

interface Props {
  product: Product;
  featured?: boolean;
}

export const ProductCard = ({ product, featured = false }: Props) => {
  const [errored, setErrored] = useState<Record<number, boolean>>({});
  const [loaded, setLoaded] = useState<Record<number, boolean>>({});
  const [current, setCurrent] = useState(0);
  const alt = useMediaAlt(product.image, product.name);

  const images =
    product.images && product.images.length > 0
      ? product.images.map(sanitizeImageUrl)
      : product.image
        ? [sanitizeImageUrl(product.image)]
        : [];
  const allErrored = images.length > 0 && images.every((_, i) => errored[i]);
  const visibleIndex = images.findIndex((_, i) => !errored[i]);
  const currentIndex = !errored[current] ? current : visibleIndex >= 0 ? visibleIndex : current;

  return (
    <Link
      to={`/produit/${encodeURIComponent(product.slug || product.id)}`}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all duration-300 hover:-translate-y-1 hover:shadow-card"
    >
      <div className="relative aspect-square overflow-hidden bg-muted">
        {!allErrored && images.length > 0 ? (
          <>
            {images.map((src, i) => (
              <div
                key={src + i}
                className={`absolute inset-0 transition-opacity duration-500 ${i === currentIndex ? "opacity-100" : "opacity-0"}`}
                aria-hidden={i !== currentIndex}
              >
                {!loaded[i] && !errored[i] && (
                  <Skeleton className="absolute inset-0 rounded-none" aria-hidden />
                )}
                <img
                  src={src}
                  alt={alt}
                  loading="lazy"
                  onLoad={() => setLoaded((s) => ({ ...s, [i]: true }))}
                  onError={() => setErrored((s) => ({ ...s, [i]: true }))}
                  className={`h-full w-full object-contain p-4 transition-transform duration-500 group-hover:scale-105 ${loaded[i] ? "opacity-100" : "opacity-0"}`}
                />
              </div>
            ))}

            {images.length > 1 && (
              <div className="absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
                {images.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setCurrent(i);
                    }}
                    aria-label={`Image ${i + 1}`}
                    className={`h-1.5 rounded-full transition-all ${i === currentIndex ? "w-5 bg-foreground" : "w-1.5 bg-foreground/30"}`}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
            Image indisponible
          </div>
        )}

        <div className="absolute left-3 top-3 z-10 flex flex-col gap-1.5">
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
          <div className="absolute right-3 top-3 z-10">
            <Badge className="bg-foreground text-background border-0">Best</Badge>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground min-h-[2.5rem]">
          {product.name}
        </h3>
        <p className="text-[13px] font-medium uppercase tracking-wider text-muted-foreground">
          {product.category}
        </p>
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
