import { ProductCard } from "./ProductCard";
import { CATALOGUE_PROMOS } from "@/data/cataloguePromos";
import { useMemo } from "react";
import { Tag } from "lucide-react";

export const PromoSection = () => {
  // Met en avant les remises réelles du catalogue PDF (en %), puis les
  // produits vedettes plein tarif catalogue.
  const promos = useMemo(() => {
    const withDiscount = CATALOGUE_PROMOS.filter((p) => p.discount > 0).sort(
      (a, b) => b.discount - a.discount
    );
    const fullPrice = CATALOGUE_PROMOS.filter((p) => p.discount === 0);
    return [...withDiscount, ...fullPrice].slice(0, 12);
  }, []);

  return (
    <section id="promos" className="relative py-20 md:py-28">
      <div className="container-px mx-auto max-w-7xl">
        <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-accent">
              <Tag className="h-3.5 w-3.5" />
              Catalogue Jardinales · jusqu'au 16 mai 2026
            </span>
            <h2 className="mt-3 font-display text-4xl font-semibold text-foreground md:text-5xl">
              Promotions à ne pas manquer
            </h2>
            <p className="mt-4 text-muted-foreground">
              Les meilleures offres du prospectus papier, à retrouver dans votre magasin Jardival.
            </p>
          </div>
          <a
            href="/catalogue-jardival-jardinales.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            Feuilleter le catalogue →
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
