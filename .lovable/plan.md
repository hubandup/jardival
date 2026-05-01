
# Plan — 4 améliorations UX mobile / géolocalisation

Aucun fichier dans `supabase/`, ni `CatalogueWorkflowDialog.tsx`, `CataloguePromoBboxPreview.tsx`, `pdfImageCrop.ts` ne sera touché.

Bonne nouvelle : beaucoup de briques existent déjà (`MobilePromoReels`, `useGeolocation`, `nearestStore`/`distanceKm`, `DirectionsMenu`). On capitalise dessus.

---

## 1. `/promotions` en mode reels sur mobile

État actuel : `Promotions.tsx` rend la même grille filtrable sur mobile et desktop. `MobilePromoReels.tsx` existe déjà (utilisé sur la home) et fait quasiment tout ce qui est demandé : 100dvh par slide, snap vertical, image en grand, prix barré + prix promo, badge `-X%`, partage, lien magasin.

Adaptations :
- Dans `src/pages/Promotions.tsx`, brancher `useIsMobile()` et, si mobile, retourner `<MobilePromoReels />` à la place de la grille (en gardant `SiteHeader` et le SEO actuel).
- Dans `src/components/MobilePromoReels.tsx`, renforcer le CTA "Trouver ce produit en magasin" :
  - Remplacer le petit bouton `MapPin` icône-only par un CTA pleine largeur fixé en bas, libellé `Trouver ce produit en magasin →`.
  - Le lien pointe vers `/magasins?promo={slug|id}&geo=1` (param `geo=1` = on déclenche la géoloc auto à l'arrivée).
  - Conserver le bouton "Voir l'offre" et le partage au-dessus, dans une rangée plus compacte.
- Respecter les filtres URL (`q`, `categorie`, `magasin`) en les appliquant aussi au flux des reels (filtrage côté composant avant `promotionToProduct`). Un petit bouton "Filtrer" en haut ouvre une sheet avec les mêmes contrôles que le desktop — réutilisation des `Select` existants.

## 2. `/magasins` avec géolocalisation auto + tri par distance

État actuel : `Stores.tsx` propose déjà la géoloc via `<NearestStore />` mais à la demande, et la liste n'est pas triée par distance. `DirectionsMenu` existe déjà (multi-providers Google / Apple / Waze / OSM).

Modifications dans `src/pages/Stores.tsx` :
- Lire `useSearchParams()` et, si `?geo=1` est présent (ou par défaut au premier rendu), appeler `useGeolocation(true)` pour demander la position au mount.
- Calculer `storesWithDistance` : pour chaque magasin filtré, ajouter `distance` via `distanceKm(userPos, store.coords)` quand `state.status === "ready"`.
- Tri : si position connue, trier par distance croissante ; sinon, conserver le tri alphabétique actuel.
- Afficher la distance dans `StoreCard` ("À 4,2 km") sous le code postal, badge discret.
- Bouton "Itinéraire" déjà présent via `DirectionsMenu` ; on s'assure qu'il passe `&origin={lat,lng}` quand la position user est connue. Pour ça, étendre `directionsUrlFor` dans `src/data/stores.ts` pour accepter un `origin?: [number, number]` optionnel et l'injecter dans l'URL Google Maps (`&origin=lat,lng`), Apple Plans (`saddr=`) et Waze (via `from=ll.`). OSM accepte déjà `from=`.
- L'utilisateur garde la possibilité de refuser : on retombe sur le tri alphabétique + un petit bandeau "Activer la géolocalisation" (déjà géré par `<NearestStore />` qu'on conserve).

## 3. `/catalogue` — affichage mobile fluide + swipe horizontal

État actuel : `Catalogue.tsx` utilise `react-pdf` + `react-pageflip`. Sur mobile, `usePortrait={isMobile}` est déjà actif mais le rendu PDF reste lourd, surtout au premier chargement.

Modifications dans `src/pages/Catalogue.tsx` :
- Garder `react-pdf` comme moteur (pas de pré-rendu serveur — on n'a pas de pipeline pour ça aujourd'hui), mais améliorer le mobile :
  - Sur mobile, basculer du flipbook vers un carrousel horizontal natif : container `flex overflow-x-auto snap-x snap-mandatory`, chaque page `<Page>` rendue à `width = viewport - padding`, hauteur auto, `loading="lazy"` via `IntersectionObserver` (on ne `<Page pageNumber>` qu'une fois la slide proche).
  - Ajouter un compteur sticky en bas `currentPage / numPages` mis à jour via IntersectionObserver sur les slides.
  - Précharger seulement les 1-2 pages voisines de la page active pour réduire la mémoire.
- Sur desktop, on garde l'expérience flipbook actuelle inchangée.
- Sur mobile aussi, masquer la bande "title + breadcrumb" plein écran si le viewport < 768px pour donner plus de place au PDF (réduire les paddings).

Note : pas de pré-rendu d'images côté serveur dans ce plan (ça impliquerait une edge function et de toucher Supabase, exclu par la contrainte). Si la perf reste insuffisante après cette passe, on envisagera un cache d'images dans une seconde itération.

## 4. CTA global flottant "Trouver un magasin"

Création d'un nouveau composant `src/components/FloatingFindStoreCta.tsx` :
- Position `fixed bottom-4 right-4 z-40`, pill verte avec icône `MapPin` + label "Trouver un magasin".
- Animation `hover:scale-105 active:scale-95`, `shadow-glow`.
- `useLocation()` : ne s'affiche pas si `pathname.startsWith("/magasins")` ni sur les routes `/admin/*` (inutile / intrusif côté admin).
- Au clic : `<Link to="/magasins?geo=1">`.
- Sur très petits écrans (< 380px), version compacte icône-only avec aria-label.
- Respecte le safe-area (`pb-[env(safe-area-inset-bottom)]`) pour iOS.

Intégration : monter `<FloatingFindStoreCta />` dans `src/App.tsx`, à l'intérieur de `<BrowserRouter>` mais en dehors de `<Routes>` (pour qu'il soit visible partout, et fasse son `useLocation()` librement).

---

## Récap des fichiers modifiés / créés

```text
src/App.tsx                              modifié (monter le CTA flottant)
src/pages/Promotions.tsx                 modifié (bascule reels mobile + filtres)
src/pages/Stores.tsx                     modifié (géoloc auto, tri distance, distance affichée)
src/pages/Catalogue.tsx                  modifié (carrousel horizontal mobile)
src/components/MobilePromoReels.tsx      modifié (CTA "Trouver en magasin", filtres URL)
src/components/FloatingFindStoreCta.tsx  créé
src/data/stores.ts                       modifié (directionsUrlFor accepte origin?)
```

Aucun changement de schéma DB, aucune edge function touchée.
