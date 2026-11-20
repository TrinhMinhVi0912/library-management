#!/usr/bin/env python3
"""Create/update Vietnamese book embeddings in Qdrant from the MongoDB catalog."""

from __future__ import annotations

import argparse
import os
import sys
import uuid
from pathlib import Path
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from dotenv import load_dotenv
from pyvi.ViTokenizer import tokenize
from pymongo import MongoClient
from pymongo.uri_parser import parse_uri
from qdrant_client import QdrantClient, models
from sentence_transformers import SentenceTransformer


VECTOR_SIZE = 768
POINT_NAMESPACE = uuid.UUID("18ab8e50-3a6e-4e1c-95bd-21fa6b793650")
BACKEND_DIR = Path(__file__).resolve().parents[2]
load_dotenv(BACKEND_DIR / ".env")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Vector hóa sách active từ MongoDB và đồng bộ vào Qdrant."
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Giới hạn số sách để chạy thử; mặc định 0 là không giới hạn.",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=int(os.getenv("EMBEDDING_BATCH_SIZE", "16")),
        help="Số văn bản mỗi batch đưa vào model (mặc định 16).",
    )
    parser.add_argument(
        "--include-hidden",
        action="store_true",
        help="Bao gồm sách hidden; mặc định chỉ lập chỉ mục sách active.",
    )
    return parser.parse_args()


def required_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(
            f"Thiếu biến môi trường {name}. Hãy cấu hình trong library-backend/.env "
            "hoặc đặt biến môi trường cho tiến trình."
        )
    return value


def book_text(book: dict[str, Any], category_names: list[str]) -> str:
    """Compose stable, labeled Vietnamese text from verified catalog fields."""
    parts = [
        f"Tên sách: {book.get('title', '')}",
        f"Tác giả: {book.get('authorText', '')}",
        f"Thể loại: {', '.join(category_names)}",
        f"Nội dung: {book.get('description', '')}",
    ]
    return " ".join(" ".join(part.split()) for part in parts if part.split())


def stable_point_id(book_id: Any) -> str:
    return str(uuid.uuid5(POINT_NAMESPACE, f"library-book:{book_id}"))


def load_books(mongo_uri: str, limit: int, include_hidden: bool) -> tuple[list[dict[str, Any]], dict[str, str]]:
    parsed_uri = parse_uri(mongo_uri)
    hosts = parsed_uri.get("nodelist", [])
    uri_options = {
        str(key).lower(): value
        for key, value in parsed_uri.get("options", {}).items()
    }
    is_single_local_host = len(hosts) == 1 and hosts[0][0].lower() in {
        "localhost",
        "127.0.0.1",
    }
    client_uri = mongo_uri
    client_options: dict[str, Any] = {"serverSelectionTimeoutMS": 15000}
    if is_single_local_host and "replicaset" in uri_options:
        # A single-node Docker replica set advertises its internal member address.
        # Direct mode uses the published endpoint without replica-set discovery.
        parts = urlsplit(mongo_uri)
        query = [
            (key, value)
            for key, value in parse_qsl(parts.query, keep_blank_values=True)
            if key.lower() not in {"replicaset", "directconnection"}
        ]
        query.append(("directConnection", "true"))
        client_uri = urlunsplit(
            (parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment)
        )
        print("Dùng directConnection cho MongoDB replica set local một node.")

    client = MongoClient(client_uri, **client_options)
    client.admin.command("ping")
    database = client.get_default_database()
    if database is None:
        client.close()
        raise RuntimeError(
            "MONGODB_URI chưa chỉ định tên database. Hãy thêm tên database vào URI "
            "hoặc cấu hình MONGODB_DATABASE."
        )
    database_name = os.getenv("MONGODB_DATABASE", "").strip()
    if database_name:
        database = client[database_name]

    query = {} if include_hidden else {"status": "active"}
    cursor = database["books"].find(
        query,
        {
            "code": 1,
            "title": 1,
            "slug": 1,
            "isbn": 1,
            "authorText": 1,
            "authors": 1,
            "publisher": 1,
            "publishYear": 1,
            "categories": 1,
            "description": 1,
            "status": 1,
        },
    ).sort("_id", 1)
    if limit > 0:
        cursor = cursor.limit(limit)
    books = list(cursor)

    category_ids = {
        category_id
        for book in books
        for category_id in book.get("categories", [])
    }
    categories = {
        str(category["_id"]): category.get("name", "")
        for category in database["categories"].find(
            {"_id": {"$in": list(category_ids)}}, {"name": 1}
        )
    }
    client.close()
    return books, categories


def connect_qdrant(url: str, api_key: str | None) -> QdrantClient:
    client = QdrantClient(url=url, api_key=api_key or None, timeout=60)
    client.get_collections()
    return client


def ensure_collection(client: QdrantClient, collection_name: str) -> None:
    if client.collection_exists(collection_name):
        collection = client.get_collection(collection_name)
        vectors = collection.config.params.vectors
        existing_size = getattr(vectors, "size", None)
        if existing_size != VECTOR_SIZE:
            raise RuntimeError(
                f"Collection '{collection_name}' có kích thước vector {existing_size}; "
                f"model hiện tại cần {VECTOR_SIZE}. Hãy chọn tên collection mới qua "
                "QDRANT_COLLECTION để tránh xóa dữ liệu cũ."
            )
    else:
        client.create_collection(
            collection_name=collection_name,
            vectors_config=models.VectorParams(size=VECTOR_SIZE, distance=models.Distance.COSINE),
        )
    for field_name in (
        "book_id",
        "status",
        "category_ids",
        "author_ids",
        "publisher_id",
        "publish_year",
    ):
        client.create_payload_index(
            collection_name=collection_name,
            field_name=field_name,
            field_schema=(
                models.PayloadSchemaType.INTEGER
                if field_name == "publish_year"
                else models.PayloadSchemaType.KEYWORD
            ),
        )


def remove_stale_points(
    client: QdrantClient, collection_name: str, active_book_ids: set[str]
) -> int:
    """Remove only points in the dedicated book collection absent from MongoDB query."""
    stale_ids: list[int | str] = []
    offset = None
    while True:
        points, offset = client.scroll(
            collection_name=collection_name,
            limit=256,
            offset=offset,
            with_payload=["book_id"],
            with_vectors=False,
        )
        stale_ids.extend(
            point.id
            for point in points
            if str((point.payload or {}).get("book_id", "")) not in active_book_ids
        )
        if offset is None:
            break

    if stale_ids:
        client.delete(
            collection_name=collection_name,
            points_selector=models.PointIdsList(points=stale_ids),
            wait=True,
        )
    return len(stale_ids)


def main() -> int:
    args = parse_args()
    if args.limit < 0 or args.batch_size < 1:
        print("--limit phải >= 0 và --batch-size phải >= 1.", file=sys.stderr)
        return 2

    mongo_uri = required_env("MONGODB_URI")
    qdrant_url = os.getenv("QDRANT_URL", "http://localhost:6333").strip()
    qdrant_api_key = os.getenv("QDRANT_API_KEY", "").strip()
    collection_name = os.getenv("QDRANT_COLLECTION", "library_books_v1").strip()
    model_name = os.getenv("EMBEDDING_MODEL", "dangvantuan/vietnamese-embedding").strip()

    print("Đọc sách từ MongoDB...")
    books, category_names_by_id = load_books(mongo_uri, args.limit, args.include_hidden)
    print(f"Kết nối Qdrant {qdrant_url}...")
    qdrant = connect_qdrant(qdrant_url, qdrant_api_key)
    ensure_collection(qdrant, collection_name)

    if not books:
        if args.limit == 0:
            removed_count = remove_stale_points(qdrant, collection_name, set())
            print(f"Không còn sách phù hợp; đã dọn {removed_count} vector cũ.")
        else:
            print("Không tìm thấy sách phù hợp để vector hóa.")
        qdrant.close()
        return 0

    raw_texts = [
        book_text(
            book,
            [
                category_names_by_id[str(category_id)]
                for category_id in book.get("categories", [])
                if str(category_id) in category_names_by_id
            ],
        )
        for book in books
    ]
    model_inputs = [tokenize(text) for text in raw_texts]

    print(f"Tải model {model_name}...")
    model = SentenceTransformer(model_name)
    if model.get_sentence_embedding_dimension() != VECTOR_SIZE:
        raise RuntimeError(
            f"Model trả về {model.get_sentence_embedding_dimension()} chiều; "
            f"collection hiện được cấu hình {VECTOR_SIZE} chiều."
        )

    lengths = [
        len(ids)
        for ids in model.tokenizer(
            model_inputs, add_special_tokens=True, truncation=False
        )["input_ids"]
    ]
    over_limit = sum(length > model.max_seq_length for length in lengths)
    if over_limit:
        print(
            f"Cảnh báo: {over_limit}/{len(books)} văn bản sách vượt "
            f"{model.max_seq_length} token và sẽ bị model cắt ở giới hạn đầu vào."
        )

    for start in range(0, len(books), args.batch_size):
        batch_books = books[start : start + args.batch_size]
        batch_texts = model_inputs[start : start + args.batch_size]
        vectors = model.encode(
            batch_texts,
            batch_size=args.batch_size,
            show_progress_bar=False,
            normalize_embeddings=True,
            convert_to_numpy=True,
        )
        points = []
        for book, vector in zip(batch_books, vectors, strict=True):
            book_id = str(book["_id"])
            payload = {
                "book_id": book_id,
                "code": book.get("code", ""),
                "title": book.get("title", ""),
                "slug": book.get("slug", ""),
                "isbn": book.get("isbn", ""),
                "status": book.get("status", "active"),
                "category_ids": [str(value) for value in book.get("categories", [])],
                "author_ids": [str(value) for value in book.get("authors", [])],
                "publisher_id": str(book["publisher"]) if book.get("publisher") else "",
                "publish_year": book.get("publishYear"),
                "embedding_model": model_name,
            }
            points.append(
                models.PointStruct(
                    id=stable_point_id(book_id),
                    vector=vector.tolist(),
                    payload=payload,
                )
            )
        qdrant.upsert(collection_name=collection_name, points=points, wait=True)
        print(f"Đã nạp {min(start + len(points), len(books))}/{len(books)} sách.")

    active_book_ids = {str(book["_id"]) for book in books}
    if args.limit == 0:
        removed_count = remove_stale_points(qdrant, collection_name, active_book_ids)
    else:
        removed_count = 0
        print("Chạy giới hạn: bỏ qua bước dọn vector cũ để giữ các sách ngoài batch thử.")
    total_points = qdrant.count(collection_name=collection_name, exact=True).count
    print(
        f"Hoàn tất: {len(books)} vector được đồng bộ vào '{collection_name}', "
        f"đã dọn {removed_count} vector cũ; tổng hiện tại {total_points}."
    )
    qdrant.close()
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:  # noqa: BLE001 - CLI emits actionable user-facing errors.
        print(f"Lỗi vector hóa: {error}", file=sys.stderr)
        raise SystemExit(1) from error
