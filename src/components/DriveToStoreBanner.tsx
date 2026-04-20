import { Link } from "react-router-dom";
import { STORES } from "@/data/stores";
import { MapPin, Clock, Sparkles } from "lucide-react";

export const DriveToStoreBanner = () => {
  return (
    <section className="relative overflow-hidden bg-foreground py-20 text-background md:py-24">
      <div className="absolute inset-0 opacity-10" aria-hidden>
        <div className="absolute -left-20 top-1/2 h-96 w-96 -translate-y-1/2 rounded-full bg-primary blur-3xl" />
        <div className="absolute -right-20 top-0 h-96 w-96 rounded-full bg-accent blur-3xl" />
      </div>

      <div className="container-px relative mx-auto grid max-w-7xl gap-12 md:grid-cols-2 md:items-center">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-background/20 bg-background/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="h-3.5 w-3.5" /> Drive to Store
          </span>
          <h2 className="mt-4 font-display text-4xl font-semibold leading-tight md:text-5xl">
            Vos promos vous attendent en magasin
          </h2>
          <p className="mt-5 max-w-lg text-lg text-background/70">
            Repérez vos coups de cœur en ligne, profitez de la qualité du conseil et de la disponibilité immédiate dans l'un de nos <strong className="text-background">{STORES.length} magasins Jardival</strong> en Bourgogne-Franche-Comté.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/magasins"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-sm font-semibold text-primary-foreground shadow-glow transition-transform hover:scale-[1.02]"
            >
              <MapPin className="h-4 w-4" />
              Trouver mon magasin
            </Link>
            <a
              href="#promos"
              className="inline-flex items-center gap-2 rounded-full border border-background/30 px-7 py-3.5 text-sm font-semibold text-background transition-colors hover:bg-background/10"
            >
              Voir les promos
            </a>
          </div>

          <div className="mt-10 grid grid-cols-3 gap-6 border-t border-background/10 pt-8">
            <Stat value={`${STORES.length}`} label="Magasins" />
            <Stat value="5" label="Départements" />
            <Stat value="6/7" label="Jours d'ouverture" />
          </div>
        </div>

        <div className="relative">
          <div className="rounded-2xl border border-background/15 bg-background/5 p-6 backdrop-blur-sm">
            <h3 className="font-display text-lg font-semibold">Magasins à proximité</h3>
            <ul className="mt-5 divide-y divide-background/10">
              {STORES.slice(0, 6).map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-3.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{s.name}</p>
                    <p className="truncate text-xs text-background/60">
                      {s.postalCode ? `${s.postalCode} · ` : ""}
                      {s.city}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-background/10 px-2.5 py-1 text-[11px] font-medium">
                    <Clock className="h-3 w-3" /> Ouvert
                  </span>
                </li>
              ))}
            </ul>
            <Link
              to="/magasins"
              className="mt-4 block text-center text-sm font-semibold text-background/80 underline-offset-4 hover:underline"
            >
              Voir les {STORES.length} magasins →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

const Stat = ({ value, label }: { value: string; label: string }) => (
  <div>
    <div className="font-display text-3xl font-semibold">{value}</div>
    <div className="text-xs uppercase tracking-wider text-background/60">{label}</div>
  </div>
);
