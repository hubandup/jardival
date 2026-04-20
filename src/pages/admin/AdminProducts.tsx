import { useMemo, useRef, useState } from "react";
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
import { Pencil, Trash2, Plus, Loader2, Search, Download, Upload, ImageDown } from "lucide-react";
import { toast } from "sonner";
import { ProductRow } from "@/hooks/useProducts";
import { exportProductsToXlsx, parseProductsFromFile } from "@/lib/productsXlsx";
import { migrateProductImagesToBucket } from "@/lib/migrateProductImages";

const empty = (): Omit<ProductRow, "id"> => ({
  ref: "",
  name: "",
  category: "",
  description: "",
  image: null,
  images: null,
  price: null,
  old_price: null,
  discount: 0,
  is_new: false,
  display_order: 0,
  active: true,
});

export default function AdminProducts() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<(Partial<ProductRow> & { isNew?: boolean }) | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [importing, setImporting] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const PAGE_SIZE = 50;

  const { data: products, isLoading } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("display_order")
        .limit(2000);
      if (error) throw error;
      return data as ProductRow[];
    },
  });

  const filtered = useMemo(() => {
    if (!products) return [];
    const s = search.trim().toLowerCase();
    if (!s) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(s) ||
        (p.ref ?? "").toLowerCase().includes(s) ||
        (p.category ?? "").toLowerCase().includes(s),
    );
  }, [products, search]);

  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const handleSave = async () => {
    if (!editing || !editing.name) {
      toast.error("Le nom est requis");
      return;
    }
    setSaving(true);
    const payload = {
      ref: editing.ref ?? null,
      name: editing.name,
      category: editing.category ?? null,
      description: editing.description ?? null,
      image: editing.image ?? null,
      images: editing.images ?? null,
      price: editing.price ?? null,
      old_price: editing.old_price ?? null,
      discount: editing.discount ?? 0,
      is_new: editing.is_new ?? false,
      display_order: editing.display_order ?? 0,
      active: editing.active ?? true,
    };
    const { error } = editing.isNew
      ? await supabase.from("products").insert(payload)
      : await supabase.from("products").update(payload).eq("id", editing.id!);
    setSaving(false);
    if (error) {
      toast.error("Erreur lors de la sauvegarde");
      return;
    }
    toast.success("Produit enregistré");
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["admin-products"] });
    qc.invalidateQueries({ queryKey: ["products"] });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer ce produit ?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) return toast.error("Erreur");
    toast.success("Supprimé");
    qc.invalidateQueries({ queryKey: ["admin-products"] });
    qc.invalidateQueries({ queryKey: ["products"] });
  };

  const handleImageUpload = async (file: File) => {
    if (!editing) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file);
    if (error) {
      setUploading(false);
      return toast.error("Erreur upload");
    }
    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    setEditing({ ...editing, image: data.publicUrl });
    setUploading(false);
  };

  const handleExport = () => {
    if (!products?.length) return toast.error("Aucun produit à exporter");
    exportProductsToXlsx(products);
    toast.success(`${products.length} produits exportés`);
  };

  const handleImport = async (file: File) => {
    setImporting(true);
    try {
      const rows = await parseProductsFromFile(file);
      const { error } = await supabase
        .from("products")
        .upsert(rows, { onConflict: "id" });
      if (error) throw error;
      toast.success(`${rows.length} produits importés`);
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleMigrateImages = async () => {
    if (!confirm("Migrer les images locales (products.json) vers le bucket pour les produits sans image ?")) return;
    setMigrating(true);
    try {
      const r = await migrateProductImagesToBucket();
      toast.success(
        `Migration : ${r.updated}/${r.total} produits mis à jour (${r.skipped} ignorés)` +
          (r.errors.length ? ` — ${r.errors.length} erreur(s)` : "")
      );
      if (r.errors.length) console.warn("Erreurs migration produits:", r.errors);
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setMigrating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Produits</h1>
          <p className="text-muted-foreground mt-1">
            Catalogue produits — {products?.length ?? 0} articles
          </p>
        </div>
        <div className="flex items-center gap-2">
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
          <Button variant="outline" size="sm" onClick={handleMigrateImages} disabled={migrating}>
            {migrating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageDown className="h-4 w-4" />}
            Migrer images
          </Button>
          <Button onClick={() => setEditing({ ...empty(), isNew: true })}>
            <Plus className="h-4 w-4" /> Ajouter
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom, référence, catégorie…"
            className="pl-9"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />
        </div>
        <div className="text-sm text-muted-foreground">
          {filtered.length} résultat{filtered.length > 1 ? "s" : ""}
        </div>
      </div>

      <Card>
        {isLoading ? (
          <div className="p-8 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Image</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Réf.</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead>Prix</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((p) => (
                <TableRow
                  key={p.id}
                  onClick={() => setEditing(p)}
                  className="cursor-pointer hover:bg-muted/50"
                >
                  <TableCell>
                    {p.image ? (
                      <img src={p.image} alt="" className="h-10 w-10 object-cover rounded" />
                    ) : (
                      <div className="h-10 w-10 rounded bg-muted" />
                    )}
                  </TableCell>
                  <TableCell className="font-medium max-w-xs truncate">{p.name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{p.ref ?? "—"}</TableCell>
                  <TableCell className="text-xs">{p.category ?? "—"}</TableCell>
                  <TableCell>
                    {p.price != null ? `${p.price}€` : "—"}
                    {p.old_price && (
                      <span className="line-through text-muted-foreground ml-2 text-xs">{p.old_price}€</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className={p.active ? "text-green-600 text-xs" : "text-muted-foreground text-xs"}>
                      {p.active ? "Actif" : "Inactif"}
                    </span>
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
              ))}
              {paged.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Aucun produit
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
            Précédent
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page + 1} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
          >
            Suivant
          </Button>
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.isNew ? "Nouveau produit" : "Modifier le produit"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label>Nom *</Label>
                <Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Référence</Label>
                <Input value={editing.ref ?? ""} onChange={(e) => setEditing({ ...editing, ref: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Catégorie</Label>
                <Input
                  value={editing.category ?? ""}
                  onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Description</Label>
                <Textarea
                  rows={3}
                  value={editing.description ?? ""}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Prix (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editing.price ?? ""}
                  onChange={(e) =>
                    setEditing({ ...editing, price: e.target.value ? parseFloat(e.target.value) : null })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Prix barré (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editing.old_price ?? ""}
                  onChange={(e) =>
                    setEditing({ ...editing, old_price: e.target.value ? parseFloat(e.target.value) : null })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Remise (%)</Label>
                <Input
                  type="number"
                  value={editing.discount ?? 0}
                  onChange={(e) => setEditing({ ...editing, discount: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Ordre d'affichage</Label>
                <Input
                  type="number"
                  value={editing.display_order ?? 0}
                  onChange={(e) => setEditing({ ...editing, display_order: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2 flex flex-col">
                <Label>Nouveauté</Label>
                <Switch
                  checked={editing.is_new ?? false}
                  onCheckedChange={(v) => setEditing({ ...editing, is_new: v })}
                />
              </div>
              <div className="space-y-2 flex flex-col">
                <Label>Actif</Label>
                <Switch
                  checked={editing.active ?? true}
                  onCheckedChange={(v) => setEditing({ ...editing, active: v })}
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Image principale</Label>
                {editing.image && <img src={editing.image} alt="" className="h-32 rounded-md object-cover" />}
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
                  disabled={uploading}
                />
                {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
                <Input
                  placeholder="Ou collez une URL"
                  value={editing.image ?? ""}
                  onChange={(e) => setEditing({ ...editing, image: e.target.value || null })}
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Galerie (une URL par ligne)</Label>
                <Textarea
                  rows={3}
                  value={(editing.images ?? []).join("\n")}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      images: e.target.value
                        .split("\n")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Annuler
            </Button>
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
