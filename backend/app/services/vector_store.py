"""
Vector store service — wraps ChromaDB for per-course collections.
"""

import os
import chromadb
from chromadb.config import Settings as ChromaSettings
from app.core.config import get_settings


class VectorStore:
    """Manages ChromaDB collections, one per course."""

    def __init__(self):
        settings = get_settings()
        self._client = chromadb.PersistentClient(
            path=settings.VECTOR_DB_PATH,
            settings=ChromaSettings(anonymized_telemetry=False),
        )

    def _collection_name(self, course_id: str) -> str:
        """Map course ID to a ChromaDB collection name (sanitized)."""
        # ChromaDB collection names: 3-63 chars, alphanumeric + _ -
        return f"course_{course_id.replace('-', '_')}"

    def get_or_create_collection(self, course_id: str):
        """Get existing or create a new collection for the course."""
        name = self._collection_name(course_id)
        return self._client.get_or_create_collection(
            name=name,
            metadata={"course_id": course_id},
        )

    def add_chunks(
        self,
        course_id: str,
        chunks: list[dict],
        embeddings: list[list[float]],
    ):
        """
        Add text chunks with their embeddings to the course collection.
        chunks: [{"text": str, "metadata": dict}, ...]
        embeddings: [[float, ...], ...]
        """
        if not chunks:
            return

        collection = self.get_or_create_collection(course_id)

        ids = [f"chunk_{i}" for i in range(collection.count(), collection.count() + len(chunks))]
        documents = [c["text"] for c in chunks]
        metadatas = [c.get("metadata", {}) for c in chunks]

        collection.add(
            ids=ids,
            documents=documents,
            metadatas=metadatas,
            embeddings=embeddings,
        )

    def delete_course(self, course_id: str):
        """Remove all vectors for a course."""
        name = self._collection_name(course_id)
        try:
            self._client.delete_collection(name)
        except Exception:
            pass  # collection may not exist

    def count(self, course_id: str) -> int:
        """Number of chunks stored for a course."""
        try:
            collection = self.get_or_create_collection(course_id)
            return collection.count()
        except Exception:
            return 0

    def query(
        self,
        course_id: str,
        query_embedding: list[float],
        top_k: int = 5,
    ) -> list[dict]:
        """
        Query the most similar chunks for a course.
        Returns: [{"text": ..., "metadata": {...}, "score": float}, ...]
        """
        collection = self.get_or_create_collection(course_id)
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k,
            include=["documents", "metadatas", "distances"],
        )
        # Flatten and format
        docs = []
        if results["ids"] and results["ids"][0]:
            for i in range(len(results["ids"][0])):
                docs.append({
                    "text": results["documents"][0][i] if results["documents"] else "",
                    "metadata": results["metadatas"][0][i] if results["metadatas"] else {},
                    "score": float(results["distances"][0][i]) if results["distances"] else 0.0,
                })
        return docs