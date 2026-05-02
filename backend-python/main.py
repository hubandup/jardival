"""
Jardival catalogue extraction backend.

Reçoit un PDF + une liste de promos avec position, retourne pour chaque promo
une image_url pointant vers l'image native extraite (HD) ou null si pas matché.

Architecture :
1. /extract télécharge le PDF
2. PyMuPDF extrait toutes les images natives avec leur bbox sur la page
3. Pour chaque promo, on calcule un anchor_xy (centre de la zone décrite)
4. Matching par distance euclidienne au centroïde de chaque image native
5. Chaque image matchée est uploadée via l'edge function Lovable upload-promo-image
6. Retour : liste de {promo_index, image_url, source: "native" | null}

Sécurité : authentification par header Authorization: Bearer <RENDER_API_SHARED_SECRET>.
Ce secret est partagé entre le frontend Lovable et ce service. Il ne donne accès
à RIEN d'autre que cet endpoint.
"""
import base64
import io
import logging
import os
import time
from typing import Literal, Optional

import fitz  # PyMuPDF
import httpx
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
log = logging.getLogger("jardival-extract")

# Secret partagé avec Lovable (frontend ET edge function upload-promo-image).
# Le frontend l'envoie dans le header Authorization quand il appelle CE service,
# et CE service l'utilise pour appeler l'edge function upload-promo-image.
SHARED_SECRET = os.environ.get("RENDER_API_SECRET")
if not SHARED_SECRET:
    raise RuntimeError("RENDER_API_SECRET env var is required")

# URL de l'edge function Lovable qui gère l'upload sécurisé vers Supabase Storage.
UPLOAD_ENDPOINT = os.environ.get(
    "UPLOAD_ENDPOINT",
    "https://nwqhzsjajjluvwrbaemw.supabase.co/functions/v1/upload-promo-image",
)

# Tailles max
MAX_PDF_BYTES = 50 * 1024 * 1024  # 50 MB
MAX_IMAGE_BYTES = 14 * 1024 * 1024  # 14 MB (l'edge function refuse > 15 MB)
JPEG_QUALITY = 88

# Filtre des images trop petites (logos, pictos) : moins de 0.5% de la surface page.
MIN_IMAGE_AREA_RATIO = 0.005

# Seuil de matching (distance normalisée [0,1] entre anchor_xy et centroïde image).
# Au-delà, on considère qu'on n'a pas trouvé de match propre.
MATCH_DISTANCE_THRESHOLD = 0.25

# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
PositionZone = Literal[
    "haut-gauche", "haut-centre", "haut-droite",
    "milieu-gauche", "milieu-centre", "milieu-droite",
    "bas-gauche", "bas-centre", "bas-droite",
]

# Centres normalisés [0,1] de chaque zone 3×3 sur la page.
ZONE_CENTERS: dict[str, tuple[float, float]] = {
    "haut-gauche":    (1/6, 1/6),
    "haut-centre":    (3/6, 1/6),
    "haut-droite":    (5/6, 1/6),
    "milieu-gauche":  (1/6, 3/6),
    "milieu-centre":  (3/6, 3/6),
    "milieu-droite":  (5/6, 3/6),
    "bas-gauche":     (1/6, 5/6),
    "bas-centre":     (3/6, 5/6),
    "bas-droite":     (5/6, 5/6),
}


class PromoInput(BaseModel):
    """Promo détectée par Gemini avec position approximative sur la page."""
    index: int
    page_number: Optional[int] = None
    position: Optional[PositionZone] = None
    # Optionnel : si Gemini fournit déjà un anchor_xy précis [x, y] normalisé [0,1],
    # on le préfère à la position 3×3 (matching plus précis).
    anchor_xy: Optional[tuple[float, float]] = None
    # Pour debug et logs uniquement.
    title: Optional[str] = None


class ExtractRequest(BaseModel):
    pdf_url: str = Field(..., description="URL HTTPS du PDF dans Supabase Storage")
    organization_id: str
    catalogue_id: str
    promos: list[PromoInput]


class PromoOutput(BaseModel):
    index: int
    image_url: Optional[str] = None
    source: Optional[Literal["native"]] = None
    # Distance de matching (debug). Plus c'est bas, plus le match est précis.
    match_distance: Optional[float] = None
    # Raison d'échec si image_url est null (debug).
    reason: Optional[str] = None


class ExtractStats(BaseModel):
    promos_total: int
    matched_native: int
    no_native_image: int
    failed_upload: int
    pdf_pages: int
    total_native_images: int
    duration_ms: int


class ExtractResponse(BaseModel):
    outputs: list[PromoOutput]
    stats: ExtractStats


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------
app = FastAPI(title="Jardival catalogue extraction", version="1.0.0")

# CORS : le frontend Lovable n'appelle PAS ce service directement (il passe par
# l'edge function extract-catalogue-promos qui appelle ce service côté serveur).
# Mais on autorise quand même pour debug/healthcheck depuis n'importe où.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    """Endpoint utilisé par Render pour vérifier que le service est up."""
    return {"status": "ok", "service": "jardival-extract"}


@app.post("/extract", response_model=ExtractResponse)
async def extract(
    body: ExtractRequest,
    authorization: Optional[str] = Header(None),
):
    started_at = time.time()

    # ----- Auth -----
    expected = f"Bearer {SHARED_SECRET}"
    if authorization != expected:
        raise HTTPException(status_code=401, detail="Invalid authorization")

    log.info(
        "extract start: catalogue=%s, promos=%d, pdf=%s",
        body.catalogue_id, len(body.promos), body.pdf_url,
    )

    # ----- Téléchargement du PDF -----
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(body.pdf_url)
        if resp.status_code != 200:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot fetch PDF (status {resp.status_code})",
            )
        pdf_bytes = resp.content

    if len(pdf_bytes) > MAX_PDF_BYTES:
        raise HTTPException(status_code=413, detail="PDF too large (>50MB)")

    log.info("PDF downloaded: %d bytes", len(pdf_bytes))

    # ----- Extraction des images natives via PyMuPDF -----
    native_images = extract_native_images(pdf_bytes)
    log.info(
        "native images extracted: %d across %d pages",
        len(native_images), len(set(img["page"] for img in native_images)),
    )

    # ----- Matching promos ↔ images -----
    outputs = match_promos_to_images(body.promos, native_images)

    # ----- Upload des images matchées via l'edge function Lovable -----
    matched_count = 0
    failed_uploads = 0
    async with httpx.AsyncClient(timeout=30.0) as client:
        for out in outputs:
            if out.get("_matched_image") is None:
                continue
            img_data = out["_matched_image"]
            try:
                public_url = await upload_image_to_supabase(
                    client=client,
                    organization_id=body.organization_id,
                    catalogue_id=body.catalogue_id,
                    page_number=img_data["page"],
                    image_index=out["index"],
                    jpeg_bytes=img_data["jpeg"],
                )
                out["image_url"] = public_url
                out["source"] = "native"
                matched_count += 1
            except Exception as e:
                log.warning("upload failed for promo %d: %s", out["index"], e)
                out["reason"] = f"upload_failed: {e}"
                failed_uploads += 1

    # ----- Nettoyage des champs internes avant sérialisation -----
    cleaned_outputs = [
        PromoOutput(
            index=o["index"],
            image_url=o.get("image_url"),
            source=o.get("source"),
            match_distance=o.get("match_distance"),
            reason=o.get("reason"),
        )
        for o in outputs
    ]

    duration_ms = int((time.time() - started_at) * 1000)
    no_native = sum(1 for o in cleaned_outputs if o.image_url is None and not o.reason)

    stats = ExtractStats(
        promos_total=len(body.promos),
        matched_native=matched_count,
        no_native_image=no_native,
        failed_upload=failed_uploads,
        pdf_pages=len(set(img["page"] for img in native_images)) if native_images else 0,
        total_native_images=len(native_images),
        duration_ms=duration_ms,
    )

    log.info(
        "extract done: matched=%d/%d, failed_upload=%d, %dms",
        matched_count, len(body.promos), failed_uploads, duration_ms,
    )

    return ExtractResponse(outputs=cleaned_outputs, stats=stats)


# ---------------------------------------------------------------------------
# Image extraction (PyMuPDF)
# ---------------------------------------------------------------------------
def extract_native_images(pdf_bytes: bytes) -> list[dict]:
    """
    Extrait toutes les images embarquées du PDF avec leur position normalisée.

    Retourne une liste de dicts:
      {
        "page": int (1-indexed),
        "centroid_xy": (x, y) en [0,1] sur la page,
        "area_ratio": float [0,1] (surface image / surface page),
        "width": int (pixels),
        "height": int (pixels),
        "jpeg": bytes (JPEG encodé prêt à uploader),
      }

    PyMuPDF gère nativement JPEG, JP2/JPX, JBIG2, CCITT, PNG, et les espaces
    couleur CMYK / DeviceN / ICC. Aucun timeout n'est nécessaire.
    """
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    results: list[dict] = []

    for page_idx in range(len(doc)):
        page = doc[page_idx]
        page_w = page.rect.width
        page_h = page.rect.height
        page_area = page_w * page_h
        if page_area <= 0:
            continue

        # get_image_info(xrefs=True) retourne pour chaque image son xref + bbox.
        try:
            image_infos = page.get_image_info(xrefs=True)
        except Exception as e:
            log.warning("page %d: get_image_info failed: %s", page_idx + 1, e)
            continue

        seen_xrefs: set[int] = set()  # dédupe les images répétées sur la page

        for info in image_infos:
            xref = info.get("xref", 0)
            if xref == 0 or xref in seen_xrefs:
                continue
            seen_xrefs.add(xref)

            bbox = info.get("bbox")
            if not bbox or len(bbox) != 4:
                continue
            x0, y0, x1, y1 = bbox
            w = x1 - x0
            h = y1 - y0
            if w <= 5 or h <= 5:
                continue

            area_ratio = (w * h) / page_area
            if area_ratio < MIN_IMAGE_AREA_RATIO:
                continue  # logo / picto / icône

            # Centroïde normalisé sur la page.
            cx = (x0 + w / 2) / page_w
            cy = (y0 + h / 2) / page_h
            cx = max(0.0, min(1.0, cx))
            cy = max(0.0, min(1.0, cy))

            # Récupère les bytes bruts de l'image via xref.
            try:
                img_dict = doc.extract_image(xref)
            except Exception as e:
                log.warning(
                    "page %d xref %d: extract_image failed: %s",
                    page_idx + 1, xref, e,
                )
                continue

            raw_bytes = img_dict.get("image")
            if not raw_bytes:
                continue

            # Convertit en JPEG via Pillow (robuste à tous les formats d'origine).
            try:
                jpeg_bytes = to_jpeg(raw_bytes)
            except Exception as e:
                log.warning(
                    "page %d xref %d: jpeg conversion failed: %s",
                    page_idx + 1, xref, e,
                )
                continue

            if len(jpeg_bytes) > MAX_IMAGE_BYTES:
                # Trop volumineux : on resize.
                jpeg_bytes = resize_jpeg(jpeg_bytes, max_dim=2400)
                if len(jpeg_bytes) > MAX_IMAGE_BYTES:
                    log.warning(
                        "page %d xref %d: image still too large after resize, skipping",
                        page_idx + 1, xref,
                    )
                    continue

            results.append({
                "page": page_idx + 1,
                "centroid_xy": (cx, cy),
                "area_ratio": area_ratio,
                "width": img_dict.get("width", 0),
                "height": img_dict.get("height", 0),
                "jpeg": jpeg_bytes,
            })

    doc.close()
    return results


def to_jpeg(raw_bytes: bytes) -> bytes:
    """
    Convertit n'importe quel format d'image (JPEG, JP2, JBIG2, PNG, CMYK, etc.)
    en JPEG RGB qualité fixée. Pillow gère la majorité des cas via PyMuPDF.
    """
    img = Image.open(io.BytesIO(raw_bytes))
    if img.mode in ("RGBA", "P", "LA", "PA"):
        # Aplatit la transparence sur fond blanc (catalogues = fond blanc).
        bg = Image.new("RGB", img.size, (255, 255, 255))
        if img.mode == "P":
            img = img.convert("RGBA")
        bg.paste(img, mask=img.split()[-1] if "A" in img.mode else None)
        img = bg
    elif img.mode == "CMYK":
        img = img.convert("RGB")
    elif img.mode != "RGB":
        img = img.convert("RGB")

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=JPEG_QUALITY, optimize=True)
    return buf.getvalue()


def resize_jpeg(jpeg_bytes: bytes, max_dim: int) -> bytes:
    """Resize une image JPEG pour que sa plus grande dim soit <= max_dim."""
    img = Image.open(io.BytesIO(jpeg_bytes))
    w, h = img.size
    if max(w, h) <= max_dim:
        return jpeg_bytes
    scale = max_dim / max(w, h)
    new_size = (int(w * scale), int(h * scale))
    img = img.resize(new_size, Image.Resampling.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=JPEG_QUALITY, optimize=True)
    return buf.getvalue()


# ---------------------------------------------------------------------------
# Matching
# ---------------------------------------------------------------------------
def match_promos_to_images(
    promos: list[PromoInput],
    native_images: list[dict],
) -> list[dict]:
    """
    Greedy 1-to-1 matching par distance euclidienne minimale.
    Chaque image native ne peut être attribuée qu'à une seule promo.

    Retourne la liste des promos enrichie de:
      - "_matched_image" : ref interne vers l'image native (None si pas matché)
      - "match_distance" : float ou None
      - "reason" : str ou None
    """
    # Index les images par page pour un lookup rapide.
    images_by_page: dict[int, list[tuple[int, dict]]] = {}
    for i, img in enumerate(native_images):
        images_by_page.setdefault(img["page"], []).append((i, img))

    # Calcule toutes les paires (promo, image) candidates avec leur distance.
    candidates: list[tuple[float, int, int]] = []  # (dist, promo_idx, image_idx_global)
    promos_with_anchor: list[tuple[int, float, float, int]] = []  # (idx, ax, ay, page)

    for p_idx, promo in enumerate(promos):
        page = promo.page_number
        if page is None:
            continue
        # Détermine l'anchor_xy : explicite > position 3×3 > skip
        if promo.anchor_xy:
            ax, ay = promo.anchor_xy
        elif promo.position and promo.position in ZONE_CENTERS:
            ax, ay = ZONE_CENTERS[promo.position]
        else:
            continue
        promos_with_anchor.append((p_idx, ax, ay, page))

        for img_global_idx, img in images_by_page.get(page, []):
            cx, cy = img["centroid_xy"]
            dist = ((ax - cx) ** 2 + (ay - cy) ** 2) ** 0.5
            if dist > MATCH_DISTANCE_THRESHOLD:
                continue
            candidates.append((dist, p_idx, img_global_idx))

    # Tri par distance croissante : on attribue d'abord les meilleurs matchs.
    candidates.sort()

    used_images: set[int] = set()
    matched_for_promo: dict[int, dict] = {}  # promo_idx -> {image, distance}

    for dist, p_idx, img_idx in candidates:
        if p_idx in matched_for_promo:
            continue
        if img_idx in used_images:
            continue
        matched_for_promo[p_idx] = {
            "image": native_images[img_idx],
            "distance": dist,
        }
        used_images.add(img_idx)

    # Construit le retour aligné sur l'ordre des promos d'entrée.
    outputs: list[dict] = []
    for p_idx, promo in enumerate(promos):
        out: dict = {
            "index": promo.index,
            "_matched_image": None,
            "match_distance": None,
            "reason": None,
        }
        if p_idx in matched_for_promo:
            m = matched_for_promo[p_idx]
            out["_matched_image"] = m["image"]
            out["match_distance"] = round(m["distance"], 4)
        else:
            if promo.page_number is None:
                out["reason"] = "no_page_number"
            elif not promo.position and not promo.anchor_xy:
                out["reason"] = "no_position"
            elif not images_by_page.get(promo.page_number):
                out["reason"] = "no_native_image_on_page"
            else:
                out["reason"] = "no_match_within_threshold"
        outputs.append(out)

    return outputs


# ---------------------------------------------------------------------------
# Upload via Lovable edge function
# ---------------------------------------------------------------------------
async def upload_image_to_supabase(
    client: httpx.AsyncClient,
    organization_id: str,
    catalogue_id: str,
    page_number: int,
    image_index: int,
    jpeg_bytes: bytes,
) -> str:
    """
    Appelle l'edge function Lovable upload-promo-image qui détient la
    SUPABASE_SERVICE_ROLE_KEY et fait l'upload sécurisé vers Supabase Storage.

    Retourne le public_url de l'image uploadée.
    """
    payload = {
        "organization_id": organization_id,
        "catalogue_id": catalogue_id,
        "page_number": page_number,
        "image_index": image_index,
        "image_base64": base64.b64encode(jpeg_bytes).decode("ascii"),
        "content_type": "image/jpeg",
    }
    resp = await client.post(
        UPLOAD_ENDPOINT,
        headers={
            "Authorization": f"Bearer {SHARED_SECRET}",
            "Content-Type": "application/json",
        },
        json=payload,
    )
    if resp.status_code != 200:
        raise RuntimeError(
            f"upload edge function returned {resp.status_code}: {resp.text[:200]}"
        )
    data = resp.json()
    public_url = data.get("public_url")
    if not public_url:
        raise RuntimeError(f"upload edge function returned no public_url: {data}")
    return public_url
