import { Product } from "@/types/product";
import { ProductCard } from "./ProductCard";
import { useMemo } from "react";

interface Props {
  products: Product[];
}

export const PromoSection = ({ products }: Props) => {
  const promos = useMemo(
    () =>
      products
        .filter((p) => p.discount > 0)
        .sort((a, b) => b.discount - a.discount)
        .slice(0, 12),
    [products]
  );

  return (
    <section id="promos" className="relative py-20 md:py-28">
      <div className="container-px mx-auto max-w-7xl">
        <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-xl">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
              Offres du moment
            </span>
            <h2 className="mt-3 font-display text-4xl font-semibold text-foreground md:text-5xl">
              Promotions à ne pas manquer
            </h2>
            <p className="mt-4 text-muted-foreground">
              Les meilleures remises de la saison, sélectionnées sur l'ensemble du catalogue.
            </p>
          </div>
          <a
            href="#catalogue"
            className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            Tout voir →
          </a>
        </div>

        <div className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
          {promos.map((p, i) => (
            <ProductCard key={p.id} product={p} featured={i < 2} />
          ))}
        </div>
      </div>
    </section>
  );
};
