import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Tag, MapPin, ChevronUp, Share2 } from "lucide-react";
import { usePromotions, useCatalogues } from "@/hooks/usePromotions";
import { CATALOGUE_PROMOS } from "@/data/cataloguePromos";
import { promotionToProduct } from "@/lib/promotion";
import { useCoverPalette } from "@/hooks/useCoverPalette";
import { toast } from "@/hooks/use-toast";
import type { Product } from "@/types/product";

const formatPrice = (price?: number | null) => {
  if (price === null || price === undefined) return null;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(price);
};

interface ReelSlideProps {
  promo: Product;
  index: number;
  total: number;
  validityLabel: string | null;
  priority: "high" | "low" | "off";
  paused: boolean;
}

const ReelSlide = ({ promo: p, index: idx, total, validityLabel, priority, paused }: ReelSlideProps) => {
  const palette = useCoverPalette(p.image);
  const price = formatPrice(p.price);
  const oldPrice = formatPrice(p.oldPrice);
  const slug = (p as Product & { slug?: string }).slug;
  const link = slug ? `/promotions/${slug}` : `/promotions`;

  // Fond adapté à la couleur dominante (fallback sombre).
  const bgStyle = palette
    ? { backgroundColor: `hsl(${palette.primary})` }
    : { backgroundColor: "hsl(var(--muted))" };

  return (
    <article
      data-reel-index={idx}
      className="reels-scroll relative flex h-[calc(100dvh-4rem)] w-full snap-start snap-always flex-col overflow-hidden"
      style={bgStyle}
    >
      {/* Image centrée, max 700px */}
      <div className="absolute inset-0 flex items-center justify-center p-4 pb-44">
        {p.image && priority !== "off" ? (
          <img
            src={p.image}
            alt={p.name}
            className="max-h-full w-auto max-w-full object-contain"
            style={{ maxWidth: "min(100%, 700px)" }}
            loading={priority === "high" ? "eager" : "lazy"}
            // @ts-expect-error fetchpriority est valide HTML mais pas encore typé partout
            fetchpriority={priority === "high" ? "high" : "low"}
            decoding="async"
          />
        ) : p.image ? (
          // Slide hors zone de préchargement : on garde un placeholder vide pour ne pas déclencher la requête.
          <div className="h-full w-full max-w-[700px]" aria-hidden />
        ) : (
          <div className="h-full w-full max-w-[700px] rounded-2xl bg-gradient-to-br from-primary/30 to-accent/30" />
        )}
      </div>

      {/* Voile pour la lisibilité du bloc d'infos */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5"
        style={{
          background:
            "linear-gradient(180deg, hsl(0 0% 0% / 0) 0%, hsl(0 0% 0% / 0.55) 60%, hsl(0 0% 0% / 0.85) 100%)",
        }}
        aria-hidden
      />

      {/* Badges en haut */}
      <div className="relative z-10 flex items-start justify-between gap-2 p-4">
        {validityLabel && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-foreground backdrop-blur">
            <Tag className="h-3 w-3" />
            {validityLabel}
          </span>
        )}
        {p.discount > 0 && (
          <span className="inline-flex items-center rounded-full bg-accent px-3 py-1 text-sm font-bold text-accent-foreground shadow-card">
            -{p.discount}%
          </span>
        )}
      </div>

      {/* Compteur position */}
      <div className="relative z-10 mx-auto -mt-2 inline-flex rounded-full bg-black/40 px-2.5 py-0.5 text-[10px] font-medium text-white/80 backdrop-blur">
        {idx + 1} / {total}
      </div>

      <div className="flex-1" />

      {/* Bloc d'infos en bas */}
      <div className="relative z-10 space-y-3 p-5 pb-6 text-white">
        {p.category && (
          <span className="inline-block text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70">
            {p.category}
          </span>
        )}
        <h2 className="font-display text-2xl font-semibold leading-tight">
          {p.name}
        </h2>
        {(p as Product & { description?: string }).description && (
          <p className="line-clamp-2 text-sm text-white/80">
            {(p as Product & { description?: string }).description}
          </p>
        )}

        <div className="flex items-end gap-3 pt-1">
          {price && (
            <span className="font-display text-3xl font-bold">{price}</span>
          )}
          {oldPrice && (
            <span className="pb-1 text-sm text-white/60 line-through">
              {oldPrice}
            </span>
          )}
        </div>

        {/* CTA principal — pleine largeur */}
        <Link
          to={`/magasins?promo=${encodeURIComponent(slug ?? p.id)}&geo=1`}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-accent px-5 py-3.5 text-sm font-bold text-accent-foreground shadow-card transition-transform active:scale-95"
        >
          <MapPin className="h-4 w-4" />
          Trouver ce produit en magasin →
        </Link>

        {/* Actions secondaires */}
        <div className="flex gap-2 pt-1">
          <Link
            to={link}
            className="inline-flex flex-1 items-center justify-center rounded-full border border-white/30 bg-white/10 px-4 py-2.5 text-xs font-semibold text-white backdrop-blur transition-transform active:scale-95"
          >
            Voir l'offre
          </Link>
          <button
            type="button"
            onClick={async () => {
              const shareUrl = `${window.location.origin}${link}`;
              const shareData: ShareData = {
                title: p.name,
                text: p.discount > 0
                  ? `${p.name} — -${p.discount}% chez Jardival`
                  : `${p.name} chez Jardival`,
                url: shareUrl,
              };
              try {
                if (navigator.share && navigator.canShare?.(shareData) !== false) {
                  await navigator.share(shareData);
                  return;
                }
                await navigator.clipboard.writeText(shareUrl);
                toast({ title: "Lien copié", description: "Vous pouvez le partager où vous voulez." });
              } catch (err) {
                if ((err as Error)?.name === "AbortError") return;
                try {
                  await navigator.clipboard.writeText(shareUrl);
                  toast({ title: "Lien copié", description: "Vous pouvez le partager où vous voulez." });
                } catch {
                  toast({ title: "Partage indisponible", description: shareUrl, variant: "destructive" });
                }
              }
            }}
            aria-label={`Partager ${p.name}`}
            className="inline-flex items-center justify-center rounded-full border border-white/30 bg-white/10 px-4 py-2.5 text-xs font-semibold text-white backdrop-blur transition-transform active:scale-95"
          >
            <Share2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Indicateur swipe (1ère slide uniquement, en pause si interruption) */}
      {idx === 0 && total > 1 && (
        <div
          className={`pointer-events-none absolute bottom-2 left-1/2 z-20 -translate-x-1/2 text-white/70 ${paused ? "" : "animate-bounce"}`}
        >
          <ChevronUp className="h-5 w-5 rotate-180" />
        </div>
      )}
    </article>
  );
};

/**
 * Vue "reels" plein écran, mobile uniquement.
 * Snap vertical : une promo = un écran. Header reste sticky au-dessus.
 */
export const MobilePromoReels = () => {
  const { data: dbPromos, isLoading } = usePromotions();
  const { data: catalogues } = useCatalogues();
  const activeCatalogue = catalogues?.[0];

  const promos = useMemo<Product[]>(() => {
    if (dbPromos && dbPromos.length > 0) {
      return dbPromos.map(promotionToProduct);
    }
    return CATALOGUE_PROMOS;
  }, [dbPromos]);

  const validityLabel = activeCatalogue?.ends_at
    ? `Jusqu'au ${new Date(activeCatalogue.ends_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`
    : null;

  // Slide actuellement visible : on l'utilise pour calculer une fenêtre de préchargement.
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // Pause : interruption (onglet caché, blur, appel/clavier) OU inactivité (>1.5s sans interaction).
  const [isInteracting, setIsInteracting] = useState(false);
  const [isVisible, setIsVisible] = useState(
    typeof document !== "undefined" ? !document.hidden : true,
  );
  const [isFocused, setIsFocused] = useState(
    typeof document !== "undefined" ? document.hasFocus() : true,
  );
  const isPaused = !isVisible || !isFocused || !isInteracting;

  // Distance de préchargement (slides avant/après la slide active rendues + priorisées).
  const PRELOAD_RADIUS = 2;

  // Détection des interruptions système (onglet caché = appel téléphonique, app en arrière-plan…)
  // et perte de focus (clavier virtuel, autre appli, alerte).
  useEffect(() => {
    const onVisibility = () => setIsVisible(!document.hidden);
    const onFocus = () => setIsFocused(true);
    const onBlur = () => setIsFocused(false);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);
    window.addEventListener("pagehide", onBlur);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("pagehide", onBlur);
    };
  }, []);

  // Détection d'activité de swipe : on considère "actif" tant qu'on touche / scroll,
  // puis on retombe en pause après une courte inactivité.
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const wake = () => {
      setIsInteracting(true);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setIsInteracting(false), 1500);
    };
    const sleep = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setIsInteracting(false), 600);
    };
    root.addEventListener("scroll", wake, { passive: true });
    root.addEventListener("touchstart", wake, { passive: true });
    root.addEventListener("touchmove", wake, { passive: true });
    root.addEventListener("touchend", sleep, { passive: true });
    root.addEventListener("pointerdown", wake);
    root.addEventListener("wheel", wake, { passive: true });
    return () => {
      if (timer) clearTimeout(timer);
      root.removeEventListener("scroll", wake);
      root.removeEventListener("touchstart", wake);
      root.removeEventListener("touchmove", wake);
      root.removeEventListener("touchend", sleep);
      root.removeEventListener("pointerdown", wake);
      root.removeEventListener("wheel", wake);
    };
  }, []);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const slides = Array.from(
      root.querySelectorAll<HTMLElement>("[data-reel-index]"),
    );
    if (slides.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Choisit l'entrée la plus visible.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const idx = Number(
          (visible.target as HTMLElement).dataset.reelIndex ?? "0",
        );
        if (!Number.isNaN(idx)) setActiveIndex(idx);
      },
      { root, threshold: [0.5, 0.75, 1] },
    );

    slides.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [promos.length]);

  // Préchargement explicite via <link rel="preload"> pour les voisines hors fenêtre de rendu.
  // On le suspend en cas de pause (interruption ou inactivité) pour économiser bande passante / CPU.
  useEffect(() => {
    if (isPaused) return;
    const urls = new Set<string>();
    for (let d = 1; d <= PRELOAD_RADIUS + 1; d++) {
      [activeIndex + d, activeIndex - d].forEach((i) => {
        const img = promos[i]?.image;
        if (img) urls.add(img);
      });
    }
    const links: HTMLLinkElement[] = [];
    urls.forEach((href) => {
      const link = document.createElement("link");
      link.rel = "preload";
      link.as = "image";
      link.href = href;
      document.head.appendChild(link);
      links.push(link);
    });
    return () => {
      links.forEach((l) => l.remove());
    };
  }, [activeIndex, promos, isPaused]);

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Chargement…
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative h-[calc(100dvh-4rem)] snap-y snap-mandatory overflow-y-scroll overscroll-contain scroll-smooth"
      style={{ scrollbarWidth: "none" }}
      aria-label="Promotions Jardival"
    >
      <style>{`
        .reels-scroll::-webkit-scrollbar { display: none; }
      `}</style>

      {promos.map((p, idx) => {
        const distance = Math.abs(idx - activeIndex);
        const priority: "high" | "low" | "off" =
          distance === 0
            ? "high"
            : distance <= PRELOAD_RADIUS
              ? "low"
              : "off";
        return (
          <ReelSlide
            key={`${p.id}-${idx}`}
            promo={p}
            index={idx}
            total={promos.length}
            validityLabel={validityLabel}
            priority={priority}
            paused={isPaused}
          />
        );
      })}

      {/* Slide finale : voir toutes les promos */}
      <div className="relative flex h-[calc(100dvh-4rem)] w-full snap-start snap-always flex-col items-center justify-center gap-6 bg-gradient-to-br from-primary to-accent p-6 text-center text-primary-foreground">
        <h2 className="font-display text-3xl font-semibold">
          C'est tout pour aujourd'hui&nbsp;!
        </h2>
        <p className="max-w-xs text-primary-foreground/80">
          Retrouve l'intégralité du catalogue ou trouve ton magasin Jardival.
        </p>
        <div className="flex w-full max-w-xs flex-col gap-3">
          <Link
            to="/promotions"
            className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-foreground shadow-card"
          >
            Toutes les promotions
          </Link>
          <Link
            to="/catalogue"
            className="rounded-full border border-white/40 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur"
          >
            Feuilleter le catalogue
          </Link>
          <Link
            to="/magasins"
            className="rounded-full border border-white/40 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur"
          >
            Trouver un magasin
          </Link>
        </div>
      </div>
    </div>
  );
};
