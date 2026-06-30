"""Quiz router — generate, list, get, delete quizzes."""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.models import Course, Quiz
from app.schemas.schemas import QuizResponse, QuizListResponse
from app.services.quiz_generator import generate_quiz

router = APIRouter(tags=["quizzes"])


@router.post("/api/courses/{course_id}/quizzes/generate", response_model=QuizResponse, status_code=status.HTTP_201_CREATED)
def create_quiz(
    course_id: str,
    title: str = Query(default="课程练习"),
    question_count: int = Query(default=5, ge=1, le=30),
    document_ids: str | None = Query(default=None, description="逗号分隔的文档 ID 列表"),
    types: str | None = Query(default=None, description="逗号分隔的题型列表"),
    db: Session = Depends(get_db),
):
    """Generate AI-powered quiz questions from course documents."""
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    doc_ids = [d.strip() for d in document_ids.split(",") if d.strip()] if document_ids else None
    type_list = [t.strip() for t in types.split(",") if t.strip()] if types else None

    try:
        quiz = generate_quiz(
            course_id=course_id,
            title=title,
            db=db,
            document_ids=doc_ids,
            question_count=question_count,
            types=type_list,
        )
        return _to_response(quiz)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Quiz generation failed: {str(e)}")


@router.get("/api/courses/{course_id}/quizzes", response_model=QuizListResponse)
def list_quizzes(course_id: str, db: Session = Depends(get_db)):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    quizzes = db.query(Quiz).filter(Quiz.course_id == course_id).order_by(Quiz.created_at.desc()).all()
    return QuizListResponse(quizzes=[_to_response(q) for q in quizzes], total=len(quizzes))


@router.get("/api/quizzes/{quiz_id}", response_model=QuizResponse)
def get_quiz(quiz_id: str, db: Session = Depends(get_db)):
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    return _to_response(quiz)


@router.delete("/api/quizzes/{quiz_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_quiz(quiz_id: str, db: Session = Depends(get_db)):
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    db.delete(quiz)
    db.commit()


def _to_response(quiz: Quiz) -> QuizResponse:
    return QuizResponse(
        id=quiz.id,
        course_id=quiz.course_id,
        title=quiz.title,
        questions=quiz.questions or [],
        source_document_ids=quiz.source_document_ids,
        created_at=quiz.created_at,
    )