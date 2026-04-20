import { useState } from "react";
import { Loader2, Search, Image as ImageIcon, Upload } from "lucide-react";
import { useMediaAssets, useUploadMedia, type MediaAsset } from "@/hooks/useMedia";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useRef } from "react";

const BUCKET_LABELS: Record<string, string> = {
  all: "Tous les buckets",
  media: "Médiathèque",
  "product-images": "Produits",
  "promo-images": "Promotions",
  "store-images": "Magasins",
  catalogues: "Catalogues",
};

interface MediaPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (url: string) => void;
  /** Pre-filter to a specific bucket */
  defaultBucket?: string;
}

export default function MediaPickerDialog({
  open,
  onOpenChange,
  onSelect,
  defaultBucket = "all",
}: MediaPickerDialogProps) {
  const [bucket, setBucket] = useState(defaultBucket);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<MediaAsset | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const upload = useUploadMedia();

  const { data: assets = [], isLoading } = useMediaAssets({
    bucket,
    type: "image",
    q,
  });

  const handleConfirm = () => {
    if (selected) {
      onSelect(selected.public_url);
      onOpenChange(false);
      setSelected(null);
      setQ("");
    }
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    try {
      const asset = await upload.mutateAsync(files[0]);
      onSelect(asset.public_url);
      onOpenChange(false);
      setSelected(null);
      setQ("");
      toast.success("Image ajoutée et sélectionnée");
    } catch (e) {
      toast.error((e as Error).message);
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" /> Choisir une image
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={bucket} onValueChange={setBucket}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(BUCKET_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
            disabled={upload.isPending}
          >
            {upload.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Uploader
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 mt-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : assets.length === 0 ? (
            <div className="text-center text-muted-foreground py-16">
              <p>Aucune image trouvée.</p>
              <p className="text-sm mt-1">
                Uploadez une image ou synchronisez vos buckets dans la
                médiathèque.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
              {assets.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => setSelected(asset)}
                  className={cn(
                    "relative aspect-square overflow-hidden rounded-lg border-2 bg-muted transition-all hover:shadow-md",
                    selected?.id === asset.id
                      ? "border-primary ring-2 ring-primary/30"
                      : "border-transparent hover:border-primary/40"
                  )}
                >
                  <img
                    src={asset.public_url}
                    alt={asset.alt ?? asset.title ?? ""}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-1.5 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100 hover:opacity-100">
                    <span className="line-clamp-1">
                      {asset.title ?? asset.path}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-3 border-t">
          <p className="text-xs text-muted-foreground">
            {selected
              ? `Sélection : ${selected.title ?? selected.path}`
              : `${assets.length} image(s)`}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button onClick={handleConfirm} disabled={!selected}>
              Choisir
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
