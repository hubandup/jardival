import { Link, useLocation } from "react-router-dom";
import { MapPin } from "lucide-react";
import logo from "@/assets/logo-jardival.png";
import { useSelectedStore } from "@/hooks/useSelectedStore";


export const SiteHeader = () => {
  const { pathname } = useLocation();
  const onHome = pathname === "/";
  const { store } = useSelectedStore();

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-xl">
      <div className="container-px mx-auto flex h-16 max-w-7xl items-center justify-between gap-6">
        <Link to="/" className="flex items-center gap-3">
          <img src={logo} alt="Jardival" className="h-9 w-auto" />
        </Link>
        <nav className="hidden items-center gap-8 text-sm font-medium md:flex">
          {onHome ? (
            <a href="#promos" className="text-foreground/70 transition-colors hover:text-accent">Promos</a>
          ) : (
            <Link to="/#promos" className="text-foreground/70 transition-colors hover:text-accent">Promos</Link>
          )}
          
          <Link to="/magasins" className="text-foreground/70 transition-colors hover:text-primary">Magasins</Link>
        </nav>

        {store && (
          <Link
            to="/magasins"
            aria-label={`Changer de magasin (actuel : ${store.name})`}
            className="ml-auto inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground/80 transition-colors hover:border-primary/40 hover:text-primary md:ml-0"
          >
            <MapPin className="h-3.5 w-3.5 text-primary" />
            <span className="max-w-[8rem] truncate">{store.name}</span>
            <span className="hidden text-muted-foreground sm:inline">· Changer</span>
          </Link>
        )}
      </div>
    </header>
  );
};
