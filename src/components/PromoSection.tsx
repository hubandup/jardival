import { ProductCard } from "./ProductCard";
import { CATALOGUE_PROMOS } from "@/data/cataloguePromos";
import { useMemo } from "react";
import { Tag, Loader2, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { usePromotions } from "@/hooks/usePromotions";
import { useCatalogues } from "@/hooks/usePromotions";
import { promotionToProduct } from "@/lib/promotion";

export const PromoSection = () => {
  const { data: dbPromos, isLoading } = usePromotions();
  const { data: catalogues } = useCatalogues();

  // Si l'admin a publié des promos en DB, on les utilise.
  // Sinon on retombe sur le catalogue PDF historique.
  const promos = useMemo(() => {
    if (dbPromos && dbPromos.length > 0) {
      return dbPromos.slice(0, 12).map(promotionToProduct);
    }
    const withDiscount = CATALOGUE_PROMOS.filter((p) => p.discount > 0).sort(
      (a, b) => b.discount - a.discount
    );
    const fullPrice = CATALOGUE_PROMOS.filter((p) => p.discount === 0);
    return [...withDiscount, ...fullPrice].slice(0, 12);
  }, [dbPromos]);

  const activeCatalogue = catalogues?.[0];
  const validityLabel = activeCatalogue?.ends_at
    ? `jusqu'au ${new Date(activeCatalogue.ends_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`
    : "jusqu'au 16 mai 2026";

  return (
    <section id="promos" className="relative py-20 md:py-28">
      <div className="container-px mx-auto max-w-7xl">
        <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-accent">
              <Tag className="h-3.5 w-3.5" />
              {validityLabel}
            </span>
            <h2 className="mt-3 font-display text-4xl font-semibold text-foreground md:text-5xl">
              Promotions à ne pas manquer
            </h2>
            <p className="mt-4 text-muted-foreground">
              Les meilleures offres du prospectus papier, à retrouver dans votre magasin Jardival.
            </p>
          </div>
          <a
            href={activeCatalogue?.pdf_url ?? "/catalogue-jardival-jardinales.pdf"}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            Feuilleter le catalogue →
          </a>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-3 py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Chargement des promotions…
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
              {promos.map((p, i) => (
                <ProductCard key={p.id} product={p} featured={i < 2} />
              ))}
            </div>
            <div className="mt-12 flex justify-center">
              <Button asChild size="lg" variant="outline">
                <Link to="/promotions">
                  Voir toutes les promotions
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </>
        )}
      </div>
    </section>
  );
};
