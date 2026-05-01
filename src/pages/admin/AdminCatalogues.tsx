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
import { Pencil, Trash2, Plus, Loader2, ExternalLink, Image as ImageIcon, Sparkles } from "lucide-react";
import { toast } from "sonner";
import CataloguePromoExtractor from "@/components/admin/CataloguePromoExtractor";

interface CatalogueRow {
  id: string;
  title: string;
  cover_image: string | null;
  pdf_url: string | null;
  starts_at: string | null;
  ends_at: string | null;
  display_order: number;
  active: boolean;
}

const empty = (): Omit<CatalogueRow, "id"> => ({
  title: "",
  cover_image: null,
  pdf_url: null,
  starts_at: null,
  ends_at: null,
  display_order: 0,
  active: true,
});

export default function AdminCatalogues() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<(Partial<CatalogueRow> & { isNew?: boolean }) | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [mediaPicker, setMediaPicker] = useState(false);
  const [extractFor, setExtractFor] = useState<CatalogueRow | null>(null);

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
    const payload = {
      title: editing.title,
      cover_image: editing.cover_image ?? null,
      pdf_url: editing.pdf_url ?? null,
      starts_at: editing.starts_at || null,
      ends_at: editing.ends_at || null,
      display_order: editing.display_order ?? 0,
      active: editing.active ?? true,
    };
    const { error } = editing.isNew
      ? await supabase.from("catalogues").insert(payload)
      : await supabase.from("catalogues").update(payload).eq("id", editing.id!);
    setSaving(false);
    if (error) return toast.error("Erreur");
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
        <Button onClick={() => setEditing({ ...empty(), isNew: true })}>
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
                  <TableCell className="font-medium">{c.title}</TableCell>
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
                      title="Extraire les promotions du PDF"
                      onClick={() => setExtractFor(c)}
                      disabled={!c.pdf_url}
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

      {extractFor && (
        <CataloguePromoExtractor
          catalogue={extractFor}
          open={!!extractFor}
          onOpenChange={(o) => !o && setExtractFor(null)}
        />
      )}
    </div>
  );
}
