"""
A3 relief 처리 — 정면 depth/relief → 계약 H(0..15).

지금(Phase A, GPU 없음)은 depth estimation을 아직 안 붙였으므로,
end-to-end 슬라이스를 돌리기 위한 *합성 H 생성기*를 둔다.
Phase B에서 generate_synthetic_h() 를 실제 depth→relief 파이프라인으로 교체.

  TODO(A3): 배경 분리 → CPU depth estimation → relief(배경 평탄화/엣지 강조/bbox 정규화)
  TODO(B1): depth GPU 전환(큰 모델, 0.1~1초)
"""
from __future__ import annotations
import numpy as np
from . import contract as C


def generate_synthetic_h(kind: str = "dome", seed: int = 0) -> np.ndarray:
    """임시 합성 H. kind: dome(입체 유물 느낌) / face(부조 얼굴) / relief_edges(회화 분기)."""
    rows, cols = C.GRID_ROWS, C.GRID_COLS
    yy, xx = np.mgrid[0:rows, 0:cols].astype(float)
    cy, cx = (rows - 1) / 2, (cols - 1) / 2

    if kind == "face":
        # 중앙 얼굴(큰 돔) + 머리 위 관(상단 융기) — 사진 속 불상 머리 느낌
        r = np.sqrt(((xx - cx) / (cols * 0.32)) ** 2 + ((yy - cy + 2) / (rows * 0.38)) ** 2)
        h = np.clip(1 - r, 0, 1) ** 0.7
        crown = np.exp(-(((xx - cx) / (cols * 0.18)) ** 2 + ((yy - cy + rows * 0.34) / (rows * 0.10)) ** 2))
        h = np.maximum(h, crown * 0.85)
    elif kind == "relief_edges":
        # 회화 분기: 동심 윤곽선 relief
        r = np.sqrt(((xx - cx) / cols) ** 2 + ((yy - cy) / rows) ** 2)
        h = 0.5 + 0.5 * np.sin(r * 26)
        h *= np.clip(1 - r * 1.6, 0, 1)
    else:  # dome
        r = np.sqrt(((xx - cx) / (cols * 0.42)) ** 2 + ((yy - cy) / (rows * 0.42)) ** 2)
        h = np.clip(1 - r ** 2, 0, 1)

    return C.validate(C.quantize(h))


if __name__ == "__main__":
    for k in ("dome", "face", "relief_edges"):
        H = generate_synthetic_h(k)
        print(k, "→ H range", H.min(), H.max(), "shape", H.shape)
