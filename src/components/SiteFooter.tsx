import logo from "@/assets/logo-jardival.png";
import { Link } from "react-router-dom";
import { STORES } from "@/data/stores";

export const SiteFooter = () => {
  return (
    <footer id="about" className="border-t border-border bg-background py-16">
      <div className="container-px mx-auto grid max-w-7xl gap-10 md:grid-cols-3">
        <div className="space-y-4">
          <img src={logo} alt="Jardival" className="h-10 w-auto" />
          <p className="max-w-xs text-sm text-muted-foreground">
            Jardival, l'enseigne jardin du réseau Point Vert. Plus de 1000 produits pour aménager, entretenir et embellir votre extérieur.
          </p>
        </div>
        <div>
          <h4 className="mb-4 text-sm font-semibold text-foreground">Catégories</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>Arrosage & irrigation</li>
            <li>Mobilier de jardin</li>
            <li>Outillage</li>
            <li>Décoration extérieure</li>
          </ul>
        </div>
        <div>
          <h4 className="mb-4 text-sm font-semibold text-foreground">Nous trouver</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <Link to="/magasins" className="transition-colors hover:text-primary">
                {STORES.length} magasins en région
              </Link>
            </li>
            <li>Service client</li>
            <li>Catalogue PDF</li>
          </ul>
        </div>
      </div>
      <div className="container-px mx-auto mt-12 max-w-7xl border-t border-border pt-6 text-xs text-muted-foreground">
        © {new Date().getFullYear()} Jardival. Prix et promotions à titre indicatif : voir conditions générales de vente.
      </div>
    </footer>
  );
};
