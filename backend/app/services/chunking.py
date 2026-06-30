"""
Text chunking utilities.
Splits long document chunks into smaller, overlapping pieces for embedding.
"""

from __future__ import annotations

from typing import List
from app.core.config import get_settings


class TextChunker:
    """Simple recursive text splitter — splits by paragraphs, then sentences, then words."""

    def __init__(self, chunk_size: int = None, chunk_overlap: int = None):
        settings = get_settings()
        self.chunk_size = chunk_size or settings.CHUNK_SIZE
        self.chunk_overlap = chunk_overlap or settings.CHUNK_OVERLAP

    def split(self, text: str) -> List[str]:
        """Split text into overlapping chunks."""
        if len(text) <= self.chunk_size:
            return [text] if text.strip() else []

        separators = ["\n\n", "\n", "。", ". ", "，", ", ", " ", ""]
        return self._split_recursive(text, separators)

    def _split_recursive(self, text: str, separators: List[str]) -> List[str]:
        """Recursively split text using separators in order of priority."""
        if len(text) <= self.chunk_size:
            return [text] if text.strip() else []

        # Try each separator
        for sep in separators:
            if sep == "":
                # Last resort: split by character
                return self._merge_chunks(list(text))
            if sep in text:
                parts = text.split(sep)
                chunks = []
                for part in parts:
                    chunks.extend(self._split_recursive(part, separators[separators.index(sep) + 1:]))
                return self._merge_chunks(chunks)

        return [text] if text.strip() else []

    def _merge_chunks(self, pieces: List[str]) -> List[str]:
        """Merge small pieces into chunks of desired size, with overlap."""
        chunks: List[str] = []
        current: List[str] = []
        current_len = 0

        for piece in pieces:
            if not piece:
                continue
            piece_len = len(piece)
            if current_len + piece_len > self.chunk_size and current:
                chunks.append(" ".join(current))
                # Keep overlap: last overlap_size chars worth of text
                overlap_text = " ".join(current)
                overlap_start = max(0, len(overlap_text) - self.chunk_overlap)
                overlap_str = overlap_text[overlap_start:]
                current = [overlap_str] if overlap_str.strip() else []
                current_len = len(overlap_str) if overlap_str.strip() else 0
            current.append(piece)
            current_len += piece_len

        if current:
            chunks.append(" ".join(current))

        return chunks


def chunk_document(text: str, metadata: dict = None) -> List[dict]:
    """
    Convenience: split text and attach metadata to each chunk.
    Returns list of {"text": ..., "metadata": ...}.
    """
    chunker = TextChunker()
    texts = chunker.split(text)
    meta = metadata or {}
    return [{"text": t, "metadata": meta} for t in texts if t.strip()]