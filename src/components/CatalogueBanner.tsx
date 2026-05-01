import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import cover from "@/assets/catalogue-cover.jpg";
import { Download, Sparkles, Calendar } from "lucide-react";
import { useCatalogues } from "@/hooks/usePromotions";
import { useCoverPalette } from "@/hooks/useCoverPalette";
import type { HeroPalette } from "@/lib/coverPalette";
import { PdfCoverImage } from "@/components/PdfCoverImage";

const FALLBACK_PDF_URL = "/catalogue-jardival-jardinales.pdf";
const VIEWER_URL = "/catalogue";

// Palette par défaut (jaune Jardival) si aucune image / extraction échoue.
const FALLBACK_PALETTE: HeroPalette = {
  primary: "45 90% 55%",
  secondary: "45 85% 52%",
  accent: "40 85% 48%",
  foreground: "20 14% 12%",
};

interface CatalogueBannerProps {
  /** Si true : affiche un seul CTA "Voir le catalogue" qui ouvre le viewer (utilisé sur mobile). */
  simplified?: boolean;
}

export const CatalogueBanner = ({ simplified = false }: CatalogueBannerProps = {}) => {
  const { data: catalogues } = useCatalogues();
  const active = catalogues?.[0];

  const pdfUrl = active?.pdf_url ?? FALLBACK_PDF_URL;
  // Stratégie : cover_image admin > rendu auto de la 1re page du PDF > image fallback statique.
  const hasExplicitCover = !!active?.cover_image;
  const hasPdf = !!active?.pdf_url;
  const [pdfCoverDataUrl, setPdfCoverDataUrl] = useState<string | null>(null);
  const coverImg = active?.cover_image ?? pdfCoverDataUrl ?? cover;
  const title = active?.title ?? "Jardinales";
  const validity = active?.ends_at
    ? `Jusqu'au ${new Date(active.ends_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`
    : "Jusqu'au 16 mai 2026";

  // Override admin (champ hero_colors sur le catalogue) > extraction auto > fallback.
  const overrides = (active as { hero_colors?: Partial<HeroPalette> | null } | undefined)
    ?.hero_colors;
  const auto = useCoverPalette(coverImg);

  const palette: HeroPalette = useMemo(
    () => ({
      primary: overrides?.primary ?? auto?.primary ?? FALLBACK_PALETTE.primary,
      secondary:
        overrides?.secondary ?? auto?.secondary ?? FALLBACK_PALETTE.secondary,
      accent: overrides?.accent ?? auto?.accent ?? FALLBACK_PALETTE.accent,
      foreground:
        overrides?.foreground ?? auto?.foreground ?? FALLBACK_PALETTE.foreground,
    }),
    [overrides, auto],
  );

  // Variables CSS scopées à la section uniquement.
  const styleVars = {
    "--hero-primary": palette.primary,
    "--hero-secondary": palette.secondary,
    "--hero-accent": palette.accent,
    "--hero-fg": palette.foreground,
    background: `linear-gradient(135deg, hsl(var(--hero-primary)), hsl(var(--hero-secondary)) 50%, hsl(var(--hero-accent)))`,
  } as React.CSSProperties;

  return (
    <section
      className="relative overflow-hidden border-b border-border transition-colors duration-700"
      style={styleVars}
    >
      <div className="absolute inset-0 opacity-25" aria-hidden>
        <div
          className="absolute -left-20 top-0 h-72 w-72 rounded-full blur-3xl"
          style={{ background: "hsl(var(--hero-secondary))" }}
        />
        <div
          className="absolute -right-10 bottom-0 h-72 w-72 rounded-full blur-3xl"
          style={{ background: "hsl(var(--hero-accent))" }}
        />
      </div>

      <div
        className="container-px relative mx-auto flex max-w-7xl flex-col items-center gap-8 py-10 md:flex-row md:gap-12 md:py-12"
        style={{ color: "hsl(var(--hero-fg))" }}
      >
        <Link
          to={VIEWER_URL}
          className="group relative shrink-0"
          aria-label={`Feuilleter le catalogue ${title} en ligne`}
        >
          <div
            className="absolute -inset-2 rounded-xl blur-xl transition-opacity group-hover:opacity-70"
            style={{ background: "hsl(var(--hero-fg) / 0.1)" }}
          />
          {!hasExplicitCover && hasPdf ? (
            <PdfCoverImage
              pdfUrl={pdfUrl}
              alt={`Catalogue ${title} Jardival`}
              className="relative h-44 w-auto rounded-lg shadow-glow ring-1 transition-transform group-hover:-rotate-2 group-hover:scale-105 md:h-52"
              style={{ boxShadow: `0 25px 50px -12px hsl(var(--hero-fg) / 0.35)` }}
              onReady={setPdfCoverDataUrl}
            />
          ) : (
            <img
              src={coverImg}
              alt={`Catalogue ${title} Jardival`}
              className="relative h-44 w-auto rounded-lg shadow-glow ring-1 transition-transform group-hover:-rotate-2 group-hover:scale-105 md:h-52"
              style={{ boxShadow: `0 25px 50px -12px hsl(var(--hero-fg) / 0.35)` }}
              loading="eager"
            />
          )}
          <span
            className="absolute -right-3 -top-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider shadow-card"
            style={{
              background: "hsl(var(--hero-accent))",
              color: "hsl(var(--hero-fg))",
            }}
          >
            <Sparkles className="h-3 w-3" /> Nouveau
          </span>
        </Link>

        <div className="flex-1 text-center md:text-left">
          <span
            className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wider"
            style={{
              borderColor: "hsl(var(--hero-fg) / 0.2)",
              background: "hsl(var(--hero-fg) / 0.05)",
            }}
          >
            <Calendar className="h-3.5 w-3.5" /> {validity}
          </span>
          <h2 className="mt-3 font-display text-3xl font-semibold leading-tight md:text-4xl lg:text-5xl">
            Le catalogue <span className="italic">{title}</span> est arrivé
          </h2>
          <p
            className="mt-3 max-w-xl md:text-lg"
            style={{ color: "hsl(var(--hero-fg) / 0.75)" }}
          >
            Retrouvez toutes les promotions du moment dans votre magasin Jardival : barbecues, mobilier, plantes et accessoires de jardin.
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 md:justify-start">
            <a
              href={pdfUrl}
              target="_blank"
              rel="noreferrer"
              onClick={async (e) => {
                try {
                  e.preventDefault();
                  const res = await fetch(pdfUrl);
                  if (!res.ok) throw new Error(`HTTP ${res.status}`);
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `catalogue-${title.toLowerCase().replace(/\s+/g, "-")}.pdf`;
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  setTimeout(() => URL.revokeObjectURL(url), 1000);
                } catch (err) {
                  console.warn("[Catalogue] Téléchargement direct impossible, ouverture dans un onglet", err);
                  window.open(pdfUrl, "_blank", "noopener,noreferrer");
                }
              }}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold shadow-card transition-all hover:scale-[1.02] hover:shadow-glow"
              style={{
                background: "hsl(var(--hero-fg))",
                color: palette.foreground.startsWith("0 0%")
                  ? "hsl(var(--hero-primary))"
                  : "hsl(0 0% 98%)",
              }}
            >
              <Download className="h-4 w-4" />
              Télécharger le catalogue
            </a>
            <Link
              to={VIEWER_URL}
              className="inline-flex items-center gap-2 rounded-full border px-6 py-3 text-sm font-semibold backdrop-blur transition-colors"
              style={{
                borderColor: "hsl(var(--hero-fg) / 0.3)",
                background: "hsl(var(--hero-fg) / 0.08)",
                color: "hsl(var(--hero-fg))",
              }}
            >
              Feuilleter en ligne
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};
