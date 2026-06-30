"""
Document upload, list, and delete router.
POST /api/courses/{course_id}/documents/upload  — upload & auto-process
GET  /api/courses/{course_id}/documents         — list documents
GET  /api/documents/{doc_id}                    — get single document
DELETE /api/documents/{doc_id}                  — delete document
"""

import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.database import get_db
from app.models.models import Course, Document, DocumentStatus
from app.schemas.schemas import DocumentResponse, DocumentListResponse
from app.services.document_parser import parse_document, PARSER_MAP
from app.services.chunking import chunk_document
from app.services.embedding import EmbeddingService
from app.services.vector_store import VectorStore

router = APIRouter(tags=["documents"])

settings = get_settings()
ALLOWED_EXTENSIONS = {"pptx", "docx", "pdf", "md"}


# ---------------------------------------------------------------------------
# POST /api/courses/{course_id}/documents/upload
# ---------------------------------------------------------------------------
@router.post("/api/courses/{course_id}/documents/upload", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    course_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    # 1. Validate course exists
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    # 2. Validate file extension
    original_name = file.filename or "unknown"
    ext = original_name.rsplit(".", 1)[-1].lower() if "." in original_name else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type .{ext}. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    # 3. Save file to disk
    upload_dir = Path(settings.UPLOAD_DIR) / course_id
    upload_dir.mkdir(parents=True, exist_ok=True)
    stored_filename = f"{uuid.uuid4().hex}_{original_name}"
    file_path = upload_dir / stored_filename

    content = await file.read()
    file_size = len(content)

    if file_size > settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"File exceeds {settings.MAX_UPLOAD_SIZE_MB}MB limit")

    with open(file_path, "wb") as f:
        f.write(content)

    # 4. Create Document record → parsing
    doc = Document(
        course_id=course_id,
        filename=stored_filename,
        original_filename=original_name,
        file_type=ext,
        file_size=file_size,
        status=DocumentStatus.PARSING,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    # 5. Parse document
    try:
        parsed_chunks = parse_document(content, ext)
        full_text = "\n\n".join(c.text for c in parsed_chunks)

        doc.parsed_content = full_text
        doc.status = DocumentStatus.PARSED
        db.commit()
    except Exception as e:
        doc.status = DocumentStatus.FAILED
        doc.error_message = f"Parse error: {str(e)}"
        db.commit()
        raise HTTPException(status_code=500, detail=f"Document parsing failed: {str(e)}")

    # 6. Chunk + Embed + Vectorize
    try:
        embed_svc = EmbeddingService()
        vector_store = VectorStore()

        all_chunks = []
        for pc in parsed_chunks:
            sub_chunks = chunk_document(pc.text, metadata={
                "document_id": doc.id,
                "course_id": course_id,
                "source": original_name,
                "page": pc.page,
                "title": pc.title,
                "source_type": pc.source_type,
            })
            all_chunks.extend(sub_chunks)

        if all_chunks:
            texts = [c["text"] for c in all_chunks]
            embeddings = embed_svc.embed(texts)
            vector_store.add_chunks(course_id, all_chunks, embeddings)

        doc.chunk_count = len(all_chunks)
        doc.status = DocumentStatus.VECTORIZED
        db.commit()
        db.refresh(doc)
    except Exception as e:
        # Document is parsed but vectorization failed — set to PARSED with error note
        doc.status = DocumentStatus.PARSED
        doc.error_message = f"Vectorization error: {str(e)}"
        db.commit()
        # Don't fail the whole upload — return what we have
        return _to_response(doc)

    return _to_response(doc)


# ---------------------------------------------------------------------------
# GET /api/courses/{course_id}/documents — list documents for a course
# ---------------------------------------------------------------------------
@router.get("/api/courses/{course_id}/documents", response_model=DocumentListResponse)
def list_documents(course_id: str, db: Session = Depends(get_db)):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    docs = db.query(Document).filter(Document.course_id == course_id).order_by(Document.created_at.desc()).all()
    return DocumentListResponse(
        documents=[_to_response(d) for d in docs],
        total=len(docs),
    )


# ---------------------------------------------------------------------------
# GET /api/documents/{doc_id} — get single document
# ---------------------------------------------------------------------------
@router.get("/api/documents/{doc_id}", response_model=DocumentResponse)
def get_document(doc_id: str, db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return _to_response(doc)


# ---------------------------------------------------------------------------
# DELETE /api/documents/{doc_id} — delete document
# ---------------------------------------------------------------------------
@router.delete("/api/documents/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(doc_id: str, db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Delete file from disk
    file_path = Path(settings.UPLOAD_DIR) / doc.course_id / doc.filename
    if file_path.exists():
        os.remove(file_path)

    db.delete(doc)
    db.commit()


# ---------------------------------------------------------------------------
def _to_response(doc: Document) -> DocumentResponse:
    return DocumentResponse(
        id=doc.id,
        course_id=doc.course_id,
        filename=doc.filename,
        original_filename=doc.original_filename,
        file_type=doc.file_type,
        file_size=doc.file_size,
        status=doc.status.value if hasattr(doc.status, "value") else doc.status,
        chunk_count=doc.chunk_count,
        error_message=doc.error_message,
        created_at=doc.created_at,
    )