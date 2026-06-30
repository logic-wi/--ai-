"use client";

import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

export function Markdown({ children }: { children: string }) {
  // AI outputs various non-standard LaTeX delimiters.
  // Convert them all to standard $$...$$ / $...$ for remark-math.
  let processed = children
    // 1) \[ ... \] → $$...$$ （标准 LaTeX display）
    .replace(/\\\[([\s\S]*?)\\\]/g, "$$$$\n$1\n$$$$")
    // 2) [ \frac... ] → $$...$$ （DeepSeek 裸方括号 display math）
    .replace(/\[\s*(\\[\s\S]*?)\s*\]/g, "$$$$\n$1\n$$$$")
    // 3) \( ... \) → $...$ （标准 LaTeX inline）
    .replace(/\\\(([\s\S]*?)\\\)/g, "$$$1$$");

  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath]}
      rehypePlugins={[[rehypeKatex, { strict: false, throwOnError: false }]]}
    >
      {processed}
    </ReactMarkdown>
  );
}