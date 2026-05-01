import { Link, useSearchParams } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { StoresMap } from "@/components/StoresMap";
import { NearestStore } from "@/components/NearestStore";
import { DEPARTMENTS, Store, distanceKm } from "@/data/stores";
import { useStores } from "@/hooks/useStores";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useSeo } from "@/hooks/useSeo";
import { Loader2, Compass } from "lucide-react";
import { DirectionsMenu } from "@/components/DirectionsMenu";
import { MapPin, Search, Phone, Clock } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const Stores = () => {
  const [searchParams] = useSearchParams();
  const autoGeo = searchParams.get("geo") === "1";
  const [query, setQuery] = useState("");
  const [dept, setDept] = useState<string>("Tous");
  const [activeId, setActiveId] = useState<string | null>(null);
  const cardRefs = useRef<Record<string, HTMLElement | null>>({});
  const { data: stores = [], isLoading } = useStores();
  const { state: geoState, request: requestGeo } = useGeolocation(autoGeo);
  const userPos = geoState.status === "ready" ? geoState.position : null;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  useSeo({
    title: "Magasins Jardival en Bourgogne-Franche-Comté — Trouvez votre jardinerie",
    description:
      "Trouvez votre magasin Jardival le plus proche en Bourgogne-Franche-Comté : adresses, horaires, services et itinéraire des jardineries du réseau.",
    canonical: typeof window !== "undefined" ? window.location.origin + "/magasins" : undefined,
    type: "website",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "Magasins Jardival",
      itemListElement: stores.slice(0, 50).map((s, i) => ({
        "@type": "ListItem",
        position: i + 1,
        item: {
          "@type": "LocalBusiness",
          name: s.name,
          address: {
            "@type": "PostalAddress",
            streetAddress: s.address,
            postalCode: s.postalCode ?? undefined,
            addressLocality: s.city,
            addressCountry: "FR",
          },
          geo: {
            "@type": "GeoCoordinates",
            latitude: s.coords[0],
            longitude: s.coords[1],
          },
          url: typeof window !== "undefined" ? `${window.location.origin}/magasins/${s.slug || s.id}` : undefined,
        },
      })),
    },
  });

  const departments = useMemo(() => {
    const set = new Set(stores.map((s) => s.department));
    return Array.from(set).sort();
  }, [stores]);

  const filtered = useMemo(() => {
    const base = stores.filter((s) => {
      if (dept !== "Tous" && s.department !== dept) return true && false;
      if (!query) return true;
      const q = query.toLowerCase();
      return (
        s.city.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        (s.postalCode ?? "").includes(q) ||
        s.department.includes(q)
      );
    });
    // Re-apply dept filter properly (the inline `return true && false` above was a guard)
    const deptFiltered = base.filter((s) => dept === "Tous" || s.department === dept);

    if (userPos) {
      return deptFiltered
        .map((s) => ({ ...s, distance: distanceKm(userPos, s.coords) }))
        .sort((a, b) => a.distance - b.distance);
    }
    return deptFiltered.map((s) => ({ ...s, distance: undefined as number | undefined }));
  }, [stores, query, dept, userPos]);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      {/* Breadcrumb */}
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
                <BreadcrumbPage>Magasins</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </div>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-hero">
        <div className="container-px mx-auto max-w-7xl pt-16 pb-8 md:pt-24 md:pb-10">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
            <MapPin className="h-3.5 w-3.5" /> Réseau Jardival & Point Vert
          </span>
          <h1 className="mt-4 max-w-3xl font-display text-5xl font-semibold leading-[1.05] text-foreground md:text-6xl">
            Trouvez votre magasin <span className="italic text-primary">Jardival</span>
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
            {stores.length} magasins partout en Bourgogne-Franche-Comté pour découvrir notre catalogue, profiter des promotions et bénéficier des conseils de nos jardiniers.
          </p>

          {/* Nearest store via geolocation */}
          <div className="mt-10">
            <NearestStore
              onLocate={(id) => {
                setActiveId(id);
                const el = cardRefs.current[id];
                if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
            />
          </div>

          {/* Search bar */}
          <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-border bg-background p-4 shadow-card sm:flex-row">
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
      <section className="pt-2 pb-10 md:pt-4 md:pb-12">
        <div className="container-px mx-auto max-w-7xl">
          {/* Map */}
          <div className="mb-12">
            <StoresMap
              stores={filtered}
              activeId={activeId}
              onSelect={(id) => {
                setActiveId(id);
                const el = cardRefs.current[id];
                if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
            />
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center gap-3 rounded-xl border border-border bg-card p-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> Chargement des magasins…
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-secondary/30 p-12 text-center text-muted-foreground">
              Aucun magasin ne correspond à votre recherche.
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {filtered.map((s) => (
                <div
                  key={s.id}
                  ref={(el) => (cardRefs.current[s.id] = el)}
                >
                  <StoreCard
                    store={s}
                    active={activeId === s.id}
                    onHover={() => setActiveId(s.id)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <SiteFooter />
    </div>
  );
};

const StoreCard = ({ store, active, onHover }: { store: Store; active?: boolean; onHover?: () => void }) => (
  <article
    onMouseEnter={onHover}
    className={`group flex h-full flex-col gap-4 rounded-2xl border bg-card p-6 transition-all hover:-translate-y-1 hover:shadow-card ${
      active ? "border-accent shadow-card ring-2 ring-accent/20" : "border-border hover:border-primary/40"
    }`}
  >
    <Link to={`/magasins/${store.slug || store.id}`} className="flex items-start justify-between gap-3">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
          {DEPARTMENTS[store.department] ?? `Département ${store.department}`}
        </p>
        <h3 className="mt-1 font-display text-xl font-semibold leading-tight text-foreground group-hover:text-primary">
          {store.name}
        </h3>
      </div>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
        <MapPin className="h-5 w-5" />
      </span>
    </Link>

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

    <div className="mt-auto flex flex-col gap-2 pt-2">
      <Link
        to={`/magasins/${store.slug || store.id}`}
        className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:shadow-glow"
      >
        Voir le magasin
      </Link>
      <div className="flex gap-2">
        <DirectionsMenu store={store} variant="outline" className="flex-1" />
        <a
          href="tel:+33000000000"
          className="inline-flex items-center justify-center rounded-full border border-border bg-background px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-secondary"
          aria-label="Appeler le magasin"
        >
          <Phone className="h-4 w-4" />
        </a>
      </div>
    </div>
  </article>
);

export default Stores;
