import { useRef, useState } from "react";
import MediaPickerDialog from "@/components/admin/MediaPickerDialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pencil, Trash2, Plus, Loader2, ImageDown, Download, Upload, Star, Image as ImageIcon, LayoutGrid, List } from "lucide-react";
import { toast } from "sonner";
import { migratePromoImagesToBucket } from "@/lib/migratePromoImages";
import { exportPromotionsToXlsx, parsePromotionsFromFile } from "@/lib/promotionsXlsx";
import { findCatalogueFallback } from "@/lib/promotion";
import { useHeroMode, useSetHeroMode } from "@/hooks/useHero";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface PromoRow {
  id: string;
  title: string;
  description: string | null;
  price: number | null;
  original_price: number | null;
  image: string | null;
  starts_at: string | null;
  ends_at: string | null;
  display_order: number;
  active: boolean;
  hero_featured: boolean;
}

const empty = (): Omit<PromoRow, "id"> => ({
  title: "",
  description: "",
  price: null,
  original_price: null,
  image: null,
  starts_at: null,
  ends_at: null,
  display_order: 0,
  active: true,
  hero_featured: false,
});

export default function AdminPromotions() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<(Partial<PromoRow> & { isNew?: boolean }) | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [mediaPicker, setMediaPicker] = useState(false);
  const [view, setView] = useState<"table" | "grid">(() => {
    if (typeof window === "undefined") return "table";
    return (localStorage.getItem("admin-promos-view") as "table" | "grid") || "table";
  });
  const switchView = (v: "table" | "grid") => {
    setView(v);
    try { localStorage.setItem("admin-promos-view", v); } catch {}
  };
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: heroMode = "random" } = useHeroMode();
  const setHeroMode = useSetHeroMode();

  const toggleHeroFeatured = async (id: string, value: boolean) => {
    const { error } = await supabase.from("promotions").update({ hero_featured: value }).eq("id", id);
    if (error) return toast.error("Erreur");
    qc.invalidateQueries({ queryKey: ["admin-promotions"] });
    qc.invalidateQueries({ queryKey: ["hero_promos"] });
  };


  const handleExport = async () => {
    const { data, error } = await supabase.from("promotions").select("*").order("display_order");
    if (error || !data) return toast.error("Erreur export");
    if (!data.length) return toast.error("Aucune promotion à exporter");
    exportPromotionsToXlsx(data);
    toast.success(`${data.length} promotions exportées`);
  };

  const handleImport = async (file: File) => {
    setImporting(true);
    try {
      const rows = await parsePromotionsFromFile(file);
      const { error } = await supabase
        .from("promotions")
        .upsert(rows, { onConflict: "id" });
      if (error) throw error;
      toast.success(`${rows.length} promotions importées`);
      qc.invalidateQueries({ queryKey: ["admin-promotions"] });
      qc.invalidateQueries({ queryKey: ["promotions"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleMigrate = async () => {
    if (!confirm("Uploader les images locales du catalogue vers le bucket pour toutes les promos sans image ?")) return;
    setMigrating(true);
    try {
      const r = await migratePromoImagesToBucket();
      toast.success(
        `Migration terminée : ${r.updated}/${r.total} promos mises à jour (${r.skipped} ignorées)` +
          (r.errors.length ? ` — ${r.errors.length} erreur(s)` : "")
      );
      if (r.errors.length) console.warn("Erreurs migration:", r.errors);
      qc.invalidateQueries({ queryKey: ["admin-promotions"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setMigrating(false);
    }
  };

  const { data: promos, isLoading } = useQuery({
    queryKey: ["admin-promotions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("promotions").select("*").order("display_order");
      if (error) throw error;
      return data as PromoRow[];
    },
  });

  const handleSave = async () => {
    if (!editing || !editing.title) {
      toast.error("Le titre est requis");
      return;
    }
    setSaving(true);
    const payload = {
      title: editing.title,
      description: editing.description ?? null,
      price: editing.price ?? null,
      original_price: editing.original_price ?? null,
      image: editing.image ?? null,
      starts_at: editing.starts_at || null,
      ends_at: editing.ends_at || null,
      display_order: editing.display_order ?? 0,
      active: editing.active ?? true,
      hero_featured: editing.hero_featured ?? false,
    };
    const { error } = editing.isNew
      ? await supabase.from("promotions").insert(payload)
      : await supabase.from("promotions").update(payload).eq("id", editing.id!);
    setSaving(false);
    if (error) {
      toast.error("Erreur lors de la sauvegarde");
      return;
    }
    toast.success("Promotion enregistrée");
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["admin-promotions"] });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer cette promotion ?")) return;
    const { error } = await supabase.from("promotions").delete().eq("id", id);
    if (error) return toast.error("Erreur");
    toast.success("Supprimée");
    qc.invalidateQueries({ queryKey: ["admin-promotions"] });
  };

  const handleImageUpload = async (file: File) => {
    if (!editing) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("promo-images").upload(path, file);
    if (error) { setUploading(false); return toast.error("Erreur upload"); }
    const { data } = supabase.storage.from("promo-images").getPublicUrl(path);
    setEditing({ ...editing, image: data.publicUrl });
    setUploading(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Promotions</h1>
          <p className="text-muted-foreground mt-1">Produits en promo affichés sur le site</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center rounded-md border border-border p-0.5">
            <Button
              type="button"
              variant={view === "table" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 px-2"
              onClick={() => switchView("table")}
              title="Vue tableau"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant={view === "grid" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 px-2"
              onClick={() => switchView("grid")}
              title="Vue grille"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4" /> Exporter Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={importing}>
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Importer Excel
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleImport(e.target.files[0])}
          />
          <Button variant="outline" size="sm" onClick={handleMigrate} disabled={migrating}>
            {migrating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageDown className="h-4 w-4" />}
            Migrer images
          </Button>
          <Button onClick={() => setEditing({ ...empty(), isNew: true })}>
            <Plus className="h-4 w-4" /> Ajouter
          </Button>
        </div>
      </div>

      <Card className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="font-semibold flex items-center gap-2"><Star className="h-4 w-4 text-accent" />Section "Hero" (page d'accueil)</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {heroMode === "manual"
              ? "Mode manuel : seules les promos cochées \"Mettre en avant\" sont affichées (4 max)."
              : "Mode aléatoire : 4 promos actives sont tirées au hasard à chaque visite."}
          </p>
        </div>
        <Select value={heroMode} onValueChange={(v) => setHeroMode(v as "manual" | "random").then(() => toast.success("Mode Hero mis à jour"))}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="manual">Manuel (sélection)</SelectItem>
            <SelectItem value="random">Aléatoire</SelectItem>
          </SelectContent>
        </Select>
      </Card>

      <Card>
        {isLoading ? (
          <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Image</TableHead>
                <TableHead>Ordre</TableHead>
                <TableHead>Titre</TableHead>
                <TableHead>Prix</TableHead>
                <TableHead>Validité</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="w-16 text-center">Hero</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {promos?.map((p) => {
                const img = p.image ?? findCatalogueFallback(p.title)?.image ?? null;
                return (
                <TableRow
                  key={p.id}
                  onClick={() => setEditing(p)}
                  className="cursor-pointer hover:bg-muted/50"
                >
                  <TableCell>
                    {img ? (
                      <img src={img} alt="" className="h-10 w-10 object-cover rounded" />
                    ) : (
                      <div className="h-10 w-10 rounded bg-muted" />
                    )}
                  </TableCell>
                  <TableCell>{p.display_order}</TableCell>
                  <TableCell className="font-medium">{p.title}</TableCell>
                  <TableCell>
                    {p.price ? `${p.price}€` : "—"}
                    {p.original_price && <span className="line-through text-muted-foreground ml-2 text-xs">{p.original_price}€</span>}
                  </TableCell>
                  <TableCell className="text-xs">
                    {p.starts_at && p.ends_at ? `${p.starts_at} → ${p.ends_at}` : "—"}
                  </TableCell>
                  <TableCell>
                    <span className={p.active ? "text-green-600 text-xs" : "text-muted-foreground text-xs"}>
                      {p.active ? "Actif" : "Inactif"}
                    </span>
                  </TableCell>
                  <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => toggleHeroFeatured(p.id, !p.hero_featured)}
                      className="inline-flex items-center justify-center"
                      title={p.hero_featured ? "Retirer du Hero" : "Mettre en avant dans le Hero"}
                    >
                      <Star className={`h-4 w-4 ${p.hero_featured ? "fill-accent text-accent" : "text-muted-foreground"}`} />
                    </button>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" onClick={() => setEditing(p)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
                );
              })}
              {promos?.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Aucune promotion</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.isNew ? "Nouvelle promotion" : "Modifier la promotion"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label>Titre *</Label>
                <Input value={editing.title ?? ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Description</Label>
                <Textarea rows={3} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Prix (€)</Label>
                <Input type="number" step="0.01" value={editing.price ?? ""} onChange={(e) => setEditing({ ...editing, price: e.target.value ? parseFloat(e.target.value) : null })} />
              </div>
              <div className="space-y-2">
                <Label>Prix barré (€)</Label>
                <Input type="number" step="0.01" value={editing.original_price ?? ""} onChange={(e) => setEditing({ ...editing, original_price: e.target.value ? parseFloat(e.target.value) : null })} />
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
              <div className="col-span-2 space-y-2 rounded-md border border-border bg-muted/30 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm">Mettre en avant dans le Hero</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">Affichée en haut de la page d'accueil (mode manuel uniquement)</p>
                  </div>
                  <Switch checked={editing.hero_featured ?? false} onCheckedChange={(v) => setEditing({ ...editing, hero_featured: v })} />
                </div>
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Image</Label>
                {(() => {
                  const preview = editing.image ?? findCatalogueFallback(editing.title ?? "")?.image;
                  return preview ? (
                    <div className="space-y-1">
                      <img src={preview} alt="" className="h-32 rounded-md object-cover" />
                      {!editing.image && (
                        <p className="text-xs text-muted-foreground">Image issue du catalogue (non sauvegardée). Cliquez "Migrer images" ou uploadez ci-dessous.</p>
                      )}
                    </div>
                  ) : null;
                })()}
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setMediaPicker(true)}>
                    <ImageIcon className="h-4 w-4" /> Médiathèque
                  </Button>
                  <Input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])} disabled={uploading} />
                  {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
                </div>
                <Input
                  placeholder="Ou collez une URL"
                  value={editing.image ?? ""}
                  onChange={(e) => setEditing({ ...editing, image: e.target.value || null })}
                />
                <MediaPickerDialog
                  open={mediaPicker}
                  onOpenChange={setMediaPicker}
                  onSelect={(url) => setEditing({ ...editing, image: url })}
                  defaultBucket="promo-images"
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
    </div>
  );
}
