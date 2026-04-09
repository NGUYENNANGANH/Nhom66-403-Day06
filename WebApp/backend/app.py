import os
import json
import hashlib
from contextlib import asynccontextmanager
from datetime import datetime
from bson import ObjectId
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from pymongo import MongoClient

from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_community.document_loaders import TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langchain_classic.agents import create_tool_calling_agent, AgentExecutor
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

from prompts import AGENT_SYSTEM_PROMPT, WELCOME_MESSAGE, SUGGESTED_QUESTIONS

load_dotenv()

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")

mongo_client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
db = mongo_client["hr_copilot"]
users_col = db["users"]
error_reports_col = db["error_reports"]
chat_logs_col = db["chat_logs"]
leave_requests_col = db["leave_requests"]
notifications_col = db["notifications"]

users_col.create_index("username", unique=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Initializing HR Copilot Agent...")
    chunks = init_vector_store()
    print(f"Vector store ready — {chunks} chunks indexed.")
    print(f"Agent tools: {[t.name for t in tools]}")
    print(f"MongoDB: {MONGO_URI} / db=hr_copilot")
    _seed_hr_account()
    yield
    mongo_client.close()


app = FastAPI(title="HR Copilot — Agent API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Models ──────────────────────────────────────────────
llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
embeddings = OpenAIEmbeddings(model="text-embedding-3-small")

# ── Vector Store ────────────────────────────────────────
CHROMA_PATH = "./chroma_db"
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data")

vector_store = None
retriever = None

def init_vector_store():
    """Load .md files from data folder, chunk, embed, store in ChromaDB."""
    global vector_store, retriever

    vector_store = Chroma(
        embedding_function=embeddings,
        persist_directory=CHROMA_PATH,
        collection_name="hr_docs"
    )

    existing = vector_store._collection.count()
    if existing > 0:
        print(f"ChromaDB already has {existing} chunks, skipping indexing.")
        retriever = vector_store.as_retriever(search_kwargs={"k": 3})
        return existing

    if not os.path.exists(DATA_DIR):
        print(f"WARNING: Data directory {DATA_DIR} not found!")
        return 0

    docs = []
    for filename in os.listdir(DATA_DIR):
        if filename.endswith((".md", ".txt")):
            filepath = os.path.join(DATA_DIR, filename)
            loader = TextLoader(filepath, encoding="utf-8")
            docs.extend(loader.load())

    if not docs:
        return 0

    splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
    splits = splitter.split_documents(docs)
    vector_store.add_documents(documents=splits)
    retriever = vector_store.as_retriever(search_kwargs={"k": 3})
    return len(splits)


# ── Agent Tools ─────────────────────────────────────────

@tool
def search_policy(query: str) -> str:
    """Tìm kiếm chính sách HR trong Sổ tay Nhân sự nội bộ.
    Dùng khi nhân viên hỏi về: nghỉ phép, bảo hiểm, lương thưởng, onboarding, quy trình HR.
    Trả về nội dung tài liệu liên quan kèm tên file nguồn."""
    if retriever is None:
        return "ERROR: Vector store chưa được khởi tạo."
    results = retriever.invoke(query)
    if not results:
        return "KHÔNG TÌM THẤY tài liệu liên quan trong kho dữ liệu nội bộ."
    output_parts = []
    for doc in results:
        source = os.path.basename(doc.metadata.get("source", "unknown"))
        output_parts.append(f"[Nguồn: {source}]\n{doc.page_content}")
    return "\n\n---\n\n".join(output_parts)


@tool
def calculate_leave(years_worked: float) -> str:
    """Tính số ngày phép năm dựa trên thâm niên làm việc.
    Dùng khi nhân viên hỏi cụ thể về SỐ NGÀY PHÉP của họ kèm thông tin thâm niên.
    Input: số năm đã làm việc (ví dụ: 0.5, 1, 2, 5)."""
    if years_worked < 0:
        return "Thâm niên không hợp lệ."
    if years_worked < 1:
        months = int(years_worked * 12)
        return (
            f"Thâm niên: {years_worked} năm ({months} tháng).\n"
            f"Theo chính sách, nhân viên dưới 1 năm được 12 ngày phép/năm "
            f"(tích lũy 1 ngày/tháng).\n"
            f"Bạn hiện có khoảng {months} ngày phép tích lũy.\n"
            f"[Nguồn: chinh-sach-nghi-phep.md]"
        )
    elif years_worked <= 3:
        return (
            f"Thâm niên: {years_worked} năm.\n"
            f"Theo chính sách, nhân viên từ 1-3 năm được 14 ngày phép/năm.\n"
            f"[Nguồn: chinh-sach-nghi-phep.md]"
        )
    else:
        return (
            f"Thâm niên: {years_worked} năm.\n"
            f"Theo chính sách, nhân viên trên 3 năm hoặc cấp Manager trở lên "
            f"được 15 ngày phép/năm.\n"
            f"[Nguồn: chinh-sach-nghi-phep.md]"
        )


@tool
def escalate_to_hr(reason: str) -> str:
    """Tạo ticket chuyển yêu cầu sang HR xử lý trực tiếp.
    Dùng khi: câu hỏi quá phức tạp, liên quan khiếu nại, tranh chấp,
    hoặc cần phê duyệt từ con người (duyệt phép, ký giải ngân)."""
    ticket_id = f"HR-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    return (
        f"ESCALATED: Đã tạo ticket [{ticket_id}] gửi tới HR Business Partner.\n"
        f"Lý do: {reason}\n"
        f"Nhân viên sẽ nhận phản hồi từ HR trong vòng 24h làm việc qua email."
    )


@tool
def reject_out_of_scope(topic: str) -> str:
    """Từ chối trả lời câu hỏi nằm ngoài phạm vi HR/chính sách công ty.
    Dùng khi nhân viên hỏi về: giá vàng, thời tiết, thể thao, chính trị,
    hoặc bất kỳ chủ đề nào KHÔNG liên quan đến nhân sự/chính sách nội bộ."""
    return (
        f"LỖI NGOÀI LUỒNG: Câu hỏi về '{topic}' nằm ngoài phạm vi hệ thống HR Copilot.\n"
        f"Tôi chỉ hỗ trợ tra cứu chính sách nhân sự nội bộ "
        f"(nghỉ phép, bảo hiểm, lương thưởng, onboarding).\n"
        f"Vui lòng liên hệ bộ phận phù hợp hoặc tìm kiếm trên Google."
    )


_current_chat_username = "unknown"


@tool
def submit_leave_request(date_from: str, date_to: str, reason: str) -> str:
    """Tạo đơn xin nghỉ phép cho nhân viên.
    Dùng khi nhân viên muốn XIN NGHỈ PHÉP hoặc GỬI ĐƠN NGHỈ.
    Input: date_from (ngày bắt đầu, ví dụ '15/04/2026'), date_to (ngày kết thúc, ví dụ '16/04/2026'), reason (lý do nghỉ).
    Nếu nhân viên chỉ nghỉ 1 ngày thì date_from = date_to."""
    user = users_col.find_one({"username": _current_chat_username})
    fullname = user["fullname"] if user else _current_chat_username

    leave_doc = {
        "username": _current_chat_username,
        "fullname": fullname,
        "date_from": date_from,
        "date_to": date_to,
        "reason": reason,
        "status": "pending",
        "created_at": datetime.now().isoformat(),
        "reviewed_by": None,
        "reviewed_at": None,
    }
    result = leave_requests_col.insert_one(leave_doc)
    leave_id = f"LP-{str(result.inserted_id)[-6:].upper()}"

    return (
        f"LEAVE_REQUEST: Đã tạo đơn xin phép [{leave_id}] thành công!\n"
        f"• Nhân viên: {fullname}\n"
        f"• Ngày nghỉ: {date_from} → {date_to}\n"
        f"• Lý do: {reason}\n"
        f"• Trạng thái: Chờ HR duyệt\n"
        f"HR sẽ xem xét đơn của bạn trên hệ thống Dashboard."
    )


# ── Agent Setup ─────────────────────────────────────────

tools = [search_policy, calculate_leave, escalate_to_hr, reject_out_of_scope, submit_leave_request]

agent_prompt = ChatPromptTemplate.from_messages([
    ("system", AGENT_SYSTEM_PROMPT),
    MessagesPlaceholder(variable_name="chat_history", optional=True),
    ("human", "{input}"),
    MessagesPlaceholder(variable_name="agent_scratchpad"),
])

agent = create_tool_calling_agent(llm, tools, agent_prompt)
agent_executor = AgentExecutor(
    agent=agent,
    tools=tools,
    verbose=True,
    max_iterations=5,
    handle_parsing_errors=True,
)


# ── API Models ──────────────────────────────────────────

class HistoryMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    username: str = "anonymous"
    history: list[HistoryMessage] = []

class ChatResponse(BaseModel):
    answer: str
    is_fallback: bool
    is_escalated: bool
    citations: list[str]
    tool_used: str

class AuthRequest(BaseModel):
    username: str
    password: str
    fullname: str = ""
    role: str = "employee"


# ── Auth Helpers ─────────────────────────────────────────

def _hash_pw(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def _seed_hr_account():
    """Tạo tài khoản HR mặc định nếu chưa tồn tại."""
    if not users_col.find_one({"username": "hr_admin"}):
        users_col.insert_one({
            "username": "hr_admin",
            "password": _hash_pw("hr123456"),
            "fullname": "HR Manager",
            "role": "hr",
            "created_at": datetime.now().isoformat(),
        })
        print("Seeded default HR account: hr_admin / hr123456")


# ── Endpoints ───────────────────────────────────────────

@app.post("/auth/register")
async def register(req: AuthRequest):
    if not req.username or not req.password:
        raise HTTPException(400, "Username và password không được trống.")
    if users_col.find_one({"username": req.username}):
        raise HTTPException(409, "Tên đăng nhập đã tồn tại.")
    user_doc = {
        "username": req.username,
        "password": _hash_pw(req.password),
        "fullname": req.fullname or req.username,
        "role": "employee",
        "created_at": datetime.now().isoformat(),
    }
    users_col.insert_one(user_doc)
    return {"status": "ok", "user": {"username": user_doc["username"], "fullname": user_doc["fullname"], "role": user_doc["role"]}}


@app.post("/auth/login")
async def login(req: AuthRequest):
    user = users_col.find_one({"username": req.username, "password": _hash_pw(req.password)})
    if not user:
        raise HTTPException(401, "Sai tên đăng nhập hoặc mật khẩu.")
    return {"status": "ok", "user": {"username": user["username"], "fullname": user["fullname"], "role": user.get("role", "employee")}}

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    global _current_chat_username
    try:
        _current_chat_username = request.username
        today = datetime.now().strftime("%d/%m/%Y")
        enriched_input = f"[Hôm nay: {today} | User: {request.username}]\n{request.message}"

        chat_history = []
        for msg in request.history:
            if msg.role == "user":
                chat_history.append(HumanMessage(content=msg.content))
            elif msg.role == "bot":
                chat_history.append(AIMessage(content=msg.content))

        result = agent_executor.invoke({"input": enriched_input, "chat_history": chat_history})
        answer = result["output"]

        is_fallback = "LỖI NGOÀI LUỒNG" in answer
        is_escalated = "ESCALATED" in answer
        is_leave = "LEAVE_REQUEST" in answer

        citations = []
        for marker in ["[Nguồn: ", "[Nguồn:"]:
            start = 0
            while True:
                idx = answer.find(marker, start)
                if idx == -1:
                    break
                end = answer.find("]", idx)
                if end == -1:
                    break
                filename = answer[idx + len(marker):end].strip()
                if filename and filename not in citations:
                    citations.append(filename)
                start = end + 1

        tool_used = "none"
        if is_leave:
            tool_used = "submit_leave_request"
        elif is_fallback:
            tool_used = "reject_out_of_scope"
        elif is_escalated:
            tool_used = "escalate_to_hr"
        elif citations:
            tool_used = "search_policy"
        if "ngày phép" in answer.lower() and "thâm niên" in answer.lower():
            tool_used = "calculate_leave"

        chat_logs_col.insert_one({
            "username": request.username,
            "question": request.message,
            "answer": answer,
            "tool_used": tool_used,
            "timestamp": datetime.now().isoformat(),
        })

        return ChatResponse(
            answer=answer,
            is_fallback=is_fallback,
            is_escalated=is_escalated,
            citations=citations,
            tool_used=tool_used,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/report-error")
async def report_error(request: dict):
    """Nhận báo lỗi từ user khi AI trả lời sai — Correction Path."""
    log_entry = {
        "timestamp": datetime.now().isoformat(),
        "original_question": request.get("question", ""),
        "ai_answer": request.get("answer", ""),
        "user_note": request.get("note", ""),
    }
    error_reports_col.insert_one(log_entry)
    return {"status": "logged", "entry": {k: v for k, v in log_entry.items() if k != "_id"}}


@app.get("/document/{filename}")
async def get_document(filename: str):
    """Trả nội dung file gốc để hiện trong Citation Viewer."""
    filepath = os.path.join(DATA_DIR, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Không tìm thấy tài liệu.")
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    return {"filename": filename, "content": content}


@app.get("/init")
async def get_init():
    """Trả welcome message + suggested questions cho frontend."""
    return {
        "welcome": WELCOME_MESSAGE,
        "suggestions": SUGGESTED_QUESTIONS,
    }


@app.get("/health")
async def health():
    doc_count = vector_store._collection.count() if vector_store else 0
    return {
        "status": "ok",
        "docs_in_db": doc_count,
        "tools": [t.name for t in tools],
        "model": "gpt-4o-mini",
    }


# ── Admin Endpoints ─────────────────────────────────────

@app.get("/admin/users")
async def admin_get_users():
    users = list(users_col.find({}, {"_id": 0, "password": 0}))
    return {"users": users, "total": len(users)}


@app.delete("/admin/users/{username}")
async def admin_delete_user(username: str):
    result = users_col.delete_one({"username": username})
    if result.deleted_count == 0:
        raise HTTPException(404, "Không tìm thấy user.")
    return {"status": "deleted", "username": username}


@app.get("/admin/error-reports")
async def admin_get_error_reports():
    reports = list(error_reports_col.find({}, {"_id": 0}).sort("timestamp", -1))
    return {"reports": reports, "total": len(reports)}


@app.delete("/admin/error-reports")
async def admin_clear_error_reports():
    result = error_reports_col.delete_many({})
    return {"status": "cleared", "deleted": result.deleted_count}


@app.get("/admin/documents")
async def admin_list_documents():
    docs = []
    if os.path.exists(DATA_DIR):
        for f in os.listdir(DATA_DIR):
            if f.endswith((".md", ".txt")):
                filepath = os.path.join(DATA_DIR, f)
                size = os.path.getsize(filepath)
                docs.append({"filename": f, "size_bytes": size})
    return {"documents": docs, "total": len(docs)}


@app.put("/admin/users/{username}/role")
async def admin_update_role(username: str, body: dict):
    new_role = body.get("role", "employee")
    if new_role not in ("employee", "hr"):
        raise HTTPException(400, "Role phải là 'employee' hoặc 'hr'.")
    result = users_col.update_one({"username": username}, {"$set": {"role": new_role}})
    if result.matched_count == 0:
        raise HTTPException(404, "Không tìm thấy user.")
    return {"status": "updated", "username": username, "role": new_role}


# ── Leave Request Endpoints ──────────────────────────────

@app.get("/admin/leave-requests")
async def admin_get_leave_requests():
    leaves = list(leave_requests_col.find().sort("created_at", -1))
    for lv in leaves:
        lv["_id"] = str(lv["_id"])
    return {"leaves": leaves, "total": len(leaves)}


@app.put("/admin/leave-requests/{leave_id}/approve")
async def admin_approve_leave(leave_id: str, body: dict = {}):
    leave = leave_requests_col.find_one({"_id": ObjectId(leave_id)})
    if not leave:
        raise HTTPException(404, "Không tìm thấy đơn.")
    reviewer = body.get("reviewed_by", "hr_admin")
    leave_requests_col.update_one(
        {"_id": ObjectId(leave_id)},
        {"$set": {"status": "approved", "reviewed_by": reviewer, "reviewed_at": datetime.now().isoformat()}},
    )
    notifications_col.insert_one({
        "username": leave["username"],
        "type": "leave_approved",
        "message": f"Đơn nghỉ phép ({leave['date_from']} → {leave['date_to']}) đã được HR duyệt.",
        "read": False,
        "created_at": datetime.now().isoformat(),
    })
    return {"status": "approved", "leave_id": leave_id}


@app.put("/admin/leave-requests/{leave_id}/reject")
async def admin_reject_leave(leave_id: str, body: dict = {}):
    leave = leave_requests_col.find_one({"_id": ObjectId(leave_id)})
    if not leave:
        raise HTTPException(404, "Không tìm thấy đơn.")
    reviewer = body.get("reviewed_by", "hr_admin")
    leave_requests_col.update_one(
        {"_id": ObjectId(leave_id)},
        {"$set": {"status": "rejected", "reviewed_by": reviewer, "reviewed_at": datetime.now().isoformat()}},
    )
    notifications_col.insert_one({
        "username": leave["username"],
        "type": "leave_rejected",
        "message": f"Đơn nghỉ phép ({leave['date_from']} → {leave['date_to']}) đã bị từ chối.",
        "read": False,
        "created_at": datetime.now().isoformat(),
    })
    return {"status": "rejected", "leave_id": leave_id}


@app.get("/notifications")
async def get_notifications(username: str):
    notifs = list(notifications_col.find({"username": username}).sort("created_at", -1).limit(20))
    for n in notifs:
        n["_id"] = str(n["_id"])
    return {"notifications": notifs, "unread": sum(1 for n in notifs if not n.get("read"))}


@app.put("/notifications/read")
async def mark_notifications_read(body: dict):
    username = body.get("username", "")
    notifications_col.update_many({"username": username, "read": False}, {"$set": {"read": True}})
    return {"status": "ok"}


@app.get("/my-leaves")
async def get_my_leaves(username: str):
    leaves = list(leave_requests_col.find({"username": username}).sort("created_at", -1))
    for lv in leaves:
        lv["_id"] = str(lv["_id"])
    return {"leaves": leaves, "total": len(leaves)}


# ── FAQ / Chat Log Endpoints ────────────────────────────

@app.get("/admin/chat-logs")
async def admin_get_chat_logs():
    logs = list(chat_logs_col.find({}, {"_id": 0}).sort("timestamp", -1).limit(100))
    return {"logs": logs, "total": len(logs)}


@app.get("/admin/faq-stats")
async def admin_faq_stats():
    pipeline = [
        {"$group": {"_id": "$tool_used", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    tool_stats = list(chat_logs_col.aggregate(pipeline))

    date_pipeline = [
        {"$project": {"date": {"$substr": ["$timestamp", 0, 10]}}},
        {"$group": {"_id": "$date", "count": {"$sum": 1}}},
        {"$sort": {"_id": -1}},
        {"$limit": 14},
    ]
    daily_stats = list(chat_logs_col.aggregate(date_pipeline))

    top_questions = list(
        chat_logs_col.find({}, {"_id": 0, "question": 1, "tool_used": 1, "timestamp": 1, "username": 1})
        .sort("timestamp", -1).limit(20)
    )

    total_chats = chat_logs_col.count_documents({})

    return {
        "tool_stats": [{"tool": s["_id"], "count": s["count"]} for s in tool_stats],
        "daily_stats": [{"date": s["_id"], "count": s["count"]} for s in daily_stats],
        "recent_questions": top_questions,
        "total_chats": total_chats,
    }


@app.get("/admin/stats")
async def admin_stats_v2():
    doc_count = vector_store._collection.count() if vector_store else 0
    pending_leaves = leave_requests_col.count_documents({"status": "pending"})
    total_chats = chat_logs_col.count_documents({})
    return {
        "total_users": users_col.count_documents({}),
        "total_error_reports": error_reports_col.count_documents({}),
        "total_docs_in_vectordb": doc_count,
        "pending_leaves": pending_leaves,
        "total_chats": total_chats,
        "model": "gpt-4o-mini",
        "tools": [t.name for t in tools],
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
