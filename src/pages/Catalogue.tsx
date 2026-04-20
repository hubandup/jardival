import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Download, ExternalLink } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

const PDF_URL = "/catalogue-jardival-jardinales.pdf";

const CataloguePage = () => {
  useEffect(() => {
    document.title = "Catalogue Jardinales — Feuilleter en ligne | Jardival";
    const meta = document.querySelector('meta[name="description"]');
    const desc =
      "Feuilletez en ligne le catalogue Jardinales Jardival : 8 pages de promotions valables jusqu'au 16 mai 2026.";
    if (meta) meta.setAttribute("content", desc);
    else {
      const m = document.createElement("meta");
      m.name = "description";
      m.content = desc;
      document.head.appendChild(m);
    }
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />

      <main className="flex-1">
        <div className="container-px mx-auto max-w-7xl py-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-sm font-semibold text-foreground/70 hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> Retour à l'accueil
            </Link>

            <div className="flex flex-wrap items-center gap-2">
              <a
                href={PDF_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
              >
                <ExternalLink className="h-4 w-4" /> Ouvrir dans un nouvel onglet
              </a>
              <a
                href={PDF_URL}
                download
                className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-card transition-all hover:scale-[1.02]"
              >
                <Download className="h-4 w-4" /> Télécharger le PDF
              </a>
            </div>
          </div>

          <h1 className="mt-6 font-display text-3xl font-semibold leading-tight text-foreground md:text-4xl">
            Catalogue <span className="italic">Jardinales</span>
          </h1>
          <p className="mt-2 text-foreground/70">
            8 pages de promotions valables jusqu'au 16 mai 2026 dans tous les magasins Jardival.
          </p>

          {/* PDF viewer */}
          <div className="mt-6 overflow-hidden rounded-xl border border-border bg-muted shadow-card">
            <object
              data={`${PDF_URL}#view=FitH&toolbar=1&navpanes=0`}
              type="application/pdf"
              className="block h-[80vh] w-full"
              aria-label="Catalogue Jardinales Jardival"
            >
              {/* Fallback for browsers that block embedded PDFs (iOS Safari, etc.) */}
              <div className="flex flex-col items-center justify-center gap-4 p-10 text-center">
                <p className="text-foreground/80">
                  Votre navigateur ne permet pas d'afficher le PDF directement.
                </p>
                <a
                  href={PDF_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
                >
                  <ExternalLink className="h-4 w-4" /> Ouvrir le catalogue
                </a>
              </div>
            </object>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
};

export default CataloguePage;
