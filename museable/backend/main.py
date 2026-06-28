"""
A5 백엔드 — FastAPI 얇은 슬라이스.

지금은 A3 합성 H를 그대로 서빙해 A4(웹 핀 뷰) 끝단을 돌린다.
Phase A/B에서 실제 작품 등록·DB·캐싱·오디오로 확장.

실행:
  uvicorn backend.main:app --reload --port 8000
  → http://localhost:8000          (웹 핀 뷰)
  → http://localhost:8000/api/artworks
"""
from __future__ import annotations
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from pipeline import contract as C
from pipeline.relief import generate_synthetic_h

app = FastAPI(title="museable API", version="0.1")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# 데모 작품 카탈로그 (A7) — Phase A에서 실제 메타/사진으로 교체
ARTWORKS = [
    {"id": "buddha_01", "title": "금동 반가사유상", "kind": "face",
     "era": "삼국시대 7세기", "type": "3d"},
    {"id": "celadon_01", "title": "청자 상감운학문 매병", "kind": "dome",
     "era": "고려 12세기", "type": "3d"},
    {"id": "ssireum_01", "title": "김홍도 「씨름」", "kind": "relief_edges",
     "era": "조선 18세기", "type": "2d"},
]
_BY_ID = {a["id"]: a for a in ARTWORKS}


@app.get("/api/artworks")
def list_artworks():
    return [{k: a[k] for k in ("id", "title", "era", "type")} for a in ARTWORKS]


@app.get("/api/artworks/{artwork_id}/heightmap")
def heightmap(artwork_id: str):
    art = _BY_ID.get(artwork_id)
    if not art:
        raise HTTPException(404, "unknown artwork")
    # TODO(A3/A5): 캐시된 H 조회 → 없으면 depth/relief 파이프라인 호출. 지금은 합성.
    H = generate_synthetic_h(art["kind"])
    return C.to_json(H, artwork_id)


# 웹 정적 파일 마운트 (맨 마지막)
_WEB = Path(__file__).resolve().parent.parent / "web"
if _WEB.exists():
    app.mount("/", StaticFiles(directory=str(_WEB), html=True), name="web")
