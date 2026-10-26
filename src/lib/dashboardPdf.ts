import { jsPDF } from "jspdf";
import html2canvas from "html2canvas-pro";
import signatureAsset from "@/assets/dashboard-signature.jpg.asset.json";

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

/** Export each direct child of `root` as a block on A4 pages (never split a block). */
export async function exportDashboardPdf(root: HTMLElement, periodLabel: string) {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, H = 297, M = 14, FOOTER = 18;
  const contentW = W - M * 2;
  const green: [number, number, number] = [25, 118, 58];
  const logo = await loadImage(signatureAsset.url);
  const dateStr = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

  // Header band on first page
  pdf.setFillColor(...green);
  pdf.rect(0, 0, W, 30, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(20);
  pdf.text("Tableau de bord Jardival", M, 15);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.text(`Rapport du ${dateStr} · ${periodLabel}`, M, 23);
  let y = 40;

  const blocks = Array.from(root.children).filter(
    (el) => !(el as HTMLElement).dataset.pdfSkip,
  ) as HTMLElement[];

  for (const el of blocks) {
    const canvas = await html2canvas(el, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      ignoreElements: (n) => (n as HTMLElement).dataset?.pdfIgnore !== undefined,
    });
    let h = (canvas.height * contentW) / canvas.width;
    let w = contentW;
    const maxH = H - FOOTER - M - 10;
    if (h > maxH) { w = (w * maxH) / h; h = maxH; }
    if (y + h > H - FOOTER - 4) { pdf.addPage(); y = M; }
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", M, y, w, h);
    y += h + 6;
  }

  // Footer on every page
  const pages = pdf.getNumberOfPages();
  const logoH = 7 * 0.7;
  const logoW = (logo.width * logoH) / logo.height;
  for (let i = 1; i <= pages; i++) {
    pdf.setPage(i);
    pdf.setDrawColor(220, 225, 222);
    pdf.line(M, H - FOOTER + 2, W - M, H - FOOTER + 2);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(200, 30, 45);
    pdf.text("DOCUMENT CONFIDENTIEL", M, H - 9);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(120, 120, 120);
    pdf.text(`${i} / ${pages}`, W / 2, H - 9, { align: "center" });
    pdf.addImage(logo, "JPEG", W - M - logoW, H - 9 - logoH + 1.5, logoW, logoH);
  }

  pdf.save(`tableau-de-bord-jardival-${new Date().toISOString().slice(0, 10)}.pdf`);
}
