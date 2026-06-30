"""
Course CRUD router — create, list, get, update, delete.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional

from app.db.database import get_db
from app.models.models import User, Course, Document
from app.schemas.schemas import (
    CourseCreate, CourseUpdate, CourseResponse, CourseListResponse,
)

router = APIRouter(prefix="/api/courses", tags=["courses"])


# ---------------------------------------------------------------------------
# Helper – get or auto-create a default user (simplified single-user mode)
# ---------------------------------------------------------------------------
def _get_or_create_default_user(db: Session) -> User:
    user = db.query(User).filter(User.username == "default").first()
    if not user:
        user = User(username="default", email="default@example.com")
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


# ---------------------------------------------------------------------------
# POST /api/courses — create a course
# ---------------------------------------------------------------------------
@router.post("/", response_model=CourseResponse, status_code=status.HTTP_201_CREATED)
def create_course(payload: CourseCreate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == payload.user_id).first() if payload.user_id else None
    if user is None:
        user = _get_or_create_default_user(db)

    course = Course(
        user_id=user.id,
        name=payload.name,
        description=payload.description or "",
    )
    db.add(course)
    db.commit()
    db.refresh(course)

    return _to_response(course, db)


# ---------------------------------------------------------------------------
# GET /api/courses — list all courses (with document_count)
# ---------------------------------------------------------------------------
@router.get("/", response_model=CourseListResponse)
def list_courses(
    user_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    query = db.query(Course)
    if user_id:
        query = query.filter(Course.user_id == user_id)

    total = query.count()
    courses = query.order_by(Course.updated_at.desc()).offset(skip).limit(limit).all()

    return CourseListResponse(
        courses=[_to_response(c, db) for c in courses],
        total=total,
    )


# ---------------------------------------------------------------------------
# GET /api/courses/{id} — get a single course
# ---------------------------------------------------------------------------
@router.get("/{course_id}", response_model=CourseResponse)
def get_course(course_id: str, db: Session = Depends(get_db)):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return _to_response(course, db)


# ---------------------------------------------------------------------------
# PATCH /api/courses/{id} — update a course
# ---------------------------------------------------------------------------
@router.patch("/{course_id}", response_model=CourseResponse)
def update_course(course_id: str, payload: CourseUpdate, db: Session = Depends(get_db)):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    if payload.name is not None:
        course.name = payload.name
    if payload.description is not None:
        course.description = payload.description

    db.commit()
    db.refresh(course)
    return _to_response(course, db)


# ---------------------------------------------------------------------------
# DELETE /api/courses/{id} — delete a course
# ---------------------------------------------------------------------------
@router.delete("/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_course(course_id: str, db: Session = Depends(get_db)):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    db.delete(course)
    db.commit()


# ---------------------------------------------------------------------------
# Build response with computed document_count
# ---------------------------------------------------------------------------
def _to_response(course: Course, db: Session) -> CourseResponse:
    doc_count = db.query(Document).filter(Document.course_id == course.id).count()
    return CourseResponse(
        id=course.id,
        user_id=course.user_id,
        name=course.name,
        description=course.description,
        document_count=doc_count,
        created_at=course.created_at,
        updated_at=course.updated_at,
    )