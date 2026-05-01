## Objectif

1. **Aperçu visuel** : avant import, afficher chaque page du PDF avec les bounding boxes détectées par l'IA superposées (numérotées et cliquables) pour valider rapidement la qualité de la détection.
2. **Crops haute qualité** : permettre de choisir la résolution de rendu (scale 1×, 2×, 3×, 4×) et le format de sortie (JPG qualité 0.92 / PNG sans perte).

---

## 1. Aperçu PDF avec bounding boxes (`src/components/admin/CataloguePromoBboxPreview.tsx`)

Nouveau composant qui :
- Reçoit `pdfUrl` + liste des `{ pageNumber, bbox, label, color, selected }`.
- Rend chaque page concernée (uniquement celles avec au moins une promo) en canvas via pdfjs (réutilise `loadPdf` exporté depuis `pdfImageCrop.ts`).
- Superpose un SVG aux dimensions du canvas avec, pour chaque bbox :
  - rectangle coloré (couleur = vert si sélectionnée, gris si décochée)
  - badge avec le n° d'index de la promo dans la table
  - tooltip au survol avec le titre
- Affiche les pages dans une zone scrollable (1 page = 1 carte), avec pagination simple si > 6 pages.
- Boutons d'action sur chaque bbox : « Aller à la ligne » (scroll vers la ligne du tableau) + « Décocher ».

Intégration dans `CataloguePromoExtractor.tsx` :
- Onglet ou section repliable « Aperçu » au-dessus de la table, visible dès que `promos.length > 0` et `bbox_2d` présents.
- Bouton « Afficher l'aperçu » pour ne pas rendre les pages tant que l'utilisateur n'en a pas besoin (les rendus PDF sont coûteux).

## 2. Qualité des crops configurable

### Modifications de `src/lib/pdfImageCrop.ts`

- Exporter `loadPdf` et `renderPage` (pour réutilisation par le composant d'aperçu).
- Ajouter options à `cropAndUploadPromoImages` :
  ```ts
  interface CropOptions {
    scale?: number;        // défaut 2 ; 1..4
    format?: "jpeg" | "png"; // défaut "jpeg"
    quality?: number;      // défaut 0.92 (jpeg uniquement)
  }
  ```
- Choix de l'extension/contentType selon format.
- Cache de page tenant compte du scale (un canvas par couple page+scale) pour éviter de re-rendre quand on change uniquement le format.

### UI dans `CataloguePromoExtractor.tsx`

Ajouter une petite barre d'options à côté du bouton « Extraire les images » :
- Select **Qualité** : Standard (2×) / Haute (3×) / Très haute (4×).
- Select **Format** : JPG (plus léger) / PNG (sans perte).
- Indicateur « Scale 3× ≈ images plus nettes mais upload plus long ».

Ces deux valeurs sont passées à `cropAndUploadPromoImages`.

## 3. Détails techniques

- Couleurs des bbox en HSL via tokens semantic : `hsl(var(--primary))` pour sélectionnée, `hsl(var(--muted-foreground))` pour décochée — pas de couleur hardcodée.
- Le SVG d'overlay utilise `viewBox="0 0 1000 1000"` avec `preserveAspectRatio="none"` superposé en `position: absolute inset-0` sur le canvas, pour que les bbox normalisées 0-1000 s'affichent sans recalcul.
- Le rendu d'aperçu utilise `scale = 1.2` (suffisant pour la pré-visualisation) afin de rester fluide ; le scale élevé n'est utilisé que pour les crops finaux.
- Pour PNG, on utilise `canvas.toBlob(b, "image/png")` (pas de quality).
- Aucun changement DB ni edge function nécessaire : tout est côté client.

## 4. Fichiers touchés

- **Créé** : `src/components/admin/CataloguePromoBboxPreview.tsx`
- **Modifié** : `src/lib/pdfImageCrop.ts` (options scale/format, exports)
- **Modifié** : `src/components/admin/CataloguePromoExtractor.tsx` (intégration aperçu + selects qualité/format)
