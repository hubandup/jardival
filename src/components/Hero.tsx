import { Product } from "@/types/product";

interface Props {
  products: Product[];
}

export const Hero = ({ products }: Props) => {
  const promoCount = products.filter((p) => p.discount > 0).length;
  const heroImages = products
    .filter((p) => p.discount >= 25)
    .slice(0, 4);

  return (
    <section id="top" className="relative overflow-hidden bg-gradient-hero">
      <div className="container-px mx-auto grid max-w-7xl items-center gap-12 py-16 md:grid-cols-2 md:py-24 lg:py-32">
        <div className="space-y-7">
          <span className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
            {promoCount} promotions actives
          </span>

          <h1 className="font-display text-5xl font-semibold leading-[1.05] text-foreground md:text-6xl lg:text-7xl">
            Le jardin,<br />
            <span className="italic text-primary">en plus beau.</span>
          </h1>

          <p className="max-w-md text-lg leading-relaxed text-muted-foreground">
            Découvrez plus de <strong className="text-foreground">{products.length} références</strong> sélectionnées par Jardival, avec des promotions jusqu'à <strong className="text-accent">-50 %</strong> sur l'arrosage, le mobilier, les outils et la décoration.
          </p>

          <div className="flex flex-wrap gap-3">
            <a
              href="#promos"
              className="rounded-full bg-accent px-7 py-3.5 text-sm font-semibold text-accent-foreground shadow-soft transition-all hover:shadow-glow hover:scale-[1.02]"
            >
              Voir les promos →
            </a>
            <a
              href="#catalogue"
              className="rounded-full border border-border bg-background px-7 py-3.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
            >
              Explorer le catalogue
            </a>
          </div>

          <div className="flex gap-8 pt-4">
            <Stat value={`${products.length}+`} label="Produits" />
            <Stat value={`${promoCount}`} label="En promo" />
            <Stat value="-50%" label="Jusqu'à" />
          </div>
        </div>

        <div className="relative">
          <div className="grid grid-cols-2 gap-4">
            {heroImages.map((p, i) => (
              <div
                key={p.id}
                className={`overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-transform ${
                  i % 2 === 0 ? "translate-y-0" : "translate-y-8"
                }`}
              >
                <div className="relative aspect-square">
                  <img
                    src={p.image}
                    alt={p.name}
                    loading="eager"
                    className="h-full w-full object-contain p-3"
                  />
                  <span className="absolute left-2 top-2 rounded-full bg-gradient-promo px-2.5 py-1 text-[10px] font-bold text-accent-foreground">
                    -{p.discount}%
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="absolute -inset-x-10 -bottom-10 -z-10 h-40 rounded-full bg-primary/15 blur-3xl" />
        </div>
      </div>
    </section>
  );
};

const Stat = ({ value, label }: { value: string; label: string }) => (
  <div>
    <div className="font-display text-2xl font-semibold text-foreground">{value}</div>
    <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
  </div>
);
