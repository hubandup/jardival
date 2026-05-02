"""
Extraction d'images natives PDF via Poppler (`pdfimages`).

Stratégie hybride :
  1. Poppler `pdfimages -all` exporte les bytes natifs de toutes les images
     dans un dossier temporaire (rapide, robuste, gère JPEG/JPX/JBIG2/CCITT/PNG
     et tous les espaces couleur exotiques sans timeout).
  2. Poppler `pdfimages -list` (ou PyMuPDF) donne pour chaque image son
     object id (= xref PDF) et la page sur laquelle elle apparaît.
  3. PyMuPDF `get_image_info(xrefs=True)` fournit les coordonnées de bbox
     en points PDF (Poppler ne les expose pas en CLI).
  4. On matche les deux par xref / object id, et on retombe sur PyMuPDF puis
     sur la rasterization 150dpi + crop si Poppler échoue à n'importe quelle étape.

Fallback en cascade :
  - Poppler indisponible ou échec global  → PyMuPDF pour tout
  - Image absente du dump Poppler         → PyMuPDF pour cette image
  - Bytes PyMuPDF illisibles               → rasterization page + crop bbox

Chaque fallback est loggé en JSON structuré (clés : org_id, page, reason,
timestamp) — la table Supabase `extraction_logs` n'existe pas aujourd'hui ;
si elle est créée plus tard, brancher l'envoi REST dans `_record_fallback`.
"""
from __future__ import annotations

import io
import json
import logging
import os
import re
import shutil
import subprocess
import tempfile
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Optional

import fitz  # PyMuPDF
from PIL import Image

log = logging.getLogger("jardival-extract.pdf_extractor")

POPPLER_GLOBAL_TIMEOUT_SEC = 30.0
POPPLER_PER_IMAGE_TIMEOUT_SEC = 5.0
RASTER_DPI = 150
JPEG_QUALITY = 88
MAX_IMAGE_BYTES = 14 * 1024 * 1024
MIN_IMAGE_AREA_RATIO = 0.005

# Format d'une ligne `pdfimages -list` (Poppler ≥ 0.62) :
#   page  num  type   width height color comp bpc  enc interp  object ID x-ppi y-ppi size ratio
# Le numéro d'objet ("object ID") est la troisième-avant-dernière colonne et
# correspond à l'xref PyMuPDF. -1 = image inline (pas d'xref stable).
_LIST_HEADER_RE = re.compile(r"^\s*page\s+num\s+type\s+", re.IGNORECASE)


@dataclass
class ImageRecord:
    """Une image native extraite, prête à être uploadée."""
    image_id: str           # identifiant stable (xref PDF si dispo, sinon page-N)
    page_number: int        # 1-indexed
    x: float                # bbox PDF (points)
    y: float
    w: float
    h: float
    page_width: float       # dimensions de la page en points (utiles pour normaliser)
    page_height: float
    centroid_xy: tuple[float, float]  # centre normalisé [0,1] sur la page
    area_ratio: float
    pixel_width: int
    pixel_height: int
    jpeg: bytes             # JPEG RGB encodé prêt à l'upload
    file_path: Optional[str] = None  # chemin du fichier Poppler temporaire (debug)
    source: str = "poppler"          # "poppler" | "pymupdf" | "raster"

    def to_public_dict(self) -> dict:
        """Vue sérialisable (sans les bytes JPEG)."""
        d = asdict(self)
        d.pop("jpeg", None)
        return d


@dataclass
class ExtractionStats:
    images_found: int = 0
    poppler_used: int = 0
    pymupdf_used: int = 0
    raster_used: int = 0
    skipped: int = 0
    poppler_available: bool = False
    fallbacks: list[dict] = field(default_factory=list)


def extract_images(
    pdf_bytes: bytes,
    *,
    organization_id: Optional[str] = None,
    catalogue_id: Optional[str] = None,
) -> tuple[list[ImageRecord], ExtractionStats]:
    """
    Point d'entrée principal.

    Parameters
    ----------
    pdf_bytes : bytes
        Le PDF en mémoire.
    organization_id, catalogue_id : str | None
        Utilisés uniquement pour les logs structurés de fallback.

    Returns
    -------
    (records, stats)
        - records : liste d'`ImageRecord` filtrée (logos/pictos enlevés).
        - stats   : compteurs et liste des fallbacks pour debug/observabilité.
    """
    stats = ExtractionStats()
    stats.poppler_available = _poppler_available()

    # PyMuPDF reste la source de vérité pour la géométrie : on en a besoin
    # quoi qu'il arrive (Poppler ne donne pas les bbox en CLI).
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        geometry = _collect_geometry(doc)
    except Exception as exc:
        doc.close()
        log.error("PyMuPDF geometry failed entirely: %s", exc)
        return [], stats

    poppler_dump: dict[int, Path] = {}
    if stats.poppler_available:
        try:
            poppler_dump = _run_poppler_dump(pdf_bytes)
        except Exception as exc:
            _record_fallback(
                stats, organization_id, catalogue_id,
                page=None, reason=f"poppler_global_failed: {exc}",
            )
            poppler_dump = {}

    records: list[ImageRecord] = []
    page_dims = {p_idx: (page.rect.width, page.rect.height) for p_idx, page in enumerate(doc)}

    for geom in geometry:
        page_idx = geom["page_index"]
        page_w, page_h = page_dims.get(page_idx, (0.0, 0.0))
        if page_w <= 0 or page_h <= 0:
            stats.skipped += 1
            continue

        # 1) Poppler : a-t-il extrait cette image ?
        jpeg_bytes: Optional[bytes] = None
        source = "poppler"
        file_path: Optional[str] = None
        poppler_path = poppler_dump.get(geom["xref"]) if geom["xref"] > 0 else None
        if poppler_path is not None:
            try:
                jpeg_bytes = _to_jpeg(poppler_path.read_bytes())
                file_path = str(poppler_path)
            except Exception as exc:
                _record_fallback(
                    stats, organization_id, catalogue_id,
                    page=page_idx + 1,
                    reason=f"poppler_decode_failed:xref={geom['xref']}:{exc}",
                )
                jpeg_bytes = None

        # 2) Fallback PyMuPDF
        if jpeg_bytes is None:
            try:
                jpeg_bytes = _pymupdf_extract(doc, geom["xref"])
                source = "pymupdf"
                if stats.poppler_available:
                    _record_fallback(
                        stats, organization_id, catalogue_id,
                        page=page_idx + 1,
                        reason=f"pymupdf_fallback:xref={geom['xref']}",
                    )
            except Exception as exc:
                _record_fallback(
                    stats, organization_id, catalogue_id,
                    page=page_idx + 1,
                    reason=f"pymupdf_extract_failed:xref={geom['xref']}:{exc}",
                )
                jpeg_bytes = None

        # 3) Dernier recours : rasterizer la page + cropper la bbox.
        if jpeg_bytes is None:
            try:
                jpeg_bytes = _raster_crop(doc, page_idx, geom["bbox"])
                source = "raster"
                _record_fallback(
                    stats, organization_id, catalogue_id,
                    page=page_idx + 1,
                    reason=f"raster_fallback:xref={geom['xref']}",
                )
            except Exception as exc:
                _record_fallback(
                    stats, organization_id, catalogue_id,
                    page=page_idx + 1,
                    reason=f"raster_failed:xref={geom['xref']}:{exc}",
                )
                stats.skipped += 1
                continue

        if len(jpeg_bytes) > MAX_IMAGE_BYTES:
            jpeg_bytes = _resize_jpeg(jpeg_bytes, max_dim=2400)
            if len(jpeg_bytes) > MAX_IMAGE_BYTES:
                stats.skipped += 1
                continue

        x0, y0, x1, y1 = geom["bbox"]
        bw, bh = x1 - x0, y1 - y0
        cx = max(0.0, min(1.0, (x0 + bw / 2) / page_w))
        cy = max(0.0, min(1.0, (y0 + bh / 2) / page_h))
        record = ImageRecord(
            image_id=str(geom["xref"]) if geom["xref"] > 0 else f"page{page_idx + 1}-inline",
            page_number=page_idx + 1,
            x=x0, y=y0, w=bw, h=bh,
            page_width=page_w, page_height=page_h,
            centroid_xy=(cx, cy),
            area_ratio=(bw * bh) / (page_w * page_h),
            pixel_width=geom.get("pixel_width", 0),
            pixel_height=geom.get("pixel_height", 0),
            jpeg=jpeg_bytes,
            file_path=file_path,
            source=source,
        )
        records.append(record)
        if source == "poppler":
            stats.poppler_used += 1
        elif source == "pymupdf":
            stats.pymupdf_used += 1
        else:
            stats.raster_used += 1

    stats.images_found = len(records)

    # Cleanup du dossier temporaire Poppler.
    for p in poppler_dump.values():
        try:
            shutil.rmtree(p.parent, ignore_errors=True)
            break  # toutes les images partagent le même parent tempdir
        except Exception:
            pass

    doc.close()
    return records, stats


# ---------------------------------------------------------------------------
# Poppler
# ---------------------------------------------------------------------------
def _poppler_available() -> bool:
    return shutil.which("pdfimages") is not None


def _run_poppler_dump(pdf_bytes: bytes) -> dict[int, Path]:
    """
    Lance `pdfimages -all -list` dans un tempdir et retourne un mapping
    {object_id: chemin_fichier}.

    Timeout global : 30 s. Si dépassé, on lève → fallback complet PyMuPDF.
    """
    tmpdir = Path(tempfile.mkdtemp(prefix="jardival-poppler-"))
    pdf_path = tmpdir / "input.pdf"
    pdf_path.write_bytes(pdf_bytes)
    prefix = tmpdir / "img"

    started = time.monotonic()
    try:
        # `-all` : exporte JPEG en .jpg, JP2 en .jp2, JBIG2 en .jb2, etc.
        # `-list` sur stdout : métadonnées par image (page, object id, dim).
        proc = subprocess.run(
            ["pdfimages", "-all", "-list", "-p", str(pdf_path), str(prefix)],
            capture_output=True,
            timeout=POPPLER_GLOBAL_TIMEOUT_SEC,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        shutil.rmtree(tmpdir, ignore_errors=True)
        raise RuntimeError(f"pdfimages timeout after {POPPLER_GLOBAL_TIMEOUT_SEC}s") from exc

    elapsed = time.monotonic() - started
    if proc.returncode != 0:
        shutil.rmtree(tmpdir, ignore_errors=True)
        raise RuntimeError(
            f"pdfimages exit {proc.returncode} after {elapsed:.1f}s: "
            f"{proc.stderr.decode('utf-8', 'replace')[:300]}"
        )

    listing = proc.stdout.decode("utf-8", "replace")
    return _parse_poppler_listing(listing, tmpdir)


def _parse_poppler_listing(listing: str, tmpdir: Path) -> dict[int, Path]:
    """
    Parse la sortie de `pdfimages -list -p` et renvoie {object_id: Path}.

    Les fichiers générés suivent le motif `img-NNN.<ext>` où NNN est l'index
    séquentiel (1-indexed) dans l'ordre du listing. On lit le `-list` ligne à
    ligne pour récupérer (page, object_id) puis on cherche le fichier sur disque.
    """
    mapping: dict[int, Path] = {}
    seen_idx = 0

    files_by_index: dict[int, Path] = {}
    for entry in tmpdir.iterdir():
        if entry.name == "input.pdf" or not entry.is_file():
            continue
        # `pdfimages` numérote sur 3 chiffres min (img-001.jpg, img-012.jp2…).
        m = re.match(r"^img-(\d+)\.[A-Za-z0-9]+$", entry.name)
        if m:
            files_by_index[int(m.group(1))] = entry

    in_data = False
    for raw in listing.splitlines():
        if not in_data:
            if _LIST_HEADER_RE.match(raw):
                in_data = True
            continue
        if not raw.strip() or raw.strip().startswith("-"):
            continue
        cols = raw.split()
        # Le format Poppler produit 15 colonnes ; on tolère ±1 selon version.
        if len(cols) < 13:
            continue
        try:
            # cols[10] = object ID, cols[11] = ID gen — selon version. On scanne
            # depuis la fin pour trouver l'object ID (entier > 0 ou -1 inline).
            object_id = _find_object_id(cols)
        except ValueError:
            continue
        seen_idx += 1
        path = files_by_index.get(seen_idx)
        if path is None or object_id is None or object_id <= 0:
            continue
        mapping[object_id] = path

    return mapping


def _find_object_id(cols: list[str]) -> Optional[int]:
    """
    Trouve l'object ID dans les colonnes du `-list`. Selon la version de
    Poppler il peut être en colonne 10 ou 11. On s'appuie sur le fait que
    "size" et "ratio" sont les 2 dernières colonnes (avec un suffixe K/M/G
    pour size et un % pour ratio), donc l'object id est cols[-5] (object id),
    suivi de id_gen (cols[-4]), x-ppi (cols[-3]), y-ppi (cols[-2] ? non —
    voir parsing de droite à gauche).

    En pratique, le plus simple est de prendre le premier entier dans la
    plage 11..-3 qui ressemble à un object id (entier ≥ 1 et < 10**7) — c'est
    suffisamment unique parmi les colonnes restantes.
    """
    # Colonnes attendues à droite : ... object_id id_gen x-ppi y-ppi size ratio
    # On parse à rebours : ratio = cols[-1], size = cols[-2], y-ppi = cols[-3],
    # x-ppi = cols[-4], id_gen = cols[-5], object_id = cols[-6].
    if len(cols) < 6:
        return None
    try:
        return int(cols[-6])
    except (ValueError, IndexError):
        return None


# ---------------------------------------------------------------------------
# PyMuPDF (geometry + fallback)
# ---------------------------------------------------------------------------
def _collect_geometry(doc: fitz.Document) -> list[dict]:
    """
    Retourne pour chaque image native : {page_index, xref, bbox, pixel_w, pixel_h}.
    Filtre les logos (< MIN_IMAGE_AREA_RATIO de la page) et les images < 5px.
    """
    out: list[dict] = []
    for page_idx in range(len(doc)):
        page = doc[page_idx]
        page_w = page.rect.width
        page_h = page.rect.height
        if page_w * page_h <= 0:
            continue
        try:
            infos = page.get_image_info(xrefs=True)
        except Exception as exc:
            log.warning("page %d get_image_info failed: %s", page_idx + 1, exc)
            continue

        seen: set[int] = set()
        for info in infos:
            xref = info.get("xref", 0)
            if xref in seen:
                continue
            seen.add(xref)
            bbox = info.get("bbox")
            if not bbox or len(bbox) != 4:
                continue
            x0, y0, x1, y1 = bbox
            if (x1 - x0) <= 5 or (y1 - y0) <= 5:
                continue
            if ((x1 - x0) * (y1 - y0)) / (page_w * page_h) < MIN_IMAGE_AREA_RATIO:
                continue
            out.append({
                "page_index": page_idx,
                "xref": xref,
                "bbox": (x0, y0, x1, y1),
                "pixel_width": info.get("width", 0),
                "pixel_height": info.get("height", 0),
            })
    return out


def _pymupdf_extract(doc: fitz.Document, xref: int) -> bytes:
    if xref <= 0:
        raise ValueError("inline image cannot be extracted by xref")
    img_dict = doc.extract_image(xref)
    raw = img_dict.get("image")
    if not raw:
        raise RuntimeError("extract_image returned no bytes")
    return _to_jpeg(raw)


def _raster_crop(
    doc: fitz.Document,
    page_idx: int,
    bbox: tuple[float, float, float, float],
) -> bytes:
    """
    Rasterize la page à `RASTER_DPI` puis crope le rectangle `bbox`
    (en points PDF). Dernier filet de sécurité : aucune raison sérieuse
    d'échouer ici.
    """
    page = doc[page_idx]
    zoom = RASTER_DPI / 72.0
    mat = fitz.Matrix(zoom, zoom)
    pix = page.get_pixmap(matrix=mat, alpha=False)
    img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
    x0, y0, x1, y1 = bbox
    crop_box = (
        max(0, int(x0 * zoom)),
        max(0, int(y0 * zoom)),
        min(pix.width, int(x1 * zoom)),
        min(pix.height, int(y1 * zoom)),
    )
    if crop_box[2] <= crop_box[0] or crop_box[3] <= crop_box[1]:
        raise RuntimeError(f"invalid crop_box {crop_box}")
    cropped = img.crop(crop_box)
    buf = io.BytesIO()
    cropped.save(buf, format="JPEG", quality=JPEG_QUALITY, optimize=True)
    return buf.getvalue()


# ---------------------------------------------------------------------------
# JPEG normalization
# ---------------------------------------------------------------------------
def _to_jpeg(raw_bytes: bytes) -> bytes:
    img = Image.open(io.BytesIO(raw_bytes))
    if img.mode in ("RGBA", "P", "LA", "PA"):
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


def _resize_jpeg(jpeg_bytes: bytes, max_dim: int) -> bytes:
    img = Image.open(io.BytesIO(jpeg_bytes))
    w, h = img.size
    if max(w, h) <= max_dim:
        return jpeg_bytes
    scale = max_dim / max(w, h)
    img = img.resize((int(w * scale), int(h * scale)), Image.Resampling.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=JPEG_QUALITY, optimize=True)
    return buf.getvalue()


# ---------------------------------------------------------------------------
# Fallback logging
# ---------------------------------------------------------------------------
def _record_fallback(
    stats: ExtractionStats,
    organization_id: Optional[str],
    catalogue_id: Optional[str],
    *,
    page: Optional[int],
    reason: str,
) -> None:
    """
    Log structuré JSON pour chaque fallback. Si la table Supabase
    `extraction_logs` est créée plus tard, brancher ici un POST vers
    `${SUPABASE_URL}/rest/v1/extraction_logs` avec la SERVICE_ROLE_KEY.
    """
    entry = {
        "org_id": organization_id,
        "catalogue_id": catalogue_id,
        "page": page,
        "reason": reason,
        "timestamp": time.time(),
    }
    stats.fallbacks.append(entry)
    log.warning("extraction_fallback %s", json.dumps(entry, default=str))
