# AI 智能学习助手

基于 RAG（检索增强生成）的智能学习平台。上传课件文档后，AI 自动解析内容并支持：结构化笔记生成、自定义习题生成、课程问答对话。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Next.js 16 + React 19 + Tailwind CSS 4 + shadcn/ui |
| 后端 | FastAPI (Python 3.10+) + SQLAlchemy + Pydantic |
| 向量数据库 | ChromaDB |
| 文档解析 | pdfplumber / python-pptx / python-docx |
| AI 对话 | DeepSeek (OpenAI 兼容接口) |
| AI 嵌入 | 硅基流动 Qwen3-Embedding-8B |
| LaTeX 渲染 | KaTeX + remark-math + rehype-katex |

## 项目结构

```
class/
├── backend/                  # FastAPI 后端
│   ├── app/
│   │   ├── core/config.py    # 配置（自动读取 .env）
│   │   ├── db/database.py    # 数据库连接 & 初始化
│   │   ├── models/models.py  # ORM 模型（User/Course/Document/Note/Quiz）
│   │   ├── routers/          # API 路由
│   │   │   ├── courses.py    # 课程 CRUD
│   │   │   ├── documents.py  # 文档上传 & 解析 & 向量化
│   │   │   ├── notes.py      # AI 笔记生成
│   │   │   ├── quizzes.py    # AI 习题生成
│   │   │   └── chat.py       # RAG 对话（SSE 流式）
│   │   ├── schemas/schemas.py# Pydantic 请求/响应模型
│   │   └── services/         # 业务逻辑
│   │       ├── llm.py         # LLM 调用（DeepSeek）
│   │       ├── embedding.py   # 嵌入调用（硅基流动）
│   │       ├── vector_store.py# ChromaDB 向量存储
│   │       ├── document_parser.py # 多格式文档解析
│   │       ├── chunking.py    # 文本分块
│   │       ├── prompts.py     # AI Prompt 模板
│   │       ├── rag.py         # RAG 检索增强生成
│   │       ├── note_generator.py # 笔记生成编排
│   │       └── quiz_generator.py # 习题生成编排
│   ├── .env.example           # 环境变量模板
│   └── requirements.txt       # Python 依赖
├── frontend/                  # Next.js 前端
│   └── src/
│       ├── app/               # 页面路由
│       │   ├── page.tsx          # 首页（课程列表）
│       │   └── courses/[id]/     # 课程详情页（含对话/习题/笔记）
│       ├── components/        # UI 组件
│       │   ├── markdown.tsx      # Markdown + LaTeX 渲染
│       │   └── ui/               # shadcn/ui 组件
│       └── lib/api.ts         # 后端 API 调用封装
└── .gitignore
```

## 功能列表

| 功能 | 说明 |
|------|------|
| 📚 课程管理 | 创建/删除课程 |
| 📤 文档上传 | 支持 .pdf / .pptx / .docx / .md，自动解析 + 向量化 |
| 📝 AI 笔记生成 | 一键生成结构化学习笔记（Markdown + LaTeX） |
| ✏️ AI 习题生成 | 可选择题型（单选/判断/填空）、数量（1-30）和标题 |
| 💬 AI 伴学对话 | 基于课程文档的 RAG 问答，SSE 流式输出 |
| 📐 LaTeX 公式渲染 | 支持行内及块级数学公式显示 |

## 部署说明

### 环境要求

- Python 3.10+
- Node.js 20+
- Git

### 1. 克隆项目

```bash
git clone https://github.com/logic-wi/--ai-.git
cd class
```

### 2. 后端部署

```bash
cd backend

# 创建虚拟环境（推荐）
python -m venv .venv

# 激活虚拟环境
# Windows:
.venv\Scripts\activate
# macOS / Linux:
source .venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env
# 编辑 .env，填入 API 密钥：
#   LLM_API_KEY=sk-xxx      ← DeepSeek 密钥
#   EMBEDDING_API_KEY=sk-xxx ← 硅基流动密钥（注册即送免费额度）
#   LLM_BASE_URL=https://api.deepseek.com/v1
#   EMBEDDING_BASE_URL=https://api.siliconflow.cn/v1
#   EMBEDDING_MODEL=Qwen/Qwen3-Embedding-8B
#   LLM_MODEL=deepseek-chat

# 启动后端（默认 http://localhost:8000）
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 3. 前端部署

```bash
cd frontend

# 安装依赖
npm install

# 开发模式启动（默认 http://localhost:3000）
npm run dev

# 或构建生产版本
npm run build
npm start
```

### 4. 访问

- 前端页面：http://localhost:3000
- 后端 API 文档（自动生成）：http://localhost:8000/docs
- 健康检查：http://localhost:8000/api/health

## 使用说明

### 创建课程

1. 打开 http://localhost:3000
2. 点击「新建课程」，输入课程名称和描述

### 上传文档

1. 进入课程详情页
2. 点击「📤 上传文档」，选择 .pdf / .pptx / .docx / .md 文件
3. 系统自动解析 → 生成嵌入向量 → 存储到向量数据库
4. 等待状态变为「✅ 已向量化」

### 生成笔记

1. 可选填标题（留空则默认"课程笔记"）
2. 点击「✨ 生成笔记」
3. AI 会读取课程文档内容，自动生成结构化笔记（含 Markdown / LaTeX 公式）
4. 点击「查看」阅读完整笔记

### 生成习题

1. 点击「✨ 生成习题」，弹出设置窗口
2. 填写标题（可选）、调节题目数量（默认5道）
3. 勾选需要的题型：选择题 / 判断题 / 填空题
4. 点击「🚀 开始生成」
5. 生成后点击「开始答题」进入答题页，提交后自动评分

### AI 对话

1. 在对话输入框输入问题
2. 按 Enter 或点击「发送」
3. AI 会根据课程文档内容回答，引用来源标注页码
4. 数学公式自动渲染为 LaTeX

## API 密钥获取

| 服务 | 用途 | 获取地址 | 免费额度 |
|------|------|----------|----------|
| DeepSeek | AI 对话 & 内容生成 | https://platform.deepseek.com | 注册赠送 |
| 硅基流动 | 文本嵌入（向量化） | https://siliconflow.cn | 注册赠送 |

## 常见问题

**Q: 点击生成无反应？**
- 确认后端已正常启动（端口 8000）
- 确认 .env 中 API 密钥已填写
- 确认已上传文档且状态为「✅ 已向量化」

**Q: LaTeX 公式不显示？**
- 确认已安装 latest 依赖（`npm install`）
- 确认后端 prompt 要求 AI 用 `$...$` / `$$...$$` 包裹公式

**Q: 切换课程后笔记/习题串了？**
- 已修复：切换课程时前端会清空旧数据，重新拉取
- 后端所有列表接口均已按 course_id 隔离