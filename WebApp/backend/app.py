import os
import json
from datetime import datetime
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_community.document_loaders import TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage, SystemMessage
from langchain.agents import create_tool_calling_agent, AgentExecutor
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

from prompts import AGENT_SYSTEM_PROMPT, WELCOME_MESSAGE, SUGGESTED_QUESTIONS

load_dotenv()

app = FastAPI(title="HR Copilot — Agent API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Models ──────────────────────────────────────────────
llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
embeddings = OpenAIEmbeddings(model="text-embedding-3-small")

# ── Vector Store ────────────────────────────────────────
CHROMA_PATH = "./chroma_db"
DATA_DIR = "../data"

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


# ── Agent Setup ─────────────────────────────────────────

tools = [search_policy, calculate_leave, escalate_to_hr, reject_out_of_scope]

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

class ChatRequest(BaseModel):
    message: str

class ChatResponse(BaseModel):
    answer: str
    is_fallback: bool
    is_escalated: bool
    citations: list[str]
    tool_used: str


# ── Endpoints ───────────────────────────────────────────

@app.on_event("startup")
async def startup():
    print("Initializing HR Copilot Agent...")
    chunks = init_vector_store()
    print(f"Vector store ready — {chunks} chunks indexed.")
    print(f"Agent tools: {[t.name for t in tools]}")


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    try:
        result = agent_executor.invoke({"input": request.message})
        answer = result["output"]

        is_fallback = "LỖI NGOÀI LUỒNG" in answer
        is_escalated = "ESCALATED" in answer

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
        if is_fallback:
            tool_used = "reject_out_of_scope"
        elif is_escalated:
            tool_used = "escalate_to_hr"
        elif citations:
            tool_used = "search_policy"
        if "ngày phép" in answer.lower() and "thâm niên" in answer.lower():
            tool_used = "calculate_leave"

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
    log_path = os.path.join(DATA_DIR, "..", "test", "error-reports.json")
    os.makedirs(os.path.dirname(log_path), exist_ok=True)

    logs = []
    if os.path.exists(log_path):
        with open(log_path, "r", encoding="utf-8") as f:
            logs = json.load(f)
    logs.append(log_entry)
    with open(log_path, "w", encoding="utf-8") as f:
        json.dump(logs, f, ensure_ascii=False, indent=2)

    return {"status": "logged", "entry": log_entry}


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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
