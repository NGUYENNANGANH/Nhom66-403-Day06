# Prototype — HR Copilot

## Mô tả

HR Copilot là chatbot AI nội bộ doanh nghiệp, sử dụng RAG (Retrieval-Augmented Generation) để tra cứu Sổ tay nhân viên và trả lời tức thì các câu hỏi về nghỉ phép, bảo hiểm, lương thưởng, onboarding. Mỗi câu trả lời kèm Citation trích dẫn tài liệu gốc — nhân viên click vào để kiểm chứng ngay.

Hệ thống bao gồm: chatbot cho nhân viên, dashboard cho HR admin (quản lý users, duyệt đơn phép, xem báo lỗi, thống kê), và correction flow (Báo lỗi → HR review → cập nhật knowledge base).

## Level: Working prototype

Prototype chạy thật end-to-end: nhân viên gõ câu hỏi → LangChain Agent chọn tool phù hợp → RAG truy xuất từ ChromaDB → GPT-4o-mini sinh câu trả lời kèm citation → hiển thị trên UI. Có xử lý cả out-of-domain, escalate to HR, xin nghỉ phép, tính ngày phép theo thâm niên.

## Links

- **Source code:** [GitHub — Nhom66-403-Day06](https://github.com/Nhom66-403-Day06) *(repo này)*
- **Backend:** `WebApp/backend/` — FastAPI server
- **Frontend:** `WebApp/frontend/` — Next.js app

## Tools & API

| Tool/API | Mục đích |
|----------|----------|
| Python FastAPI | Backend REST API server |
| LangChain + LangChain Classic | Agent framework, tool calling, prompt template |
| ChromaDB | Vector store cho RAG — lưu embeddings tài liệu HR |
| OpenAI GPT-4o-mini | LLM sinh câu trả lời (~$0.001/query, latency <2s) |
| OpenAI text-embedding-3-small | Embedding model cho vector search |
| MongoDB + PyMongo | Lưu users, chat logs, error reports, leave requests, notifications |
| Next.js 14 + TailwindCSS | Frontend SPA — chat UI, admin dashboard, login/register |
| Axios | HTTP client frontend → backend |
| Cursor (AI IDE) | Hỗ trợ vibe-coding toàn bộ dự án |

## Phân công prototype

> Phân theo **chức năng end-to-end** — mỗi người sở hữu trọn vẹn 1 tính năng từ AI tool/prompt → backend API → frontend UI.
>
> **Chung cả nhóm:** Thu thập & chuẩn hóa mock data HR (4 file `.md` trong `data/`).

| Thành viên | Chức năng sở hữu | Phần AI | Output code |
|-----------|-------------------|---------|-------------|
| **Trịnh Kế Tiến** | **RAG Pipeline + Agent** | RAG indexing (chunk → embed → ChromaDB), tool `search_policy` (vector search top-3), LangChain AgentExecutor, citation extraction | `app.py`: `init_vector_store()`, `search_policy()`, agent setup, `/chat` endpoint, `/document/{filename}` |
| **Mai Phi Hiếu** | **Chat UI + Guardrail ngoài phạm vi** | Tool `reject_out_of_scope` (detect off-topic → cảnh báo "LỖI NGOÀI LUỒNG"), logic hiển thị khác nhau theo loại response AI (fallback đỏ / escalated vàng / bình thường) | `chat/page.tsx`: chat UI, dark mode, Citation Viewer Modal, suggested questions, `page.tsx`: landing page |
| **Nguyễn Năng Anh** | **Xin nghỉ phép + Đánh giá câu trả lời** | Tool `submit_leave_request` (Agent tạo đơn phép qua chat), tool `calculate_leave` (tính phép theo thâm niên), chức năng Báo lỗi AI (correction path) | `app.py`: `submit_leave_request()`, `calculate_leave()`, `/report-error`, leave CRUD API, notifications. `chat/page.tsx`: UI nút "Báo lỗi". `admin/page.tsx`: tab Đơn phép |
| **Phạm Thanh Tùng** | **Auth + Admin Dashboard + Escalation** | Tool `escalate_to_hr` (tạo ticket chuyển HR), dashboard thống kê AI (biểu đồ tool usage, lượt chat/ngày, câu hỏi gần đây) | `app.py`: auth endpoints, admin endpoints, `escalate_to_hr()`, faq-stats pipeline. `login/page.tsx`, `register/page.tsx`, `admin/page.tsx`: tabs Tổng quan, Users, FAQ, Báo lỗi, Tài liệu |
| **Dương Phương Thảo** | **System Prompt + Data + Learning Signal** | Viết AGENT_SYSTEM_PROMPT (9 rules cho Agent), WELCOME_MESSAGE, SUGGESTED_QUESTIONS, thiết kế Correction Flow (Báo lỗi → DB → HR review → cập nhật KB) | `prompts.py`, `data/*.md` (4 file chính sách HR), test & iterate prompt qua nhiều phiên bản |

## Cấu trúc thư mục

```
Nhom66-403-Day06/
├── spec-final.md                    ← SPEC 6 phần + phân công
├── prototype-readme.md              ← File này
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
    │   └── .env.example
    └── frontend/
        ├── src/app/
        │   ├── page.tsx             ← Landing page
        │   ├── chat/page.tsx        ← Chat UI chính
        │   ├── admin/page.tsx       ← HR Admin Dashboard
        │   ├── login/page.tsx       ← Đăng nhập
        │   └── register/page.tsx    ← Đăng ký
        └── package.json
```

## Hướng dẫn chạy

```bash
# 1. Backend
cd WebApp/backend
pip install -r requirements.txt
cp .env.example .env          # Điền OPENAI_API_KEY + MONGO_URI
uvicorn app:app --reload

# 2. Frontend
cd WebApp/frontend
npm install
npm run dev                   # http://localhost:3000

