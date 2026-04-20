import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import {
  ArrowLeft,
  Download,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Loader2,
} from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { useIsMobile } from "@/hooks/use-mobile";

// Worker hosted on the same package CDN — version must match pdfjs-dist
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const PDF_URL = "/catalogue-jardival-jardinales.pdf";

const CataloguePage = () => {
  const isMobile = useIsMobile();
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1);
  const [containerWidth, setContainerWidth] = useState<number>(800);

  useEffect(() => {
    document.title = "Catalogue Jardinales — Feuilleter en ligne | Jardival";
    const meta = document.querySelector('meta[name="description"]');
    const desc =
      "Feuilletez en ligne le catalogue Jardinales Jardival : 8 pages de promotions valables jusqu'au 16 mai 2026.";
    if (meta) meta.setAttribute("content", desc);

    const updateWidth = () => {
      const w = Math.min(window.innerWidth - 48, 1000);
      setContainerWidth(w);
    };
    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  const onLoad = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  }, []);

  const goPrev = () => setPageNumber((p) => Math.max(1, p - (isMobile ? 1 : 2)));
  const goNext = () =>
    setPageNumber((p) => Math.min(numPages, p + (isMobile ? 1 : 2)));

  // Two pages side-by-side on desktop (book mode), single page on mobile
  const showSpread = !isMobile && pageNumber > 1 && pageNumber < numPages;
  const pageWidth = showSpread ? containerWidth / 2 : containerWidth;

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
            <a
              href={PDF_URL}
              download
              className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-card transition-all hover:scale-[1.02]"
            >
              <Download className="h-4 w-4" /> Télécharger le PDF
            </a>
          </div>

          <h1 className="mt-6 font-display text-3xl font-semibold leading-tight text-foreground md:text-4xl">
            Catalogue <span className="italic">Jardinales</span>
          </h1>
          <p className="mt-2 text-foreground/70">
            8 pages de promotions valables jusqu'au 16 mai 2026 dans tous les magasins Jardival.
          </p>

          {/* Toolbar */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-t-xl border border-b-0 border-border bg-card px-4 py-3">
            <div className="flex items-center gap-2">
              <button
                onClick={goPrev}
                disabled={pageNumber <= 1}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Page précédente"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-semibold tabular-nums text-foreground/80">
                {numPages > 0
                  ? showSpread
                    ? `${pageNumber}–${pageNumber + 1} / ${numPages}`
                    : `${pageNumber} / ${numPages}`
                  : "—"}
              </span>
              <button
                onClick={goNext}
                disabled={pageNumber >= numPages}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Page suivante"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setScale((s) => Math.max(0.5, s - 0.2))}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-foreground transition hover:bg-muted"
                aria-label="Zoom arrière"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <span className="text-sm font-semibold tabular-nums text-foreground/70 w-12 text-center">
                {Math.round(scale * 100)}%
              </span>
              <button
                onClick={() => setScale((s) => Math.min(2.5, s + 0.2))}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-foreground transition hover:bg-muted"
                aria-label="Zoom avant"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* PDF viewer */}
          <div className="overflow-auto rounded-b-xl border border-border bg-muted p-4 shadow-card md:p-6">
            <div className="flex justify-center">
              <Document
                file={PDF_URL}
                onLoadSuccess={onLoad}
                loading={
                  <div className="flex items-center justify-center gap-3 p-16 text-foreground/70">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Chargement du catalogue…
                  </div>
                }
                error={
                  <div className="flex flex-col items-center gap-4 p-10 text-center">
                    <p className="text-foreground/80">
                      Impossible d'afficher le catalogue. Téléchargez-le pour le consulter.
                    </p>
                    <a
                      href={PDF_URL}
                      download
                      className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
                    >
                      <Download className="h-4 w-4" /> Télécharger le PDF
                    </a>
                  </div>
                }
              >
                <div className="flex flex-wrap justify-center gap-2">
                  <Page
                    pageNumber={pageNumber}
                    width={pageWidth * scale}
                    renderAnnotationLayer={false}
                    renderTextLayer={false}
                    className="shadow-card"
                  />
                  {showSpread && (
                    <Page
                      pageNumber={pageNumber + 1}
                      width={pageWidth * scale}
                      renderAnnotationLayer={false}
                      renderTextLayer={false}
                      className="shadow-card"
                    />
                  )}
                </div>
              </Document>
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
};

export default CataloguePage;
