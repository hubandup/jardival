import { SiteHeader } from "@/components/SiteHeader";
import { Hero } from "@/components/Hero";
import { CatalogueBanner } from "@/components/CatalogueBanner";
import { PromoSection } from "@/components/PromoSection";
import { DriveToStoreBanner } from "@/components/DriveToStoreBanner";
import { SiteFooter } from "@/components/SiteFooter";
import { MobilePromoReels } from "@/components/MobilePromoReels";
import { useProducts } from "@/hooks/useProducts";
import { useSeo } from "@/hooks/useSeo";

const SITE_URL = "https://jardival.lovable.app";

const Index = () => {
  const { data: products = [] } = useProducts();

  useSeo({
    title: "Jardival — Promotions jardinerie en Bourgogne-Franche-Comté",
    description:
      "Découvrez les promotions Jardival, votre réseau de jardineries en Bourgogne-Franche-Comté. Magasins Point Vert près de chez vous.",
    canonical: SITE_URL + "/",
    type: "website",
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "Jardival",
        url: SITE_URL,
        logo: SITE_URL + "/placeholder.svg",
        description:
          "Réseau de jardineries Jardival & Point Vert en Bourgogne-Franche-Comté.",
      },
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "Jardival",
        url: SITE_URL,
        potentialAction: {
          "@type": "SearchAction",
          target: SITE_URL + "/promotions?q={search_term_string}",
          "query-input": "required name=search_term_string",
        },
      },
    ],
  });
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      {/* Mobile : reels promos plein écran */}
      <main className="md:hidden">
        <MobilePromoReels />
      </main>

      {/* Tablette / desktop : expérience complète */}
      <div className="hidden md:block">
        <main>
          <CatalogueBanner />
          <Hero products={products} />
          <PromoSection />
          <DriveToStoreBanner />
        </main>
        <SiteFooter />
      </div>
    </div>
  );
};

export default Index;
