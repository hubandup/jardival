import { useEffect, useMemo, useRef } from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  ArrowLeft,
  MapPin,
  Phone,
  Clock,
  Check,
  ExternalLink,
} from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { DirectionsMenu } from "@/components/DirectionsMenu";
import { ProductCard } from "@/components/ProductCard";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  DEPARTMENTS,
  mapsUrl,
  distanceKm,
  formatStoreHours,
} from "@/data/stores";
import { useStore, useStores } from "@/hooks/useStores";
import { usePromotions } from "@/hooks/usePromotions";
import { promotionToProduct } from "@/lib/promotion";
import { useSeo } from "@/hooks/useSeo";
import { useMediaAlt } from "@/hooks/useMedia";
import storeHero from "@/assets/store-placeholder.jpg";

const StoreDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { data: store, isLoading } = useStore(id);
  const { data: allStores = [] } = useStores();
  const { data: allPromos = [] } = usePromotions();
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [id]);

  const canonical = typeof window !== "undefined" ? window.location.origin + `/magasins/${store?.slug || id}` : undefined;
  useSeo({
    title: store ? `${store.name} — ${store.city} | Jardival` : "Magasin Jardival",
    description: store
      ? `${store.name}, ${store.address}, ${store.city}. Horaires, itinéraire et services du magasin Jardival.`
      : "Magasin du réseau Jardival.",
    canonical,
    image: store?.image ?? undefined,
    type: "website",
    jsonLd: store
      ? {
          "@context": "https://schema.org",
          "@type": "LocalBusiness",
          name: store.name,
          image: store.image ?? undefined,
          telephone: store.phone ?? undefined,
          address: {
            "@type": "PostalAddress",
            streetAddress: store.address,
            postalCode: store.postalCode ?? undefined,
            addressLocality: store.city,
            addressCountry: "FR",
          },
          geo: {
            "@type": "GeoCoordinates",
            latitude: store.coords[0],
            longitude: store.coords[1],
          },
          url: canonical,
          openingHoursSpecification: store.hours
            ?.filter((h) => !h.closed)
            .map((h) => ({
              "@type": "OpeningHoursSpecification",
              dayOfWeek: h.day,
              opens: h.morning?.split("–")[0]?.trim(),
              closes: h.afternoon?.split("–")[1]?.trim(),
            })),
        }
      : undefined,
  });

  // Init mini-map
  useEffect(() => {
    if (!store || !mapEl.current || mapRef.current) return;
    const map = L.map(mapEl.current, {
      zoomControl: true,
      scrollWheelZoom: false,
      dragging: true,
    }).setView(store.coords, 15);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    const html = `
      <div style="position:relative;width:42px;height:42px;transform:translate(-50%,-100%);">
        <svg viewBox="0 0 32 44" width="42" height="42" xmlns="http://www.w3.org/2000/svg">
          <path d="M16 0C7.16 0 0 7.16 0 16c0 11 16 28 16 28s16-17 16-28c0-8.84-7.16-16-16-16z" fill="hsl(354,78%,48%)" stroke="white" stroke-width="2"/>
          <circle cx="16" cy="16" r="6" fill="white"/>
        </svg>
      </div>`;
    L.marker(store.coords, {
      icon: L.divIcon({
        html,
        className: "jardival-marker",
        iconSize: [42, 42],
        iconAnchor: [21, 42],
      }),
    }).addTo(map);

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [store]);

  const heroAlt = useMediaAlt(
    store?.image ?? undefined,
    `Devanture du magasin ${store?.name ?? ""}`,
  );

  if (!id) return <Navigate to="/magasins" replace />;
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="container-px mx-auto max-w-3xl py-32 text-center text-muted-foreground">
          Chargement…
        </div>
        <SiteFooter />
      </div>
    );
  }
  if (!store) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="container-px mx-auto max-w-3xl py-32 text-center">
          <h1 className="font-display text-4xl font-semibold">
            Magasin introuvable
          </h1>
          <p className="mt-4 text-muted-foreground">
            Ce magasin n'existe pas ou n'est plus référencé.
          </p>
          <Link
            to="/magasins"
            className="mt-8 inline-block rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
          >
            Voir tous les magasins
          </Link>
        </div>
        <SiteFooter />
      </div>
    );
  }

  const heroImage = store.image ?? storeHero;

  const today = new Date().getDay(); // 0 = dim, 1 = lun…
  const todayIndex = today === 0 ? 6 : today - 1;
  const todayHours = store.hours?.[todayIndex];
  const promos = allPromos
    .filter((p) => !p.store_ids || p.store_ids.length === 0 || p.store_ids.includes(store.id))
    .slice(0, 4)
    .map(promotionToProduct);
  const nearby = allStores
    .filter((s) => s.id !== store.id)
    .map((s) => ({ ...s, distance: distanceKm(store.coords, s.coords) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 3);

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
                <BreadcrumbLink asChild>
                  <Link to="/magasins">Magasins</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{store.name}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </div>

      {/* Hero */}
      <section className="relative h-[420px] w-full overflow-hidden md:h-[520px]">
        <img
          src={heroImage}
          alt={heroAlt}
          className="absolute inset-0 h-full w-full object-cover"
          width={1920}
          height={1024}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/85 via-foreground/40 to-transparent" />
        <div className="container-px relative z-10 mx-auto flex h-full max-w-7xl flex-col justify-end pb-10">
          <Link
            to="/magasins"
            className="mb-6 inline-flex w-fit items-center gap-2 rounded-full bg-background/90 px-4 py-2 text-sm font-semibold text-foreground backdrop-blur transition hover:bg-background"
          >
            <ArrowLeft className="h-4 w-4" /> Tous les magasins
          </Link>
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/30 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white backdrop-blur">
            {DEPARTMENTS[store.department] ?? `Département ${store.department}`}
          </span>
          <h1 className="mt-4 font-display text-4xl font-semibold leading-tight text-white md:text-6xl">
            {store.name}
          </h1>
          <p className="mt-3 flex items-center gap-2 text-base text-white/90 md:text-lg">
            <MapPin className="h-4 w-4" />
            {store.address}
            {store.postalCode ? `, ${store.postalCode}` : ","} {store.city}
          </p>
        </div>
      </section>

      {/* Quick info */}
      <section className="border-b border-border bg-card">
        <div className="container-px mx-auto grid max-w-7xl gap-6 py-8 md:grid-cols-3">
          {/* Horaires aujourd'hui */}
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Aujourd'hui
              </p>
              <p className="mt-1 font-semibold text-foreground">
                {formatStoreHours(todayHours)}
              </p>
            </div>
          </div>
          {/* Téléphone */}
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
              <Phone className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Téléphone
              </p>
              <a
                href={`tel:${store.phone?.replace(/\s/g, "")}`}
                className="mt-1 block font-semibold text-foreground hover:text-primary"
              >
                {store.phone}
              </a>
            </div>
          </div>
          {/* Itinéraire */}
          <div className="flex items-center md:justify-end">
            <DirectionsMenu store={store} />
          </div>
        </div>
      </section>

      {/* Main content grid */}
      <section className="py-14 md:py-20">
        <div className="container-px mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1fr_400px]">
          {/* Colonne gauche */}
          <div className="space-y-12">
            {/* Carte */}
            <div>
              <h2 className="mb-5 font-display text-2xl font-semibold text-foreground md:text-3xl">
                Localisation
              </h2>
              <div
                ref={mapEl}
                className="h-[380px] w-full overflow-hidden rounded-2xl border border-border shadow-card"
                style={{ background: "hsl(var(--secondary))" }}
              />
              <a
                href={mapsUrl(store)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                Ouvrir sur OpenStreetMap <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>

            {/* Services */}
            <div>
              <h2 className="mb-5 font-display text-2xl font-semibold text-foreground md:text-3xl">
                Services & rayons
              </h2>
              <div className="flex flex-wrap gap-2.5">
                {store.services?.map((svc) => (
                  <span
                    key={svc}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-sm font-medium text-foreground"
                  >
                    <Check className="h-3.5 w-3.5 text-primary" />
                    {svc}
                  </span>
                ))}
              </div>
            </div>

            {/* Promos catalogue */}
            {promos.length > 0 && (
              <div>
                <div className="mb-5 flex items-end justify-between gap-4">
                  <h2 className="font-display text-2xl font-semibold text-foreground md:text-3xl">
                    Promos du moment
                  </h2>
                  <Link
                    to="/catalogue"
                    className="text-sm font-semibold text-primary hover:underline"
                  >
                    Voir le catalogue →
                  </Link>
                </div>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  {promos.map((p) => (
                    <ProductCard key={p.id} product={p} />
                  ))}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Offres valables jusqu'au 16 mai 2026 dans votre magasin{" "}
                  {store.name}.
                </p>
              </div>
            )}
          </div>

          {/* Colonne droite : horaires semaine + magasins proches */}
          <aside className="space-y-8">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
              <h3 className="font-display text-xl font-semibold text-foreground">
                Horaires d'ouverture
              </h3>
              <ul className="mt-4 space-y-2.5">
                {store.hours?.map((h, i) => {
                  const isToday = i === todayIndex;
                  return (
                    <li
                      key={h.day}
                      className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm ${
                        isToday
                          ? "bg-primary-soft font-semibold text-primary"
                          : "text-foreground/80"
                      }`}
                    >
                      <span>{h.day}</span>
                      <span className="tabular-nums">
                        {formatStoreHours(h)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
              <h3 className="font-display text-xl font-semibold text-foreground">
                Magasins à proximité
              </h3>
              <ul className="mt-4 space-y-3">
                {nearby.map((s) => (
                  <li key={s.id}>
                    <Link
                      to={`/magasins/${s.slug || s.id}`}
                      className="group flex items-center justify-between gap-3 rounded-lg border border-border p-3 transition hover:border-primary/40 hover:bg-secondary/40"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-foreground group-hover:text-primary">
                          {s.name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {s.city} · {DEPARTMENTS[s.department] ?? ""}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">
                        {s.distance.toFixed(0)} km
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
};

export default StoreDetail;
