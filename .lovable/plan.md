# Edge function `upload-promo-image` pour Render

## Objectif

Permettre à un service externe hébergé sur Render d'uploader des images extraites de catalogues PDF dans le bucket `promo-images`, sans exposer la `SUPABASE_SERVICE_ROLE_KEY` côté Render. L'authentification se fait via un secret partagé `RENDER_API_SECRET`.

## Ce qui sera créé

### 1. Secret `RENDER_API_SECRET`
- Généré côté serveur : 32 caractères aléatoires (alphanumériques URL-safe, via `crypto.getRandomValues`).
- Stocké dans les Secrets Lovable Cloud via le tool `add_secret`.
- **Important** : la valeur sera générée puis affichée **une seule fois** dans le chat pour que vous puissiez la copier dans les variables d'environnement Render. Elle ne sera plus jamais ré-affichable ensuite (vous devrez en regénérer une si perdue).

### 2. Edge function `supabase/functions/upload-promo-image/index.ts`

**Endpoint** : `POST /functions/v1/upload-promo-image`

**Authentification** :
- Header attendu : `Authorization: Bearer <RENDER_API_SECRET>`
- Comparaison à temps constant pour éviter les timing attacks.
- Pas de JWT utilisateur (`verify_jwt = false` côté config — déjà le défaut Lovable).
- 401 si manquant ou invalide.

**Corps de requête (JSON, validé via Zod)** :
```json
{
  "organization_id": "uuid",
  "catalogue_id": "uuid",
  "page_number": 1,
  "image_index": 0,
  "image_base64": "...",
  "content_type": "image/jpeg"
}
```
- `content_type` restreint à `image/jpeg`, `image/png`, `image/webp`.
- `page_number` et `image_index` : entiers ≥ 0, bornés (ex. ≤ 10000) pour éviter les abus.
- `image_base64` : taille max ~15 MB (après décodage) pour éviter de saturer la mémoire.
- IDs validés au format UUID.

**Logique** :
1. Vérifier le secret.
2. Parser et valider le body.
3. Décoder le base64 → `Uint8Array`.
4. Construire le chemin : `extracted-native/{organization_id}/{catalogue_id}/{page_number}_{image_index}.jpg` (extension toujours `.jpg` comme demandé, même si content-type différent — cohérent avec votre wording).
5. Upload via le client Supabase initialisé avec `SUPABASE_SERVICE_ROLE_KEY` (`upsert: true`, `contentType` correct).
6. Récupérer l'URL publique (bucket `promo-images` est public).
7. Retourner `{ "public_url": "https://..." }` + 200.

**Gestion d'erreurs** :
- 400 : validation échouée
- 401 : secret invalide
- 413 : payload trop gros
- 500 : erreur upload (avec message safe, sans fuite interne)
- CORS headers sur toutes les réponses (y compris erreurs et OPTIONS).

### 3. Pas de modif de `supabase/config.toml`
Les fonctions Lovable se déploient avec `verify_jwt = false` par défaut — pas besoin d'override.

## Ce qui ne sera PAS fait
- Pas d'écriture en base (juste upload storage). Si vous voulez aussi enregistrer une ligne dans `media_assets` ou similaire, dites-le et je l'ajouterai.
- Pas de rate limiting applicatif (le secret partagé suffit pour un service de confiance ; si vous voulez un quota par organisation, à préciser).

## Questions avant de coder

1. **Extension du fichier** : vous avez écrit `.jpg` en dur dans le chemin. Je garde `.jpg` en dur, ou je dérive l'extension du `content_type` (`.jpg` / `.png` / `.webp`) ? Garder `.jpg` en dur peut tromper les navigateurs si vous uploadez du PNG.
2. **Écrasement** : si une image existe déjà au même chemin, j'utilise `upsert: true` (écrase). OK ?
3. **Trace en base** : faut-il aussi insérer une ligne dans `media_assets` (avec `public_url`, `bucket`, `path`, organisation, etc.) à la fin de l'upload ?

Si vous validez le plan tel quel (avec `.jpg` en dur, upsert oui, pas de trace en base), je passe à l'implémentation directement.
