"""RAG chat router — SSE streaming conversation."""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.models import Course
from app.services.rag import rag_chat_stream

router = APIRouter(tags=["chat"])


@router.get("/api/courses/{course_id}/chat")
async def chat(
    course_id: str,
    q: str = Query(..., description="用户问题"),
    db: Session = Depends(get_db),
):
    """Streaming RAG chat — returns SSE (Server-Sent Events)."""
    # Validate course exists
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    return StreamingResponse(
        rag_chat_stream(course_id, q, db),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )