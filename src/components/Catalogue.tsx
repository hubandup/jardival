import { Product } from "@/types/product";
import { ProductCard } from "./ProductCard";
import { useMemo, useState } from "react";

interface Props {
  products: Product[];
}

const PAGE_SIZE = 24;

export const Catalogue = ({ products }: Props) => {
  const categories = useMemo(() => {
    const map = new Map<string, number>();
    products.forEach((p) => map.set(p.category, (map.get(p.category) ?? 0) + 1));
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [products]);

  const [active, setActive] = useState<string>("Tous");
  const [onlyPromos, setOnlyPromos] = useState(false);
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState(PAGE_SIZE);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (active !== "Tous" && p.category !== active) return false;
      if (onlyPromos && p.discount === 0) return false;
      if (query && !p.name.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [products, active, onlyPromos, query]);

  return (
    <section id="catalogue" className="bg-secondary/40 py-20 md:py-28">
      <div className="container-px mx-auto max-w-7xl">
        <div className="mb-10">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Catalogue complet
          </span>
          <h2 className="mt-3 font-display text-4xl font-semibold text-foreground md:text-5xl">
            Tout pour votre jardin
          </h2>
        </div>

        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            <Chip active={active === "Tous"} onClick={() => { setActive("Tous"); setVisible(PAGE_SIZE); }}>
              Tous · {products.length}
            </Chip>
            {categories.map(([cat, count]) => (
              <Chip
                key={cat}
                active={active === cat}
                onClick={() => { setActive(cat); setVisible(PAGE_SIZE); }}
              >
                {cat} · {count}
              </Chip>
            ))}
          </div>
        </div>

        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setVisible(PAGE_SIZE); }}
            placeholder="Rechercher un produit…"
            className="flex-1 rounded-full border border-border bg-background px-5 py-3 text-sm shadow-soft outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <label className="flex cursor-pointer items-center gap-2 rounded-full border border-border bg-background px-5 py-3 text-sm font-medium">
            <input
              type="checkbox"
              checked={onlyPromos}
              onChange={(e) => { setOnlyPromos(e.target.checked); setVisible(PAGE_SIZE); }}
              className="h-4 w-4 accent-accent"
            />
            Promos uniquement
          </label>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-background p-12 text-center text-muted-foreground">
            Aucun produit ne correspond à votre recherche.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
              {filtered.slice(0, visible).map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>

            {visible < filtered.length && (
              <div className="mt-12 flex justify-center">
                <button
                  onClick={() => setVisible((v) => v + PAGE_SIZE)}
                  className="rounded-full border border-border bg-background px-8 py-3.5 text-sm font-semibold text-foreground shadow-soft transition-all hover:bg-primary hover:text-primary-foreground hover:border-primary"
                >
                  Voir plus ({filtered.length - visible} restants)
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
};

const Chip = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button
    onClick={onClick}
    className={`rounded-full border px-4 py-2 text-xs font-medium transition-all ${
      active
        ? "border-primary bg-primary text-primary-foreground shadow-soft"
        : "border-border bg-background text-foreground/70 hover:border-primary/50 hover:text-foreground"
    }`}
  >
    {children}
  </button>
);
