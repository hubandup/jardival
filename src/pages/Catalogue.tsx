import { useEffect, useState, useCallback, useRef, forwardRef } from "react";
import { Link } from "react-router-dom";
import { Document, Page, pdfjs } from "react-pdf";
import HTMLFlipBook from "react-pageflip";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import {
  ArrowLeft,
  Download,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { useIsMobile } from "@/hooks/use-mobile";
import { useCatalogues } from "@/hooks/usePromotions";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

// Worker hosted on the same package CDN — version must match pdfjs-dist
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const FALLBACK_PDF_URL = "/catalogue-jardival-jardinales.pdf";

// Each page must be a forwardRef component for react-pageflip to attach refs
type FlipPageProps = {
  pageNumber: number;
  width: number;
  height: number;
};

const FlipPage = forwardRef<HTMLDivElement, FlipPageProps>(
  ({ pageNumber, width, height }, ref) => (
    <div
      ref={ref}
      className="overflow-hidden bg-white shadow-card"
      style={{ width, height }}
    >
      <Page
        pageNumber={pageNumber}
        width={width}
        renderAnnotationLayer={false}
        renderTextLayer={false}
        loading={
          <div
            className="flex items-center justify-center bg-muted"
            style={{ width, height }}
          >
            <Loader2 className="h-5 w-5 animate-spin text-foreground/50" />
          </div>
        }
      />
    </div>
  )
);
FlipPage.displayName = "FlipPage";

const CataloguePage = () => {
  const isMobile = useIsMobile();
  const { data: catalogues } = useCatalogues();
  const activeCatalogue = catalogues?.[0];
  const pdfUrl = activeCatalogue?.pdf_url ?? FALLBACK_PDF_URL;
  const title = activeCatalogue?.title ?? "Jardinales";

  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 500, h: 700 });
  const bookRef = useRef<any>(null);

  useEffect(() => {
    document.title = `Catalogue ${title} — Feuilleter en ligne | Jardival`;
    const meta = document.querySelector('meta[name="description"]');
    const desc = `Feuilletez en ligne le catalogue ${title} Jardival.`;
    if (meta) meta.setAttribute("content", desc);

    const update = () => {
      // A4 ratio ~ 1:1.414. On desktop the book displays 2 pages side-by-side,
      // so total width = 2 * pageWidth. Cap to viewport.
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const mobile = vw < 768;
      const maxBookWidth = Math.min(vw - 48, 1100);
      const pageW = mobile ? Math.min(vw - 48, 500) : maxBookWidth / 2;
      const pageH = Math.min(pageW * 1.414, vh - 280);
      const finalW = pageH / 1.414;
      setSize({ w: finalW, h: pageH });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const onLoad = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  }, []);

  const goPrev = () => bookRef.current?.pageFlip()?.flipPrev();
  const goNext = () => bookRef.current?.pageFlip()?.flipNext();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />

      <main className="flex-1">
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
                  <BreadcrumbPage>Catalogue</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </div>

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
            Feuilletez les 8 pages de promotions — cliquez ou glissez le coin d'une page pour la tourner.
          </p>

          {/* Flip book */}
          <div className="mt-8 rounded-xl bg-gradient-to-br from-muted to-muted/40 p-4 shadow-card md:p-8">
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
              {numPages > 0 && (
                <div className="flex justify-center">
                  <HTMLFlipBook
                    ref={bookRef}
                    width={size.w}
                    height={size.h}
                    size="fixed"
                    minWidth={200}
                    maxWidth={1000}
                    minHeight={300}
                    maxHeight={1400}
                    showCover={true}
                    flippingTime={800}
                    usePortrait={isMobile}
                    drawShadow={true}
                    maxShadowOpacity={0.5}
                    mobileScrollSupport={true}
                    onFlip={(e: any) => setCurrentPage(e.data)}
                    className="mx-auto"
                    style={{}}
                    startPage={0}
                    startZIndex={0}
                    autoSize={false}
                    clickEventForward={true}
                    useMouseEvents={true}
                    swipeDistance={30}
                    showPageCorners={true}
                    disableFlipByClick={false}
                  >
                    {Array.from({ length: numPages }, (_, i) => (
                      <FlipPage
                        key={i + 1}
                        pageNumber={i + 1}
                        width={size.w}
                        height={size.h}
                      />
                    ))}
                  </HTMLFlipBook>
                </div>
              )}
            </Document>
          </div>

          {/* Toolbar under the book */}
          {numPages > 0 && (
            <div className="mt-4 flex items-center justify-center gap-4">
              <button
                onClick={goPrev}
                disabled={currentPage <= 0}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-card transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Page précédente"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="text-sm font-semibold tabular-nums text-foreground/80 min-w-[80px] text-center">
                {currentPage + 1} / {numPages}
              </span>
              <button
                onClick={goNext}
                disabled={currentPage >= numPages - 1}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-card transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Page suivante"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
};

export default CataloguePage;
