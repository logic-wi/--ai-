"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Quiz, QuizQuestion, getQuiz } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Markdown } from "@/components/markdown";

export default function QuizPage() {
  const params = useParams<{ id: string; quizId: string }>();
  const router = useRouter();
  const { id: courseId, quizId } = params;

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Answer tracking
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(null);

  useEffect(() => {
    getQuiz(quizId)
      .then(setQuiz)
      .catch(e => setError(e instanceof Error ? e.message : "加载失败"))
      .finally(() => setLoading(false));
  }, [quizId]);

  const handleAnswer = (idx: number, value: string) => {
    if (submitted) return;
    setAnswers(prev => ({ ...prev, [idx]: value }));
  };

  const handleSubmit = () => {
    if (!quiz) return;
    let correct = 0;
    quiz.questions.forEach((q, i) => {
      if ((answers[i] || "").trim().toLowerCase() === q.correct_answer.trim().toLowerCase()) correct++;
    });
    setScore(correct);
    setSubmitted(true);
  };

  const isCorrect = (q: QuizQuestion, idx: number) => {
    if (!submitted) return null;
    return (answers[idx] || "").trim().toLowerCase() === q.correct_answer.trim().toLowerCase();
  };

  if (loading) return (
    <div className="flex flex-col flex-1 p-6 max-w-3xl mx-auto w-full">
      <div className="text-center py-20 text-muted-foreground">加载习题中...</div>
    </div>
  );

  if (error || !quiz) return (
    <div className="flex flex-col flex-1 p-6 max-w-3xl mx-auto w-full">
      <p className="text-red-500">{error || "习题不存在"}</p>
      <Button className="mt-4" onClick={() => router.back()}>返回</Button>
    </div>
  );

  return (
    <div className="flex flex-col flex-1 p-6 md:p-10 max-w-3xl mx-auto w-full">
      <button className="text-sm text-muted-foreground hover:text-foreground mb-4" onClick={() => router.back()}>
        ← 返回课程
      </button>

      <div className="mb-6">
        <h1 className="text-2xl font-bold">{quiz.title}</h1>
        <p className="text-muted-foreground text-sm mt-1">{quiz.questions.length} 道题</p>
      </div>

      {submitted && score !== null && (
        <div className={`mb-6 p-4 rounded-lg text-center font-semibold ${
          score === quiz.questions.length ? "bg-green-100 text-green-800" :
          score >= quiz.questions.length / 2 ? "bg-yellow-100 text-yellow-800" :
          "bg-red-100 text-red-800"
        }`}>
          得分: {score} / {quiz.questions.length}
          ({Math.round(score / quiz.questions.length * 100)}%)
        </div>
      )}

      <div className="space-y-6">
        {quiz.questions.map((q, idx) => (
          <Card key={idx} className={`${submitted ? (isCorrect(q, idx) ? "border-green-300 bg-green-50" : "border-red-300 bg-red-50") : ""}`}>
            <CardContent className="p-5">
              <div className="flex items-start gap-2 mb-3">
                <span className="text-sm font-bold text-muted-foreground shrink-0 mt-0.5">{idx + 1}.</span>
                <div>
                  <p className="font-medium">{q.question}</p>
                  <span className="text-xs text-muted-foreground uppercase">{q.type.replace("_", " ")}</span>
                </div>
              </div>

              {q.type === "multiple_choice" && q.options && (
                <div className="space-y-2 ml-6">
                  {q.options.map((opt, oi) => {
                    const letter = String.fromCharCode(65 + oi); // A, B, C, D
                    const selected = answers[idx] === letter;
                    const correct = q.correct_answer === letter;
                    return (
                      <button
                        key={oi}
                        className={`w-full text-left px-3 py-2 rounded-md border text-sm transition-colors ${
                          submitted
                            ? correct
                              ? "border-green-500 bg-green-100 font-semibold"
                              : selected && !correct
                                ? "border-red-500 bg-red-100"
                                : "border-gray-200"
                            : selected
                              ? "border-blue-500 bg-blue-50"
                              : "border-gray-200 hover:border-blue-300"
                        }`}
                        onClick={() => handleAnswer(idx, letter)}
                      >
                        {letter}. {opt}
                      </button>
                    );
                  })}
                </div>
              )}

              {q.type === "true_false" && (
                <div className="flex gap-3 ml-6">
                  {["True", "False"].map(val => {
                    const selected = answers[idx] === val;
                    return (
                      <button
                        key={val}
                        className={`px-5 py-2 rounded-md border text-sm ${
                          submitted
                            ? q.correct_answer === val
                              ? "border-green-500 bg-green-100 font-semibold"
                              : selected
                                ? "border-red-500 bg-red-100"
                                : "border-gray-200"
                            : selected
                              ? "border-blue-500 bg-blue-50"
                              : "border-gray-200 hover:border-blue-300"
                        }`}
                        onClick={() => handleAnswer(idx, val)}
                      >
                        {val === "True" ? "✅ 正确" : "❌ 错误"}
                      </button>
                    );
                  })}
                </div>
              )}

              {q.type === "fill_in_blank" && (
                <div className="ml-6">
                  <Input
                    placeholder="输入你的答案..."
                    value={answers[idx] || ""}
                    onChange={e => handleAnswer(idx, e.target.value)}
                    disabled={submitted}
                    className={submitted ? (isCorrect(q, idx) ? "border-green-500" : "border-red-500") : ""}
                  />
                </div>
              )}

              {submitted && q.explanation && (
                <div className="mt-3 ml-6 p-3 bg-blue-50 border border-blue-200 rounded-md text-sm">
                  <span className="font-semibold">解析：</span>
                  <Markdown>{q.explanation}</Markdown>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {!submitted ? (
        <Button className="mt-8 w-full" size="lg" onClick={handleSubmit} disabled={Object.keys(answers).length === 0}>
          提交答案
        </Button>
      ) : (
        <Button className="mt-8" variant="outline" onClick={() => router.back()}>
          返回课程
        </Button>
      )}
    </div>
  );
}