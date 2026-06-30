"""AI Quiz generation — collects parsed content, calls LLM, saves structured JSON."""

import json
import re
from sqlalchemy.orm import Session
from app.models.models import Course, Document, Quiz
from app.services.llm import LLMService
from app.services.prompts import QUIZ_SYSTEM, QUIZ_USER

MAX_CONTENT_CHARS = 10000


def generate_quiz(
    course_id: str,
    title: str,
    db: Session,
    document_ids: list[str] | None = None,
    question_count: int = 5,
    types: list[str] | None = None,
) -> Quiz:
    """Generate quiz questions from course documents, save to DB."""
    if types is None:
        types = ["multiple_choice", "true_false", "fill_in_blank"]

    query = db.query(Document).filter(
        Document.course_id == course_id,
        Document.status.in_(["parsed", "vectorized"]),
    )
    if document_ids:
        query = query.filter(Document.id.in_(document_ids))
    docs = query.all()

    if not docs:
        raise ValueError("No parsed documents found.")

    content_parts: list[str] = []
    used_doc_ids: list[str] = []
    total = 0
    for doc in docs:
        text = doc.parsed_content or ""
        if not text.strip():
            continue
        used_doc_ids.append(doc.id)
        content_parts.append(text)
        total += len(text)
        if total > MAX_CONTENT_CHARS:
            break

    course = db.query(Course).filter(Course.id == course_id).first()

    llm = LLMService()
    user_prompt = QUIZ_USER.format(
        course_name=course.name if course else "",
        question_count=question_count,
        types=", ".join(types),
        content="\n\n---\n\n".join(content_parts),
    )

    raw = llm.chat(system_prompt=QUIZ_SYSTEM, user_prompt=user_prompt, temperature=0.8)

    questions = _parse_questions(raw)

    quiz = Quiz(
        course_id=course_id,
        title=title,
        questions=questions,
        source_document_ids=used_doc_ids,
    )
    db.add(quiz)
    db.commit()
    db.refresh(quiz)
    return quiz


def _parse_questions(raw: str) -> list[dict]:
    """Extract JSON array from LLM output (handles markdown fences)."""
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass

    match = re.search(r"\[[\s\S]*\]", raw)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass

    match = re.search(r"```(?:json)?\s*([\s\S]*?)```", raw)
    if match:
        inner = match.group(1).strip()
        arr_match = re.search(r"\[[\s\S]*\]", inner)
        if arr_match:
            return json.loads(arr_match.group())
        return json.loads(inner)

    raise ValueError(f"Failed to parse quiz JSON: {raw[:300]}")