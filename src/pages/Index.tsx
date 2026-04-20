import productsData from "@/data/products.json";
import { Product } from "@/types/product";
import { SiteHeader } from "@/components/SiteHeader";
import { CatalogueBanner } from "@/components/CatalogueBanner";
import { Hero } from "@/components/Hero";
import { PromoSection } from "@/components/PromoSection";
import { Catalogue } from "@/components/Catalogue";
import { DriveToStoreBanner } from "@/components/DriveToStoreBanner";
import { SiteFooter } from "@/components/SiteFooter";

const products = productsData as Product[];

const Index = () => {
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
