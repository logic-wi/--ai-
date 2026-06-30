const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export type Course = {
  id: string;
  user_id: string;
  name: string;
  description: string;
  document_count: number;
  created_at: string;
  updated_at: string;
};

export type CourseListResponse = {
  courses: Course[];
  total: number;
};

export type CourseCreatePayload = {
  name: string;
  description?: string;
};

// ---- Document Types ----

export type Document = {
  id: string;
  course_id: string;
  filename: string;
  original_filename: string;
  file_type: string;
  file_size: number;
  status: string;
  chunk_count: number;
  error_message?: string;
  created_at: string;
};

export type DocumentListResponse = {
  documents: Document[];
  total: number;
};

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(
      typeof detail.detail === "string" ? detail.detail : JSON.stringify(detail.detail || detail)
    );
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ---- Courses ----

export function listCourses(params?: { skip?: number; limit?: number }) {
  const qs = new URLSearchParams();
  if (params?.skip != null) qs.set("skip", String(params.skip));
  if (params?.limit != null) qs.set("limit", String(params.limit));
  const suffix = qs.toString() ? `?${qs}` : "";
  return request<CourseListResponse>(`/api/courses/${suffix}`);
}

export function getCourse(id: string) {
  return request<Course>(`/api/courses/${id}`);
}

export function createCourse(payload: CourseCreatePayload) {
  return request<Course>("/api/courses/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateCourse(id: string, payload: Partial<CourseCreatePayload>) {
  return request<Course>(`/api/courses/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteCourse(id: string) {
  return request<void>(`/api/courses/${id}`, { method: "DELETE" });
}

// ---- Documents ----

export function listDocuments(courseId: string) {
  return request<DocumentListResponse>(`/api/courses/${courseId}/documents`);
}

export function getDocument(docId: string) {
  return request<Document>(`/api/documents/${docId}`);
}

export function deleteDocument(docId: string) {
  return request<void>(`/api/documents/${docId}`, { method: "DELETE" });
}

export function uploadDocument(courseId: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return request<Document>(`/api/courses/${courseId}/documents/upload`, {
    method: "POST",
    body: formData,
    headers: {},
  });
}

// ---- Notes ----

export type Note = {
  id: string;
  course_id: string;
  title: string;
  content: string;
  source_document_ids?: string[];
  created_at: string;
};

export type NoteListResponse = {
  notes: Note[];
  total: number;
};

export function generateNote(courseId: string, title?: string) {
  const qs = title ? `?title=${encodeURIComponent(title)}` : "";
  return request<Note>(`/api/courses/${courseId}/notes/generate${qs}`, {
    method: "POST",
  });
}

export function listNotes(courseId: string) {
  return request<NoteListResponse>(`/api/courses/${courseId}/notes`);
}

export function getNote(noteId: string) {
  return request<Note>(`/api/notes/${noteId}`);
}

export function deleteNote(noteId: string) {
  return request<void>(`/api/notes/${noteId}`, { method: "DELETE" });
}

// ---- Quizzes ----

export type Quiz = {
  id: string;
  course_id: string;
  title: string;
  questions: QuizQuestion[];
  source_document_ids?: string[];
  created_at: string;
};

export type QuizQuestion = {
  type: "multiple_choice" | "true_false" | "fill_in_blank";
  question: string;
  options?: string[];
  correct_answer: string;
  explanation?: string;
};

export type QuizListResponse = {
  quizzes: Quiz[];
  total: number;
};

export function generateQuiz(
  courseId: string,
  params?: { title?: string; question_count?: number; types?: string[]; document_ids?: string[] }
) {
  const qs = new URLSearchParams();
  if (params?.title) qs.set("title", params.title);
  if (params?.question_count) qs.set("question_count", String(params.question_count));
  if (params?.types) qs.set("types", params.types.join(","));
  if (params?.document_ids) qs.set("document_ids", params.document_ids.join(","));
  return request<Quiz>(`/api/courses/${courseId}/quizzes/generate?${qs}`, { method: "POST" });
}

export function listQuizzes(courseId: string) {
  return request<QuizListResponse>(`/api/courses/${courseId}/quizzes`);
}

export function getQuiz(quizId: string) {
  return request<Quiz>(`/api/quizzes/${quizId}`);
}

export function deleteQuiz(quizId: string) {
  return request<void>(`/api/quizzes/${quizId}`, { method: "DELETE" });
}