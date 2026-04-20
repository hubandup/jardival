import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ProductCard } from "@/components/ProductCard";
import { Tag, Loader2 } from "lucide-react";
import { usePromotions, useCatalogues } from "@/hooks/usePromotions";
import { promotionToProduct } from "@/lib/promotion";
import { useSeo } from "@/hooks/useSeo";

const SITE_URL = "https://jardival.lovable.app";

const Promotions = () => {
  const { data: dbPromos = [], isLoading } = usePromotions();
  const { data: catalogues } = useCatalogues();
  const activeCatalogue = catalogues?.[0];

  const promos = dbPromos.map(promotionToProduct);

  const validityLabel = activeCatalogue?.ends_at
    ? `jusqu'au ${new Date(activeCatalogue.ends_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`
    : "Offres en cours";

  useSeo({
    title: "Toutes les promotions Jardival — Catalogue Jardinales",
    description:
      "Découvrez toutes les promotions Jardival du catalogue Jardinales : jardin, plein air, mobilier, plantes et accessoires à prix réduits.",
    canonical: SITE_URL + "/promotions",
  });

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="py-20 md:py-28">
        <div className="container-px mx-auto max-w-7xl">
          <div className="mb-12 max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-accent">
              <Tag className="h-3.5 w-3.5" />
              {validityLabel}
            </span>
            <h1 className="mt-3 font-display text-4xl font-semibold text-foreground md:text-5xl">
              Toutes les promotions
            </h1>
            <p className="mt-4 text-muted-foreground">
              {promos.length} offres à retrouver dans votre magasin Jardival.
            </p>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center gap-3 py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> Chargement des promotions…
            </div>
          ) : promos.length === 0 ? (
            <p className="py-16 text-center text-muted-foreground">
              Aucune promotion en cours pour le moment.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
              {promos.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
};

export default Promotions;
