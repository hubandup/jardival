import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { MapPin, Navigation, Loader2, Compass } from "lucide-react";
import { DEPARTMENTS } from "@/data/stores";
import { useStores } from "@/hooks/useStores";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useSelectedStore } from "@/hooks/useSelectedStore";
import { nearestStore } from "@/lib/geo";
import { DirectionsMenu } from "@/components/DirectionsMenu";

interface Props {
  onLocate?: (storeId: string) => void;
}

export const NearestStore = ({ onLocate }: Props) => {
  const { state, request } = useGeolocation();
  const { data: stores = [] } = useStores();
  const { select } = useSelectedStore();

  const nearest = useMemo(() => {
    if (state.status !== "ready" || stores.length === 0) return null;
    return nearestStore(state.position, stores);
  }, [state, stores]);

  // Auto-select the nearest store as soon as geolocation resolves
  useEffect(() => {
    if (nearest?.store) select(nearest.store);
  }, [nearest, select]);

  // Idle: invitation
  if (state.status === "idle") {
    return (
      <div className="rounded-2xl border-2 border-dashed border-primary/30 bg-primary-soft/40 p-6 md:p-8">
        <div className="flex flex-col items-start gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Compass className="h-6 w-6" />
            </span>
            <div>
              <h2 className="font-display text-xl font-semibold text-foreground md:text-2xl">
                Trouvez le magasin le plus proche
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Activez la géolocalisation pour repérer instantanément votre magasin Jardival.
              </p>
            </div>
          </div>
          <button
            onClick={request}
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-soft transition-all hover:shadow-glow hover:scale-[1.02]"
          >
            <Navigation className="h-4 w-4" />
            Me géolocaliser
          </button>
        </div>
      </div>
    );
  }

  // Loading
  if (state.status === "loading") {
    return (
      <div className="flex items-center justify-center gap-3 rounded-2xl border border-border bg-card p-8 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        Recherche de votre magasin le plus proche…
      </div>
    );
  }

  // Errors
  if (state.status === "denied" || state.status === "unsupported" || state.status === "error") {
    const msg =
      state.status === "denied"
        ? "Géolocalisation refusée. Vous pouvez quand même rechercher votre magasin ci-dessous."
        : state.status === "unsupported"
        ? "Votre navigateur ne supporte pas la géolocalisation."
        : "Impossible de récupérer votre position.";
    return (
      <div className="rounded-2xl border border-border bg-secondary/40 p-6 text-sm text-muted-foreground">
        <div className="flex items-start gap-3">
          <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
          <div className="flex-1">
            <p className="font-medium text-foreground">{msg}</p>
            <button
              onClick={request}
              className="mt-2 text-xs font-semibold text-primary underline-offset-4 hover:underline"
            >
              Réessayer
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Ready
  if (!nearest) return null;
  const { store, distance } = nearest;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary-soft via-background to-primary-soft/60 p-6 shadow-card md:p-8">
      <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/15 blur-3xl" aria-hidden />

      <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-soft">
            <MapPin className="h-7 w-7" />
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
              Votre magasin le plus proche
            </p>
            <h2 className="mt-1 font-display text-2xl font-semibold leading-tight text-foreground md:text-3xl">
              {store.name}
            </h2>
            <p className="mt-1 text-sm text-foreground/80">
              {store.address} — {store.postalCode ? `${store.postalCode} ` : ""}
              {store.city}
            </p>
            <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-background/80 px-3 py-1 text-xs font-semibold text-primary">
              <Compass className="h-3.5 w-3.5" />
              À environ {distance.toFixed(1)} km · {DEPARTMENTS[store.department] ?? ""}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 md:flex-nowrap">
          <DirectionsMenu store={store} />
          <button
            onClick={() => onLocate?.(store.id)}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
          >
            Voir sur la carte
          </button>
        </div>
      </div>
    </div>
  );
};
