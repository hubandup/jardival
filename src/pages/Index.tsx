import { SiteHeader } from "@/components/SiteHeader";
import { CatalogueBanner } from "@/components/CatalogueBanner";
import { Hero } from "@/components/Hero";
import { PromoSection } from "@/components/PromoSection";
import { Catalogue } from "@/components/Catalogue";
import { DriveToStoreBanner } from "@/components/DriveToStoreBanner";
import { SiteFooter } from "@/components/SiteFooter";
import { useProducts } from "@/hooks/useProducts";

const Index = () => {
  const { data: products = [] } = useProducts();
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <CatalogueBanner />
      <main>
        <Hero products={products} />
        <PromoSection />
        <DriveToStoreBanner />
        <Catalogue products={products} />
      </main>
      <SiteFooter />
    </div>
  );
};

export default Index;
