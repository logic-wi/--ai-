"""
Notes router — generate, list, get, delete AI notes.
POST /api/courses/{course_id}/notes/generate  — trigger note generation
GET  /api/courses/{course_id}/notes           — list notes
GET  /api/notes/{note_id}                     — get single note
DELETE /api/notes/{note_id}                   — delete note
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.models import Course, Note
from app.schemas.schemas import NoteResponse, NoteListResponse
from app.services.note_generator import generate_note

router = APIRouter(tags=["notes"])


@router.post("/api/courses/{course_id}/notes/generate", response_model=NoteResponse, status_code=status.HTTP_201_CREATED)
def create_note(course_id: str, title: str = "课程笔记", db: Session = Depends(get_db)):
    """Generate an AI-powered structured note from all parsed documents in this course."""
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    try:
        note = generate_note(course_id, title, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Note generation failed: {str(e)}")

    return _to_response(note)


@router.get("/api/courses/{course_id}/notes", response_model=NoteListResponse)
def list_notes(course_id: str, db: Session = Depends(get_db)):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    notes = db.query(Note).filter(Note.course_id == course_id).order_by(Note.created_at.desc()).all()
    return NoteListResponse(
        notes=[_to_response(n) for n in notes],
        total=len(notes),
    )


@router.get("/api/notes/{note_id}", response_model=NoteResponse)
def get_note(note_id: str, db: Session = Depends(get_db)):
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    return _to_response(note)


@router.delete("/api/notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_note(note_id: str, db: Session = Depends(get_db)):
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    db.delete(note)
    db.commit()


def _to_response(note: Note) -> NoteResponse:
    return NoteResponse(
        id=note.id,
        course_id=note.course_id,
        title=note.title,
        content=note.content,
        source_document_ids=note.source_document_ids,
        created_at=note.created_at,
    )