Retirer le lien "Toutes les promos" du menu de navigation (SiteHeader) tout en conservant la route `/promotions` fonctionnelle dans App.tsx.

**Changement technique :**
- Dans `src/components/SiteHeader.tsx`, supprimer la ligne `<Link to="/promotions">Toutes les promos</Link>`.
- Aucun autre fichier n'est modifié. La page `/promotions` reste accessible directement par son URL et reste référencée dans les autres composants (ex. CTA mobile).