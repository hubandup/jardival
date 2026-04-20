import { Link, useLocation } from "react-router-dom";
import logo from "@/assets/logo-jardival.png";
import { MapPin } from "lucide-react";

export const SiteHeader = () => {
  const { pathname } = useLocation();
  const onHome = pathname === "/";

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-xl">
      <div className="container-px mx-auto flex h-16 max-w-7xl items-center justify-between gap-6">
        <Link to="/" className="flex items-center gap-3">
          <img src={logo} alt="Jardival" className="h-9 w-auto" />
        </Link>
        <nav className="hidden items-center gap-8 text-sm font-medium md:flex">
          {onHome ? (
            <>
              <a href="#promos" className="text-foreground/70 transition-colors hover:text-accent">Promos</a>
              <a href="#catalogue" className="text-foreground/70 transition-colors hover:text-primary">Catalogue</a>
            </>
          ) : (
            <>
              <Link to="/#promos" className="text-foreground/70 transition-colors hover:text-accent">Promos</Link>
              <Link to="/#catalogue" className="text-foreground/70 transition-colors hover:text-primary">Catalogue</Link>
            </>
          )}
          <Link to="/promotions" className="text-foreground/70 transition-colors hover:text-accent">Toutes les promos</Link>
          <Link to="/magasins" className="text-foreground/70 transition-colors hover:text-primary">Magasins</Link>
        </nav>
        <Link
          to="/magasins"
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-soft transition-all hover:shadow-glow hover:scale-[1.02]"
        >
          <MapPin className="h-4 w-4" />
          Trouver un magasin
        </Link>
      </div>
    </header>
  );
};
