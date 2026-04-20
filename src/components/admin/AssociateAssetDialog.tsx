import { useEffect, useMemo, useState } from "react";
import { Loader2, Link2, Search, Package, Tag, Store } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { MediaAsset } from "@/hooks/useMedia";

type EntityKind = "product" | "promotion" | "store";

interface Candidate {
  id: string;
  name: string;
  category?: string | null;
  hasImage: boolean;
}

interface AssociateAssetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: MediaAsset | null;
}

export default function AssociateAssetDialog({
  open,
  onOpenChange,
  asset,
}: AssociateAssetDialogProps) {
  const [kind, setKind] = useState<EntityKind>("product");
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addToGallery, setAddToGallery] = useState(false);
  const qc = useQueryClient();

  // Reset on open
  useEffect(() => {
    if (open) {
      setQ("");
      setSelectedId(null);
      setAddToGallery(false);
      setKind("product");
    }
  }, [open]);

  const { data: candidates = [], isLoading } = useQuery({
    queryKey: ["associate-candidates", kind, q],
    enabled: open,
    queryFn: async (): Promise<Candidate[]> => {
      const term = q.trim();
      if (kind === "product") {
        let query = supabase
          .from("products")
          .select("id,name,category,image")
          .order("name")
          .limit(40);
        if (term) query = query.ilike("name", `%${term}%`);
        const { data, error } = await query;
        if (error) throw error;
        return (data ?? []).map((p) => ({
          id: p.id,
          name: p.name,
          category: p.category,
          hasImage: !!p.image,
        }));
      }
      if (kind === "promotion") {
        let query = supabase
          .from("promotions")
          .select("id,title,image")
          .order("title")
          .limit(40);
        if (term) query = query.ilike("title", `%${term}%`);
        const { data, error } = await query;
        if (error) throw error;
        return (data ?? []).map((p) => ({
          id: p.id,
          name: p.title,
          hasImage: !!p.image,
        }));
      }
      let query = supabase
        .from("stores")
        .select("id,name,city,image")
        .order("name")
        .limit(40);
      if (term) query = query.or(`name.ilike.%${term}%,city.ilike.%${term}%`);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        category: s.city,
        hasImage: !!s.image,
      }));
    },
  });

  const associate = useMutation({
    mutationFn: async () => {
      if (!asset || !selectedId) throw new Error("Sélection manquante");
      const url = asset.public_url;

      let entityName = "";

      if (kind === "product") {
        const { data: product, error: fetchErr } = await supabase
          .from("products")
          .select("name,images")
          .eq("id", selectedId)
          .single();
        if (fetchErr) throw fetchErr;
        entityName = product.name;

        const patch: { image: string; images?: string[] } = { image: url };
        if (addToGallery) {
          const current = Array.isArray(product.images) ? product.images : [];
          if (!current.includes(url)) patch.images = [...current, url];
        }
        const { error } = await supabase
          .from("products")
          .update(patch)
          .eq("id", selectedId);
        if (error) throw error;
      } else if (kind === "promotion") {
        const { data: promo, error: fetchErr } = await supabase
          .from("promotions")
          .select("title")
          .eq("id", selectedId)
          .single();
        if (fetchErr) throw fetchErr;
        entityName = promo.title;
        const { error } = await supabase
          .from("promotions")
          .update({ image: url })
          .eq("id", selectedId);
        if (error) throw error;
      } else {
        const { data: store, error: fetchErr } = await supabase
          .from("stores")
          .select("name")
          .eq("id", selectedId)
          .single();
        if (fetchErr) throw fetchErr;
        entityName = store.name;
        const { error } = await supabase
          .from("stores")
          .update({ image: url })
          .eq("id", selectedId);
        if (error) throw error;
      }

      // Sync media title + alt with entity name
      const { error: mediaErr } = await supabase
        .from("media_assets")
        .update({ title: entityName, alt: asset.alt || entityName })
        .eq("id", asset.id);
      if (mediaErr) throw mediaErr;

      return entityName;
    },
    onSuccess: (entityName) => {
      toast.success(`Image associée à « ${entityName} »`);
      qc.invalidateQueries({ queryKey: ["media_assets"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["promotions"] });
      qc.invalidateQueries({ queryKey: ["stores"] });
      onOpenChange(false);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const filtered = useMemo(() => candidates, [candidates]);

  if (!asset) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" /> Associer cette image
          </DialogTitle>
          <DialogDescription>
            Liez cette image à un produit, une promotion ou un magasin. Le titre et le texte alternatif seront synchronisés automatiquement.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3">
          <img
            src={asset.public_url}
            alt={asset.alt ?? ""}
            className="h-16 w-16 rounded-md object-cover border"
          />
          <div className="text-sm min-w-0">
            <p className="font-medium truncate">{asset.title ?? asset.path}</p>
            <p className="text-xs text-muted-foreground truncate">{asset.path}</p>
          </div>
        </div>

        <Tabs value={kind} onValueChange={(v) => { setKind(v as EntityKind); setSelectedId(null); }}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="product"><Package className="h-4 w-4 mr-1" />Produit</TabsTrigger>
            <TabsTrigger value="promotion"><Tag className="h-4 w-4 mr-1" />Promotion</TabsTrigger>
            <TabsTrigger value="store"><Store className="h-4 w-4 mr-1" />Magasin</TabsTrigger>
          </TabsList>

          <TabsContent value={kind} className="mt-3 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-9"
                autoFocus
              />
            </div>

            <div className="border rounded-md max-h-[320px] overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : filtered.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-10">
                  Aucun résultat.
                </p>
              ) : (
                <RadioGroup value={selectedId ?? ""} onValueChange={setSelectedId}>
                  {filtered.map((c) => (
                    <Label
                      key={c.id}
                      htmlFor={`assoc-${c.id}`}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 cursor-pointer border-b last:border-b-0 hover:bg-muted/50 transition-colors",
                        selectedId === c.id && "bg-primary/5",
                      )}
                    >
                      <RadioGroupItem id={`assoc-${c.id}`} value={c.id} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{c.name}</p>
                        {c.category && (
                          <p className="text-xs text-muted-foreground truncate">{c.category}</p>
                        )}
                      </div>
                      {c.hasImage && (
                        <span className="text-[10px] text-muted-foreground">image actuelle sera remplacée</span>
                      )}
                    </Label>
                  ))}
                </RadioGroup>
              )}
            </div>

            {kind === "product" && selectedId && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="add-gallery"
                  checked={addToGallery}
                  onCheckedChange={(v) => setAddToGallery(v === true)}
                />
                <Label htmlFor="add-gallery" className="text-sm cursor-pointer">
                  Ajouter aussi à la galerie du produit
                </Label>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Plus tard
          </Button>
          <Button
            onClick={() => associate.mutate()}
            disabled={!selectedId || associate.isPending}
          >
            {associate.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Associer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
