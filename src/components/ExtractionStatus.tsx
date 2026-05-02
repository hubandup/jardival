import { CheckCircle2, AlertTriangle, Loader2, ImageIcon, Search } from "lucide-react";

export type ExtractionStep =
  | "PENDING"
  | "EXTRACTING"
  | "MATCHING"
  | "DONE"
  | "ERROR";

const STEPS: ExtractionStep[] = ["PENDING", "EXTRACTING", "MATCHING", "DONE"];

const STEP_LABEL: Record<ExtractionStep, string> = {
  PENDING: "En attente",
  EXTRACTING: "Extraction des promos",
  MATCHING: "Association des images",
  DONE: "Terminé",
  ERROR: "Erreur",
};

const STEP_ICON: Record<ExtractionStep, typeof Loader2> = {
  PENDING: Loader2,
  EXTRACTING: Search,
  MATCHING: ImageIcon,
  DONE: CheckCircle2,
  ERROR: AlertTriangle,
};

export interface ExtractionStatusProps {
  status: ExtractionStep;
  reason?: string | null;
  className?: string;
}

/**
 * Indicateur compact de l'état du pipeline d'extraction catalogue → promos.
 * Mobile first, palette Jardival.
 */
export const ExtractionStatus = ({
  status,
  reason,
  className,
}: ExtractionStatusProps) => {
  if (status === "ERROR") {
    return (
      <div
        className={`flex items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive ${className ?? ""}`}
        role="alert"
      >
        <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
        <div>
          <p className="font-semibold">Échec de l'extraction</p>
          {reason && <p className="mt-1 text-xs opacity-90">{reason}</p>}
        </div>
      </div>
    );
  }

  const currentIdx = STEPS.indexOf(status);

  return (
    <div
      className={`rounded-2xl border border-black/10 bg-white p-4 ${className ?? ""}`}
      aria-label="Progression de l'extraction"
    >
      <ol className="flex items-center justify-between gap-2">
        {STEPS.map((step, i) => {
          const Icon = STEP_ICON[step];
          const isDone = i < currentIdx || status === "DONE";
          const isCurrent = i === currentIdx && status !== "DONE";
          const colorClass = isDone
            ? "text-[hsl(120,46%,33%)]"
            : isCurrent
              ? "text-[hsl(120,46%,33%)]"
              : "text-black/30";
          return (
            <li key={step} className="flex flex-1 flex-col items-center gap-1">
              <Icon
                className={`h-5 w-5 ${colorClass} ${isCurrent && step !== "DONE" ? "animate-spin" : ""}`}
              />
              <span
                className={`text-[10px] font-semibold uppercase tracking-wider ${colorClass}`}
              >
                {STEP_LABEL[step]}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

/**
 * Badge discret signalant qu'une image a été reconstituée par rasterisation
 * (fallback côté pipeline d'extraction).
 */
export const RasterizedBadge = ({ className }: { className?: string }) => (
  <span
    className={`inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur ${className ?? ""}`}
    title="Image reconstituée à partir du PDF"
  >
    <ImageIcon className="h-3 w-3" />
    Image reconstituée
  </span>
);

export default ExtractionStatus;
