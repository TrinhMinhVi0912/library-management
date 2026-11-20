"""Persistent Vietnamese embedding and Qdrant search API for the Node backend."""

from __future__ import annotations

import os
import secrets
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field
from pyvi.ViTokenizer import tokenize
from qdrant_client import QdrantClient, models
from sentence_transformers import SentenceTransformer


BACKEND_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_DIR / ".env")
MODEL_NAME = os.getenv("EMBEDDING_MODEL", "dangvantuan/vietnamese-embedding").strip()
COLLECTION_NAME = os.getenv("QDRANT_COLLECTION", "library_books_v1").strip()
QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333").strip()
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY", "").strip() or None
SERVICE_API_KEY = os.getenv("EMBEDDING_SERVICE_API_KEY", "").strip()
SCORE_THRESHOLD = float(os.getenv("EMBEDDING_SCORE_THRESHOLD", "0.2"))

runtime: dict[str, Any] = {}


class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=500)
    category_id: str | None = Field(default=None, pattern=r"^[0-9a-fA-F]{24}$")
    author_id: str | None = Field(default=None, pattern=r"^[0-9a-fA-F]{24}$")
    publisher_id: str | None = Field(default=None, pattern=r"^[0-9a-fA-F]{24}$")
    year: int | None = Field(default=None, ge=1000, le=2200)
    limit: int = Field(default=1000, ge=1, le=1000)


class RecommendationRequest(BaseModel):
    profile_texts: list[str] = Field(min_length=1, max_length=100)
    exclude_book_ids: list[str] = Field(default_factory=list, max_length=1000)
    limit: int = Field(default=12, ge=1, le=30)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    runtime["model"] = SentenceTransformer(MODEL_NAME)
    runtime["qdrant"] = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY, timeout=30)
    yield
    runtime["qdrant"].close()


app = FastAPI(title="Library Semantic Search", lifespan=lifespan)


def verify_service_key(value: str | None) -> None:
    if SERVICE_API_KEY and not secrets.compare_digest(value or "", SERVICE_API_KEY):
        raise HTTPException(status_code=401, detail="Không được phép gọi dịch vụ tìm kiếm.")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "collection": COLLECTION_NAME, "model": MODEL_NAME}


@app.post("/search")
def search_books(payload: SearchRequest, x_service_key: str | None = Header(default=None)) -> dict[str, Any]:
    verify_service_key(x_service_key)
    query_vector = runtime["model"].encode(
        tokenize(payload.query.strip()), normalize_embeddings=True, convert_to_numpy=True
    ).tolist()
    conditions: list[models.FieldCondition] = [
        models.FieldCondition(key="status", match=models.MatchValue(value="active"))
    ]
    if payload.category_id:
        conditions.append(models.FieldCondition(
            key="category_ids", match=models.MatchValue(value=payload.category_id)
        ))
    if payload.author_id:
        conditions.append(models.FieldCondition(
            key="author_ids", match=models.MatchValue(value=payload.author_id)
        ))
    if payload.publisher_id:
        conditions.append(models.FieldCondition(
            key="publisher_id", match=models.MatchValue(value=payload.publisher_id)
        ))
    if payload.year:
        conditions.append(models.FieldCondition(
            key="publish_year", match=models.MatchValue(value=payload.year)
        ))

    try:
        result = runtime["qdrant"].query_points(
            collection_name=COLLECTION_NAME,
            query=query_vector,
            query_filter=models.Filter(must=conditions),
            limit=payload.limit,
            score_threshold=SCORE_THRESHOLD,
            with_payload=["book_id"],
            with_vectors=False,
        )
    except Exception as error:
        raise HTTPException(
            status_code=503,
            detail="Chưa có collection sách trong Qdrant hoặc dịch vụ lưu trữ chưa sẵn sàng.",
        ) from error
    return {
        "results": [
            {"book_id": str(point.payload["book_id"]), "score": float(point.score)}
            for point in result.points
            if point.payload and point.payload.get("book_id")
        ]
    }


@app.post("/recommend")
def recommend_books(payload: RecommendationRequest, x_service_key: str | None = Header(default=None)) -> dict[str, Any]:
    verify_service_key(x_service_key)
    profile_vectors = runtime["model"].encode(
        [tokenize(text.strip()) for text in payload.profile_texts if text.strip()],
        normalize_embeddings=True,
        convert_to_numpy=True,
    )
    if len(profile_vectors) == 0:
        return {"results": []}
    profile_vector = profile_vectors.mean(axis=0)
    norm = float((profile_vector**2).sum() ** 0.5)
    if norm:
        profile_vector = profile_vector / norm
    conditions: list[models.FieldCondition] = [
        models.FieldCondition(key="status", match=models.MatchValue(value="active"))
    ]
    if payload.exclude_book_ids:
        conditions.append(models.FieldCondition(
            key="book_id", match=models.MatchExcept(**{"except": payload.exclude_book_ids})
        ))
    try:
        result = runtime["qdrant"].query_points(
            collection_name=COLLECTION_NAME,
            query=profile_vector.tolist(),
            query_filter=models.Filter(must=conditions),
            limit=payload.limit,
            score_threshold=SCORE_THRESHOLD,
            with_payload=["book_id"],
            with_vectors=False,
        )
    except Exception as error:
        raise HTTPException(status_code=503, detail="Qdrant chưa sẵn sàng cho gợi ý sách.") from error
    return {
        "results": [
            {"book_id": str(point.payload["book_id"]), "score": float(point.score)}
            for point in result.points
            if point.payload and point.payload.get("book_id")
        ]
    }
