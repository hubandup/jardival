import { useMemo, useRef, useState } from "react";
import { Loader2, RefreshCw, Search, Trash2, Upload, X, Copy, FileText, LayoutGrid, List, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import {
  MediaAsset,
  useDeleteMediaAsset,
  useMediaAssets,
  useSyncMedia,
  useUpdateMediaAsset,
  useUploadMedia,
} from "@/hooks/useMedia";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
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
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import AssociateAssetDialog from "@/components/admin/AssociateAssetDialog";

const BUCKET_LABELS: Record<string, string> = {
  all: "Tous",
  media: "Médiathèque",
  "product-images": "Produits",
  "promo-images": "Promotions",
  "store-images": "Magasins",
  catalogues: "Catalogues",
  external: "URL externes",
};

export default function AdminMedia() {
  const [bucket, setBucket] = useState<string>("all");
  const [type, setType] = useState<"all" | "image" | "pdf">("all");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<MediaAsset | null>(null);
  const [toDelete, setToDelete] = useState<MediaAsset | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [sortKey, setSortKey] = useState<"title" | "bucket" | "size" | "date">("date");
  const [sortAsc, setSortAsc] = useState(false);
  const [associateAsset, setAssociateAsset] = useState<MediaAsset | null>(null);

  const { data: rawAssets = [], isLoading } = useMediaAssets({ bucket, type, q });

  const assets = useMemo(() => {
    const sorted = [...rawAssets].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "title":
          cmp = (a.title ?? a.path).localeCompare(b.title ?? b.path);
          break;
        case "bucket":
          cmp = a.bucket.localeCompare(b.bucket);
          break;
        case "size":
          cmp = (a.size_bytes ?? 0) - (b.size_bytes ?? 0);
          break;
        case "date":
          cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
      }
      return sortAsc ? cmp : -cmp;
    });
    return sorted;
  }, [rawAssets, sortKey, sortAsc]);
  const sync = useSyncMedia();
  const upload = useUploadMedia();
  const remove = useDeleteMediaAsset();

  const handleSync = async () => {
    try {
      const res = await sync.mutateAsync();
      toast.success(`Sync : ${res.inserted} nouveaux fichiers (${res.scanned} scannés)`);
      if (res.errors.length) toast.warning(`${res.errors.length} erreur(s)`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    const uploaded: MediaAsset[] = [];
    for (const f of Array.from(files)) {
      try {
        const a = await upload.mutateAsync(f);
        uploaded.push(a);
      } catch (e) {
        toast.error(`${f.name} : ${(e as Error).message}`);
      }
    }
    if (uploaded.length) {
      toast.success(`${uploaded.length} fichier(s) ajouté(s)`);
      // Propose association for the first uploaded image
      const firstImage = uploaded.find((a) => a.mime_type?.startsWith("image/"));
      if (firstImage) setAssociateAsset(firstImage);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    try {
      await remove.mutateAsync(toDelete);
      toast.success("Fichier supprimé");
      setToDelete(null);
      if (selected?.id === toDelete.id) setSelected(null);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const buckets = useMemo(() => Object.keys(BUCKET_LABELS), []);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Médiathèque</h1>
          <p className="text-sm text-muted-foreground">
            {assets.length} fichier(s) • Gérez vos images, PDF et leurs métadonnées SEO.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
          />
          <Button
            variant="outline"
            onClick={handleSync}
            disabled={sync.isPending}
          >
            {sync.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Synchroniser
          </Button>
          <Button onClick={() => fileInputRef.current?.click()} disabled={upload.isPending}>
            {upload.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Ajouter
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par titre, alt, description, slug, fichier…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={bucket} onValueChange={setBucket}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {buckets.map((b) => (
              <SelectItem key={b} value={b}>{BUCKET_LABELS[b]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous types</SelectItem>
            <SelectItem value="image">Images</SelectItem>
          <SelectItem value="pdf">PDF</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex border rounded-md">
          <Button
            variant={view === "grid" ? "secondary" : "ghost"}
            size="icon"
            className="h-9 w-9 rounded-r-none"
            onClick={() => setView("grid")}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={view === "list" ? "secondary" : "ghost"}
            size="icon"
            className="h-9 w-9 rounded-l-none"
            onClick={() => setView("list")}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : assets.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          <p className="mb-2">Aucun fichier.</p>
          <p className="text-sm">
            Cliquez sur <b>Synchroniser</b> pour importer les fichiers déjà présents dans vos buckets,
            ou <b>Ajouter</b> pour téléverser de nouveaux médias.
          </p>
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {assets.map((asset) => (
            <MediaCard key={asset.id} asset={asset} onSelect={setSelected} />
          ))}
        </div>
      ) : (
        <MediaListView
          assets={assets}
          onSelect={setSelected}
          sortKey={sortKey}
          sortAsc={sortAsc}
          onSort={(key) => {
            if (key === sortKey) setSortAsc(!sortAsc);
            else { setSortKey(key); setSortAsc(true); }
          }}
        />
      )}

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {selected && (
            <EditPanel
              asset={selected}
              onDelete={() => setToDelete(selected)}
              onClose={() => setSelected(null)}
            />
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce fichier ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le fichier <b>{toDelete?.path}</b> sera retiré de la médiathèque. Si possible,
              il sera également supprimé du bucket de stockage. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SortHeader({
  label,
  active,
  asc,
  onClick,
}: {
  label: string;
  active: boolean;
  asc: boolean;
  onClick: () => void;
}) {
  return (
    <TableHead>
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
      >
        {label}
        <ArrowUpDown className={cn("h-3 w-3", active ? "text-foreground" : "text-muted-foreground/50")} />
        {active && <span className="text-[10px]">{asc ? "↑" : "↓"}</span>}
      </button>
    </TableHead>
  );
}

function MediaListView({
  assets,
  onSelect,
  sortKey,
  sortAsc,
  onSort,
}: {
  assets: MediaAsset[];
  onSelect: (a: MediaAsset) => void;
  sortKey: string;
  sortAsc: boolean;
  onSort: (key: "title" | "bucket" | "size" | "date") => void;
}) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12"></TableHead>
            <SortHeader label="Titre" active={sortKey === "title"} asc={sortAsc} onClick={() => onSort("title")} />
            <SortHeader label="Bucket" active={sortKey === "bucket"} asc={sortAsc} onClick={() => onSort("bucket")} />
            <TableHead>Type</TableHead>
            <TableHead>Dimensions</TableHead>
            <SortHeader label="Taille" active={sortKey === "size"} asc={sortAsc} onClick={() => onSort("size")} />
            <TableHead>Alt</TableHead>
            <SortHeader label="Date" active={sortKey === "date"} asc={sortAsc} onClick={() => onSort("date")} />
          </TableRow>
        </TableHeader>
        <TableBody>
          {assets.map((asset) => {
            const isImage = asset.mime_type?.startsWith("image/");
            return (
              <TableRow
                key={asset.id}
                onClick={() => onSelect(asset)}
                className="cursor-pointer hover:bg-muted/50"
              >
                <TableCell>
                  {isImage ? (
                    <img src={asset.public_url} alt="" className="h-9 w-9 rounded object-cover" />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded bg-muted">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </TableCell>
                <TableCell className="font-medium max-w-[200px] truncate">
                  {asset.title ?? asset.path}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[10px]">
                    {BUCKET_LABELS[asset.bucket] ?? asset.bucket}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {asset.mime_type?.split("/").pop() ?? "—"}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {asset.width && asset.height ? `${asset.width}×${asset.height}` : "—"}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {asset.size_bytes ? `${(asset.size_bytes / 1024).toFixed(0)} Ko` : "—"}
                </TableCell>
                <TableCell>
                  {isImage && !asset.alt ? (
                    <Badge variant="destructive" className="text-[10px]">manquant</Badge>
                  ) : isImage ? (
                    <span className="text-xs text-muted-foreground max-w-[120px] truncate block">{asset.alt}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(asset.created_at).toLocaleDateString("fr-FR")}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function MediaCard({ asset, onSelect }: { asset: MediaAsset; onSelect: (a: MediaAsset) => void }) {
  const isImage = asset.mime_type?.startsWith("image/");
  const isPdf = asset.mime_type === "application/pdf";
  const incomplete = !asset.alt && isImage;

  return (
    <button
      onClick={() => onSelect(asset)}
      className={cn(
        "group relative aspect-square overflow-hidden rounded-lg border bg-muted text-left transition-all hover:shadow-md hover:border-primary/40",
      )}
    >
      {isImage ? (
        <img
          src={asset.public_url}
          alt={asset.alt ?? asset.title ?? ""}
          loading="lazy"
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-muted-foreground">
          <FileText className="h-10 w-10" />
          <span className="line-clamp-2 text-center text-xs">{asset.title ?? asset.path}</span>
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-gradient-to-t from-black/80 to-transparent p-2 text-[11px] text-white opacity-0 transition-opacity group-hover:opacity-100">
        <span className="line-clamp-1 font-medium">{asset.title ?? asset.path}</span>
        <span className="line-clamp-1 text-white/70">{asset.bucket}</span>
      </div>
      {incomplete && (
        <Badge variant="destructive" className="absolute right-2 top-2 text-[10px]">
          alt manquant
        </Badge>
      )}
      {isPdf && (
        <Badge className="absolute left-2 top-2 text-[10px]">PDF</Badge>
      )}
    </button>
  );
}

function EditPanel({
  asset,
  onClose,
  onDelete,
}: {
  asset: MediaAsset;
  onClose: () => void;
  onDelete: () => void;
}) {
  const [form, setForm] = useState({
    title: asset.title ?? "",
    alt: asset.alt ?? "",
    description: asset.description ?? "",
    caption: asset.caption ?? "",
    credit: asset.credit ?? "",
    seo_slug: asset.seo_slug ?? "",
    tags: asset.tags?.join(", ") ?? "",
  });
  const update = useUpdateMediaAsset();
  const isImage = asset.mime_type?.startsWith("image/");

  const handleSave = async () => {
    try {
      await update.mutateAsync({
        id: asset.id,
        patch: {
          title: form.title || null,
          alt: form.alt || null,
          description: form.description || null,
          caption: form.caption || null,
          credit: form.credit || null,
          seo_slug: form.seo_slug || null,
          tags: form.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        },
      });
      toast.success("Métadonnées enregistrées");
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <>
      <SheetHeader>
        <SheetTitle className="line-clamp-1">{asset.title ?? asset.path}</SheetTitle>
        <SheetDescription className="font-mono text-xs">
          {asset.bucket}/{asset.path}
        </SheetDescription>
      </SheetHeader>

      <div className="my-4 overflow-hidden rounded-lg border bg-muted">
        {isImage ? (
          <img src={asset.public_url} alt={form.alt} className="max-h-72 w-full object-contain" />
        ) : (
          <div className="flex h-48 flex-col items-center justify-center gap-2 text-muted-foreground">
            <FileText className="h-12 w-12" />
            <a
              href={asset.public_url}
              target="_blank"
              rel="noreferrer"
              className="text-sm underline"
            >
              Ouvrir le fichier
            </a>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <Field label="Titre" value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
        {isImage && (
          <Field
            label="Texte alternatif (alt)"
            value={form.alt}
            onChange={(v) => setForm({ ...form, alt: v })}
            hint="Décrit l'image pour les lecteurs d'écran et le SEO. Obligatoire pour l'accessibilité."
          />
        )}
        <div className="space-y-1.5">
          <Label htmlFor="desc">Description</Label>
          <Textarea
            id="desc"
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        <Field
          label="Légende"
          value={form.caption}
          onChange={(v) => setForm({ ...form, caption: v })}
        />
        <Field label="Crédit / source" value={form.credit} onChange={(v) => setForm({ ...form, credit: v })} />
        <Field
          label="Slug SEO"
          value={form.seo_slug}
          onChange={(v) => setForm({ ...form, seo_slug: v })}
          hint="Identifiant lisible utilisé pour le SEO (le fichier physique n'est pas renommé)."
        />
        <Field
          label="Tags"
          value={form.tags}
          onChange={(v) => setForm({ ...form, tags: v })}
          hint="Séparés par des virgules."
        />

        <div className="space-y-1.5">
          <Label>URL publique</Label>
          <div className="flex gap-2">
            <Input value={asset.public_url} readOnly className="font-mono text-xs" />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => {
                navigator.clipboard.writeText(asset.public_url);
                toast.success("URL copiée");
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
          <Meta label="Type" value={asset.mime_type ?? "—"} />
          <Meta
            label="Taille"
            value={asset.size_bytes ? `${(asset.size_bytes / 1024).toFixed(1)} Ko` : "—"}
          />
          <Meta label="Bucket" value={asset.bucket} />
          <Meta
            label="Ajouté le"
            value={new Date(asset.created_at).toLocaleDateString("fr-FR")}
          />
        </dl>
      </div>

      <SheetFooter className="mt-6 flex-row justify-between gap-2 sm:justify-between">
        <Button variant="destructive" onClick={onDelete}>
          <Trash2 className="h-4 w-4" /> Supprimer
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>
            <X className="h-4 w-4" /> Annuler
          </Button>
          <Button onClick={handleSave} disabled={update.isPending}>
            {update.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Enregistrer
          </Button>
        </div>
      </SheetFooter>
    </>
  );
}

function Field({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-medium text-foreground/80">{label}</dt>
      <dd className="truncate">{value}</dd>
    </div>
  );
}
