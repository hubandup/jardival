import { useRef, useState } from "react";
import MediaPickerDialog from "@/components/admin/MediaPickerDialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pencil, Loader2, Download, FileUp, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { exportStoresToXlsx, parseStoresFromFile } from "@/lib/storesXlsx";
import { DEFAULT_HOURS, StoreHours } from "@/data/stores";
import { Checkbox } from "@/components/ui/checkbox";

interface StoreRow {
  id: string;
  slug: string | null;
  name: string;
  address: string;
  postal_code: string | null;
  city: string;
  department: string;
  phone: string | null;
  latitude: number;
  longitude: number;
  image: string | null;
  services: string[] | null;
  hours: StoreHours[] | null;
}

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

function ensureHours(h: StoreHours[] | null | undefined): StoreHours[] {
  if (Array.isArray(h) && h.length === 7) return h;
  return DEFAULT_HOURS.map((d) => ({ ...d }));
}

export default function AdminStores() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<StoreRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [mediaPicker, setMediaPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: stores, isLoading } = useQuery({
    queryKey: ["admin-stores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("stores").select("*").order("name");
      if (error) throw error;
      return data as unknown as StoreRow[];
    },
  });

  const handleExport = () => {
    if (!stores || stores.length === 0) {
      toast.error("Aucun magasin à exporter");
      return;
    }
    exportStoresToXlsx(stores as any);
    toast.success(`${stores.length} magasins exportés`);
  };

  const handleImport = async (file: File) => {
    setImporting(true);
    try {
      const rows = await parseStoresFromFile(file);
      const { error } = await supabase.from("stores").upsert(rows as any, { onConflict: "id" });
      if (error) throw error;
      toast.success(`${rows.length} magasins importés`);
      qc.invalidateQueries({ queryKey: ["admin-stores"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    const { error } = await supabase
      .from("stores")
      .update({
        name: editing.name,
        slug: editing.slug?.trim() ? editing.slug.trim() : null,
        address: editing.address,
        postal_code: editing.postal_code,
        city: editing.city,
        department: editing.department,
        phone: editing.phone,
        latitude: editing.latitude,
        longitude: editing.longitude,
        image: editing.image,
        services: editing.services,
        hours: ensureHours(editing.hours) as any,
      })
      .eq("id", editing.id);
    setSaving(false);
    if (error) {
      toast.error("Erreur lors de la sauvegarde");
      return;
    }
    toast.success("Magasin mis à jour");
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["admin-stores"] });
  };

  const handleImageUpload = async (file: File) => {
    if (!editing) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${editing.id}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("store-images").upload(path, file, { upsert: true });
    if (error) {
      setUploading(false);
      toast.error("Erreur upload");
      return;
    }
    const { data } = supabase.storage.from("store-images").getPublicUrl(path);
    setEditing({ ...editing, image: data.publicUrl });
    setUploading(false);
    toast.success("Image téléchargée");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Magasins</h1>
          <p className="text-muted-foreground mt-1">
            Gérez les informations de vos {stores?.length ?? 0} magasins
          </p>
        </div>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleImport(e.target.files[0])}
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
          >
            {importing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileUp className="h-4 w-4 mr-2" />}
            Importer Excel
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Exporter Excel
          </Button>
        </div>
      </div>

      <Card>
        {isLoading ? (
          <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Ville</TableHead>
                <TableHead>Département</TableHead>
                <TableHead>Téléphone</TableHead>
                <TableHead>Image</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stores?.map((s) => (
                <TableRow
                  key={s.id}
                  className="cursor-pointer"
                  onClick={() => setEditing(s)}
                >
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.city}</TableCell>
                  <TableCell>{s.department}</TableCell>
                  <TableCell>{s.phone ?? "—"}</TableCell>
                  <TableCell>
                    {s.image ? <span className="text-xs text-green-600">✓</span> : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" onClick={() => setEditing(s)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifier le magasin</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label>Nom</Label>
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Slug d'URL</Label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">/magasins/</span>
                  <Input
                    value={editing.slug ?? ""}
                    placeholder="genere-automatiquement-depuis-la-ville"
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        slug: e.target.value
                          .toLowerCase()
                          .replace(/\s+/g, "-")
                          .replace(/[^a-z0-9-]/g, ""),
                      })
                    }
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Laissez vide pour régénérer automatiquement à partir de la ville à l'enregistrement.
                </p>
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Adresse</Label>
                <Input value={editing.address} onChange={(e) => setEditing({ ...editing, address: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Code postal</Label>
                <Input value={editing.postal_code ?? ""} onChange={(e) => setEditing({ ...editing, postal_code: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Ville</Label>
                <Input value={editing.city} onChange={(e) => setEditing({ ...editing, city: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Département</Label>
                <Input value={editing.department} onChange={(e) => setEditing({ ...editing, department: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Téléphone</Label>
                <Input value={editing.phone ?? ""} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Latitude</Label>
                <Input type="number" step="any" value={editing.latitude} onChange={(e) => setEditing({ ...editing, latitude: parseFloat(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>Longitude</Label>
                <Input type="number" step="any" value={editing.longitude} onChange={(e) => setEditing({ ...editing, longitude: parseFloat(e.target.value) })} />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Image de couverture</Label>
                {editing.image && <img src={editing.image} alt="" className="h-32 rounded-md object-cover" />}
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setMediaPicker(true)}>
                    <ImageIcon className="h-4 w-4" /> Médiathèque
                  </Button>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
                    disabled={uploading}
                  />
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
                  defaultBucket="store-images"
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Services (un par ligne)</Label>
                <Textarea
                  rows={5}
                  value={(editing.services ?? []).join("\n")}
                  onChange={(e) => setEditing({ ...editing, services: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
                />
              </div>
              <div className="col-span-2 space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Horaires d'ouverture</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setEditing({ ...editing, hours: DEFAULT_HOURS.map((d) => ({ ...d })) })
                    }
                  >
                    Réinitialiser
                  </Button>
                </div>
                <div className="rounded-md border divide-y">
                  {ensureHours(editing.hours).map((h, i) => {
                    const isContinuous = !h.closed && !!h.morning && !h.afternoon;
                    return (
                      <div key={i} className="grid grid-cols-12 items-center gap-2 p-2">
                        <div className="col-span-2 text-sm font-medium">{DAYS[i]}</div>
                        <div className="col-span-2 flex items-center gap-1.5">
                          <Checkbox
                            id={`closed-${i}`}
                            checked={!!h.closed}
                            onCheckedChange={(v) => {
                              const next = ensureHours(editing.hours).map((x, idx) =>
                                idx === i
                                  ? v
                                    ? { day: DAYS[i], closed: true }
                                    : { day: DAYS[i], morning: "", afternoon: "", closed: false }
                                  : x,
                              );
                              setEditing({ ...editing, hours: next });
                            }}
                          />
                          <label htmlFor={`closed-${i}`} className="text-xs">Fermé</label>
                        </div>
                        <div className="col-span-2 flex items-center gap-1.5">
                          <Checkbox
                            id={`cont-${i}`}
                            checked={isContinuous}
                            disabled={!!h.closed}
                            onCheckedChange={(v) => {
                              const next = ensureHours(editing.hours).map((x, idx) =>
                                idx === i
                                  ? v
                                    ? { day: DAYS[i], morning: x.morning ?? "", afternoon: "", closed: false }
                                    : { day: DAYS[i], morning: x.morning ?? "", afternoon: "14h00 – 19h00", closed: false }
                                  : x,
                              );
                              setEditing({ ...editing, hours: next });
                            }}
                          />
                          <label htmlFor={`cont-${i}`} className="text-xs">Continu</label>
                        </div>
                        {isContinuous ? (
                          <Input
                            className="col-span-6 h-8"
                            placeholder="9h00 – 19h00"
                            disabled={!!h.closed}
                            value={h.morning ?? ""}
                            onChange={(e) => {
                              const next = ensureHours(editing.hours).map((x, idx) =>
                                idx === i ? { ...x, day: DAYS[i], morning: e.target.value, afternoon: "" } : x,
                              );
                              setEditing({ ...editing, hours: next });
                            }}
                          />
                        ) : (
                          <>
                            <Input
                              className="col-span-3 h-8"
                              placeholder="9h00 – 12h00"
                              disabled={!!h.closed}
                              value={h.morning ?? ""}
                              onChange={(e) => {
                                const next = ensureHours(editing.hours).map((x, idx) =>
                                  idx === i ? { ...x, day: DAYS[i], morning: e.target.value } : x,
                                );
                                setEditing({ ...editing, hours: next });
                              }}
                            />
                            <Input
                              className="col-span-3 h-8"
                              placeholder="14h00 – 19h00"
                              disabled={!!h.closed}
                              value={h.afternoon ?? ""}
                              onChange={(e) => {
                                const next = ensureHours(editing.hours).map((x, idx) =>
                                  idx === i ? { ...x, day: DAYS[i], afternoon: e.target.value } : x,
                                );
                                setEditing({ ...editing, hours: next });
                              }}
                            />
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  Cochez « Continu » pour une journée non-stop (un seul créneau). Format conseillé : « 9h00 – 12h00 » (tiret long « – »).
                </p>
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
