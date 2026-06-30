"""
AI Note generation — orchestrates: collect parsed content → LLM → save to DB.
"""

from sqlalchemy.orm import Session
from app.models.models import Course, Document, Note
from app.services.llm import LLMService
from app.services.prompts import NOTE_GEN_SYSTEM, NOTE_GEN_USER


MAX_CONTENT_CHARS = 12000  # truncate to avoid token overflow


def generate_note(course_id: str, title: str, db: Session) -> Note:
    """
    Generate a structured note for a course.
    - Collects parsed content from all vectorized/parsed documents.
    - Calls LLM with the note-generation prompt.
    - Saves the Markdown result into the Note table.
    """
    # 1. Collect content from documents in this course
    docs = db.query(Document).filter(
        Document.course_id == course_id,
        Document.status.in_(["parsed", "vectorized"]),
    ).all()

    if not docs:
        raise ValueError("No parsed documents found in this course. Upload and parse documents first.")

    # Build combined content with source labels
    content_parts: list[str] = []
    doc_ids: list[str] = []
    total_chars = 0

    for doc in docs:
        text = doc.parsed_content or ""
        if not text.strip():
            continue
        doc_ids.append(doc.id)
        header = f"\n\n---\n来源: {doc.original_filename}\n---\n\n"
        remaining = MAX_CONTENT_CHARS - total_chars - len(header)
        if remaining <= 0:
            break
        content_parts.append(header + text[:remaining])
        total_chars += len(header) + min(len(text), remaining)

    course = db.query(Course).filter(Course.id == course_id).first()

    # 2. Call LLM
    llm = LLMService()
    user_prompt = NOTE_GEN_USER.format(
        course_name=course.name if course else "unknown",
        content="\n".join(content_parts),
    )
    markdown_result = llm.chat(system_prompt=NOTE_GEN_SYSTEM, user_prompt=user_prompt)

    # 3. Save to DB
    note = Note(
        course_id=course_id,
        title=title,
        content=markdown_result,
        source_document_ids=doc_ids,
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return note