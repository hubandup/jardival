"""
Jardival catalogue extraction backend.

Reçoit un PDF + une liste de promos avec position, retourne pour chaque promo
une image_url pointant vers l'image native extraite (HD) ou null si pas matché.

Architecture :
1. /extract télécharge le PDF
2. `pdf_extractor` extrait toutes les images natives via Poppler (`pdfimages
   -all`), avec fallback PyMuPDF puis rasterization 150dpi+crop si besoin
3. `image_matcher` associe chaque promo Gemini à au plus une image native
   par IoU (seuil 0.15) avec fallback distance centroïde
4. Chaque image matchée est uploadée via l'edge function Lovable upload-promo-image
5. Retour : liste de {promo_index, image_url, source: "native" | null}

Sécurité : authentification par header Authorization: Bearer <RENDER_API_SHARED_SECRET>.
Ce secret est partagé entre le frontend Lovable et ce service. Il ne donne accès
à RIEN d'autre que cet endpoint.
"""
import base64
import logging
import os
import time
from typing import Literal, Optional

import httpx
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from pdf_extractor import ImageRecord, extract_images
from image_matcher import PromoCandidate, match_promos

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

# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
PositionZone = Literal[
    "haut-gauche", "haut-centre", "haut-droite",
    "milieu-gauche", "milieu-centre", "milieu-droite",
    "bas-gauche", "bas-centre", "bas-droite",
]


class PromoInput(BaseModel):
    """Promo détectée par Gemini avec position approximative sur la page."""
    index: int
    page_number: Optional[int] = None
    position: Optional[PositionZone] = None
    # Optionnel : si Gemini fournit déjà un anchor_xy précis [x, y] normalisé [0,1],
    # on le préfère à la position 3×3 (matching plus précis).
    anchor_xy: Optional[tuple[float, float]] = None
    # Optionnel : bbox normalisée [0,1] sur la page (x, y, w, h).
    # Quand fournie, l'`image_matcher` privilégie l'IoU plutôt que la distance.
    bbox: Optional[tuple[float, float, float, float]] = None
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
    # Score de matching ∈ [0,1]. 1.0 = recouvrement parfait.
    match_score: Optional[float] = None
    # "iou" | "centroid" — méthode qui a permis le match (debug).
    match_method: Optional[Literal["iou", "centroid"]] = None
    # True si l'image associée a dû être obtenue par rasterization de la page
    # (Poppler ET PyMuPDF ont échoué à fournir les bytes natifs). L'edge
    # function appelante persiste ce flag dans `promotions.is_rasterized`
    # pour pouvoir filtrer/réessayer ces promos plus tard.
    is_rasterized: bool = False
    # Bbox de l'image native matchée, normalisée [0,1] sur la page :
    # (x, y, w, h) avec origine top-left. Permet l'affichage d'overlay
    # côté front (preview, validation manuelle) sans avoir à rouvrir
    # le PDF. None quand aucune image n'a été matchée.
    image_bbox_norm: Optional[tuple[float, float, float, float]] = None
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
    # Compteurs par source d'extraction (debug observabilité Poppler vs fallbacks).
    poppler_used: int = 0
    pymupdf_used: int = 0
    raster_used: int = 0
    fallbacks: int = 0


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

    # ----- Extraction des images natives (Poppler + fallbacks) -----
    records, extract_stats = extract_images(
        pdf_bytes,
        organization_id=body.organization_id,
        catalogue_id=body.catalogue_id,
    )
    log.info(
        "images extracted: %d (poppler=%d, pymupdf=%d, raster=%d, fallbacks=%d)",
        len(records),
        extract_stats.poppler_used,
        extract_stats.pymupdf_used,
        extract_stats.raster_used,
        len(extract_stats.fallbacks),
    )

    # ----- Matching promos ↔ images (IoU + fallback centroïde) -----
    candidates = [
        PromoCandidate(
            promo_index=p.index,
            page_number=p.page_number,
            bbox_norm=p.bbox,
            anchor_xy=p.anchor_xy,
            position=p.position,
        )
        for p in body.promos
    ]
    matches = match_promos(candidates, records)
    matches_by_index = {m.promo_index: m for m in matches}
    records_by_id: dict[str, ImageRecord] = {r.image_id: r for r in records}

    # ----- Upload des images matchées via l'edge function Lovable -----
    matched_count = 0
    failed_uploads = 0
    final_outputs: list[PromoOutput] = []
    async with httpx.AsyncClient(timeout=30.0) as client:
        for promo in body.promos:
            match = matches_by_index.get(promo.index)
            if match is None or match.image_id is None:
                final_outputs.append(PromoOutput(
                    index=promo.index,
                    reason=match.reason if match else "no_match",
                ))
                continue
            record = records_by_id.get(match.image_id)
            if record is None:
                final_outputs.append(PromoOutput(
                    index=promo.index,
                    reason="image_record_missing",
                ))
                continue
            try:
                public_url = await upload_image_to_supabase(
                    client=client,
                    organization_id=body.organization_id,
                    catalogue_id=body.catalogue_id,
                    page_number=record.page_number,
                    image_index=promo.index,
                    jpeg_bytes=record.jpeg,
                )
                final_outputs.append(PromoOutput(
                    index=promo.index,
                    image_url=public_url,
                    source="native",
                    match_score=match.match_score,
                    match_method=match.match_method,
                    is_rasterized=(record.source == "raster"),
                    image_bbox_norm=_normalize_bbox(record),
                ))
                matched_count += 1
            except Exception as e:
                log.warning("upload failed for promo %d: %s", promo.index, e)
                final_outputs.append(PromoOutput(
                    index=promo.index,
                    match_score=match.match_score,
                    match_method=match.match_method,
                    is_rasterized=(record.source == "raster"),
                    image_bbox_norm=_normalize_bbox(record),
                    reason=f"upload_failed: {e}",
                ))
                failed_uploads += 1

    duration_ms = int((time.time() - started_at) * 1000)
    no_native = sum(1 for o in final_outputs if o.image_url is None and not o.reason)
    pdf_pages = len({r.page_number for r in records}) if records else 0

    stats = ExtractStats(
        promos_total=len(body.promos),
        matched_native=matched_count,
        no_native_image=no_native,
        failed_upload=failed_uploads,
        pdf_pages=pdf_pages,
        total_native_images=len(records),
        duration_ms=duration_ms,
        poppler_used=extract_stats.poppler_used,
        pymupdf_used=extract_stats.pymupdf_used,
        raster_used=extract_stats.raster_used,
        fallbacks=len(extract_stats.fallbacks),
    )

    log.info(
        "extract done: matched=%d/%d, failed_upload=%d, %dms",
        matched_count, len(body.promos), failed_uploads, duration_ms,
    )

    return ExtractResponse(outputs=final_outputs, stats=stats)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _normalize_bbox(record: ImageRecord) -> Optional[tuple[float, float, float, float]]:
    """
    Convertit la bbox PDF (points, origine top-left) d'un `ImageRecord` en
    coordonnées normalisées [0,1] sur la page. Retourne None si la page a
    des dimensions invalides (ne devrait pas arriver — garde-fou défensif).
    """
    if record.page_width <= 0 or record.page_height <= 0:
        return None
    return (
        record.x / record.page_width,
        record.y / record.page_height,
        record.w / record.page_width,
        record.h / record.page_height,
    )


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
