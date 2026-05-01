import { Navigation, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Store, directionsUrlFor, DirectionsProvider } from "@/data/stores";
import { cn } from "@/lib/utils";

interface Props {
  store: Store;
  variant?: "primary" | "outline";
  size?: "default" | "sm";
  className?: string;
  label?: string;
  origin?: [number, number] | null;
}

const PROVIDERS: { id: DirectionsProvider; name: string; emoji: string; hint: string }[] = [
  { id: "google", name: "Google Maps", emoji: "🗺️", hint: "Le plus complet" },
  { id: "apple", name: "Plans (Apple)", emoji: "", hint: "iPhone & Mac" },
  { id: "waze", name: "Waze", emoji: "🚗", hint: "Trafic en direct" },
  { id: "osm", name: "OpenStreetMap", emoji: "🌍", hint: "Sans pub, libre" },
];

export const DirectionsMenu = ({
  store,
  variant = "primary",
  size = "default",
  className,
  label = "Itinéraire",
  origin = null,
}: Props) => {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all";
  const sizeCls = size === "sm" ? "px-5 py-2.5 text-sm" : "px-5 py-2.5 text-sm";
  const variantCls =
    variant === "primary"
      ? "bg-primary text-primary-foreground hover:shadow-glow"
      : "border border-border bg-background text-foreground hover:bg-secondary";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(base, sizeCls, variantCls, "outline-none", className)}
      >
        <Navigation className="h-4 w-4" />
        {label}
        <ChevronDown className="h-3.5 w-3.5 opacity-80" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground">
          Ouvrir avec…
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {PROVIDERS.map((p) => (
          <DropdownMenuItem key={p.id} asChild>
            <a
              href={directionsUrlFor(store, p.id, origin)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex cursor-pointer items-center gap-3 px-2 py-2"
            >
              <span className="text-lg leading-none">{p.emoji || "📍"}</span>
              <span className="flex flex-col">
                <span className="text-sm font-semibold text-foreground">{p.name}</span>
                <span className="text-[11px] text-muted-foreground">{p.hint}</span>
              </span>
            </a>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
