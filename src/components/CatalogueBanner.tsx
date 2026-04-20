import { Link } from "react-router-dom";
import cover from "@/assets/catalogue-cover.jpg";
import { Download, Sparkles, Calendar } from "lucide-react";

const PDF_URL = "/catalogue-jardival-jardinales.pdf";
const VIEWER_URL = "/catalogue";

export const CatalogueBanner = () => {
  return (
    <section className="relative overflow-hidden border-b border-border bg-gradient-to-br from-[hsl(45,90%,55%)] via-[hsl(45,85%,52%)] to-[hsl(40,85%,48%)]">
      <div className="absolute inset-0 opacity-20" aria-hidden>
        <div className="absolute -left-20 top-0 h-72 w-72 rounded-full bg-white blur-3xl" />
        <div className="absolute -right-10 bottom-0 h-72 w-72 rounded-full bg-primary blur-3xl" />
      </div>

      <div className="container-px relative mx-auto flex max-w-7xl flex-col items-center gap-8 py-10 md:flex-row md:gap-12 md:py-12">
        {/* Cover */}
        <Link
          to={VIEWER_URL}
          className="group relative shrink-0"
          aria-label="Feuilleter le catalogue Jardinales en ligne"
        >
          <div className="absolute -inset-2 rounded-xl bg-foreground/10 blur-xl transition-opacity group-hover:opacity-70" />
          <img
            src={cover}
            alt="Catalogue Jardinales Jardival"
            className="relative h-44 w-auto rounded-lg shadow-glow ring-1 ring-foreground/10 transition-transform group-hover:-rotate-2 group-hover:scale-105 md:h-52"
            loading="eager"
          />
          <span className="absolute -right-3 -top-3 inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-accent-foreground shadow-card">
            <Sparkles className="h-3 w-3" /> Nouveau
          </span>
        </Link>

        {/* Content */}
        <div className="flex-1 text-center md:text-left">
          <span className="inline-flex items-center gap-2 rounded-full border border-foreground/20 bg-foreground/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-foreground">
            <Calendar className="h-3.5 w-3.5" /> Jusqu'au 16 mai 2026
          </span>
          <h2 className="mt-3 font-display text-3xl font-semibold leading-tight text-foreground md:text-4xl lg:text-5xl">
            Le catalogue <span className="italic">Jardinales</span> est arrivé
          </h2>
          <p className="mt-3 max-w-xl text-foreground/75 md:text-lg">
            8 pages de promotions à retrouver dans votre magasin Jardival : barbecues, mobilier, plantes et accessoires de jardin.
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 md:justify-start">
            <a
              href={PDF_URL}
              download
              className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background shadow-card transition-all hover:scale-[1.02] hover:shadow-glow"
            >
              <Download className="h-4 w-4" />
              Télécharger le catalogue
            </a>
            <Link
              to={VIEWER_URL}
              className="inline-flex items-center gap-2 rounded-full border border-foreground/30 bg-background/30 px-6 py-3 text-sm font-semibold text-foreground backdrop-blur transition-colors hover:bg-background/60"
            >
              Feuilleter en ligne
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};
