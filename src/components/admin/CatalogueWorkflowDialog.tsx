// Workflow d'extraction des promotions d'un catalogue, en 4 étapes :
//  1) Upload du PDF (drag & drop)
//  2) Sélection des zones (IA + ajustement manuel)
//  3) Tableau d'édition + export XLSX
//  4) Programmation (dates) + validation finale → insertion en base
//
// L'état est persisté dans la table `catalogue_extractions` pour pouvoir
// reprendre là où on s'était arrêté.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Loader2,
  UploadCloud,
  Sparkles,
  ImageIcon,
  Wand2,
  FileSpreadsheet,
  Check,
  Trash2,
  ChevronRight,
  ChevronLeft,
  CalendarClock,
  RefreshCcw,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { cropAndUploadPromoImages } from "@/lib/pdfImageCrop";
import CataloguePromoBboxPreview, { type PreviewBox } from "./CataloguePromoBboxPreview";

export type WorkflowStep = "upload" | "zones" | "tableau" | "programmation";

export interface WorkflowPromo {
  title: string;
  description?: string | null;
  price?: number | null;
  original_price?: number | null;
  discount_percent?: number | null;
  category?: string | null;
  page_number?: number | null;
  bbox_2d?: [number, number, number, number] | null;
  image_url?: string | null;
  image_cutout_url?: string | null;
  selected?: boolean;
}

export interface CatalogueLite {
  id: string;
  title: string;
  pdf_url: string | null;
  starts_at: string | null;
  ends_at: string | null;
}

interface Props {
  catalogue: CatalogueLite;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialStep?: WorkflowStep;
  /** Recharger les données admin-catalogues à la fermeture */
  onCompleted?: () => void;
}

const STEPS: { key: WorkflowStep; label: string; icon: React.ElementType }[] = [
  { key: "upload", label: "PDF", icon: UploadCloud },
  { key: "zones", label: "Zones", icon: Sparkles },
  { key: "tableau", label: "Tableau", icon: FileSpreadsheet },
  { key: "programmation", label: "Programmation", icon: CalendarClock },
];

export default function CatalogueWorkflowDialog({
  catalogue,
  open,
  onOpenChange,
  initialStep,
  onCompleted,
}: Props) {
  const qc = useQueryClient();
  const [step, setStep] = useState<WorkflowStep>(initialStep ?? "upload");
  const [pdfUrl, setPdfUrl] = useState<string | null>(catalogue.pdf_url);
  const [promos, setPromos] = useState<WorkflowPromo[]>([]);
  const [startsAt, setStartsAt] = useState<string>(catalogue.starts_at ?? "");
  const [endsAt, setEndsAt] = useState<string>(catalogue.ends_at ?? "");
  const [hydrated, setHydrated] = useState(false);
  const [extractionId, setExtractionId] = useState<string | null>(null);
  const dirtyRef = useRef(false);

  // Charger le brouillon existant à l'ouverture
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setHydrated(false);
      const { data, error } = await supabase
        .from("catalogue_extractions")
        .select("id, step, promos, starts_at, ends_at")
        .eq("catalogue_id", catalogue.id)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.error(error);
        toast.error("Impossible de charger le brouillon");
      }
      if (data) {
        setExtractionId(data.id);
        setPromos((data.promos as unknown as WorkflowPromo[]) ?? []);
        setStartsAt(data.starts_at ?? catalogue.starts_at ?? "");
        setEndsAt(data.ends_at ?? catalogue.ends_at ?? "");
        // Si initialStep est fourni (depuis le menu Reprendre), on l'honore.
        // Sinon, on reprend à l'étape sauvegardée.
        if (!initialStep) {
          setStep((data.step as WorkflowStep) ?? "upload");
        }
      } else {
        setExtractionId(null);
        setPromos([]);
        setStartsAt(catalogue.starts_at ?? "");
        setEndsAt(catalogue.ends_at ?? "");
      }
      setPdfUrl(catalogue.pdf_url);
      setHydrated(true);
      dirtyRef.current = false;
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, catalogue.id]);

  // Sauvegarde auto (debounced) du brouillon dès qu'il y a des changements
  useEffect(() => {
    if (!open || !hydrated) return;
    if (!dirtyRef.current) return;
    const t = setTimeout(async () => {
      const payload = {
        catalogue_id: catalogue.id,
        step,
        promos: promos as unknown as never,
        starts_at: startsAt || null,
        ends_at: endsAt || null,
        status: "draft" as const,
      };
      const { data, error } = await supabase
        .from("catalogue_extractions")
        .upsert([payload], { onConflict: "catalogue_id" })
        .select("id")
        .maybeSingle();
      if (error) {
        console.error("Save draft error", error);
      } else if (data) {
        setExtractionId(data.id);
        dirtyRef.current = false;
      }
    }, 800);
    return () => clearTimeout(t);
  }, [open, hydrated, step, promos, startsAt, endsAt, catalogue.id]);

  const markDirty = useCallback(() => {
    dirtyRef.current = true;
  }, []);

  const updatePromos = useCallback(
    (updater: (prev: WorkflowPromo[]) => WorkflowPromo[]) => {
      setPromos((prev) => {
        const next = updater(prev);
        dirtyRef.current = true;
        return next;
      });
    },
    []
  );

  const reset = () => {
    if (!confirm("Recommencer entièrement ce catalogue ? Le brouillon sera effacé.")) return;
    setPromos([]);
    setStep("upload");
    setStartsAt(catalogue.starts_at ?? "");
    setEndsAt(catalogue.ends_at ?? "");
    markDirty();
  };

  // --- Étape 1 : upload du PDF ---
  const handlePdfUpload = async (file: File) => {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Merci de fournir un fichier PDF");
      return;
    }
    const path = `pdf-${Date.now()}.pdf`;
    const { error } = await supabase.storage
      .from("catalogues")
      .upload(path, file, { contentType: "application/pdf" });
    if (error) {
      toast.error("Erreur upload PDF");
      return;
    }
    const { data } = supabase.storage.from("catalogues").getPublicUrl(path);
    setPdfUrl(data.publicUrl);
    // On met à jour aussi le catalogue
    await supabase.from("catalogues").update({ pdf_url: data.publicUrl }).eq("id", catalogue.id);
    qc.invalidateQueries({ queryKey: ["admin-catalogues"] });
    toast.success("PDF uploadé");
    markDirty();
    setStep("zones");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Catalogue : {catalogue.title}
          </DialogTitle>
          <DialogDescription>
            Workflow guidé en 4 étapes pour extraire et publier les promotions.
          </DialogDescription>
        </DialogHeader>

        <Stepper current={step} onJump={(s) => setStep(s)} disabled={!pdfUrl} />

        {!hydrated ? (
          <div className="py-12 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {step === "upload" && (
              <UploadStep currentPdfUrl={pdfUrl} onUploaded={handlePdfUpload} onNext={() => setStep("zones")} />
            )}
            {step === "zones" && (
              <ZonesStep
                pdfUrl={pdfUrl}
                catalogue={catalogue}
                promos={promos}
                updatePromos={updatePromos}
                onPrev={() => setStep("upload")}
                onNext={() => setStep("tableau")}
              />
            )}
            {step === "tableau" && (
              <TableStep
                catalogue={catalogue}
                promos={promos}
                updatePromos={updatePromos}
                onPrev={() => setStep("zones")}
                onNext={() => setStep("programmation")}
              />
            )}
            {step === "programmation" && (
              <ScheduleStep
                catalogue={catalogue}
                promos={promos}
                startsAt={startsAt}
                endsAt={endsAt}
                onChangeStarts={(v) => {
                  setStartsAt(v);
                  markDirty();
                }}
                onChangeEnds={(v) => {
                  setEndsAt(v);
                  markDirty();
                }}
                onPrev={() => setStep("tableau")}
                onValidated={async () => {
                  // Marque le brouillon comme validé
                  if (extractionId) {
                    await supabase
                      .from("catalogue_extractions")
                      .update({ status: "validated", step: "valide" })
                      .eq("id", extractionId);
                  }
                  qc.invalidateQueries({ queryKey: ["admin-catalogues"] });
                  qc.invalidateQueries({ queryKey: ["promotions"] });
                  qc.invalidateQueries({ queryKey: ["admin-promotions"] });
                  qc.invalidateQueries({ queryKey: ["hero_promos"] });
                  onCompleted?.();
                  onOpenChange(false);
                }}
              />
            )}
          </>
        )}

        <DialogFooter className="flex justify-between sm:justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={reset} title="Effacer le brouillon et recommencer">
            <RefreshCcw className="h-4 w-4" />
            Recommencer
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------- Stepper ---------------------------- */

function Stepper({
  current,
  onJump,
  disabled,
}: {
  current: WorkflowStep;
  onJump: (s: WorkflowStep) => void;
  disabled?: boolean;
}) {
  const currentIdx = STEPS.findIndex((s) => s.key === current);
  return (
    <div className="flex items-center gap-1 py-2 overflow-x-auto">
      {STEPS.map((s, i) => {
        const Icon = s.icon;
        const active = i === currentIdx;
        const done = i < currentIdx;
        return (
          <div key={s.key} className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              disabled={disabled && i > 0}
              onClick={() => onJump(s.key)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition",
                active && "bg-primary text-primary-foreground",
                !active && done && "text-primary hover:bg-primary/10",
                !active && !done && "text-muted-foreground hover:bg-muted",
                disabled && i > 0 && "opacity-40 cursor-not-allowed"
              )}
            >
              <span
                className={cn(
                  "h-5 w-5 rounded-full flex items-center justify-center text-xs",
                  active ? "bg-primary-foreground/20" : done ? "bg-primary/20" : "bg-muted"
                )}
              >
                {done ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <Icon className="h-4 w-4" />
              {s.label}
            </button>
            {i < STEPS.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </div>
        );
      })}
    </div>
  );
}

/* ---------------------------- Étape 1 : Upload ---------------------------- */

function UploadStep({
  currentPdfUrl,
  onUploaded,
  onNext,
}: {
  currentPdfUrl: string | null;
  onUploaded: (file: File) => Promise<void>;
  onNext: () => void;
}) {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    if (!files || !files[0]) return;
    setUploading(true);
    try {
      await onUploaded(files[0]);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="py-6">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => !uploading && document.getElementById("catalogue-pdf-input")?.click()}
        className={cn(
          "border-2 border-dashed rounded-lg p-16 text-center transition cursor-pointer",
          dragActive ? "border-primary bg-primary/5" : "border-border bg-muted/30 hover:bg-muted/50"
        )}
      >
        <UploadCloud className="h-14 w-14 mx-auto text-muted-foreground mb-4" />
        <p className="text-base font-medium mb-1">
          Glissez-déposez votre catalogue PDF ici
        </p>
        <p className="text-sm text-muted-foreground">
          ou cliquez pour sélectionner un fichier
        </p>
        <input
          id="catalogue-pdf-input"
          type="file"
          accept="application/pdf"
          onChange={(e) => handleFiles(e.target.files)}
          disabled={uploading}
          className="hidden"
        />
        {uploading && (
          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Envoi en cours…
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------- Étape 2 : Zones ---------------------------- */

function ZonesStep({
  pdfUrl,
  catalogue,
  promos,
  updatePromos,
  onPrev,
  onNext,
}: {
  pdfUrl: string | null;
  catalogue: CatalogueLite;
  promos: WorkflowPromo[];
  updatePromos: (u: (p: WorkflowPromo[]) => WorkflowPromo[]) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const [extracting, setExtracting] = useState(false);
  const [croppingImages, setCroppingImages] = useState(false);
  const [cropProgress, setCropProgress] = useState<{ done: number; total: number } | null>(null);

  if (!pdfUrl) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-muted-foreground mb-4">
          Aucun PDF disponible pour ce catalogue.
        </p>
        <Button variant="outline" onClick={onPrev}>
          <ChevronLeft className="h-4 w-4" /> Uploader un PDF
        </Button>
      </div>
    );
  }

  const handleAiExtract = async () => {
    setExtracting(true);
    try {
      const absoluteUrl = new URL(pdfUrl, window.location.origin).toString();
      const { data, error } = await supabase.functions.invoke("extract-catalogue-promos", {
        body: { pdf_url: absoluteUrl, starts_at: catalogue.starts_at, ends_at: catalogue.ends_at },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const list: WorkflowPromo[] = (data?.promotions ?? []).map((p: WorkflowPromo) => ({
        ...p,
        selected: true,
      }));
      updatePromos(() => list);
      toast.success(`${list.length} zones détectées par l'IA`);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Erreur extraction IA");
    } finally {
      setExtracting(false);
    }
  };

  const handleCropImages = async () => {
    const tasks = promos
      .map((p, idx) => ({ p, idx }))
      .filter(({ p }) => p.bbox_2d && p.page_number && p.selected !== false)
      .map(({ p, idx }) => ({
        pageNumber: p.page_number!,
        bbox: p.bbox_2d!,
        filename: `${idx}-${p.title}`,
      }));
    if (!tasks.length) {
      toast.error("Aucune zone à extraire");
      return;
    }
    setCroppingImages(true);
    setCropProgress({ done: 0, total: tasks.length });
    try {
      const results = await cropAndUploadPromoImages(
        new URL(pdfUrl, window.location.origin).toString(),
        tasks,
        (done, total) => setCropProgress({ done, total }),
        { scale: 3, format: "jpeg", quality: 0.92 }
      );
      const byFilename = new Map(results.map((r) => [r.filename, r.publicUrl]));
      updatePromos((prev) =>
        prev.map((p, idx) => {
          const url = byFilename.get(`${idx}-${p.title}`);
          return url ? { ...p, image_url: url, image_cutout_url: null } : p;
        })
      );
      const ok = results.filter((r) => r.publicUrl).length;
      toast.success(`${ok} images extraites`);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Erreur crop");
    } finally {
      setCroppingImages(false);
    }
  };

  const selectedWithBbox = promos.filter((p) => p.selected !== false && p.bbox_2d).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2 p-3 border rounded-md bg-muted/30">
        <div>
          <p className="text-sm font-medium">Détection des zones de promotions</p>
          <p className="text-xs text-muted-foreground">
            L'IA propose les zones — vous pouvez ensuite les déplacer, redimensionner, supprimer ou en ajouter.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleAiExtract} disabled={extracting} size="sm">
            {extracting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {promos.length ? "Relancer l'IA" : "Détecter avec l'IA"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCropImages}
            disabled={croppingImages || selectedWithBbox === 0}
          >
            {croppingImages ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {cropProgress ? `${cropProgress.done}/${cropProgress.total}` : ""}
              </>
            ) : (
              <>
                <ImageIcon className="h-4 w-4" />
                Extraire les images ({selectedWithBbox})
              </>
            )}
          </Button>
        </div>
      </div>

      {promos.length > 0 ? (
        <CataloguePromoBboxPreview
          pdfUrl={new URL(pdfUrl, window.location.origin).toString()}
          boxes={promos
            .map((p, idx): PreviewBox | null =>
              p.bbox_2d && p.page_number
                ? {
                    pageNumber: p.page_number,
                    bbox: p.bbox_2d,
                    index: idx + 1,
                    label: p.title,
                    subLabel: [
                      p.price != null ? `${p.price} €` : null,
                      p.original_price != null ? `au lieu de ${p.original_price} €` : null,
                    ]
                      .filter(Boolean)
                      .join(" · "),
                    selected: p.selected !== false,
                    price: p.price,
                    originalPrice: p.original_price,
                    description: p.description,
                    imageUrl: p.image_cutout_url ?? p.image_url,
                  }
                : null
            )
            .filter((b): b is PreviewBox => b !== null)}
          onToggleBox={(i) =>
            updatePromos((prev) =>
              prev.map((p, idx) => (idx === i ? { ...p, selected: !p.selected } : p))
            )
          }
          onDeleteBox={(i) => updatePromos((prev) => prev.filter((_, idx) => idx !== i))}
          onUpdateBbox={(i, bbox) =>
            updatePromos((prev) => prev.map((p, idx) => (idx === i ? { ...p, bbox_2d: bbox } : p)))
          }
          onUpdateText={(i, patch) =>
            updatePromos((prev) =>
              prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p))
            )
          }
          onAddBox={(pageNumber, bbox) =>
            updatePromos((prev) => [
              ...prev,
              {
                title: `Nouvelle zone (page ${pageNumber})`,
                page_number: pageNumber,
                bbox_2d: bbox,
                selected: true,
              },
            ])
          }
        />
      ) : (
        <div className="py-12 text-center border rounded-md bg-muted/20">
          <Sparkles className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            Lancez la détection IA pour proposer automatiquement les zones de promotions.
          </p>
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onPrev}>
          <ChevronLeft className="h-4 w-4" /> Précédent
        </Button>
        <Button onClick={onNext} disabled={promos.length === 0}>
          Étape suivante <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/* ---------------------------- Étape 3 : Tableau + XLSX ---------------------------- */

function TableStep({
  catalogue,
  promos,
  updatePromos,
  onPrev,
  onNext,
}: {
  catalogue: CatalogueLite;
  promos: WorkflowPromo[];
  updatePromos: (u: (p: WorkflowPromo[]) => WorkflowPromo[]) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const [cuttingIdx, setCuttingIdx] = useState<number | null>(null);
  const [batchCutting, setBatchCutting] = useState(false);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);

  const handleCutoutOne = async (i: number) => {
    const p = promos[i];
    if (!p?.image_url) {
      toast.error("Pas d'image source à détourer");
      return;
    }
    setCuttingIdx(i);
    try {
      const { data, error } = await supabase.functions.invoke("remove-bg-promo", {
        body: { image_url: p.image_url, filename: p.title },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.public_url) throw new Error("URL manquante");
      updatePromos((prev) =>
        prev.map((x, idx) => (idx === i ? { ...x, image_cutout_url: data.public_url } : x))
      );
      toast.success("Image détourée");
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Erreur détourage");
    } finally {
      setCuttingIdx(null);
    }
  };

  const handleCutoutAll = async () => {
    const targets = promos
      .map((p, idx) => ({ p, idx }))
      .filter(({ p }) => p.image_url && !p.image_cutout_url && p.selected !== false);
    if (!targets.length) {
      toast.info("Toutes les images sont déjà détourées");
      return;
    }
    setBatchCutting(true);
    let ok = 0;
    let fail = 0;
    for (const { p, idx } of targets) {
      try {
        const { data, error } = await supabase.functions.invoke("remove-bg-promo", {
          body: { image_url: p.image_url, filename: p.title },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        updatePromos((prev) =>
          prev.map((x, j) => (j === idx ? { ...x, image_cutout_url: data.public_url } : x))
        );
        ok++;
      } catch (e) {
        console.error("cutout", idx, e);
        fail++;
      }
    }
    setBatchCutting(false);
    toast.success(`${ok} détourée(s)${fail ? ` · ${fail} échec(s)` : ""}`);
  };

  const handleReplaceImage = async (i: number, file: File) => {
    setUploadingIdx(i);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `manual/${Date.now()}-${i}.${ext}`;
      const { error } = await supabase.storage
        .from("promo-images")
        .upload(path, file, { contentType: file.type || "image/jpeg" });
      if (error) throw error;
      const { data } = supabase.storage.from("promo-images").getPublicUrl(path);
      updatePromos((prev) =>
        prev.map((x, idx) =>
          idx === i ? { ...x, image_url: data.publicUrl, image_cutout_url: null } : x
        )
      );
      toast.success("Image remplacée");
    } catch (e) {
      console.error(e);
      toast.error("Erreur upload");
    } finally {
      setUploadingIdx(null);
    }
  };

  const exportXlsx = () => {
    const rows = promos
      .filter((p) => p.selected !== false)
      .map((p, idx) => ({
        ordre: idx + 1,
        titre: p.title,
        description: p.description ?? "",
        prix: p.price ?? "",
        prix_avant: p.original_price ?? "",
        remise_pct: p.discount_percent ?? "",
        categorie: p.category ?? "",
        page: p.page_number ?? "",
        image_url: p.image_cutout_url ?? p.image_url ?? "",
      }));
    const ws = XLSX.utils.json_to_sheet(rows);
    (ws as any)["!cols"] = [
      { wch: 6 }, { wch: 40 }, { wch: 50 }, { wch: 10 }, { wch: 10 },
      { wch: 8 }, { wch: 24 }, { wch: 6 }, { wch: 60 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Promotions");
    const slug = (catalogue.title || "catalogue").toLowerCase().replace(/[^a-z0-9]+/g, "-");
    XLSX.writeFile(wb, `${slug}-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const selectedCount = promos.filter((p) => p.selected !== false).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2 p-3 border rounded-md bg-muted/30">
        <p className="text-sm">
          <span className="font-medium">{selectedCount}</span> / {promos.length} promotions sélectionnées
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleCutoutAll} disabled={batchCutting}>
            {batchCutting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            Détourer tout
          </Button>
          <Button variant="outline" size="sm" onClick={exportXlsx}>
            <FileSpreadsheet className="h-4 w-4" /> Exporter en XLSX
          </Button>
        </div>
      </div>

      <div className="border rounded-md max-h-[55vh] overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead className="w-20">Image</TableHead>
              <TableHead>Titre</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-24">Prix</TableHead>
              <TableHead className="w-24">Avant</TableHead>
              <TableHead className="w-32">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {promos.map((p, i) => (
              <TableRow key={i} className={p.selected === false ? "opacity-50" : ""}>
                <TableCell>
                  <Checkbox
                    checked={p.selected !== false}
                    onCheckedChange={(v) =>
                      updatePromos((prev) =>
                        prev.map((x, idx) => (idx === i ? { ...x, selected: !!v } : x))
                      )
                    }
                  />
                </TableCell>
                <TableCell>
                  {p.image_cutout_url || p.image_url ? (
                    <div className="relative h-14 w-14">
                      <img
                        src={p.image_cutout_url ?? p.image_url ?? ""}
                        alt=""
                        className="h-14 w-14 rounded object-contain border bg-muted/30"
                      />
                      {p.image_cutout_url && (
                        <span
                          className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full p-0.5"
                          title="Détourée"
                        >
                          <Check className="h-2.5 w-2.5" />
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="h-14 w-14 rounded border border-dashed flex items-center justify-center text-muted-foreground">
                      <ImageIcon className="h-4 w-4" />
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <Input
                    value={p.title}
                    onChange={(e) =>
                      updatePromos((prev) =>
                        prev.map((x, idx) => (idx === i ? { ...x, title: e.target.value } : x))
                      )
                    }
                    className="h-8 text-sm"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    value={p.description ?? ""}
                    onChange={(e) =>
                      updatePromos((prev) =>
                        prev.map((x, idx) =>
                          idx === i ? { ...x, description: e.target.value } : x
                        )
                      )
                    }
                    className="h-8 text-sm"
                    placeholder="Description"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    step="0.01"
                    value={p.price ?? ""}
                    onChange={(e) =>
                      updatePromos((prev) =>
                        prev.map((x, idx) =>
                          idx === i
                            ? { ...x, price: e.target.value ? parseFloat(e.target.value) : null }
                            : x
                        )
                      )
                    }
                    className="h-8 text-sm"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    step="0.01"
                    value={p.original_price ?? ""}
                    onChange={(e) =>
                      updatePromos((prev) =>
                        prev.map((x, idx) =>
                          idx === i
                            ? {
                                ...x,
                                original_price: e.target.value
                                  ? parseFloat(e.target.value)
                                  : null,
                              }
                            : x
                        )
                      )
                    }
                    className="h-8 text-sm"
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Détourer (suppression du fond)"
                      onClick={() => handleCutoutOne(i)}
                      disabled={cuttingIdx === i || !p.image_url}
                      className="h-7 w-7"
                    >
                      {cuttingIdx === i ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Wand2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    <label
                      className={cn(
                        "h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-accent cursor-pointer",
                        uploadingIdx === i && "pointer-events-none opacity-50"
                      )}
                      title="Remplacer l'image"
                    >
                      {uploadingIdx === i ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <UploadCloud className="h-3.5 w-3.5" />
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={(e) => e.target.files?.[0] && handleReplaceImage(i, e.target.files[0])}
                      />
                    </label>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() =>
                        updatePromos((prev) => prev.filter((_, idx) => idx !== i))
                      }
                      className="h-7 w-7 text-destructive"
                      title="Supprimer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {promos.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Aucune promotion. Revenez à l'étape précédente pour les détecter.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onPrev}>
          <ChevronLeft className="h-4 w-4" /> Précédent
        </Button>
        <Button onClick={onNext} disabled={selectedCount === 0}>
          Étape suivante <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/* ---------------------------- Étape 4 : Programmation ---------------------------- */

function ScheduleStep({
  catalogue,
  promos,
  startsAt,
  endsAt,
  onChangeStarts,
  onChangeEnds,
  onPrev,
  onValidated,
}: {
  catalogue: CatalogueLite;
  promos: WorkflowPromo[];
  startsAt: string;
  endsAt: string;
  onChangeStarts: (v: string) => void;
  onChangeEnds: (v: string) => void;
  onPrev: () => void;
  onValidated: () => void | Promise<void>;
}) {
  const [publishing, setPublishing] = useState(false);
  const selected = useMemo(() => promos.filter((p) => p.selected !== false), [promos]);

  const publish = async () => {
    if (!selected.length) {
      toast.error("Aucune promotion à publier");
      return;
    }
    if (!startsAt || !endsAt) {
      toast.error("Renseignez les dates de début et de fin");
      return;
    }
    setPublishing(true);
    try {
      // Désactive les anciennes promos liées à ce catalogue
      await supabase
        .from("promotions")
        .update({ active: false })
        .eq("catalogue_id", catalogue.id);

      const rows = selected.map((p, idx) => ({
        title: p.title,
        description: p.description ?? p.category ?? null,
        price: p.price ?? 0,
        original_price: p.original_price ?? null,
        image: p.image_cutout_url ?? p.image_url ?? null,
        starts_at: startsAt,
        ends_at: endsAt,
        active: true,
        display_order: idx,
        catalogue_id: catalogue.id,
      }));
      const { error } = await supabase.from("promotions").insert(rows);
      if (error) throw error;

      // MAJ dates du catalogue
      await supabase
        .from("catalogues")
        .update({ starts_at: startsAt, ends_at: endsAt })
        .eq("id", catalogue.id);

      toast.success(`${rows.length} promotions publiées`);
      await onValidated();
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Erreur publication");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="space-y-4 py-4">
      <div className="grid grid-cols-2 gap-4 max-w-md">
        <div className="space-y-1">
          <Label>Date d'activation</Label>
          <Input
            type="date"
            value={startsAt}
            onChange={(e) => onChangeStarts(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label>Date de fin</Label>
          <Input type="date" value={endsAt} onChange={(e) => onChangeEnds(e.target.value)} />
        </div>
      </div>

      <div className="rounded-md border p-4 bg-muted/30">
        <p className="text-sm font-medium mb-2">Récapitulatif</p>
        <ul className="text-sm space-y-1 text-muted-foreground">
          <li>• {selected.length} promotion(s) à publier</li>
          <li>
            • {selected.filter((p) => p.image_cutout_url || p.image_url).length} avec image
            ({selected.filter((p) => p.image_cutout_url).length} détourée(s))
          </li>
          <li>
            • Période :{" "}
            {startsAt && endsAt ? (
              <span className="text-foreground font-medium">
                {startsAt} → {endsAt}
              </span>
            ) : (
              <span className="text-destructive">à compléter</span>
            )}
          </li>
        </ul>
        <p className="text-xs text-muted-foreground mt-3">
          Les anciennes promotions liées à ce catalogue seront désactivées avant l'insertion des
          nouvelles.
        </p>
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onPrev}>
          <ChevronLeft className="h-4 w-4" /> Précédent
        </Button>
        <Button onClick={publish} disabled={publishing || !selected.length || !startsAt || !endsAt}>
          {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Programmer & publier
        </Button>
      </div>
    </div>
  );
}
