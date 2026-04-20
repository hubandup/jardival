import logo from "@/assets/logo-jardival.png";

export const SiteHeader = () => {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-xl">
      <div className="container-px mx-auto flex h-16 max-w-7xl items-center justify-between gap-6">
        <a href="#top" className="flex items-center gap-3">
          <img src={logo} alt="Jardival" className="h-9 w-auto" />
        </a>
        <nav className="hidden items-center gap-8 text-sm font-medium md:flex">
          <a href="#promos" className="text-foreground/70 transition-colors hover:text-accent">Promos</a>
          <a href="#catalogue" className="text-foreground/70 transition-colors hover:text-primary">Catalogue</a>
          <a href="#about" className="text-foreground/70 transition-colors hover:text-primary">À propos</a>
        </nav>
        <a
          href="#promos"
          className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-soft transition-all hover:shadow-glow hover:scale-[1.02]"
        >
          Voir les offres
        </a>
      </div>
    </header>
  );
};
