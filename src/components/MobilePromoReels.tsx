import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, Tag, MapPin, ChevronUp, Navigation } from "lucide-react";
import { usePromotions, useCatalogues } from "@/hooks/usePromotions";
import { promotionToProduct } from "@/lib/promotion";
import { useFavorites } from "@/hooks/useFavorites";
import { useSelectedStore } from "@/hooks/useSelectedStore";
import { directionsUrlFor, type DirectionsProvider } from "@/data/stores";
import iconShare from "@/assets/icon-share.svg";
import iconLike from "@/assets/icon-like.svg";

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
  const navigate = useNavigate();
  const { isFavorite, toggle } = useFavorites();
  const { store: selectedStore } = useSelectedStore();
  const [shareOpen, setShareOpen] = useState(false);
  const [dirOpen, setDirOpen] = useState(false);
  const [imgIdx, setImgIdx] = useState(0);
  const price = formatPrice(p.price);
  const oldPrice = formatPrice(p.oldPrice);
  const slug = (p as Product & { slug?: string }).slug;
  const link = slug ? `/promotions/${slug}` : `/promotions`;
  const liked = isFavorite(p.id);
  const images = (p.images && p.images.length > 0 ? p.images : [p.image]).filter(Boolean);

  const goToOffer = () => navigate(link);
  const stop = (e: React.MouseEvent | React.TouchEvent) => e.stopPropagation();

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}${link}` : link;
  const shareText = p.discount > 0
    ? `${p.name} — -${p.discount}% chez Jardival`
    : `${p.name} chez Jardival`;

  const handleNativeShare = async () => {
    const shareData: ShareData = { title: p.name, text: shareText, url: shareUrl };
    try {
      if (navigator.share && navigator.canShare?.(shareData) !== false) {
        await navigator.share(shareData);
        setShareOpen(false);
        return;
      }
      setShareOpen((v) => !v);
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      setShareOpen((v) => !v);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({ title: "Lien copié", description: "Vous pouvez le partager où vous voulez." });
    } catch {
      toast({ title: "Partage indisponible", description: shareUrl, variant: "destructive" });
    }
    setShareOpen(false);
  };

  const shareLinks = [
    { label: "WhatsApp", href: `https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}` },
    { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}` },
    { label: "X / Twitter", href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}` },
    { label: "Messenger", href: `https://www.facebook.com/dialog/send?link=${encodeURIComponent(shareUrl)}&app_id=0&redirect_uri=${encodeURIComponent(shareUrl)}` },
    { label: "Email", href: `mailto:?subject=${encodeURIComponent(p.name)}&body=${encodeURIComponent(`${shareText}\n\n${shareUrl}`)}` },
  ];

  return (
    <article
      data-reel-index={idx}
      onClick={goToOffer}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") goToOffer(); }}
      className="reels-scroll relative flex h-[calc(100dvh-4rem)] w-full snap-start snap-always flex-col overflow-hidden bg-white cursor-pointer"
    >
      {/* Carrousel horizontal images (swipe latéral) */}
      <div
        className="absolute inset-0 flex overflow-x-auto snap-x snap-mandatory pb-72"
        style={{ scrollbarWidth: "none" }}
        onScroll={(e) => {
          const el = e.currentTarget;
          const i = Math.round(el.scrollLeft / el.clientWidth);
          if (i !== imgIdx) setImgIdx(i);
        }}
        onClick={stop}
      >
        {images.map((src, i) => (
          <div
            key={`${src}-${i}`}
            className="relative flex h-full w-full shrink-0 snap-center items-center justify-center"
          >
            {src && priority !== "off" ? (
              <img
                src={src}
                alt={`${p.name}${images.length > 1 ? ` (${i + 1}/${images.length})` : ""}`}
                className="h-full w-full object-contain"
                loading={priority === "high" && i === 0 ? "eager" : "lazy"}
                // @ts-expect-error fetchpriority est valide HTML mais pas encore typé partout
                fetchpriority={priority === "high" && i === 0 ? "high" : "low"}
                decoding="async"
              />
            ) : src ? (
              <div className="h-full w-full" aria-hidden />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-primary/10 to-accent/10" />
            )}
          </div>
        ))}
      </div>
      {/* Dots compteur images si plusieurs */}
      {images.length > 1 && (
        <div className="pointer-events-none absolute left-1/2 z-10 flex -translate-x-1/2 gap-1.5" style={{ top: "3.5rem" }}>
          {images.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${i === imgIdx ? "w-5 bg-foreground/80" : "w-1.5 bg-foreground/30"}`}
            />
          ))}
        </div>
      )}

      {/* Badges en haut */}
      <div className="relative z-10 flex items-start justify-between gap-2 p-4">
        {validityLabel && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-foreground/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-background backdrop-blur">
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
      <div className="relative z-10 mx-auto -mt-2 inline-flex rounded-full bg-foreground/10 px-2.5 py-0.5 text-[10px] font-medium text-foreground/70 backdrop-blur">
        {idx + 1} / {total}
      </div>

      {/* Actions flottantes verticales (like / partage) — style reels */}
      <div className="absolute right-3 z-20 flex flex-col gap-4" style={{ bottom: "5.5rem" }}>
        <button
          type="button"
          onClick={(e) => { stop(e); const now = toggle(p.id); toast({ title: now ? "Ajouté aux favoris" : "Retiré des favoris" }); }}
          aria-label={liked ? "Retirer des favoris" : "Ajouter aux favoris"}
          aria-pressed={liked}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-white/95 shadow-card backdrop-blur transition-transform active:scale-90"
        >
          <img
            src={iconLike}
            alt=""
            className="h-8 w-8"
            style={{
              filter: liked
                ? "invert(28%) sepia(94%) saturate(7472%) hue-rotate(356deg) brightness(94%) contrast(118%)"
                : "none",
              strokeWidth: 2,
            }}
          />
        </button>
        <div className="relative">
          <button
            type="button"
            onClick={(e) => { stop(e); handleNativeShare(); }}
            aria-label={`Partager ${p.name}`}
            aria-expanded={shareOpen}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-white/95 shadow-card backdrop-blur transition-transform active:scale-90"
          >
            <img src={iconShare} alt="" className="h-8 w-8" />
          </button>
          {shareOpen && (
            <div
              onClick={stop}
              className="absolute right-0 bottom-16 z-30 w-44 overflow-hidden rounded-2xl border border-border bg-background shadow-elegant"
            >
              {shareLinks.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setShareOpen(false)}
                  className="block px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
                >
                  {s.label}
                </a>
              ))}
              <button
                type="button"
                onClick={copyLink}
                className="block w-full px-4 py-2.5 text-left text-sm font-medium text-foreground hover:bg-muted"
              >
                Copier le lien
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1" />

      {/* Bloc d'infos en bas — fond blanc, texte sombre */}
      <div className="relative z-10 space-y-3 bg-white p-5 pb-6 text-foreground">
        <h2 className="font-display text-2xl font-semibold leading-tight text-foreground">
          {p.name}
        </h2>
        {(p.pageNumber || p.reference) && (
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
            {p.pageNumber ? `Page ${p.pageNumber}` : ""}
            {p.pageNumber && p.reference ? " · " : ""}
            {p.reference ? `Réf. ${p.reference}` : ""}
          </p>
        )}
        {(p as Product & { description?: string }).description && (
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {(p as Product & { description?: string }).description}
          </p>
        )}

        <div className="flex items-end gap-3 pt-1">
          {price && (
            <span className="font-display text-3xl font-bold text-foreground">{price}</span>
          )}
          {oldPrice && (
            <span className="pb-1 text-sm text-muted-foreground line-through">
              {oldPrice}
            </span>
          )}
        </div>

        {/* CTA principal — pleine largeur (en bas) */}
        {selectedStore ? (
          <div className="relative mt-3">
            <button
              type="button"
              onClick={(e) => { stop(e); setDirOpen((v) => !v); }}
              aria-expanded={dirOpen}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-accent px-5 py-3.5 text-sm font-bold text-accent-foreground shadow-card transition-transform active:scale-95"
            >
              <Navigation className="h-4 w-4" />
              Voir chez {selectedStore.name} →
            </button>
            {dirOpen && (
              <div
                onClick={stop}
                className="absolute left-0 right-0 bottom-14 z-30 overflow-hidden rounded-2xl border border-border bg-background shadow-elegant"
              >
                {([
                  { id: "google", name: "Google Maps" },
                  { id: "apple", name: "Plans (Apple)" },
                  { id: "waze", name: "Waze" },
                  { id: "osm", name: "OpenStreetMap" },
                ] as { id: DirectionsProvider; name: string }[]).map((prov) => (
                  <a
                    key={prov.id}
                    href={directionsUrlFor(selectedStore, prov.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setDirOpen(false)}
                    className="block px-4 py-3 text-sm font-medium text-foreground hover:bg-muted"
                  >
                    {prov.name}
                  </a>
                ))}
              </div>
            )}
          </div>
        ) : (
          <Link
            to={`/magasins?promo=${encodeURIComponent(slug ?? p.id)}&geo=1`}
            onClick={stop}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-accent px-5 py-3.5 text-sm font-bold text-accent-foreground shadow-card transition-transform active:scale-95"
          >
            <MapPin className="h-4 w-4" />
            Trouver ce produit en magasin →
          </Link>
        )}
      </div>

      {/* Indicateur swipe (1ère slide uniquement, en pause si interruption) */}
      {idx === 0 && total > 1 && (
        <div
          className={`pointer-events-none absolute bottom-2 left-1/2 z-20 -translate-x-1/2 text-foreground/40 ${paused ? "" : "animate-bounce"}`}
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
    return (dbPromos ?? [])
      .filter((p) => !!p.image && p.image.trim() !== "")
      .map(promotionToProduct);
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

  if (promos.length === 0) {
    return (
      <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center px-6 text-center">
        <div className="space-y-2">
          <h2 className="font-display text-2xl font-semibold text-foreground">
            Promotions bientôt disponibles
          </h2>
          <p className="text-sm text-muted-foreground">
            Revenez très vite pour découvrir les nouvelles offres Jardival.
          </p>
        </div>
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
          Retrouve toutes les promotions ou trouve ton magasin Jardival.
        </p>
        <div className="flex w-full max-w-xs flex-col gap-3">
          <Link
            to="/promotions"
            className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-foreground shadow-card"
          >
            Toutes les promotions
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
