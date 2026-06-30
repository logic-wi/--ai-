"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Markdown } from "@/components/markdown";
import {
  Course, getCourse,
  Document, listDocuments, deleteDocument, uploadDocument,
  Note, listNotes, generateNote as genNoteApi, deleteNote,
  Quiz, listQuizzes, generateQuiz as genQuizApi, deleteQuiz,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  sources?: { source: string; page: string; source_type: string; title: string }[];
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const STATUS_LABELS: Record<string, string> = {
  uploaded: "📤 已上传",
  parsing: "🔍 解析中...",
  parsed: "📝 已解析",
  vectorized: "✅ 已向量化",
  failed: "❌ 失败",
};

const TYPE_ICONS: Record<string, string> = {
  pptx: "🎞️",
  docx: "📄",
  pdf: "📕",
  md: "📝",
};

export default function CourseDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const courseId = params.id;

  const [course, setCourse] = useState<Course | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatingQuiz, setGeneratingQuiz] = useState(false);
  const [quizDialogOpen, setQuizDialogOpen] = useState(false);
  const [quizTypes, setQuizTypes] = useState({
    multiple_choice: true,
    true_false: true,
    fill_in_blank: true,
  });
  const [quizCount, setQuizCount] = useState(5);
  const [quizTitle, setQuizTitle] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatting, setChatting] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    try {
      const [courseData, docsData, notesData, quizData] = await Promise.all([
        getCourse(courseId),
        listDocuments(courseId),
        listNotes(courseId),
        listQuizzes(courseId),
      ]);
      setCourse(courseData);
      setDocuments(docsData.documents);
      setNotes(notesData.notes);
      setQuizzes(quizData.quizzes);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally { setLoading(false); }
  }, [courseId]);

  useEffect(() => {
    setLoading(true);
    setDocuments([]);
    setNotes([]);
    setQuizzes([]);
    setMessages([]);
    fetchData();
    const i = setInterval(fetchData, 5000);
    return () => clearInterval(i);
  }, [fetchData]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (!["pptx","docx","pdf","md"].includes(file.name.split(".").pop()?.toLowerCase()||"")) { setError("不支持的文件类型"); return; }
    setUploading(true); setError(null);
    try { const doc = await uploadDocument(courseId, file); setDocuments(p => [doc, ...p]); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : "上传失败"); }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  };

  const handleDelete = async (docId: string) => {
    if (!confirm("确定要删除？")) return;
    try { await deleteDocument(docId); setDocuments(p => p.filter(d => d.id !== docId)); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : "删除失败"); }
  };

  const handleGenerateNote = async () => {
    setGenerating(true); setError(null);
    try { const note = await genNoteApi(courseId, noteTitle||undefined); setNotes(p => [note, ...p]); setNoteTitle(""); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : "生成失败"); }
    finally { setGenerating(false); }
  };

  const handleDeleteNote = async (id: string) => {
    if (!confirm("确定要删除？")) return;
    try { await deleteNote(id); setNotes(p => p.filter(n => n.id !== id)); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : "删除失败"); }
  };

  const handleGenerateQuiz = async () => {
    const types = Object.entries(quizTypes).filter(([,v])=>v).map(([k])=>k);
    if (types.length===0) return;
    setGeneratingQuiz(true); setError(null);
    try { const quiz = await genQuizApi(courseId, { question_count: quizCount, types, title: quizTitle||undefined }); setQuizzes(p => [quiz, ...p]); setQuizDialogOpen(false); setQuizTitle(""); setQuizCount(5); setQuizTypes({multiple_choice:true,true_false:true,fill_in_blank:true}); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : "生成失败"); }
    finally { setGeneratingQuiz(false); }
  };

  const handleDeleteQuiz = async (id: string) => {
    if (!confirm("确定要删除？")) return;
    try { await deleteQuiz(id); setQuizzes(p => p.filter(q => q.id !== id)); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : "删除失败"); }
  };

  const handleChatSend = async () => {
    if (!chatInput.trim() || chatting) return;
    const question = chatInput.trim(); setChatInput(""); setChatting(true); setError(null);
    setMessages(p => [...p, { role: "user", content: question }]);
    setMessages(p => [...p, { role: "assistant", content: "", sources: [] }]);
    const url = `${API_BASE}/api/courses/${courseId}/chat?q=${encodeURIComponent(question)}`;
    const resp = await fetch(url);
    if (!resp.ok) { setError("对话失败"); setChatting(false); return; }
    const reader = resp.body?.getReader(); if (!reader) { setChatting(false); return; }
    const dec = new TextDecoder(); let buf = "";
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n"); buf = lines.pop() || "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const ev = JSON.parse(line.slice(6));
          if (ev.type === "sources") setMessages(p => { const c = [...p]; if (c.length) c[c.length-1] = {...c[c.length-1], sources: ev.sources}; return c; });
          else if (ev.type === "text") setMessages(p => { const c = [...p]; if (c.length) c[c.length-1] = {...c[c.length-1], content: c[c.length-1].content + ev.content}; return c; });
          else if (ev.type === "error") setError(ev.message);
        } catch {}
      }
    }
    setChatting(false);
  };

  const formatSize = (b: number) => b<1024?`${b}B`:b<1024*1024?`${(b/1024).toFixed(1)}KB`:`${(b/1024/1024).toFixed(1)}MB`;

  if (loading) return <div className="flex flex-col flex-1 p-6 md:p-10 max-w-5xl mx-auto w-full"><div className="text-center text-muted-foreground py-20">加载中...</div></div>;

  return (
    <div className="flex flex-col flex-1 p-6 md:p-10 max-w-5xl mx-auto w-full">
      <button className="text-sm text-muted-foreground hover:text-foreground mb-4 flex items-center gap-1" onClick={() => router.push("/")}>← 返回课程列表</button>
      <div className="mb-8"><h1 className="text-3xl font-bold tracking-tight">{course?.name}</h1><p className="text-muted-foreground mt-1">{course?.description||"暂无描述"}</p></div>
      {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}<button className="ml-2 underline" onClick={()=>setError(null)}>关闭</button></div>}

      {/* Documents */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4"><h2 className="text-xl font-semibold">📄 文档 ({documents.length})</h2></div>
        <input ref={fileInputRef} type="file" accept=".pptx,.docx,.pdf,.md" onChange={handleUpload} className="hidden"/>
        <div className="flex items-center gap-4 mb-4"><Button onClick={()=>fileInputRef.current?.click()} disabled={uploading}>{uploading?"上传中...":"📤 上传文档"}</Button><span className="text-xs text-muted-foreground">.pptx, .docx, .pdf, .md (≤50MB)</span></div>
        {uploading && <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground"><div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>解析+向量化中...</div>}
        {documents.length===0 ? <div className="text-center py-8 text-muted-foreground border border-dashed rounded-xl"><p>还没有文档</p></div> :
          <div className="space-y-2">{documents.map(doc=><Card key={doc.id} className="hover:shadow-sm"><CardContent className="p-4 flex items-center justify-between"><div className="flex items-center gap-3 min-w-0"><span className="text-xl shrink-0">{TYPE_ICONS[doc.file_type]||"📁"}</span><div className="min-w-0"><p className="font-medium truncate">{doc.original_filename}</p><div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5"><span>{formatSize(doc.file_size)}</span><span>·</span><span className={doc.status==="failed"?"text-red-500":""}>{STATUS_LABELS[doc.status]||doc.status}</span>{doc.chunk_count>0&&<><span>·</span><span>{doc.chunk_count}分块</span></>}</div></div></div><button className="text-red-400 hover:text-red-600 text-sm shrink-0 ml-4" onClick={()=>handleDelete(doc.id)}>删除</button></CardContent></Card>)}</div>}
      </div>

      {/* Chat */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">💬 AI 伴学对话</h2>
        <Card><CardContent className="p-0">
          <div className="h-80 overflow-y-auto p-4 space-y-3 bg-muted/30">
            {messages.length===0 ? <div className="text-center py-12 text-muted-foreground"><p className="mb-1">开始对话，基于课程资料回答</p><p className="text-xs">示例：什么是监督学习？</p></div> :
              messages.map((msg,i)=><div key={i} className={`flex ${msg.role==="user"?"justify-end":"justify-start"}`}><div className={`max-w-[80%] rounded-lg px-4 py-2 ${msg.role==="user"?"bg-blue-500 text-white":"bg-white border shadow-sm"}`}>{msg.role==="assistant"&&msg.content?<div className="prose prose-sm max-w-none text-sm"><Markdown>{msg.content}</Markdown></div>:msg.role==="assistant"&&chatting?<span className="text-muted-foreground text-sm">思考中...</span>:msg.role==="user"?<p className="text-sm whitespace-pre-wrap">{msg.content}</p>:null}{msg.sources&&msg.sources.length>0&&<div className="mt-2 pt-2 border-t border-gray-100 text-xs text-muted-foreground">📖 {msg.sources.map((s,j)=><span key={j}>{s.source}{s.source_type==="slide"&&s.page?` 第${s.page}页`:s.page?` 第${s.page}页`:""}{j<msg.sources!.length-1?"、":""}</span>)}</div>}</div></div>)}
            <div ref={chatEndRef}/>
          </div>
          <div className="flex items-center gap-2 p-3 border-t"><Input placeholder="输入问题..." value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleChatSend()} disabled={chatting} className="flex-1"/><Button onClick={handleChatSend} disabled={!chatInput.trim()||chatting}>{chatting?"...":"发送"}</Button></div>
        </CardContent></Card>
      </div>

      {/* Quiz */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4"><h2 className="text-xl font-semibold">📝 复习习题</h2>
          <Dialog open={quizDialogOpen} onOpenChange={setQuizDialogOpen}>
            <DialogTrigger><Button disabled={documents.length===0}>✨ 生成习题</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>出题设置</DialogTitle>
                <DialogDescription>选择题型、数量和标题</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium mb-2 block">标题（可选）</Label>
                  <Input placeholder="如：第一章复习题" value={quizTitle} onChange={e=>setQuizTitle(e.target.value)} />
                </div>
                <div>
                  <Label className="text-sm font-medium mb-2 block">题目数量</Label>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={()=>setQuizCount(c=>Math.max(1,c-1))} disabled={quizCount<=1}>-</Button>
                    <span className="w-8 text-center font-semibold">{quizCount}</span>
                    <Button variant="outline" size="sm" onClick={()=>setQuizCount(c=>Math.min(30,c+1))} disabled={quizCount>=30}>+</Button>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium mb-2 block">题型</Label>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox checked={quizTypes.multiple_choice} onChange={e=>setQuizTypes(p=>({...p,multiple_choice:e.target.checked}))} />
                      <span>选择题</span>
                    </Label>
                    <Label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox checked={quizTypes.true_false} onChange={e=>setQuizTypes(p=>({...p,true_false:e.target.checked}))} />
                      <span>判断题</span>
                    </Label>
                    <Label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox checked={quizTypes.fill_in_blank} onChange={e=>setQuizTypes(p=>({...p,fill_in_blank:e.target.checked}))} />
                      <span>填空题</span>
                    </Label>
                  </div>
                </div>
              </div>
              <DialogFooter showCloseButton>
                <Button onClick={handleGenerateQuiz} disabled={!(quizTypes.multiple_choice||quizTypes.true_false||quizTypes.fill_in_blank)}>{generatingQuiz?"生成中...":"🚀 开始生成"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        {generatingQuiz && <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground"><div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin"/>AI 正在出题...</div>}
        {quizzes.length===0?<div className="text-center py-8 text-muted-foreground border border-dashed rounded-xl"><p className="mb-2">还没有习题</p><p className="text-xs">上传文档后点击「生成习题」</p></div>:
          <div className="space-y-2">{quizzes.map(quiz=><Card key={quiz.id} className="hover:shadow-sm"><CardContent className="p-4 flex items-center justify-between"><div><p className="font-medium">{quiz.title}</p><p className="text-xs text-muted-foreground mt-1">{quiz.questions.length} 道题 · {new Date(quiz.created_at).toLocaleString("zh-CN")}</p></div><div className="flex items-center gap-2"><Button variant="outline" size="sm" onClick={()=>router.push(`/courses/${courseId}/quiz/${quiz.id}`)}>开始答题</Button><button className="text-red-400 hover:text-red-600 text-sm" onClick={()=>handleDeleteQuiz(quiz.id)}>删除</button></div></CardContent></Card>)}</div>}
      </div>

      {/* Notes */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4"><h2 className="text-xl font-semibold">🤖 AI 笔记 ({notes.length})</h2><div className="flex items-center gap-2"><Input placeholder="标题(可选)" value={noteTitle} onChange={e=>setNoteTitle(e.target.value)} className="w-40"/><Button onClick={handleGenerateNote} disabled={generating||documents.length===0}>{generating?"生成中...":"✨ 生成笔记"}</Button></div></div>
        {generating && <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground"><div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"/>AI 正在分析...</div>}
        {notes.length===0?<div className="text-center py-8 text-muted-foreground border border-dashed rounded-xl"><p className="mb-2">还没有 AI 笔记</p><p className="text-xs">上传文档后点击「生成笔记」</p></div>:
          <div className="space-y-2">{notes.map(note=><Card key={note.id} className="hover:shadow-sm"><CardContent className="p-4"><div className="flex items-center justify-between mb-2"><h3 className="font-semibold">{note.title}</h3><div className="flex items-center gap-2"><Dialog><DialogTrigger><Button variant="outline" size="sm">查看</Button></DialogTrigger><DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto"><DialogHeader><DialogTitle>{note.title}</DialogTitle></DialogHeader><div className="prose prose-sm max-w-none mt-4"><Markdown>{note.content}</Markdown></div></DialogContent></Dialog><button className="text-red-400 hover:text-red-600 text-sm" onClick={()=>handleDeleteNote(note.id)}>删除</button></div></div><p className="text-xs text-muted-foreground">{new Date(note.created_at).toLocaleString("zh-CN")}{note.source_document_ids&&` · 基于 ${note.source_document_ids.length} 份文档`}</p></CardContent></Card>)}</div>}
      </div>
    </div>
  );
}