## Objectif

Quand vous uploadez un nouveau catalogue PDF dans l'admin, les promotions actuelles sont automatiquement remplacées par celles extraites du PDF (titre, prix, ancien prix, % remise, image, dates de validité).

## Comment ça marche

L'extraction depuis un PDF de prospectus n'est pas triviale (mise en page complexe, prix éclatés sur la page, images séparées du texte). On utilise donc une IA multimodale (Gemini 2.5 Pro via Lovable AI, sans clé API à fournir) qui "lit" chaque page du PDF comme un humain et renvoie une liste structurée de promotions.

## Flux utilisateur

1. Admin → page **Catalogues** → bouton **"Ajouter / Remplacer le catalogue"**
2. Upload du PDF + saisie des dates de validité (début/fin)
3. Cliquer **"Extraire les promotions du PDF"**
   - Aperçu : tableau éditable des promos détectées (titre, prix, remise, image)
   - Possibilité de cocher/décocher, corriger les prix, supprimer une ligne erronée
4. Bouton **"Remplacer toutes les promotions"** :
   - Confirmation explicite ("Cette action supprimera les X promotions actuelles")
   - Désactive les anciennes promos (soft delete via `active=false`) ou les supprime
   - Insère les nouvelles avec les dates de validité du catalogue
5. Le site public affiche immédiatement les nouvelles promos (PromoSection, page /promotions, Hero)

## Détails techniques

### Edge function `extract-catalogue-promos`
- Input : `{ pdf_url, starts_at, ends_at }`
- Étapes :
  1. Télécharge le PDF depuis le bucket `catalogues`
  2. Convertit chaque page en image (via `pdfjs-dist` côté Deno ou en envoyant le PDF directement à Gemini qui supporte les PDF)
  3. Appelle `google/gemini-2.5-pro` avec un prompt structuré demandant un JSON :
     ```json
     [{ "title", "description", "price", "original_price", "discount_percent", "category", "page_number" }]
     ```
  4. Renvoie la liste au client (pas d'écriture en base à ce stade)
- Sécurité : `verify_jwt` + check `is_admin(auth.uid())`

### Extraction des images des produits
Option simple (recommandée pour démarrer) : pas d'extraction automatique d'images. L'admin associe les images via la médiathèque existante après import, OU on garde l'image actuelle si le titre matche (via `findCatalogueFallback` déjà en place).

Option avancée (phase 2) : `pdfimages` (poppler) pour extraire les images bitmap du PDF, puis Gemini associe chaque image au produit le plus proche sur la même page. À discuter selon résultat phase 1.

### UI Admin
- Nouveau composant `CataloguePromoExtractor.tsx` ouvert depuis la fiche catalogue
- Aperçu en tableau avec checkboxes + édition inline
- Deux modes de remplacement :
  - **Remplacer** : `DELETE FROM promotions` puis insert (radical)
  - **Désactiver + ajouter** : `UPDATE promotions SET active=false` puis insert (conserve l'historique)

### Schéma DB
- Ajout colonne `promotions.catalogue_id uuid` (nullable, ref `catalogues.id`) pour tracer la source
- Permet plus tard de faire "supprimer toutes les promos issues de ce catalogue"

## Limites à connaître

- L'IA peut se tromper sur certains prix/titres → l'écran d'aperçu éditable est indispensable
- Les "remises catégorie" (ex: "-20% sur les géraniums") sans prix unitaire seront extraites avec `price=0` comme aujourd'hui
- Coût : ~1 appel Gemini Pro par upload de catalogue (négligeable)
- PDF > 50 pages : on traite par batch

## Fichiers impactés

- **Nouveau** : `supabase/functions/extract-catalogue-promos/index.ts`
- **Nouveau** : `src/components/admin/CataloguePromoExtractor.tsx`
- **Modifié** : `src/pages/admin/AdminCatalogues.tsx` (bouton "Extraire les promos")
- **Migration** : ajout colonne `promotions.catalogue_id`

## Question

Avant de coder, une décision :

**Mode de remplacement par défaut ?**
- A) **Remplacement total** : les anciennes promos sont supprimées définitivement
- B) **Désactivation + ajout** : les anciennes passent en `active=false` (réactivables, traçables)
- C) **Au choix à chaque import** (toggle dans l'UI)

Je recommande **C** pour la flexibilité. Validez ce plan et précisez votre préférence, je l'implémente ensuite.
