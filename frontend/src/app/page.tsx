"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Course, CourseCreatePayload, createCourse, deleteCourse, listCourses } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function Home() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create dialog state
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listCourses();
      setCourses(data.courses);
      setTotal(data.total);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const payload: CourseCreatePayload = { name: newName.trim() };
      if (newDesc.trim()) payload.description = newDesc.trim();
      await createCourse(payload);
      setNewName("");
      setNewDesc("");
      setOpen(false);
      await fetchCourses();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "创建失败");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除该课程及其所有资料吗？")) return;
    try {
      await deleteCourse(id);
      await fetchCourses();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "删除失败");
    }
  };

  return (
    <div className="flex flex-col flex-1 p-6 md:p-10 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">📚 AI 智能学习助手</h1>
          <p className="text-muted-foreground mt-1">
            按课程管理你的学习资料，AI 帮你做笔记、出题、对话
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger>
            <Button>+ 新建课程</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>创建新课程</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <Label htmlFor="course-name">课程名称 *</Label>
                <Input
                  id="course-name"
                  placeholder="例如：线性代数"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                />
              </div>
              <div>
                <Label htmlFor="course-desc">课程描述</Label>
                <Textarea
                  id="course-desc"
                  placeholder="例如：大学线性代数课程"
                  rows={3}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                />
              </div>
              <Button
                className="w-full"
                onClick={handleCreate}
                disabled={!newName.trim() || creating}
              >
                {creating ? "创建中..." : "创建课程"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
          <button className="ml-2 underline" onClick={() => setError(null)}>
            关闭
          </button>
        </div>
      )}

      {/* Course List */}
      {loading ? (
        <div className="text-center text-muted-foreground py-20">加载中...</div>
      ) : courses.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-muted-foreground text-lg mb-4">还没有课程，创建第一个吧！</p>
          <Button onClick={() => setOpen(true)}>+ 新建课程</Button>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground mb-4">
            共 {total} 门课程
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <Card key={course.id} className="hover:shadow-md transition-shadow cursor-pointer">
                <Link href={`/courses/${course.id}`} className="block">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center justify-between">
                    <span className="truncate">{course.name}</span>
                    <button
                      className="text-red-400 hover:text-red-600 text-sm font-normal ml-2 shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(course.id);
                      }}
                      title="删除课程"
                    >
                      删除
                    </button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                    {course.description || "暂无描述"}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>📄 {course.document_count} 份资料</span>
                    <span>·</span>
                    <span>{new Date(course.created_at).toLocaleDateString("zh-CN")}</span>
                  </div>
                </CardContent>
                </Link>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}