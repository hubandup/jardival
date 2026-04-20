import productsData from "@/data/products.json";
import { Product } from "@/types/product";
import { SiteHeader } from "@/components/SiteHeader";
import { Hero } from "@/components/Hero";
import { PromoSection } from "@/components/PromoSection";
import { Catalogue } from "@/components/Catalogue";
import { SiteFooter } from "@/components/SiteFooter";

const products = productsData as Product[];

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <Hero products={products} />
        <PromoSection products={products} />
        <Catalogue products={products} />
      </main>
      <SiteFooter />
    </div>
  );
};

export default Index;
