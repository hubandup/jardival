import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ProductCard } from "@/components/ProductCard";
import { MobilePromoReels } from "@/components/MobilePromoReels";
import { Tag, Loader2, X, Search } from "lucide-react";
import { usePromotions, useCatalogues, type PromotionRow } from "@/hooks/usePromotions";
import { useStores } from "@/hooks/useStores";
import { promotionToProduct } from "@/lib/promotion";
import { useSeo } from "@/hooks/useSeo";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const SITE_URL = "https://jardival.lovable.app";
const ALL = "__all__";

const Promotions = () => {
  const isMobile = useIsMobile();
  const { data: dbPromos = [], isLoading } = usePromotions();
  const { data: catalogues } = useCatalogues();
  const { data: stores = [] } = useStores();
  const activeCatalogue = catalogues?.[0];

  const [searchParams, setSearchParams] = useSearchParams();
  const category = searchParams.get("categorie") ?? ALL;
  const storeId = searchParams.get("magasin") ?? ALL;
  const query = searchParams.get("q") ?? "";

  const updateParam = (key: string, value: string, defaultValue: string) => {
    const next = new URLSearchParams(searchParams);
    if (!value || value === defaultValue) next.delete(key);
    else next.set(key, value);
    setSearchParams(next, { replace: true });
  };

  const setCategory = (v: string) => updateParam("categorie", v, ALL);
  const setStoreId = (v: string) => updateParam("magasin", v, ALL);
  const setQuery = (v: string) => updateParam("q", v, "");
  const resetAll = () => setSearchParams(new URLSearchParams(), { replace: true });

  const categories = useMemo(() => {
    const set = new Set<string>();
    dbPromos.forEach((p: PromotionRow) => {
      if (p.description && p.description.trim()) set.add(p.description.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "fr"));
  }, [dbPromos]);

  const normalize = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    return dbPromos.filter((p) => {
      if (!p.image || p.image.trim() === "") return false;
      if (category !== ALL && (p.description ?? "").trim() !== category) return false;
      if (storeId !== ALL) {
        if (!p.store_ids || p.store_ids.length === 0) return false;
        if (!p.store_ids.includes(storeId)) return false;
      }
      if (q && !normalize(p.title).includes(q)) return false;
      return true;
    });
  }, [dbPromos, category, storeId, query]);

  const promos = filtered.map(promotionToProduct);
  const hasFilters = category !== ALL || storeId !== ALL || query.trim() !== "";

  const validityLabel = activeCatalogue?.ends_at
    ? `jusqu'au ${new Date(activeCatalogue.ends_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`
    : "Offres en cours";

  useSeo({
    title: "Toutes les promotions Jardival — Catalogue Jardinales",
    description:
      "Découvrez toutes les promotions Jardival du catalogue Jardinales : jardin, plein air, mobilier, plantes et accessoires à prix réduits.",
    canonical: SITE_URL + "/promotions",
  });

  if (isMobile) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <MobilePromoReels />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="py-20 md:py-28">
        <div className="container-px mx-auto max-w-7xl">
          <div className="mb-10 max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-accent">
              <Tag className="h-3.5 w-3.5" />
              {validityLabel}
            </span>
            <h1 className="mt-3 font-display text-4xl font-semibold text-foreground md:text-5xl">
              Toutes les promotions
            </h1>
            <p className="mt-4 text-muted-foreground">
              {promos.length} offre{promos.length > 1 ? "s" : ""}
              {hasFilters ? " correspondant à vos filtres" : ""} à retrouver dans votre magasin Jardival.
            </p>
          </div>

          <div className="mb-10 flex flex-wrap items-end gap-3 rounded-2xl border border-border/60 bg-card/50 p-4">
            <div className="flex flex-col gap-1.5 flex-1 min-w-[220px]">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Recherche
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Rechercher un produit…"
                  className="pl-9"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Catégorie
              </label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Toutes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Toutes les catégories</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Magasin
              </label>
              <Select value={storeId} onValueChange={setStoreId}>
                <SelectTrigger className="w-[260px]">
                  <SelectValue placeholder="Tous" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Tous les magasins</SelectItem>
                  {stores.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} — {s.city}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetAll}
                className="self-end"
              >
                <X className="h-4 w-4" />
                Réinitialiser
              </Button>
            )}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center gap-3 py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> Chargement des promotions…
            </div>
          ) : promos.length === 0 ? (
            <p className="py-16 text-center text-muted-foreground">
              Aucune promotion ne correspond à ces filtres.
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
