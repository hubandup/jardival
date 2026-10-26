import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pencil, Trash2, Plus, Loader2, ExternalLink, FileText } from "lucide-react";
import { toast } from "sonner";
import { getCurrentOrgId } from "@/lib/auth";

interface CatalogueRow {
  id: string;
  title: string;
  pdf_url: string | null;
  starts_at: string | null;
  ends_at: string | null;
  active: boolean;
}

type Editing = Partial<CatalogueRow> & { isNew?: boolean };

const fmt = (d: string | null) =>
  d ? new Date(d + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "—";

function statusOf(c: CatalogueRow) {
  const today = new Date().toISOString().slice(0, 10);
  if (!c.active) return "Inactif";
  if (c.starts_at && today < c.starts_at) return "Programmé";
  if (c.ends_at && today > c.ends_at) return "Terminé";
  return "En ligne";
}

export default function AdminCatalogues() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { data: items, isLoading } = useQuery({
    queryKey: ["admin-catalogues"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("catalogues")
        .select("id, title, pdf_url, starts_at, ends_at, active")
        .order("starts_at", { ascending: false });
      if (error) throw error;
      return data as CatalogueRow[];
    },
  });

  const uploadPdf = async (file: File) => {
    if (!editing) return;
    if (file.type !== "application/pdf") return toast.error("Le fichier doit être un PDF");
    setUploading(true);
    const path = `catalogue-${Date.now()}.pdf`;
    const { error } = await supabase.storage
      .from("catalogues")
      .upload(path, file, { contentType: "application/pdf" });
    setUploading(false);
    if (error) return toast.error("Échec de l'envoi du PDF");
    const { data } = supabase.storage.from("catalogues").getPublicUrl(path);
    setEditing({
      ...editing,
      pdf_url: data.publicUrl,
      title: editing.title || file.name.replace(/\.pdf$/i, ""),
    });
  };

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.pdf_url) return toast.error("Ajoutez un PDF");
    if (!editing.starts_at || !editing.ends_at) return toast.error("Choisissez les dates d'apparition");
    if (editing.ends_at < editing.starts_at) return toast.error("La date de fin précède la date de début");
    setSaving(true);
    const payload = {
      title: editing.title?.trim() || "Catalogue",
      pdf_url: editing.pdf_url,
      starts_at: editing.starts_at,
      ends_at: editing.ends_at,
      active: true,
      display_order: 0,
    };
    let error;
    if (editing.isNew) {
      const orgId = await getCurrentOrgId();
      if (!orgId) {
        setSaving(false);
        return toast.error("Aucune organisation associée à votre compte.");
      }
      ({ error } = await (supabase as any).from("catalogues").insert({ ...payload, organization_id: orgId }));
    } else {
      ({ error } = await (supabase as any).from("catalogues").update(payload).eq("id", editing.id!));
    }
    setSaving(false);
    if (error) return toast.error("Erreur lors de l'enregistrement");
    toast.success("Catalogue enregistré");
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["admin-catalogues"] });
    qc.invalidateQueries({ queryKey: ["catalogues"] });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer ce catalogue ?")) return;
    const { error } = await supabase.from("catalogues").delete().eq("id", id);
    if (error) return toast.error("Erreur");
    toast.success("Supprimé");
    qc.invalidateQueries({ queryKey: ["admin-catalogues"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Catalogues</h1>
          <p className="text-muted-foreground mt-1">
            Le PDF apparaît dans le catalogue feuilletable entre les dates choisies.
          </p>
        </div>
        <Button onClick={() => setEditing({ isNew: true })}>
          <Plus className="h-4 w-4" /> Ajouter un PDF
        </Button>
      </div>

      <Card>
        {isLoading ? (
          <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Titre</TableHead>
                <TableHead>Début</TableHead>
                <TableHead>Fin</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(items ?? []).map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.title}</TableCell>
                  <TableCell>{fmt(c.starts_at)}</TableCell>
                  <TableCell>{fmt(c.ends_at)}</TableCell>
                  <TableCell>{statusOf(c)}</TableCell>
                  <TableCell className="text-right space-x-1">
                    {c.pdf_url && (
                      <Button variant="ghost" size="icon" asChild title="Voir le PDF">
                        <a href={c.pdf_url} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a>
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => setEditing(c)} title="Modifier">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)} title="Supprimer">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {(items ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Aucun catalogue
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.isNew ? "Nouveau catalogue" : "Modifier le catalogue"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Fichier PDF</Label>
                {editing.pdf_url && (
                  <a href={editing.pdf_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-primary underline">
                    <FileText className="h-4 w-4" /> PDF actuel
                  </a>
                )}
                <Input
                  type="file"
                  accept="application/pdf"
                  disabled={uploading}
                  onChange={(e) => e.target.files?.[0] && uploadPdf(e.target.files[0])}
                />
                {uploading && (
                  <p className="text-xs text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin" /> Envoi en cours…
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Titre</Label>
                <Input value={editing.title ?? ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Apparition le</Label>
                  <Input type="date" value={editing.starts_at ?? ""} onChange={(e) => setEditing({ ...editing, starts_at: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Jusqu'au (inclus)</Label>
                  <Input type="date" value={editing.ends_at ?? ""} onChange={(e) => setEditing({ ...editing, ends_at: e.target.value })} />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Annuler</Button>
            <Button onClick={handleSave} disabled={saving || uploading}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
