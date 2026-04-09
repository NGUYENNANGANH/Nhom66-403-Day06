# Prototype — HR Copilot

## Mô tả

HR Copilot là chatbot AI nội bộ doanh nghiệp, sử dụng RAG (Retrieval-Augmented Generation) để tra cứu Sổ tay nhân viên và trả lời tức thì các câu hỏi về nghỉ phép, bảo hiểm, lương thưởng, onboarding. Mỗi câu trả lời kèm Citation trích dẫn tài liệu gốc — nhân viên click vào để kiểm chứng ngay.

Hệ thống bao gồm: chatbot cho nhân viên, dashboard cho HR admin (quản lý users, duyệt đơn phép, xem báo lỗi, thống kê), và correction flow (Báo lỗi → HR review → cập nhật knowledge base).

## Level: Working prototype

Prototype chạy thật end-to-end: nhân viên gõ câu hỏi → LangChain Agent chọn tool phù hợp → RAG truy xuất từ ChromaDB → GPT-4o-mini sinh câu trả lời kèm citation → hiển thị trên UI. Có xử lý cả out-of-domain, escalate to HR, xin nghỉ phép, tính ngày phép theo thâm niên.

## Links

- **Source code:** [GitHub — Nhom66-403-Day06](https://github.com/Nhom66-403-Day06) *(repo này)*
- **Backend:** `WebApp/backend/` — FastAPI server (port 8000)
- **Frontend:** `WebApp/frontend/` — Next.js app (port 3000)

## Tools & API

| Tool/API | Mục đích |
|----------|----------|
| Python FastAPI | Backend REST API server |
| LangChain + LangChain Classic | Agent framework, tool calling, prompt template |
| ChromaDB | Vector store cho RAG — lưu embeddings tài liệu HR |
| OpenAI GPT-4o-mini | LLM sinh câu trả lời (~$0.001/query, latency <2s) |
| OpenAI text-embedding-3-small | Embedding model cho vector search |
| MongoDB + PyMongo | Lưu users, chat logs, error reports, leave requests, notifications |
| Next.js 16 + React 19 | Frontend SPA — App Router, home page, chat UI, admin dashboard |
| TailwindCSS v4 | Styling framework — utility-first CSS |
| TypeScript 5 | Type-safe frontend development |
| Lucide React | Icon library cho UI components |
| Axios | HTTP client frontend → backend |
| Geist / Geist Mono | Font chính (Google Fonts qua next/font) |
| Cursor (AI IDE) | Hỗ trợ vibe-coding toàn bộ dự án |

## Phân công prototype

> Phân theo **chức năng end-to-end** — mỗi người sở hữu trọn vẹn 1 tính năng từ AI tool/prompt → backend API → frontend UI.
>
> **Chung cả nhóm:** Thu thập & chuẩn hóa mock data HR (4 file `.md` trong `data/`).

| Thành viên | Chức năng sở hữu | Phần AI | Output code |
|-----------|-------------------|---------|-------------|
| **Trịnh Kế Tiến** | **RAG Pipeline + Agent** | RAG indexing (chunk → embed → ChromaDB), tool `search_policy` (vector search top-3), LangChain AgentExecutor, citation extraction | `app.py`: `init_vector_store()`, `search_policy()`, agent setup, `/chat` endpoint, `/document/{filename}` |
| **Mai Phi Hiếu** | **Chat UI + Guardrail ngoài phạm vi** | Tool `reject_out_of_scope` (detect off-topic → cảnh báo "LỖI NGOÀI LUỒNG"), logic hiển thị khác nhau theo loại response AI (fallback đỏ / escalated vàng / bình thường) | `chat/page.tsx`: chat UI, dark mode, Citation Viewer Modal, suggested questions, `page.tsx`: home page với embedded chat |
| **Nguyễn Năng Anh** | **Xin nghỉ phép + Đánh giá câu trả lời** | Tool `submit_leave_request` (Agent tạo đơn phép qua chat), tool `calculate_leave` (tính phép theo thâm niên), chức năng Báo lỗi AI (correction path) | `app.py`: `submit_leave_request()`, `calculate_leave()`, `/report-error`, leave CRUD API, notifications. `chat/page.tsx`: UI nút "Báo lỗi". `admin/page.tsx`: tab Đơn phép |
| **Phạm Thanh Tùng** | **Auth + Admin Dashboard + Escalation** | Tool `escalate_to_hr` (tạo ticket chuyển HR), dashboard thống kê AI (biểu đồ tool usage, lượt chat/ngày, câu hỏi gần đây) | `app.py`: auth endpoints, admin endpoints, `escalate_to_hr()`, faq-stats pipeline. `login/page.tsx`, `register/page.tsx`, `admin/page.tsx`: tabs Tổng quan, Users, FAQ, Báo lỗi, Tài liệu |
| **Dương Phương Thảo** | **System Prompt + Data + Learning Signal** | Viết AGENT_SYSTEM_PROMPT (9 rules cho Agent), WELCOME_MESSAGE, SUGGESTED_QUESTIONS, thiết kế Correction Flow (Báo lỗi → DB → HR review → cập nhật KB) | `prompts.py`, `data/*.md` (4 file chính sách HR), test & iterate prompt qua nhiều phiên bản |

## Cấu trúc thư mục

```
Nhom66-403-Day06/
├── spec-final.md                    ← SPEC 6 phần + phân công
├── prototype-readme.md              ← File này
├── demo-slides.pdf                  ← Slide thuyết trình demo
├── data/                            ← Dữ liệu HR nội bộ (mock)
│   ├── chinh-sach-nghi-phep.md
│   ├── chinh-sach-bao-hiem.md
│   ├── chinh-sach-luong-thuong.md
│   └── quy-trinh-onboarding.md
└── WebApp/
    ├── backend/
    │   ├── app.py                   ← FastAPI + LangChain Agent + RAG
    │   ├── prompts.py               ← System prompt, welcome message
    │   ├── requirements.txt
    │   ├── .env.example
    │   └── chroma_db/               ← Vector store (auto-generated khi chạy)
    └── frontend/
        ├── package.json
        ├── tsconfig.json
        ├── next.config.ts
        ├── postcss.config.mjs
        ├── eslint.config.mjs
        ├── public/                  ← Static assets (SVG icons)
        └── src/app/
            ├── layout.tsx           ← Root layout (Geist font, metadata)
            ├── globals.css          ← TailwindCSS v4 imports
            ├── page.tsx             ← Home page (chat embedded + notifications)
            ├── chat/page.tsx        ← Chat UI độc lập (anonymous mode)
            ├── admin/page.tsx       ← HR Admin Dashboard (role-gated)
            ├── login/page.tsx       ← Đăng nhập
            └── register/page.tsx    ← Đăng ký
```

## API Endpoints

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| `POST` | `/chat` | Gửi câu hỏi → Agent xử lý → trả answer + citations |
| `POST` | `/auth/register` | Đăng ký tài khoản mới |
| `POST` | `/auth/login` | Đăng nhập (SHA-256 hash password) |
| `POST` | `/report-error` | Nhân viên báo lỗi câu trả lời AI |
| `GET` | `/init` | Lấy welcome message + suggested questions |
| `GET` | `/document/{filename}` | Xem nội dung tài liệu gốc (Citation Viewer) |
| `GET` | `/health` | Health check + thông tin hệ thống |
| `GET` | `/notifications` | Lấy thông báo của user |
| `PUT` | `/notifications/read` | Đánh dấu đã đọc thông báo |
| `GET` | `/my-leaves` | Xem đơn phép của mình |
| `GET` | `/admin/users` | Danh sách users |
| `DELETE` | `/admin/users/{username}` | Xóa user |
| `PUT` | `/admin/users/{username}/role` | Đổi role user |
| `GET` | `/admin/leave-requests` | Danh sách đơn phép |
| `PUT` | `/admin/leave-requests/{id}/approve` | Duyệt đơn phép |
| `PUT` | `/admin/leave-requests/{id}/reject` | Từ chối đơn phép |
| `GET` | `/admin/error-reports` | Danh sách báo lỗi |
| `DELETE` | `/admin/error-reports` | Xóa toàn bộ báo lỗi |
| `GET` | `/admin/documents` | Danh sách tài liệu trong knowledge base |
| `GET` | `/admin/chat-logs` | Lịch sử chat (100 gần nhất) |
| `GET` | `/admin/faq-stats` | Thống kê: tool usage, lượt chat/ngày, top câu hỏi |
| `GET` | `/admin/stats` | Tổng quan: users, reports, docs, pending leaves |

## Agent Tools (LangChain)

| Tool | Khi nào Agent gọi |
|------|--------------------|
| `search_policy` | Câu hỏi về chính sách HR → vector search top-3 chunks từ ChromaDB |
| `calculate_leave` | Hỏi số ngày phép cụ thể kèm thâm niên |
| `escalate_to_hr` | Khiếu nại, tranh chấp, phê duyệt, hoặc quá phức tạp |
| `reject_out_of_scope` | Câu hỏi ngoài phạm vi HR (giá vàng, thời tiết, thể thao...) |
| `submit_leave_request` | Nhân viên muốn xin nghỉ phép qua chat |

## Database (MongoDB)

Database: `hr_copilot`

| Collection | Nội dung |
|------------|----------|
| `users` | Tài khoản (username, password hash, fullname, role) |
| `chat_logs` | Lịch sử chat (question, answer, tool_used, timestamp) |
| `error_reports` | Báo lỗi AI (question, ai_answer, user_note) |
| `leave_requests` | Đơn xin phép (date, reason, status, reviewer) |
| `notifications` | Thông báo cho user (duyệt/từ chối phép) |

## Hướng dẫn chạy

### Yêu cầu

- Python 3.10+
- Node.js 18+
- MongoDB đang chạy (mặc định `mongodb://localhost:27017`)
- OpenAI API Key

### 1. Backend

```bash
cd WebApp/backend
pip install -r requirements.txt
cp .env.example .env          # Điền OPENAI_API_KEY + MONGO_URI
uvicorn app:app --reload      # http://localhost:8000
```

### 2. Frontend

```bash
cd WebApp/frontend
npm install
npm run dev                   # http://localhost:3000
```

Nếu backend không chạy ở `localhost:8000`, set biến môi trường `NEXT_PUBLIC_API_URL` trước khi chạy frontend.


