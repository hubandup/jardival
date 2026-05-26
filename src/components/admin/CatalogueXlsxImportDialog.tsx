import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Upload, AlertTriangle, FileSpreadsheet, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentOrgId } from "@/lib/auth";
import { parseXlsxFile, filenameStem, type ParsedPromo, type ParseResult } from "@/hooks/useXlsxParser";

interface StoreOption {
  id: string;
  name: string;
  city: string | null;
}

interface DraftState {
  step: number;
  meta: Meta;
  parse: ParseResult | null;
  promos: ParsedPromo[];
  xlsxUrl: string | null;
}

interface Meta {
  title: string;
  starts_at: string;
  ends_at: string;
  store_ids: string[];
  cover_image: string | null;
  hero_primary: string;
  hero_secondary: string;
  allStores: boolean;
}

const DRAFT_KEY = "xlsx-import-draft";

const emptyMeta = (): Meta => ({
  title: "",
  starts_at: "",
  ends_at: "",
  store_ids: [],
  cover_image: null,
  hero_primary: "",
  hero_secondary: "",
  allStores: true,
});

export default function CatalogueXlsxImportDialog({
  open,
  onOpenChange,
  onCompleted,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCompleted?: () => void;
}) {
  const [step, setStep] = useState(1);
  const [meta, setMeta] = useState<Meta>(emptyMeta());
  const [parse, setParse] = useState<ParseResult | null>(null);
  const [promos, setPromos] = useState<ParsedPromo[]>([]);
  const [xlsxUrl, setXlsxUrl] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // Load draft + stores on open
  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase
        .from("stores")
        .select("id, name, city")
        .order("city");
      setStores((data as StoreOption[]) || []);
    })();

    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d: DraftState = JSON.parse(raw);
        setStep(d.step || 1);
        setMeta(d.meta || emptyMeta());
        setParse(d.parse || null);
        setPromos(d.promos || []);
        setXlsxUrl(d.xlsxUrl || null);
      }
    } catch {}
  }, [open]);

  // Autosave
  useEffect(() => {
    if (!open) return;
    const d: DraftState = { step, meta, parse, promos, xlsxUrl };
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    } catch {}
  }, [open, step, meta, parse, promos, xlsxUrl]);

  const reset = () => {
    setStep(1);
    setMeta(emptyMeta());
    setParse(null);
    setPromos([]);
    setXlsxUrl(null);
    localStorage.removeItem(DRAFT_KEY);
  };

  const closeAndReset = () => {
    reset();
    onOpenChange(false);
  };

  const handleFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      toast.error("Format xlsx requis");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Fichier > 10 MB");
      return;
    }
    setParsing(true);
    setUploading(true);
    try {
      const result = await parseXlsxFile(file);
      setParse(result);
      setPromos(result.promos);
      if (!meta.title && result.suggestedTitle) {
        setMeta((m) => ({ ...m, title: result.suggestedTitle! }));
      }

      // Upload to storage
      const path = `xlsx-${Date.now()}.xlsx`;
      const { error } = await supabase.storage.from("catalogues").upload(path, file);
      if (error) {
        toast.error("Upload Excel échoué : " + error.message);
      } else {
        const { data } = supabase.storage.from("catalogues").getPublicUrl(path);
        setXlsxUrl(data.publicUrl);
      }
      toast.success(`${result.totalRows} lignes parsées`);
      setStep(3);
    } catch (e: any) {
      toast.error("Parsing échoué : " + (e?.message || "erreur"));
    } finally {
      setParsing(false);
      setUploading(false);
    }
  };

  const updatePromo = (idx: number, patch: Partial<ParsedPromo>) => {
    setPromos((arr) => {
      const next = [...arr];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  const counts = useMemo(() => {
    const pub = promos.filter((p) => p.status === "published").length;
    const dr = promos.filter((p) => p.status === "draft").length;
    return { pub, dr };
  }, [promos]);

  const canStep1Continue =
    meta.title.trim() && meta.starts_at && meta.ends_at && (meta.allStores || meta.store_ids.length > 0);

  const publish = async () => {
    if (!parse) return;
    setPublishing(true);
    try {
      const orgId = await getCurrentOrgId();
      if (!orgId) {
        toast.error("Aucune organisation associée");
        setPublishing(false);
        return;
      }

      // 1. Create catalogue
      const { data: cat, error: catErr } = await (supabase as any)
        .from("catalogues")
        .insert({
          title: meta.title,
          starts_at: meta.starts_at,
          ends_at: meta.ends_at,
          cover_image: meta.cover_image,
          hero_colors:
            meta.hero_primary || meta.hero_secondary
              ? { primary: meta.hero_primary || null, secondary: meta.hero_secondary || null }
              : null,
          xlsx_url: xlsxUrl,
          import_method: "xlsx",
          active: true,
          display_order: 0,
          organization_id: orgId,
        })
        .select("*")
        .single();
      if (catErr || !cat) {
        toast.error("Création catalogue échouée : " + (catErr?.message || ""));
        setPublishing(false);
        return;
      }

      // 2. Bulk insert promotions
      const storeIds = meta.allStores ? null : meta.store_ids;
      const rows = promos.map((p, i) => ({
        title: p.title,
        description: p.description,
        price: p.price,
        original_price: p.original_price,
        image: p.image_url,
        image_urls: p.image_urls,
        status: p.status,
        page_number: p.page_number,
        reference: p.reference,
        external_id: p.external_id,
        extra_fields: p.extra_fields,
        catalogue_id: cat.id,
        starts_at: meta.starts_at,
        ends_at: meta.ends_at,
        store_ids: storeIds,
        display_order: p.display_order ?? i,
        active: true,
      }));

      const { error: insErr } = await (supabase as any).from("promotions").insert(rows);
      if (insErr) {
        toast.error("Insertion des promotions échouée : " + insErr.message);
        setPublishing(false);
        return;
      }

      toast.success(`Catalogue publié — ${counts.pub} promos, ${counts.dr} brouillons`);
      onCompleted?.();
      closeAndReset();
    } finally {
      setPublishing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(o) : closeAndReset())}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importer un catalogue Excel
            <span className="text-xs text-muted-foreground ml-2">Étape {step}/4</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2">
          {step === 1 && (
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label>Titre du catalogue *</Label>
                <Input value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Date de début *</Label>
                <Input type="date" value={meta.starts_at} onChange={(e) => setMeta({ ...meta, starts_at: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Date de fin *</Label>
                <Input type="date" value={meta.ends_at} onChange={(e) => setMeta({ ...meta, ends_at: e.target.value })} />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Magasins concernés *</Label>
                <div className="flex items-center gap-2 mb-2">
                  <Checkbox
                    id="all-stores"
                    checked={meta.allStores}
                    onCheckedChange={(v) => setMeta({ ...meta, allStores: !!v })}
                  />
                  <label htmlFor="all-stores" className="text-sm font-medium">
                    Tous les magasins
                  </label>
                </div>
                {!meta.allStores && (
                  <ScrollArea className="h-48 border p-2">
                    <div className="space-y-1">
                      {stores.map((s) => (
                        <div key={s.id} className="flex items-center gap-2">
                          <Checkbox
                            checked={meta.store_ids.includes(s.id)}
                            onCheckedChange={(v) => {
                              setMeta({
                                ...meta,
                                store_ids: v
                                  ? [...meta.store_ids, s.id]
                                  : meta.store_ids.filter((x) => x !== s.id),
                              });
                            }}
                          />
                          <span className="text-sm">
                            {s.name || s.city} <span className="text-muted-foreground">— {s.city}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
              <div className="space-y-2">
                <Label>Couleur hero — primaire</Label>
                <Input type="color" value={meta.hero_primary || "#0f1422"} onChange={(e) => setMeta({ ...meta, hero_primary: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Couleur hero — secondaire</Label>
                <Input type="color" value={meta.hero_secondary || "#E8FF4C"} onChange={(e) => setMeta({ ...meta, hero_secondary: e.target.value })} />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Image de couverture (URL optionnelle)</Label>
                <Input value={meta.cover_image ?? ""} onChange={(e) => setMeta({ ...meta, cover_image: e.target.value || null })} placeholder="https://..." />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div
                className="border-2 border-dashed p-12 text-center cursor-pointer hover:bg-muted/40"
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files?.[0];
                  if (f) handleFile(f);
                }}
              >
                <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <p className="font-medium">Glissez le fichier Excel ici</p>
                <p className="text-sm text-muted-foreground">ou cliquez pour parcourir (xlsx, 10 MB max)</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
              </div>
              {(parsing || uploading) && (
                <div className="flex items-center gap-2 justify-center">
                  <Loader2 className="h-4 w-4 animate-spin" /> Traitement…
                </div>
              )}
            </div>
          )}

          {step === 3 && parse && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Badge variant="default">{counts.pub} publiables</Badge>
                <Badge variant="secondary">{counts.dr} brouillons</Badge>
                <span className="text-muted-foreground">/ {promos.length} lignes</span>
              </div>
              <ScrollArea className="h-[55vh] border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead className="w-12">État</TableHead>
                      <TableHead className="w-16">Img</TableHead>
                      <TableHead>Titre</TableHead>
                      <TableHead className="w-24">Prix</TableHead>
                      <TableHead className="w-24">Prix barré</TableHead>
                      <TableHead className="w-24">Réf</TableHead>
                      <TableHead className="w-16">Page</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {promos.map((p, i) => (
                      <TableRow key={i} className={p.status === "draft" ? "bg-orange-50" : ""}>
                        <TableCell className="text-xs text-muted-foreground">{p.rowIndex}</TableCell>
                        <TableCell>
                          {p.status === "draft" ? (
                            <AlertTriangle className="h-4 w-4 text-orange-600" />
                          ) : (
                            <Check className="h-4 w-4 text-green-600" />
                          )}
                        </TableCell>
                        <TableCell>
                          {p.image_url ? (
                            <img src={p.image_url} alt="" className="h-10 w-10 object-cover" loading="lazy" />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Input
                            value={p.title}
                            onChange={(e) => updatePromo(i, { title: e.target.value })}
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            value={p.price ?? ""}
                            onChange={(e) => updatePromo(i, { price: e.target.value === "" ? null : parseFloat(e.target.value) })}
                            className="h-8 w-20"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            value={p.original_price ?? ""}
                            onChange={(e) => updatePromo(i, { original_price: e.target.value === "" ? null : parseFloat(e.target.value) })}
                            className="h-8 w-20"
                          />
                        </TableCell>
                        <TableCell className="text-xs">{p.reference || "—"}</TableCell>
                        <TableCell className="text-xs">{p.page_number ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4 p-4">
              <h3 className="text-lg font-semibold">Récapitulatif</h3>
              <ul className="text-sm space-y-1">
                <li>• Titre : <strong>{meta.title}</strong></li>
                <li>• Période : {meta.starts_at} → {meta.ends_at}</li>
                <li>• Magasins : {meta.allStores ? "Tous" : `${meta.store_ids.length} sélectionnés`}</li>
                <li>• Promos publiables : <strong className="text-green-700">{counts.pub}</strong></li>
                <li>• Brouillons (sans image valide) : <strong className="text-orange-700">{counts.dr}</strong></li>
              </ul>
              <p className="text-xs text-muted-foreground">
                Les brouillons sont insérés mais invisibles sur le front tant que vous n'ajoutez pas d'image valide.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-3">
          <div className="flex justify-between w-full">
            <Button variant="ghost" onClick={closeAndReset}>Annuler & vider brouillon</Button>
            <div className="flex gap-2">
              {step > 1 && (
                <Button variant="outline" onClick={() => setStep(step - 1)}>
                  <ChevronLeft className="h-4 w-4" /> Précédent
                </Button>
              )}
              {step === 1 && (
                <Button onClick={() => setStep(2)} disabled={!canStep1Continue}>
                  Suivant <ChevronRight className="h-4 w-4" />
                </Button>
              )}
              {step === 2 && parse && (
                <Button onClick={() => setStep(3)}>
                  Voir l'aperçu <ChevronRight className="h-4 w-4" />
                </Button>
              )}
              {step === 3 && (
                <Button onClick={() => setStep(4)} disabled={promos.length === 0}>
                  Continuer <ChevronRight className="h-4 w-4" />
                </Button>
              )}
              {step === 4 && (
                <Button onClick={publish} disabled={publishing}>
                  {publishing && <Loader2 className="h-4 w-4 animate-spin" />}
                  Publier le catalogue
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
