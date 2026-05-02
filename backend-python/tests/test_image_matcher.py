"""
Tests unitaires pour `image_matcher`.

Couvre :
  - primitive IoU (recouvrement nul, partiel, total)
  - matching IoU greedy 1-to-1 au seuil 0.15
  - fallback centroïde quand bbox manque ou IoU < seuil
  - cloisonnement par page (pas de match cross-page)
  - cas d'erreur : pas de page, pas de position, page sans image
  - synthèse de bbox autour d'anchor_xy / zone 3×3
"""
from __future__ import annotations

import sys
from pathlib import Path

# Le projet n'a pas de packaging Python : on ajoute le dossier parent au path
# pour que `from image_matcher import ...` fonctionne en mode `pytest backend-python`.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest  # noqa: E402

from image_matcher import (  # noqa: E402
    IOU_THRESHOLD,
    PromoCandidate,
    _iou,
    match_promos,
)
from pdf_extractor import ImageRecord  # noqa: E402


# Page A4 par défaut en points PDF (595 × 842).
PAGE_W = 595.0
PAGE_H = 842.0


def make_image(
    image_id: str,
    page: int,
    bbox_norm: tuple[float, float, float, float],
) -> ImageRecord:
    """Construit un ImageRecord minimal à partir d'une bbox normalisée."""
    nx, ny, nw, nh = bbox_norm
    x = nx * PAGE_W
    y = ny * PAGE_H
    w = nw * PAGE_W
    h = nh * PAGE_H
    cx = (nx + nw / 2)
    cy = (ny + nh / 2)
    return ImageRecord(
        image_id=image_id,
        page_number=page,
        x=x, y=y, w=w, h=h,
        page_width=PAGE_W, page_height=PAGE_H,
        centroid_xy=(cx, cy),
        area_ratio=nw * nh,
        pixel_width=1024,
        pixel_height=768,
        jpeg=b"",
        file_path=f"/tmp/{image_id}.jpg",
    )


# ---------------------------------------------------------------------------
# IoU primitive
# ---------------------------------------------------------------------------
class TestIoU:
    def test_identical_boxes_iou_is_one(self):
        box = (0.1, 0.2, 0.3, 0.4)
        assert _iou(box, box) == pytest.approx(1.0)

    def test_disjoint_boxes_iou_is_zero(self):
        a = (0.0, 0.0, 0.2, 0.2)
        b = (0.5, 0.5, 0.2, 0.2)
        assert _iou(a, b) == 0.0

    def test_partial_overlap(self):
        # Deux carrés 0.4x0.4 décalés de 0.2 chacun → recouvrement 0.2x0.2.
        a = (0.0, 0.0, 0.4, 0.4)
        b = (0.2, 0.2, 0.4, 0.4)
        # union = 2*(0.16) - 0.04 = 0.28 ; iou = 0.04 / 0.28 ≈ 0.1429
        assert _iou(a, b) == pytest.approx(0.04 / 0.28, rel=1e-3)

    def test_one_inside_other(self):
        outer = (0.0, 0.0, 1.0, 1.0)
        inner = (0.25, 0.25, 0.5, 0.5)
        # inter = 0.25 ; union = 1.0 ; iou = 0.25
        assert _iou(outer, inner) == pytest.approx(0.25)

    def test_zero_area_box(self):
        a = (0.0, 0.0, 0.0, 0.0)
        b = (0.0, 0.0, 0.5, 0.5)
        assert _iou(a, b) == 0.0


# ---------------------------------------------------------------------------
# Matching avec bbox explicite
# ---------------------------------------------------------------------------
class TestMatchWithBbox:
    def test_high_iou_match_uses_iou_method(self):
        img = make_image("xref-10", page=1, bbox_norm=(0.1, 0.1, 0.4, 0.4))
        promo = PromoCandidate(
            promo_index=0, page_number=1, bbox_norm=(0.12, 0.12, 0.4, 0.4),
        )
        [result] = match_promos([promo], [img])
        assert result.image_id == "xref-10"
        assert result.match_method == "iou"
        assert result.match_score is not None and result.match_score >= IOU_THRESHOLD

    def test_low_iou_falls_back_to_centroid(self):
        # bbox promo très petite et décalée → IoU < 0.15 mais centroïdes
        # raisonnablement proches → fallback centroïde doit matcher.
        img = make_image("xref-1", page=1, bbox_norm=(0.0, 0.0, 0.5, 0.5))
        promo = PromoCandidate(
            promo_index=0, page_number=1, bbox_norm=(0.4, 0.4, 0.05, 0.05),
        )
        [result] = match_promos([promo], [img])
        assert result.image_id == "xref-1"
        assert result.match_method == "centroid"

    def test_no_image_on_page(self):
        img = make_image("xref-1", page=2, bbox_norm=(0.1, 0.1, 0.4, 0.4))
        promo = PromoCandidate(
            promo_index=0, page_number=1, bbox_norm=(0.1, 0.1, 0.4, 0.4),
        )
        [result] = match_promos([promo], [img])
        assert result.image_id is None
        assert result.reason == "no_native_image_on_page"

    def test_match_isolated_per_page(self):
        # Une image identique sur chaque page : la promo de la page 2 ne doit
        # pas matcher l'image de la page 1, même si elle a une IoU=1 logique.
        img1 = make_image("xref-1", page=1, bbox_norm=(0.1, 0.1, 0.4, 0.4))
        img2 = make_image("xref-2", page=2, bbox_norm=(0.1, 0.1, 0.4, 0.4))
        p1 = PromoCandidate(0, page_number=1, bbox_norm=(0.1, 0.1, 0.4, 0.4))
        p2 = PromoCandidate(1, page_number=2, bbox_norm=(0.1, 0.1, 0.4, 0.4))
        results = match_promos([p1, p2], [img1, img2])
        assert results[0].image_id == "xref-1"
        assert results[1].image_id == "xref-2"


# ---------------------------------------------------------------------------
# Greedy 1-to-1
# ---------------------------------------------------------------------------
class TestGreedyOneToOne:
    def test_single_image_two_promos_best_iou_wins(self):
        img = make_image("xref-1", page=1, bbox_norm=(0.1, 0.1, 0.4, 0.4))
        # promo A : IoU ~ 0.6 (très bon recouvrement)
        # promo B : IoU ~ 0.16 (juste au-dessus du seuil)
        promo_a = PromoCandidate(0, page_number=1, bbox_norm=(0.12, 0.12, 0.4, 0.4))
        promo_b = PromoCandidate(1, page_number=1, bbox_norm=(0.4, 0.4, 0.4, 0.4))

        results = match_promos([promo_a, promo_b], [img])
        a_result = next(r for r in results if r.promo_index == 0)
        b_result = next(r for r in results if r.promo_index == 1)
        assert a_result.image_id == "xref-1"
        assert a_result.match_method == "iou"
        # B doit retomber sur centroïde (image déjà prise) ou no_image.
        assert b_result.image_id != "xref-1"

    def test_two_images_two_promos_distinct_assignments(self):
        img1 = make_image("xref-1", page=1, bbox_norm=(0.0, 0.0, 0.4, 0.4))
        img2 = make_image("xref-2", page=1, bbox_norm=(0.5, 0.5, 0.4, 0.4))
        promo1 = PromoCandidate(0, page_number=1, bbox_norm=(0.0, 0.0, 0.4, 0.4))
        promo2 = PromoCandidate(1, page_number=1, bbox_norm=(0.5, 0.5, 0.4, 0.4))
        results = match_promos([promo1, promo2], [img1, img2])
        ids = {r.promo_index: r.image_id for r in results}
        assert ids[0] == "xref-1"
        assert ids[1] == "xref-2"


# ---------------------------------------------------------------------------
# Anchor / position zone (pas de bbox)
# ---------------------------------------------------------------------------
class TestAnchorAndZone:
    def test_anchor_xy_synthesizes_bbox_for_iou(self):
        # Image qui couvre le quart haut-gauche : (0,0,0.5,0.5).
        img = make_image("xref-1", page=1, bbox_norm=(0.0, 0.0, 0.5, 0.5))
        # anchor au centre de cette zone → bbox synthétique 0.36×0.36 centrée
        # sur (0.25, 0.25) → fort recouvrement avec l'image.
        promo = PromoCandidate(0, page_number=1, anchor_xy=(0.25, 0.25))
        [result] = match_promos([promo], [img])
        assert result.image_id == "xref-1"
        # IoU ou centroïde acceptables, mais on s'attend plutôt à IoU ici.
        assert result.match_method in ("iou", "centroid")

    def test_position_zone_falls_back_when_iou_too_low(self):
        # Image très petite dans le coin haut-gauche.
        img = make_image("xref-1", page=1, bbox_norm=(0.0, 0.0, 0.05, 0.05))
        # Promo positionnée "haut-gauche" → centre (1/6, 1/6), bbox synthétique
        # ne recouvre quasi pas l'image → centroïde devrait quand même matcher.
        promo = PromoCandidate(0, page_number=1, position="haut-gauche")
        [result] = match_promos([promo], [img])
        assert result.image_id == "xref-1"
        assert result.match_method == "centroid"


# ---------------------------------------------------------------------------
# Cas d'échec
# ---------------------------------------------------------------------------
class TestFailures:
    def test_no_page_number(self):
        img = make_image("xref-1", page=1, bbox_norm=(0.1, 0.1, 0.4, 0.4))
        promo = PromoCandidate(promo_index=0, page_number=None)
        [result] = match_promos([promo], [img])
        assert result.image_id is None
        assert result.reason == "no_page_number"

    def test_no_position_no_bbox_no_anchor(self):
        img = make_image("xref-1", page=1, bbox_norm=(0.1, 0.1, 0.4, 0.4))
        promo = PromoCandidate(promo_index=0, page_number=1)
        [result] = match_promos([promo], [img])
        assert result.image_id is None
        assert result.reason == "no_position"

    def test_empty_image_list(self):
        promo = PromoCandidate(0, page_number=1, bbox_norm=(0.1, 0.1, 0.4, 0.4))
        [result] = match_promos([promo], [])
        assert result.image_id is None
        assert result.reason == "no_native_image_on_page"


# ---------------------------------------------------------------------------
# Préservation de l'ordre d'entrée
# ---------------------------------------------------------------------------
def test_results_preserve_input_order():
    img = make_image("xref-1", page=1, bbox_norm=(0.1, 0.1, 0.4, 0.4))
    promos = [
        PromoCandidate(promo_index=42, page_number=1, bbox_norm=(0.1, 0.1, 0.4, 0.4)),
        PromoCandidate(promo_index=7, page_number=None),
        PromoCandidate(promo_index=99, page_number=1, position="bas-droite"),
    ]
    results = match_promos(promos, [img])
    assert [r.promo_index for r in results] == [42, 7, 99]
