import { useState } from "react";
import MediaPickerDialog from "@/components/admin/MediaPickerDialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pencil, Trash2, Plus, Loader2, ExternalLink, Image as ImageIcon, Sparkles, Palette, Wand2, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import CatalogueWorkflowDialog, { type WorkflowStep } from "@/components/admin/CatalogueWorkflowDialog";
import CatalogueXlsxImportDialog from "@/components/admin/CatalogueXlsxImportDialog";
import { getCurrentOrgId } from "@/lib/auth";
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
import { extractCoverPalette, type HeroPalette } from "@/lib/coverPalette";

interface CatalogueRow {
  id: string;
  title: string;
  cover_image: string | null;
  pdf_url: string | null;
  starts_at: string | null;
  ends_at: string | null;
  display_order: number;
  active: boolean;
  hero_colors: Partial<HeroPalette> | null;
}

const empty = (): Omit<CatalogueRow, "id"> => ({
  title: "",
  cover_image: null,
  pdf_url: null,
  starts_at: null,
  ends_at: null,
  display_order: 0,
  active: true,
  hero_colors: null,
});

export default function AdminCatalogues() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<(Partial<CatalogueRow> & { isNew?: boolean }) | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [mediaPicker, setMediaPicker] = useState(false);
  
  const [resumeMenu, setResumeMenu] = useState<{ catalogue: CatalogueRow; hasDraft: boolean } | null>(null);
  const [workflowFor, setWorkflowFor] = useState<{ catalogue: CatalogueRow; step?: WorkflowStep } | null>(null);

  const openCatalogue = async (c: CatalogueRow) => {
    // Vérifie s'il existe un brouillon pour proposer Reprendre/Recommencer
    const { data } = await supabase
      .from("catalogue_extractions")
      .select("id")
      .eq("catalogue_id", c.id)
      .maybeSingle();
    if (data) {
      setResumeMenu({ catalogue: c, hasDraft: true });
    } else {
      // Pas de brouillon : ouvre directement à l'étape Zones (ou Upload si pas de PDF)
      setWorkflowFor({ catalogue: c, step: c.pdf_url ? "zones" : "upload" });
    }
  };

  const { data: items, isLoading } = useQuery({
    queryKey: ["admin-catalogues"],
    queryFn: async () => {
      const { data, error } = await supabase.from("catalogues").select("*").order("display_order");
      if (error) throw error;
      return data as CatalogueRow[];
    },
  });

  const handleSave = async () => {
    if (!editing || !editing.title) return toast.error("Le titre est requis");
    setSaving(true);
    const basePayload = {
      title: editing.title,
      cover_image: editing.cover_image ?? null,
      pdf_url: editing.pdf_url ?? null,
      starts_at: editing.starts_at || null,
      ends_at: editing.ends_at || null,
      display_order: editing.display_order ?? 0,
      active: editing.active ?? true,
      hero_colors: editing.hero_colors ?? null,
    };

    let result;
    if (editing.isNew) {
      const orgId = await getCurrentOrgId();
      if (!orgId) {
        setSaving(false);
        console.error("[handleSave catalogues] missing organization_id for current user");
        return toast.error("Aucune organisation associée à votre compte. Contactez l'administrateur.");
      }
      result = await (supabase as any)
        .from("catalogues")
        .insert({ ...basePayload, organization_id: orgId });
    } else {
      result = await (supabase as any)
        .from("catalogues")
        .update(basePayload)
        .eq("id", editing.id!);
    }
    setSaving(false);
    if (result.error) {
      console.error("[handleSave catalogues] Supabase error", {
        message: result.error.message,
        code: result.error.code,
        details: result.error.details,
        hint: result.error.hint,
      });
      return toast.error("Erreur");
    }
    toast.success("Catalogue enregistré");
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["admin-catalogues"] });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer ce catalogue ?")) return;
    const { error } = await supabase.from("catalogues").delete().eq("id", id);
    if (error) return toast.error("Erreur");
    toast.success("Supprimé");
    qc.invalidateQueries({ queryKey: ["admin-catalogues"] });
  };

  const uploadFile = async (file: File, kind: "image" | "pdf") => {
    if (!editing) return;
    const setUp = kind === "image" ? setUploadingImg : setUploadingPdf;
    setUp(true);
    const ext = file.name.split(".").pop();
    const path = `${kind}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("catalogues").upload(path, file);
    if (error) { setUp(false); return toast.error("Erreur upload"); }
    const { data } = supabase.storage.from("catalogues").getPublicUrl(path);
    setEditing({ ...editing, [kind === "image" ? "cover_image" : "pdf_url"]: data.publicUrl });
    setUp(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Catalogues</h1>
          <p className="text-muted-foreground mt-1">Catalogues PDF téléchargeables</p>
        </div>
        <Button
          onClick={async () => {
            const orgId = await getCurrentOrgId();
            if (!orgId) {
              console.error("[create catalogue] missing organization_id for current user");
              toast.error("Aucune organisation associée à votre compte. Contactez l'administrateur.");
              return;
            }
            const { data, error } = await (supabase as any)
              .from("catalogues")
              .insert({ title: "Nouveau catalogue", active: false, display_order: 0, organization_id: orgId })
              .select("*")
              .single();
            if (error || !data) {
              console.error("[create catalogue] Supabase error", {
                message: error?.message,
                code: error?.code,
                details: error?.details,
                hint: error?.hint,
              });
              toast.error("Impossible de créer le catalogue");
              return;
            }
            qc.invalidateQueries({ queryKey: ["admin-catalogues"] });
            setWorkflowFor({ catalogue: data as CatalogueRow, step: "upload" });
          }}
        >
          <Plus className="h-4 w-4" /> Ajouter
        </Button>
      </div>

      <Card>
        {isLoading ? (
          <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ordre</TableHead>
                <TableHead>Titre</TableHead>
                <TableHead>Validité</TableHead>
                <TableHead>PDF</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="w-36">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items?.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{c.display_order}</TableCell>
                  <TableCell className="font-medium">
                    <button
                      type="button"
                      onClick={() => openCatalogue(c)}
                      className="text-left hover:text-primary hover:underline"
                      title="Ouvrir le workflow d'extraction"
                    >
                      {c.title}
                    </button>
                  </TableCell>
                  <TableCell className="text-xs">
                    {c.starts_at && c.ends_at ? `${c.starts_at} → ${c.ends_at}` : "—"}
                  </TableCell>
                  <TableCell>
                    {c.pdf_url ? (
                      <a href={c.pdf_url} target="_blank" rel="noreferrer" className="text-primary inline-flex items-center gap-1 text-xs">
                        Voir <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : "—"}
                  </TableCell>
                  <TableCell>
                    <span className={c.active ? "text-green-600 text-xs" : "text-muted-foreground text-xs"}>
                      {c.active ? "Actif" : "Inactif"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Workflow d'extraction"
                      onClick={() => openCatalogue(c)}
                    >
                      <Sparkles className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setEditing(c)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {items?.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Aucun catalogue</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.isNew ? "Nouveau catalogue" : "Modifier le catalogue"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label>Titre *</Label>
                <Input value={editing.title ?? ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Date de début</Label>
                <Input type="date" value={editing.starts_at ?? ""} onChange={(e) => setEditing({ ...editing, starts_at: e.target.value || null })} />
              </div>
              <div className="space-y-2">
                <Label>Date de fin</Label>
                <Input type="date" value={editing.ends_at ?? ""} onChange={(e) => setEditing({ ...editing, ends_at: e.target.value || null })} />
              </div>
              <div className="space-y-2">
                <Label>Ordre d'affichage</Label>
                <Input type="number" value={editing.display_order ?? 0} onChange={(e) => setEditing({ ...editing, display_order: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="space-y-2 flex flex-col">
                <Label>Actif</Label>
                <Switch checked={editing.active ?? true} onCheckedChange={(v) => setEditing({ ...editing, active: v })} />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Image de couverture</Label>
                {editing.cover_image && <img src={editing.cover_image} alt="" className="h-32 rounded-md object-cover" />}
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setMediaPicker(true)}>
                    <ImageIcon className="h-4 w-4" /> Médiathèque
                  </Button>
                  <Input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0], "image")} disabled={uploadingImg} />
                  {uploadingImg && <Loader2 className="h-4 w-4 animate-spin" />}
                </div>
                <MediaPickerDialog
                  open={mediaPicker}
                  onOpenChange={setMediaPicker}
                  onSelect={(url) => setEditing({ ...editing, cover_image: url })}
                  defaultBucket="catalogues"
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Fichier PDF</Label>
                {editing.pdf_url && (
                  <a href={editing.pdf_url} target="_blank" rel="noreferrer" className="text-primary inline-flex items-center gap-1 text-xs">
                    PDF actuel <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                <Input type="file" accept="application/pdf" onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0], "pdf")} disabled={uploadingPdf} />
                {uploadingPdf && <Loader2 className="h-4 w-4 animate-spin" />}
              </div>
              <div className="col-span-2">
                <HeroColorsEditor
                  coverImage={editing.cover_image ?? null}
                  value={editing.hero_colors ?? null}
                  onChange={(c) => setEditing({ ...editing, hero_colors: c })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Annuler</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Menu Reprendre / Recommencer (si un brouillon existe) */}
      <AlertDialog open={!!resumeMenu} onOpenChange={(o) => !o && setResumeMenu(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Brouillon existant</AlertDialogTitle>
            <AlertDialogDescription>
              Un brouillon d'extraction existe déjà pour « {resumeMenu?.catalogue.title} ». Souhaitez-vous reprendre où vous en étiez, ou recommencer depuis l'étape « Zones » ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <Button
              variant="outline"
              onClick={() => {
                if (resumeMenu) setWorkflowFor({ catalogue: resumeMenu.catalogue, step: "zones" });
                setResumeMenu(null);
              }}
            >
              Recommencer
            </Button>
            <AlertDialogAction
              onClick={() => {
                if (resumeMenu) setWorkflowFor({ catalogue: resumeMenu.catalogue });
                setResumeMenu(null);
              }}
            >
              Reprendre
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {workflowFor && (
        <CatalogueWorkflowDialog
          catalogue={workflowFor.catalogue}
          initialStep={workflowFor.step}
          open={!!workflowFor}
          onOpenChange={(o) => !o && setWorkflowFor(null)}
          onCompleted={() => qc.invalidateQueries({ queryKey: ["admin-catalogues"] })}
        />
      )}
    </div>
  );
}

// --- Éditeur de couleurs du hero (auto + override) ---

const HERO_COLOR_FIELDS: Array<{ key: keyof HeroPalette; label: string }> = [
  { key: "primary", label: "Primaire" },
  { key: "secondary", label: "Secondaire" },
  { key: "accent", label: "Accent" },
  { key: "foreground", label: "Texte" },
];

function HeroColorsEditor({
  coverImage,
  value,
  onChange,
}: {
  coverImage: string | null;
  value: Partial<HeroPalette> | null;
  onChange: (v: Partial<HeroPalette> | null) => void;
}) {
  const [extracting, setExtracting] = useState(false);

  const runAuto = async () => {
    if (!coverImage) {
      toast.error("Aucune image de couverture");
      return;
    }
    setExtracting(true);
    const palette = await extractCoverPalette(coverImage);
    setExtracting(false);
    if (!palette) {
      toast.error("Extraction des couleurs impossible");
      return;
    }
    onChange(palette);
    toast.success("Palette extraite de la couverture");
  };

  const update = (key: keyof HeroPalette, v: string) => {
    onChange({ ...(value ?? {}), [key]: v });
  };

  return (
    <div className="rounded-md border p-3 space-y-3 bg-muted/30">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Palette className="h-4 w-4 text-primary" />
          <Label className="m-0">Couleurs du hero (bannière catalogue)</Label>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={runAuto}
            disabled={extracting || !coverImage}
            title="Extrait automatiquement la palette dominante de la couverture"
          >
            {extracting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4" />
            )}
            Auto depuis la couverture
          </Button>
          {value && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
              Réinitialiser
            </Button>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Laisse vide pour utiliser l'extraction automatique au chargement de la page.
        Format HSL : <code className="text-[10px]">teinte saturation% luminosité%</code> (ex.{" "}
        <code className="text-[10px]">45 90% 55%</code>).
      </p>
      <div className="grid grid-cols-2 gap-3">
        {HERO_COLOR_FIELDS.map((f) => {
          const v = value?.[f.key] ?? "";
          return (
            <div key={f.key} className="space-y-1">
              <Label className="text-xs">{f.label}</Label>
              <div className="flex items-center gap-2">
                <div
                  className="h-8 w-8 rounded border shrink-0"
                  style={{
                    background: v ? `hsl(${v})` : "transparent",
                    backgroundImage: v
                      ? undefined
                      : "repeating-linear-gradient(45deg, hsl(var(--muted)) 0 4px, transparent 4px 8px)",
                  }}
                />
                <Input
                  value={v}
                  placeholder="ex. 45 90% 55%"
                  onChange={(e) => update(f.key, e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
