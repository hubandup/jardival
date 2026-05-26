import { useParams, Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ProductCard } from "@/components/ProductCard";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MapPin, Truck, ShieldCheck, Leaf, Loader2 } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useProduct, useProducts } from "@/hooks/useProducts";
import { useSeo } from "@/hooks/useSeo";
import { useMediaAlt } from "@/hooks/useMedia";

const DESCRIPTIONS = [
  "Conçu pour durer, ce produit Jardival allie robustesse et design soigné pour sublimer votre extérieur saison après saison.",
  "Une sélection de qualité, pensée pour les jardiniers exigeants. Matériaux résistants aux intempéries et finitions soignées.",
  "Un essentiel du jardin, plébiscité par nos clients. Pratique à utiliser et facile à entretenir au quotidien.",
  "Profitez d'un produit fiable, testé et approuvé par notre équipe. Idéal pour aménager et entretenir votre espace vert.",
];

function descriptionFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return DESCRIPTIONS[h % DESCRIPTIONS.length];
}

const ProductDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: result, isLoading } = useProduct(id);
  const { data: allProducts = [] } = useProducts();
  const product = result?.product;
  const description = result?.row.description || (id ? descriptionFor(id) : "");
  const [activeImg, setActiveImg] = useState(0);
  const currentImage = product?.images[activeImg] ?? product?.image ?? "";
  const heroAlt = useMediaAlt(currentImage, product?.name ?? "");

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
    setActiveImg(0);
  }, [id]);

  // 301-style client redirect: if URL param doesn't match the canonical slug, replace it
  useEffect(() => {
    if (!id || !product?.slug) return;
    if (product.slug !== id) {
      navigate(`/produit/${product.slug}`, { replace: true });
    }
  }, [id, product?.slug, navigate]);

  const seoTitle = product ? `${product.name} | Jardival` : "Produit | Jardival";
  const seoDesc = product
    ? `${description.slice(0, 140)} Disponible chez Jardival, votre jardinerie de proximité.`
    : "Découvrez la sélection Jardival pour votre jardin et votre extérieur.";
  const seoImage = product?.image || undefined;
  const canonical = typeof window !== "undefined" ? window.location.href.split("?")[0] : undefined;

  useSeo({
    title: seoTitle,
    description: seoDesc,
    canonical,
    image: seoImage,
    type: "product",
    jsonLd: product
      ? {
          "@context": "https://schema.org",
          "@type": "Product",
          name: product.name,
          description,
          image: product.images?.length ? product.images : product.image,
          sku: product.ref,
          category: product.category,
          brand: { "@type": "Brand", name: "Jardival" },
          offers: product.price > 0
            ? {
                "@type": "Offer",
                price: product.price,
                priceCurrency: "EUR",
                availability: "https://schema.org/InStock",
                url: canonical,
              }
            : undefined,
        }
      : undefined,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="container-px mx-auto max-w-3xl py-32 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
        </div>
        <SiteFooter />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="container-px mx-auto max-w-3xl py-32 text-center">
          <h1 className="font-display text-4xl font-semibold">Produit introuvable</h1>
          <p className="mt-4 text-muted-foreground">Ce produit n'existe pas ou n'est plus disponible.</p>
          <Link to="/" className="mt-8 inline-block rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground">
            Retour au catalogue
          </Link>
        </div>
        <SiteFooter />
      </div>
    );
  }

  const related = allProducts
    .filter((p) => p.category === product.category && p.id !== product.id)
    .slice(0, 4);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <div className="border-b border-border bg-card">
        <div className="container-px mx-auto max-w-7xl py-3">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/">Accueil</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/catalogue">Catalogue</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage className="line-clamp-1">{product.name}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </div>

      <div className="container-px mx-auto max-w-7xl pt-8">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Retour
        </button>
      </div>

      <main className="container-px mx-auto max-w-7xl py-10 md:py-14">
        <div className="grid gap-12 lg:grid-cols-2">
          {/* Galerie */}
          <div className="space-y-4">
            <div className="relative aspect-square overflow-hidden rounded-2xl border border-border bg-secondary/40">
              <img
                src={currentImage}
                alt={heroAlt}
                className="h-full w-full object-contain p-8"
              />
              {product.discount > 0 && (
                <Badge className="absolute left-4 top-4 bg-gradient-promo border-0 px-3 py-1.5 text-sm font-bold text-accent-foreground shadow-soft">
                  -{product.discount}%
                </Badge>
              )}
              {product.isNew && (
                <Badge variant="outline" className="absolute right-4 top-4 border-primary bg-background text-primary font-semibold">
                  Nouveau
                </Badge>
              )}
            </div>

            {product.images.length > 1 && (
              <div className="grid grid-cols-4 gap-3">
                {product.images.map((img, i) => (
                  <ThumbButton
                    key={i}
                    img={img}
                    index={i}
                    productName={product.name}
                    active={activeImg === i}
                    onClick={() => setActiveImg(i)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Infos */}
          <div className="flex flex-col">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              {product.category}
            </p>
            <h1 className="mt-3 font-display text-4xl font-semibold leading-tight text-foreground md:text-5xl">
              {product.name}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">Référence : {product.ref}</p>

            <div className="mt-8 flex items-baseline gap-4">
              {product.price === 0 ? (
                <span className="font-display text-4xl font-semibold text-foreground">
                  Offre en magasin
                </span>
              ) : (
                <>
                  <span className="font-display text-5xl font-semibold text-foreground">
                    {product.price.toFixed(2)}€
                  </span>
                  {product.oldPrice && (
                    <>
                      <span className="text-xl text-muted-foreground line-through">
                        {product.oldPrice.toFixed(2)}€
                      </span>
                      <span className="rounded-full bg-accent/10 px-3 py-1 text-sm font-semibold text-accent">
                        Économisez {(product.oldPrice - product.price).toFixed(2)}€
                      </span>
                    </>
                  )}
                </>
              )}
            </div>

            <p className="mt-8 leading-relaxed text-foreground/80">{description}</p>

            <div className="mt-8 grid grid-cols-2 gap-3">
              <Feature icon={<ShieldCheck className="h-4 w-4" />} text="Garantie 2 ans" />
              <Feature icon={<Truck className="h-4 w-4" />} text="Dispo en magasin" />
              <Feature icon={<Leaf className="h-4 w-4" />} text="Sélection Jardival" />
              <Feature icon={<MapPin className="h-4 w-4" />} text="Réseau Point Vert" />
            </div>

            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/magasins"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-primary px-7 py-4 text-sm font-semibold text-primary-foreground shadow-soft transition-all hover:shadow-glow hover:scale-[1.01]"
              >
                <MapPin className="h-4 w-4" />
                Voir en magasin
              </Link>
              <button
                className="rounded-full border border-border bg-background px-7 py-4 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
              >
                Ajouter aux favoris
              </button>
            </div>

            <p className="mt-6 text-xs text-muted-foreground">
              Disponibilité et prix variables selon votre magasin Jardival le plus proche.
            </p>
          </div>
        </div>

        {related.length > 0 && (
          <section className="mt-24">
            <h2 className="mb-8 font-display text-3xl font-semibold text-foreground">
              Dans la même catégorie
            </h2>
            <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
              {related.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        )}
      </main>

      <SiteFooter />
    </div>
  );
};

const ThumbButton = ({
  img,
  index,
  productName,
  active,
  onClick,
}: {
  img: string;
  index: number;
  productName: string;
  active: boolean;
  onClick: () => void;
}) => {
  const alt = useMediaAlt(img, `${productName} ${index + 1}`);
  return (
    <button
      onClick={onClick}
      className={`aspect-square overflow-hidden rounded-lg border-2 bg-secondary/40 transition-all ${
        active ? "border-primary shadow-soft" : "border-border hover:border-primary/40"
      }`}
    >
      <img src={img} alt={alt} className="h-full w-full object-contain p-2" />
    </button>
  );
};

const Feature = ({ icon, text }: { icon: React.ReactNode; text: string }) => (
  <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/30 px-3 py-2.5 text-xs font-medium text-foreground">
    <span className="text-primary">{icon}</span>
    {text}
  </div>
);

export default ProductDetail;
