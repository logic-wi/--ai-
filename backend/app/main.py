"""
FastAPI application entry point.
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import get_settings
from app.db.database import init_db
from app.routers import courses, documents, notes, chat, quizzes

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="AI Study Assistant API",
    version="0.1.0",
    description="Backend API for the AI-powered study & review assistant.",
    lifespan=lifespan,
)

# CORS — allow Next.js dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(courses.router)
app.include_router(documents.router)
app.include_router(notes.router)
app.include_router(chat.router)
app.include_router(quizzes.router)


@app.get("/api/health")
def health_check():
    return {"status": "ok", "version": "0.1.0"}