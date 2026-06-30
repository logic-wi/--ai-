"""
RAG — Retrieval-Augmented Generation.
Orchestrates: embed question → vector search → inject context → LLM stream.
"""

from sqlalchemy.orm import Session
from app.models.models import Course
from app.services.embedding import EmbeddingService
from app.services.vector_store import VectorStore
from app.services.llm import LLMService
from app.services.prompts import RAG_SYSTEM, RAG_USER


def build_rag_context(course_id: str, db: Session, query_embedding: list[float], top_k: int = 5) -> tuple[str, list[dict]]:
    """
    Retrieve top-k matching chunks from vector store and build context string.
    Returns: (context_text, source_chunks)
    """
    vector_store = VectorStore()
    chunks = vector_store.query(course_id, query_embedding, top_k=top_k)

    if not chunks:
        return "（该课程暂无资料，请先上传文档。）", []

    parts = []
    for i, c in enumerate(chunks):
        meta = c.get("metadata", {})
        source = meta.get("source", "未知")
        page = meta.get("page", "")
        src_type = meta.get("source_type", "")
        src_label = f"{source}"
        if src_type == "slide":
            src_label += f" 第{page}页"
        elif page:
            src_label += f" 第{page}页"
        parts.append(f"[来源{i+1}: {src_label}]\n{c['text']}")

    context = "\n\n---\n\n".join(parts)
    return context, chunks


def rag_chat_stream(
    course_id: str,
    question: str,
    db: Session,
    top_k: int = 5,
):
    """
    Streaming RAG chat generator.
    Yields SSE-formatted chunks: data: {"type": "text"|"sources"|"error"|"done", ...}
    """
    import json

    # 1. Embed the question
    try:
        embed_svc = EmbeddingService()
        query_emb = embed_svc.embed_single(question)
    except Exception as e:
        yield f"data: {json.dumps({'type': 'error', 'message': f'Embedding failed: {str(e)}'})}\n\n"
        return

    # 2. Build context
    context, source_chunks = build_rag_context(course_id, db, query_emb, top_k=top_k)

    # 3. Get course name
    course = db.query(Course).filter(Course.id == course_id).first()
    course_name = course.name if course else "unknown"

    # 4. Send sources first
    sources = []
    for c in source_chunks:
        meta = c.get("metadata", {})
        sources.append({
            "source": meta.get("source", "未知"),
            "page": meta.get("page", ""),
            "source_type": meta.get("source_type", ""),
            "title": meta.get("title", ""),
        })

    yield f"data: {json.dumps({'type': 'sources', 'sources': sources})}\n\n"

    # 5. Stream LLM response
    llm = LLMService()
    user_prompt = RAG_USER.format(
        course_name=course_name,
        context=context,
        question=question,
    )

    try:
        for text_chunk in llm.chat_stream(
            system_prompt=RAG_SYSTEM,
            user_prompt=user_prompt,
        ):
            yield f"data: {json.dumps({'type': 'text', 'content': text_chunk})}\n\n"
    except Exception as e:
        yield f"data: {json.dumps({'type': 'error', 'message': f'LLM failed: {str(e)}'})}\n\n"
        return

    # 6. Done
    yield f"data: {json.dumps({'type': 'done'})}\n\n"