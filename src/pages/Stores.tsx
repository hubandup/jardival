import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { STORES, DEPARTMENTS, mapsUrl, Store } from "@/data/stores";
import { MapPin, Navigation, Search, Phone, Clock } from "lucide-react";

const Stores = () => {
  const [query, setQuery] = useState("");
  const [dept, setDept] = useState<string>("Tous");

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  const departments = useMemo(() => {
    const set = new Set(STORES.map((s) => s.department));
    return Array.from(set).sort();
  }, []);

  const filtered = useMemo(() => {
    return STORES.filter((s) => {
      if (dept !== "Tous" && s.department !== dept) return false;
      if (!query) return true;
      const q = query.toLowerCase();
      return (
        s.city.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        (s.postalCode ?? "").includes(q) ||
        s.department.includes(q)
      );
    });
  }, [query, dept]);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-hero">
        <div className="container-px mx-auto max-w-7xl py-16 md:py-24">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
            <MapPin className="h-3.5 w-3.5" /> Réseau Jardival & Point Vert
          </span>
          <h1 className="mt-4 max-w-3xl font-display text-5xl font-semibold leading-[1.05] text-foreground md:text-6xl">
            Trouvez votre magasin <span className="italic text-primary">Jardival</span>
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
            {STORES.length} magasins partout en Bourgogne-Franche-Comté pour découvrir notre catalogue, profiter des promotions et bénéficier des conseils de nos jardiniers.
          </p>

          {/* Search bar */}
          <div className="mt-10 flex flex-col gap-3 rounded-2xl border border-border bg-background p-4 shadow-card sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Code postal, ville ou nom du magasin…"
                className="w-full rounded-xl border border-border bg-background py-3.5 pl-11 pr-4 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <select
              value={dept}
              onChange={(e) => setDept(e.target.value)}
              className="rounded-xl border border-border bg-background px-4 py-3.5 text-sm font-medium outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="Tous">Tous les départements</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d} — {DEPARTMENTS[d] ?? ""}
                </option>
              ))}
            </select>
          </div>

          <p className="mt-4 text-sm text-muted-foreground">
            <strong className="text-foreground">{filtered.length}</strong> magasin{filtered.length > 1 ? "s" : ""} trouvé{filtered.length > 1 ? "s" : ""}
          </p>
        </div>
      </section>

      {/* Stores grid */}
      <section className="py-16 md:py-20">
        <div className="container-px mx-auto max-w-7xl">
          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-secondary/30 p-12 text-center text-muted-foreground">
              Aucun magasin ne correspond à votre recherche.
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {filtered.map((s) => (
                <StoreCard key={s.id} store={s} />
              ))}
            </div>
          )}
        </div>
      </section>

      <SiteFooter />
    </div>
  );
};

const StoreCard = ({ store }: { store: Store }) => (
  <article className="group flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-card">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
          {DEPARTMENTS[store.department] ?? `Département ${store.department}`}
        </p>
        <h3 className="mt-1 font-display text-xl font-semibold leading-tight text-foreground">
          {store.name}
        </h3>
      </div>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
        <MapPin className="h-5 w-5" />
      </span>
    </div>

    <div className="space-y-1 text-sm text-foreground/80">
      <p>{store.address}</p>
      <p className="font-medium">
        {store.postalCode ? `${store.postalCode} ` : ""}
        {store.city.toUpperCase()}
      </p>
    </div>

    <div className="flex items-center gap-4 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <Clock className="h-3.5 w-3.5" /> Lun–Sam · 9h–19h
      </span>
    </div>

    <div className="mt-auto flex gap-2 pt-2">
      <a
        href={mapsUrl(store)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:shadow-glow"
      >
        <Navigation className="h-4 w-4" />
        Itinéraire
      </a>
      <a
        href="tel:+33000000000"
        className="inline-flex items-center justify-center rounded-full border border-border bg-background px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-secondary"
        aria-label="Appeler le magasin"
      >
        <Phone className="h-4 w-4" />
      </a>
    </div>
  </article>
);

export default Stores;
