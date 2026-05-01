import { Link, useLocation } from "react-router-dom";
import { MapPin } from "lucide-react";

/**
 * Bouton flottant global "Trouver un magasin".
 * - Caché sur /magasins (déjà sur la page) et sur l'admin.
 * - Au clic, déclenche la géoloc auto via ?geo=1.
 */
export const FloatingFindStoreCta = () => {
  const { pathname } = useLocation();
  if (pathname.startsWith("/magasins") || pathname.startsWith("/admin")) {
    return null;
  }

  return (
    <Link
      to="/magasins?geo=1"
      aria-label="Trouver un magasin"
      className="fixed right-4 z-40 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg ring-1 ring-primary/30 backdrop-blur transition-transform hover:scale-105 active:scale-95"
      style={{
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)",
      }}
    >
      <MapPin className="h-4 w-4" />
      <span className="hidden xs:inline sm:inline">Trouver un magasin</span>
    </Link>
  );
};
