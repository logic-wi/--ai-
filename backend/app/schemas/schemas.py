"""
Pydantic schemas for API request/response validation.
"""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


# =============================================================================
# User
# =============================================================================
class UserCreate(BaseModel):
    username: str = Field(..., min_length=1, max_length=100)
    email: Optional[str] = None


class UserResponse(BaseModel):
    id: str
    username: str
    email: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


# =============================================================================
# Course
# =============================================================================
class CourseCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: str = ""
    user_id: Optional[str] = None  # auto-create default user if omitted


class CourseUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class CourseResponse(BaseModel):
    id: str
    user_id: str
    name: str
    description: str
    document_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CourseListResponse(BaseModel):
    courses: List[CourseResponse]
    total: int


# =============================================================================
# Document
# =============================================================================
class DocumentResponse(BaseModel):
    id: str
    course_id: str
    filename: str
    original_filename: str
    file_type: str
    file_size: int
    status: str
    chunk_count: int
    error_message: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class DocumentListResponse(BaseModel):
    documents: List[DocumentResponse]
    total: int


# =============================================================================
# Note
# =============================================================================
class NoteResponse(BaseModel):
    id: str
    course_id: str
    title: str
    content: str
    source_document_ids: Optional[List[str]] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class NoteListResponse(BaseModel):
    notes: List[NoteResponse]
    total: int


# =============================================================================
# Quiz
# =============================================================================
class QuizQuestion(BaseModel):
    type: str  # multiple_choice, true_false, fill_in_blank
    question: str
    options: Optional[List[str]] = None       # for multiple_choice
    correct_answer: str
    explanation: Optional[str] = None


class QuizGenerateRequest(BaseModel):
    course_id: str
    document_ids: Optional[List[str]] = None   # specify documents or use all
    question_count: int = Field(default=5, ge=1, le=30)
    types: List[str] = ["multiple_choice", "true_false", "fill_in_blank"]


class QuizResponse(BaseModel):
    id: str
    course_id: str
    title: str
    questions: List[dict]
    source_document_ids: Optional[List[str]] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class QuizListResponse(BaseModel):
    quizzes: List[QuizResponse]
    total: int