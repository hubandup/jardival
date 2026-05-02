# Jardival catalogue extraction backend

Service Python (FastAPI + PyMuPDF) qui extrait les images natives d'un PDF de
catalogue et les associe aux promos détectées par Gemini, avec upload sécurisé
vers Supabase Storage via une edge function Lovable.

## Architecture

```
Frontend Lovable
  → edge function `extract-catalogue-promos` (Lovable, Gemini multimodal)
    → POST https://<render-url>/extract  (CE service)
      → download PDF (Supabase Storage public URL)
      → PyMuPDF: extraction native des images de chaque page
      → matching anchor_xy ↔ centroïde image (par page, distance euclidienne)
      → POST https://nwqhzsjajjluvwrbaemw.supabase.co/functions/v1/upload-promo-image
         (edge function Lovable, qui détient SERVICE_ROLE_KEY)
         → upload vers bucket `promo-images`
         ← public_url
    ← list de {promo_index, image_url, source: "native"|null}
  ← affichage frontend
```

## Sécurité

- `RENDER_API_SECRET` : secret partagé entre le frontend Lovable et ce service.
  Sert à authentifier les appels au service. Stocké côté Lovable (Cloud →
  Secrets) ET côté Render (env var). Jamais commité.
- Le service utilise ce MÊME secret pour appeler l'edge function
  `upload-promo-image`. Le contrat de l'edge function (côté Lovable) accepte
  ce secret et possède la `SUPABASE_SERVICE_ROLE_KEY` en interne.
- Aucune clé Supabase admin ne touche jamais ce service.

## Endpoints

### `GET /health`

Healthcheck pour Render. Retourne `{"status": "ok"}`.

### `POST /extract`

**Headers** : `Authorization: Bearer <RENDER_API_SECRET>`

**Body** :
```json
{
  "pdf_url": "https://nwqhzsjajjluvwrbaemw.supabase.co/storage/v1/object/public/catalogues/pdf-XXXX.pdf",
  "organization_id": "uuid-org",
  "catalogue_id": "uuid-cat",
  "promos": [
    { "index": 0, "page_number": 3, "position": "haut-gauche", "title": "Barbecue Charbon" },
    { "index": 1, "page_number": 3, "anchor_xy": [0.42, 0.58], "title": "Engrais Géraniums" }
  ]
}
```

**Réponse** :
```json
{
  "outputs": [
    { "index": 0, "image_url": "https://.../promo-images/...", "source": "native", "match_distance": 0.04 },
    { "index": 1, "image_url": null, "source": null, "reason": "no_match_within_threshold" }
  ],
  "stats": {
    "promos_total": 2,
    "matched_native": 1,
    "no_native_image": 1,
    "failed_upload": 0,
    "pdf_pages": 8,
    "total_native_images": 152,
    "duration_ms": 2840
  }
}
```

## Déploiement Render

1. Pousser ce dossier dans `hubandup/jardival` à la racine sous `/backend-python/`.
2. Sur https://dashboard.render.com → **New +** → **Web Service**.
3. Connecter le repo `hubandup/jardival`.
4. Configurer :
   - **Name** : `jardival-extract`
   - **Region** : Frankfurt (proche France)
   - **Branch** : `main`
   - **Root Directory** : `backend-python`
   - **Runtime** : Python 3
   - **Build Command** : `pip install -r requirements.txt`
   - **Start Command** : `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Plan** : Free
5. Section **Environment Variables** :
   - `RENDER_API_SECRET` = la valeur que vous avez générée et stockée dans
     Lovable Cloud → Secrets → RENDER_API_SECRET.
   - `UPLOAD_ENDPOINT` = `https://nwqhzsjajjluvwrbaemw.supabase.co/functions/v1/upload-promo-image`
6. Cliquer **Create Web Service**. Le build prend ~2 minutes.
7. Vous obtenez une URL type `https://jardival-extract.onrender.com`.

## Test après déploiement

```bash
# Healthcheck (pas d'auth)
curl https://jardival-extract.onrender.com/health
# → {"status":"ok","service":"jardival-extract"}

# Extraction (avec auth)
curl -X POST https://jardival-extract.onrender.com/extract \
  -H "Authorization: Bearer <RENDER_API_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{
    "pdf_url": "https://nwqhzsjajjluvwrbaemw.supabase.co/storage/v1/object/public/catalogues/pdf-XXXX.pdf",
    "organization_id": "uuid-jardival",
    "catalogue_id": "uuid-catalogue-test",
    "promos": [
      {"index": 0, "page_number": 3, "position": "haut-gauche"}
    ]
  }'
```

## Notes opérationnelles

- **Cold starts** : le free tier de Render endort le service après 15 min
  d'inactivité. Le premier appel après endormissement prend ~30s. Pour Jardival
  c'est acceptable (extraction occasionnelle). Pour un usage intensif
  (Lagostina, Burger King), passer au plan Starter (~7€/mois, pas de cold start).
- **Limite PDF** : 50 MB hard cap dans le code. Au-delà → 413.
- **Limite mémoire Render free** : 512 MB. Suffisant pour des catalogues 8-10
  pages. Si plus, monter à Starter (1 GB).
- **Logs** : visibles en temps réel dans le dashboard Render → Logs.

## Ce qu'il restera à faire côté frontend Lovable

Une fois ce service déployé et son URL connue, demander à Lovable de :

1. Créer un secret `EXTRACT_SERVICE_URL` dans Cloud → Secrets avec la valeur
   `https://jardival-extract.onrender.com`.
2. Modifier l'edge function `extract-catalogue-promos` pour qu'après l'appel à
   Gemini, elle POSTe les promos vers `${EXTRACT_SERVICE_URL}/extract` avec le
   header `Authorization: Bearer ${RENDER_API_SECRET}`, et qu'elle merge les
   `image_url` retournés dans la réponse au frontend.
3. Supprimer toute la logique pdf.js côté frontend (`extractNativeImages`,
   `matchPromosToImages`, `extractPromoImages`) — devenue inutile.
