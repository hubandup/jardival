"""
Matching spatial entre promos détectées par Gemini et images natives extraites
du PDF (`pdf_extractor.ImageRecord`).

Stratégie :
  1. Coordonnées Poppler/PyMuPDF → pourcentages page [0,1] (fait à l'extraction
     dans `ImageRecord.centroid_xy` et `page_width/height`).
  2. IoU (Intersection over Union) entre la bbox normalisée de la promo et
     celle de chaque image native sur la même page. Seuil minimum 0.15.
  3. Greedy 1-to-1 par IoU décroissant : chaque image native ne peut être
     attribuée qu'à une seule promo, dans l'ordre des meilleurs scores.
  4. Fallback distance centroïde pour les promos non matchées par IoU
     (utile quand Gemini ne fournit pas de bbox mais seulement une zone 3×3
     ou un anchor_xy).

Le module ne dépend pas de FastAPI ni de la stack Supabase : c'est de la
géométrie pure pour rester testable.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, Optional

from pdf_extractor import ImageRecord

IOU_THRESHOLD = 0.15

# Quand on n'a qu'un point (anchor_xy ou centre de zone 3×3) on synthétise
# une bbox carrée de cette demi-largeur autour du point pour pouvoir tenter
# l'IoU. Valeur empirique : couvre une promo "standard" sur une page A4.
SYNTHETIC_HALF_SIZE = 0.18

# Centres normalisés [0,1] des 9 zones d'une grille 3×3. Reproduit la
# convention utilisée dans `main.py` pour rester compatible.
ZONE_CENTERS: dict[str, tuple[float, float]] = {
    "haut-gauche":    (1 / 6, 1 / 6),
    "haut-centre":    (3 / 6, 1 / 6),
    "haut-droite":    (5 / 6, 1 / 6),
    "milieu-gauche":  (1 / 6, 3 / 6),
    "milieu-centre":  (3 / 6, 3 / 6),
    "milieu-droite":  (5 / 6, 3 / 6),
    "bas-gauche":     (1 / 6, 5 / 6),
    "bas-centre":     (3 / 6, 5 / 6),
    "bas-droite":     (5 / 6, 5 / 6),
}

MatchMethod = Literal["iou", "centroid"]


@dataclass
class PromoCandidate:
    """Une promo Gemini candidate au matching avec les images natives."""
    promo_index: int
    page_number: Optional[int]
    # bbox normalisée en pourcentages de page [0,1] : (x, y, w, h) avec
    # origine en haut-gauche. Optionnelle : si absente on retombe sur
    # anchor_xy ou position zone.
    bbox_norm: Optional[tuple[float, float, float, float]] = None
    anchor_xy: Optional[tuple[float, float]] = None  # (x, y) ∈ [0,1]
    position: Optional[str] = None  # clé de ZONE_CENTERS


@dataclass
class MatchResult:
    promo_index: int
    image_id: Optional[str] = None
    image_path: Optional[str] = None
    match_score: Optional[float] = None
    match_method: Optional[MatchMethod] = None
    # Source d'extraction de l'image matchée ("poppler" | "pymupdf" | "raster"),
    # propagée depuis `ImageRecord.source` pour permettre à la couche métier de
    # marquer `is_rasterized` sans avoir à recroiser l'image_id.
    image_source: Optional[str] = None
    reason: Optional[str] = None


def match_promos(
    promos: list[PromoCandidate],
    images: list[ImageRecord],
) -> list[MatchResult]:
    """
    Associe chaque promo à au plus une image native. Greedy 1-to-1.

    Algorithme :
      - Phase 1 : pour chaque (promo, image) sur la même page, calcule l'IoU.
        Trie par IoU décroissant et attribue tant que l'IoU ≥ IOU_THRESHOLD.
      - Phase 2 : pour les promos non matchées, fallback distance centroïde
        sur les images encore disponibles. Pas de seuil dur ici : on prend le
        meilleur match restant (la couche métier décidera quoi en faire via
        `match_score`).
    """
    images_by_page = _group_images_by_page(images)
    used_images: set[str] = set()
    results: dict[int, MatchResult] = {}

    # --- Phase 1 : IoU greedy ---
    iou_pairs: list[tuple[float, int, ImageRecord]] = []
    for promo in promos:
        if promo.page_number is None:
            continue
        promo_bbox = _resolve_promo_bbox(promo)
        if promo_bbox is None:
            continue
        for img in images_by_page.get(promo.page_number, []):
            score = _iou(promo_bbox, _image_bbox_norm(img))
            if score >= IOU_THRESHOLD:
                iou_pairs.append((score, promo.promo_index, img))

    # Tri par IoU décroissant — on prend les meilleurs matchs en premier.
    iou_pairs.sort(key=lambda t: t[0], reverse=True)
    for score, promo_idx, img in iou_pairs:
        if promo_idx in results:
            continue
        if img.image_id in used_images:
            continue
        results[promo_idx] = MatchResult(
            promo_index=promo_idx,
            image_id=img.image_id,
            image_path=img.file_path,
            match_score=round(score, 4),
            match_method="iou",
            image_source=img.source,
        )
        used_images.add(img.image_id)

    # --- Phase 2 : fallback centroïde ---
    for promo in promos:
        if promo.promo_index in results:
            continue
        if promo.page_number is None:
            results[promo.promo_index] = MatchResult(
                promo_index=promo.promo_index, reason="no_page_number",
            )
            continue
        anchor = _resolve_promo_anchor(promo)
        if anchor is None:
            results[promo.promo_index] = MatchResult(
                promo_index=promo.promo_index, reason="no_position",
            )
            continue
        candidates = [
            img for img in images_by_page.get(promo.page_number, [])
            if img.image_id not in used_images
        ]
        if not candidates:
            results[promo.promo_index] = MatchResult(
                promo_index=promo.promo_index,
                reason="no_native_image_on_page",
            )
            continue
        best_img, best_dist = _closest_centroid(anchor, candidates)
        # Score centroïde : 1 - distance ∈ [0,1] où 0 = opposés.
        score = max(0.0, 1.0 - best_dist)
        results[promo.promo_index] = MatchResult(
            promo_index=promo.promo_index,
            image_id=best_img.image_id,
            image_path=best_img.file_path,
            match_score=round(score, 4),
            match_method="centroid",
            image_source=best_img.source,
        )
        used_images.add(best_img.image_id)

    # Conserve l'ordre d'entrée des promos.
    return [
        results.get(p.promo_index, MatchResult(promo_index=p.promo_index, reason="unhandled"))
        for p in promos
    ]


# ---------------------------------------------------------------------------
# Geometry primitives
# ---------------------------------------------------------------------------
def _iou(
    a: tuple[float, float, float, float],
    b: tuple[float, float, float, float],
) -> float:
    """IoU de deux bbox (x, y, w, h) en coordonnées normalisées."""
    ax0, ay0, aw, ah = a
    bx0, by0, bw, bh = b
    ax1, ay1 = ax0 + aw, ay0 + ah
    bx1, by1 = bx0 + bw, by0 + bh

    inter_x0 = max(ax0, bx0)
    inter_y0 = max(ay0, by0)
    inter_x1 = min(ax1, bx1)
    inter_y1 = min(ay1, by1)
    inter_w = max(0.0, inter_x1 - inter_x0)
    inter_h = max(0.0, inter_y1 - inter_y0)
    inter = inter_w * inter_h
    if inter <= 0:
        return 0.0
    union = aw * ah + bw * bh - inter
    if union <= 0:
        return 0.0
    return inter / union


def _image_bbox_norm(img: ImageRecord) -> tuple[float, float, float, float]:
    """Convertit l'ImageRecord (coords PDF en points) en bbox normalisée."""
    if img.page_width <= 0 or img.page_height <= 0:
        return (0.0, 0.0, 0.0, 0.0)
    return (
        img.x / img.page_width,
        img.y / img.page_height,
        img.w / img.page_width,
        img.h / img.page_height,
    )


def _resolve_promo_bbox(
    promo: PromoCandidate,
) -> Optional[tuple[float, float, float, float]]:
    """
    Détermine la bbox normalisée à utiliser pour calculer l'IoU.

    Priorité : bbox_norm explicite > synthétique autour de anchor_xy >
    synthétique autour du centre de la zone 3×3 > None.
    """
    if promo.bbox_norm:
        return _clip_bbox(promo.bbox_norm)
    if promo.anchor_xy:
        return _synthetic_bbox(promo.anchor_xy)
    if promo.position and promo.position in ZONE_CENTERS:
        return _synthetic_bbox(ZONE_CENTERS[promo.position])
    return None


def _resolve_promo_anchor(promo: PromoCandidate) -> Optional[tuple[float, float]]:
    """Centre logique de la promo pour le fallback distance centroïde."""
    if promo.bbox_norm:
        x, y, w, h = promo.bbox_norm
        return (x + w / 2, y + h / 2)
    if promo.anchor_xy:
        return promo.anchor_xy
    if promo.position and promo.position in ZONE_CENTERS:
        return ZONE_CENTERS[promo.position]
    return None


def _synthetic_bbox(
    anchor: tuple[float, float],
) -> tuple[float, float, float, float]:
    """Bbox carrée de demi-côté SYNTHETIC_HALF_SIZE centrée sur `anchor`."""
    cx, cy = anchor
    half = SYNTHETIC_HALF_SIZE
    x0 = max(0.0, cx - half)
    y0 = max(0.0, cy - half)
    x1 = min(1.0, cx + half)
    y1 = min(1.0, cy + half)
    return (x0, y0, x1 - x0, y1 - y0)


def _clip_bbox(
    bbox: tuple[float, float, float, float],
) -> tuple[float, float, float, float]:
    x, y, w, h = bbox
    x = max(0.0, min(1.0, x))
    y = max(0.0, min(1.0, y))
    w = max(0.0, min(1.0 - x, w))
    h = max(0.0, min(1.0 - y, h))
    return (x, y, w, h)


def _closest_centroid(
    anchor: tuple[float, float],
    images: list[ImageRecord],
) -> tuple[ImageRecord, float]:
    ax, ay = anchor
    best: Optional[ImageRecord] = None
    best_dist = float("inf")
    for img in images:
        cx, cy = img.centroid_xy
        d = ((ax - cx) ** 2 + (ay - cy) ** 2) ** 0.5
        if d < best_dist:
            best_dist = d
            best = img
    assert best is not None  # appelé uniquement avec une liste non vide
    return best, best_dist


def _group_images_by_page(images: list[ImageRecord]) -> dict[int, list[ImageRecord]]:
    out: dict[int, list[ImageRecord]] = {}
    for img in images:
        out.setdefault(img.page_number, []).append(img)
    return out
