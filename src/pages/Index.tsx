import { useEffect } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { CatalogueBanner } from "@/components/CatalogueBanner";
import { Hero } from "@/components/Hero";
import { PromoSection } from "@/components/PromoSection";
import { Catalogue } from "@/components/Catalogue";
import { DriveToStoreBanner } from "@/components/DriveToStoreBanner";
import { SiteFooter } from "@/components/SiteFooter";
import { MobilePromoReels } from "@/components/MobilePromoReels";
import { useProducts } from "@/hooks/useProducts";
import { useCatalogues } from "@/hooks/usePromotions";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSeo } from "@/hooks/useSeo";
import { renderPdfCover, getCachedPdfCover } from "@/lib/pdfCover";

const SITE_URL = "https://jardival.lovable.app";

const FALLBACK_PDF_URL = "/catalogue-jardival-jardinales.pdf";

const Index = () => {
  const { data: products = [] } = useProducts();
  const { data: catalogues } = useCatalogues();
  const isMobile = useIsMobile();

  // Préchargement de la 1re page du PDF dès l'entrée sur mobile : la palette du
  // CatalogueBanner sera ainsi disponible avant le 1er rendu (évite le flash jaune).
  useEffect(() => {
    if (!isMobile) return;
    const pdfUrl = catalogues?.[0]?.pdf_url ?? FALLBACK_PDF_URL;
    if (!pdfUrl) return;
    if (getCachedPdfCover(pdfUrl)) return;
    // Lance en tâche de fond (idle si dispo) pour ne pas bloquer le 1er paint.
    const start = () => {
      void renderPdfCover(pdfUrl);
    };
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void) => number;
    };
    if (typeof w.requestIdleCallback === "function") {
      w.requestIdleCallback(start);
    } else {
      setTimeout(start, 0);
    }
  }, [isMobile, catalogues]);

  useSeo({
    title: "Jardival — Jardinerie & catalogue Jardinales en Bourgogne-Franche-Comté",
    description:
      "Découvrez Jardival, votre réseau de jardineries en Bourgogne-Franche-Comté. Catalogue Jardinales, promotions, magasins Point Vert près de chez vous.",
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
          target: SITE_URL + "/catalogue?q={search_term_string}",
          "query-input": "required name=search_term_string",
        },
      },
    ],
  });
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      {/* Mobile : bannière catalogue simplifiée, puis reels promos plein écran */}
      <main className="md:hidden">
        <CatalogueBanner simplified />
        <MobilePromoReels />
      </main>

      {/* Tablette / desktop : expérience complète */}
      <div className="hidden md:block">
        <CatalogueBanner />
        <main>
          <Hero products={products} />
          <Catalogue products={products} />
          <PromoSection />
          <DriveToStoreBanner />
        </main>
        <SiteFooter />
      </div>
    </div>
  );
};

export default Index;
