import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Sparkles, Trash2, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { cropAndUploadPromoImages } from "@/lib/pdfImageCrop";

interface ExtractedPromo {
  title: string;
  description?: string | null;
  price?: number | null;
  original_price?: number | null;
  discount_percent?: number | null;
  category?: string | null;
  page_number?: number | null;
  bbox_2d?: [number, number, number, number] | null;
  image_url?: string | null;
  selected?: boolean;
}

interface Props {
  catalogue: {
    id: string;
    title: string;
    pdf_url: string | null;
    starts_at: string | null;
    ends_at: string | null;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CataloguePromoExtractor({ catalogue, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [extracting, setExtracting] = useState(false);
  const [promos, setPromos] = useState<ExtractedPromo[]>([]);
  const [mode, setMode] = useState<"replace" | "deactivate">("deactivate");
  const [importing, setImporting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [extractingImages, setExtractingImages] = useState(false);
  const [imgProgress, setImgProgress] = useState<{ done: number; total: number } | null>(null);

  const handleExtractImages = async () => {
    if (!catalogue.pdf_url) {
      toast.error("Pas de PDF associé");
      return;
    }
    const tasks = promos
      .map((p, idx) => ({ p, idx }))
      .filter(({ p }) => p.bbox_2d && p.page_number && p.selected !== false)
      .map(({ p, idx }) => ({
        pageNumber: p.page_number!,
        bbox: p.bbox_2d!,
        filename: `${idx}-${p.title}`,
      }));
    if (!tasks.length) {
      toast.error("Aucune zone d'image détectée par l'IA");
      return;
    }
    setExtractingImages(true);
    setImgProgress({ done: 0, total: tasks.length });
    try {
      const results = await cropAndUploadPromoImages(
        catalogue.pdf_url,
        tasks,
        (done, total) => setImgProgress({ done, total })
      );
      // Indexe par filename (qui contient l'idx)
      const byFilename = new Map(results.map((r) => [r.filename, r.publicUrl]));
      setPromos((prev) =>
        prev.map((p, idx) => {
          const key = `${idx}-${p.title}`;
          const url = byFilename.get(key);
          return url ? { ...p, image_url: url } : p;
        })
      );
      const ok = results.filter((r) => r.publicUrl).length;
      const fail = results.length - ok;
      toast.success(`${ok} images extraites${fail ? ` (${fail} échec${fail > 1 ? "s" : ""})` : ""}`);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Erreur extraction images");
    } finally {
      setExtractingImages(false);
    }
  };

  const handleExtract = async () => {
    if (!catalogue.pdf_url) {
      toast.error("Ce catalogue n'a pas de PDF associé");
      return;
    }
    setExtracting(true);
    setPromos([]);
    try {
      const { data, error } = await supabase.functions.invoke("extract-catalogue-promos", {
        body: {
          pdf_url: catalogue.pdf_url,
          starts_at: catalogue.starts_at,
          ends_at: catalogue.ends_at,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const list: ExtractedPromo[] = (data?.promotions ?? []).map((p: ExtractedPromo) => ({
        ...p,
        selected: true,
      }));
      setPromos(list);
      toast.success(`${list.length} promotions détectées`);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Erreur lors de l'extraction");
    } finally {
      setExtracting(false);
    }
  };

  const updatePromo = (i: number, patch: Partial<ExtractedPromo>) => {
    setPromos((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  };

  const removePromo = (i: number) => {
    setPromos((prev) => prev.filter((_, idx) => idx !== i));
  };

  const selectedCount = promos.filter((p) => p.selected).length;

  const handleImport = async () => {
    const toInsert = promos.filter((p) => p.selected);
    if (!toInsert.length) {
      toast.error("Aucune promotion sélectionnée");
      return;
    }
    setImporting(true);
    try {
      // 1) Mode "replace" : supprime toutes les anciennes promos
      // 2) Mode "deactivate" : désactive toutes les anciennes
      if (mode === "replace") {
        const { error: delErr } = await supabase
          .from("promotions")
          .delete()
          .neq("id", "00000000-0000-0000-0000-000000000000");
        if (delErr) throw delErr;
      } else {
        const { error: updErr } = await supabase
          .from("promotions")
          .update({ active: false })
          .eq("active", true);
        if (updErr) throw updErr;
      }

      // 3) Insertion des nouvelles
      const rows = toInsert.map((p, idx) => ({
        title: p.title,
        description: p.description ?? p.category ?? null,
        price: p.price ?? 0,
        original_price: p.original_price ?? null,
        starts_at: catalogue.starts_at,
        ends_at: catalogue.ends_at,
        active: true,
        display_order: idx,
        catalogue_id: catalogue.id,
      }));
      const { error: insErr } = await supabase.from("promotions").insert(rows);
      if (insErr) throw insErr;

      toast.success(`${rows.length} promotions importées`);
      qc.invalidateQueries({ queryKey: ["promotions"] });
      qc.invalidateQueries({ queryKey: ["admin-promotions"] });
      qc.invalidateQueries({ queryKey: ["hero_promos"] });
      setPromos([]);
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Erreur import");
    } finally {
      setImporting(false);
      setConfirmOpen(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Extraire les promotions du catalogue
            </DialogTitle>
            <DialogDescription>
              L'IA va analyser le PDF « {catalogue.title} » et en extraire les promotions.
              Vous pourrez ensuite vérifier et corriger avant d'importer.
            </DialogDescription>
          </DialogHeader>

          {!promos.length && (
            <div className="py-8 flex flex-col items-center gap-4">
              <Button onClick={handleExtract} disabled={extracting || !catalogue.pdf_url} size="lg">
                {extracting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Analyse en cours (peut prendre 30-60s)…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" /> Lancer l'extraction
                  </>
                )}
              </Button>
              {!catalogue.pdf_url && (
                <p className="text-sm text-destructive">Aucun PDF associé à ce catalogue.</p>
              )}
            </div>
          )}

          {promos.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {selectedCount} / {promos.length} promotions sélectionnées
                </p>
                <Button variant="outline" size="sm" onClick={handleExtract} disabled={extracting}>
                  {extracting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Relancer l'extraction
                </Button>
              </div>

              <div className="border rounded-md max-h-[50vh] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Titre</TableHead>
                      <TableHead>Catégorie</TableHead>
                      <TableHead className="w-24">Prix</TableHead>
                      <TableHead className="w-24">Ancien</TableHead>
                      <TableHead className="w-16">%</TableHead>
                      <TableHead className="w-12">Page</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {promos.map((p, i) => (
                      <TableRow key={i} className={!p.selected ? "opacity-50" : ""}>
                        <TableCell>
                          <Checkbox
                            checked={p.selected}
                            onCheckedChange={(v) => updatePromo(i, { selected: !!v })}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={p.title}
                            onChange={(e) => updatePromo(i, { title: e.target.value })}
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell className="text-xs">{p.category ?? "—"}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            value={p.price ?? ""}
                            onChange={(e) =>
                              updatePromo(i, { price: e.target.value ? parseFloat(e.target.value) : null })
                            }
                            className="h-8 w-20"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            value={p.original_price ?? ""}
                            onChange={(e) =>
                              updatePromo(i, {
                                original_price: e.target.value ? parseFloat(e.target.value) : null,
                              })
                            }
                            className="h-8 w-20"
                          />
                        </TableCell>
                        <TableCell className="text-xs">
                          {p.discount_percent ? `${p.discount_percent}%` : "—"}
                        </TableCell>
                        <TableCell className="text-xs">{p.page_number ?? "—"}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => removePromo(i)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="space-y-2 border-t pt-4">
                <Label>Mode d'import</Label>
                <RadioGroup value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
                  <div className="flex items-start gap-2">
                    <RadioGroupItem value="deactivate" id="mode-deactivate" className="mt-1" />
                    <Label htmlFor="mode-deactivate" className="font-normal cursor-pointer">
                      <span className="font-medium">Désactiver les anciennes</span>
                      <span className="block text-xs text-muted-foreground">
                        Les promotions actuelles passent en inactif (réactivables, traçables)
                      </span>
                    </Label>
                  </div>
                  <div className="flex items-start gap-2">
                    <RadioGroupItem value="replace" id="mode-replace" className="mt-1" />
                    <Label htmlFor="mode-replace" className="font-normal cursor-pointer">
                      <span className="font-medium text-destructive">Remplacement total</span>
                      <span className="block text-xs text-muted-foreground">
                        Supprime définitivement toutes les promotions actuelles
                      </span>
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            {promos.length > 0 && (
              <Button onClick={() => setConfirmOpen(true)} disabled={importing || !selectedCount}>
                {importing && <Loader2 className="h-4 w-4 animate-spin" />}
                Importer {selectedCount} promotions
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer le remplacement ?</AlertDialogTitle>
            <AlertDialogDescription>
              {mode === "replace"
                ? "Toutes les promotions actuelles vont être SUPPRIMÉES définitivement et remplacées par les nouvelles."
                : "Toutes les promotions actuellement actives vont être désactivées et les nouvelles vont être ajoutées."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleImport}>Confirmer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
