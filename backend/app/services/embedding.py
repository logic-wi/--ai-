"""
Embedding service — calls OpenAI-compatible API to get vectors.
"""

from openai import OpenAI
from app.core.config import get_settings


class EmbeddingService:
    """Thin wrapper around OpenAI-compatible embeddings API."""

    def __init__(self):
        settings = get_settings()
        self.client = OpenAI(
            api_key=settings.EMBEDDING_API_KEY,
            base_url=settings.EMBEDDING_BASE_URL,
        )
        self.model = settings.EMBEDDING_MODEL

    def embed(self, texts: list[str]) -> list[list[float]]:
        """Batch-embed a list of texts. Returns list of vectors."""
        if not texts:
            return []
        resp = self.client.embeddings.create(model=self.model, input=texts)
        # Return in same order
        return [d.embedding for d in sorted(resp.data, key=lambda x: x.index)]

    def embed_single(self, text: str) -> list[float]:
        """Embed a single text."""
        return self.embed([text])[0]