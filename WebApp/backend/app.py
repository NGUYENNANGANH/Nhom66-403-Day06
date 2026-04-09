import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

# LangChain imports
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_community.document_loaders import TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnablePassthrough
from langchain_core.output_parsers import StrOutputParser

load_dotenv()

app = FastAPI(title="Internal RAG Chatbot API")

# Setup CORS for Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize models
llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
embeddings = OpenAIEmbeddings(model="text-embedding-3-small")

# Vector Store Path
CHROMA_PATH = "./chroma_db"
DATA_DIR = "../../data"  # Path to Nhom30-E403/data

# Initialize ChromaDB Vector Store
vector_store = Chroma(
    embedding_function=embeddings,
    persist_directory=CHROMA_PATH
)

def load_documents():
    """Loads markdown data from Nhom30-E403/data and indexes it."""
    docs = []
    if not os.path.exists(DATA_DIR):
        return 0
        
    for filename in os.listdir(DATA_DIR):
        if filename.endswith(".md") or filename.endswith(".txt"):
            file_path = os.path.join(DATA_DIR, filename)
            loader = TextLoader(file_path, encoding='utf-8')
            docs.extend(loader.load())
            
    if not docs:
        return 0
        
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
    splits = text_splitter.split_documents(docs)
    
    # Check if we need to add to chromadb to avoid duplicating on every restart
    existing_count = vector_store._collection.count() if vector_store._collection else 0
    if existing_count == 0:
        vector_store.add_documents(documents=splits)
        return len(splits)
    return 0

# RAG Setup
retriever = vector_store.as_retriever(search_kwargs={"k": 3})

# System prompt emphasizing Path 3 & 4 (Uncertainty Handling)
system_prompt = (
    "Bạn là Trợ lý Nhân sự (HR Copilot) nội bộ của công ty. "
    "Nhiệm vụ của bạn là giải đáp thắc mắc về chính sách dựa trên tài liệu đính kèm bên dưới.\n"
    "Quy tắc quan trọng nhất:\n"
    "1. CHỈ sử dụng tài liệu đính kèm để trả lời các câu hỏi về chính sách/quy chế. TUYỆT ĐỐI KHÔNG bịa ra chính sách (Hallucination).\n"
    "2. Nếu người dùng chỉ đang chào hỏi (ví dụ: 'xin chào', 'hello', 'cảm ơn'), hãy đáp lại lịch sự, tự nhiên và hỏi xem họ cần tra cứu thông tin gì về nhân sự.\n"
    "3. Nếu tài liệu không chứa câu trả lời HOẶC user hỏi về vấn đề chuyên môn/chính sách ngoài lề (giá vàng, ứng lương không có trong quy chế), "
    "MỚI TRẢ LỜI ĐÚNG CÂU SAU: LỖI NGOÀI LUỒNG: 'Hệ thống hiện chưa có dữ liệu mảng này. Tôi sẽ mở ticket chuyển tiếp yêu cầu của bạn tới thẳng HR BP.'\n"
    "4. LUÔN LUÔN trích dẫn nguồn văn bản (Ví dụ: [Trích dẫn: Chính sách Nghỉ phép - Mục X]) nếu trả lời dựa trên tài liệu.\n\n"
    "Tài liệu liên quan:\n"
    "{context}"
)

prompt = ChatPromptTemplate.from_messages([
    ("system", system_prompt),
    ("human", "{input}"),
])

# Manual RAG Setup
def format_docs(docs):
    return "\n\n".join(doc.page_content for doc in docs)

rag_chain = (
    {"context": retriever | format_docs, "input": RunnablePassthrough()}
    | prompt
    | llm
    | StrOutputParser()
)

# Pydantic models
class ChatRequest(BaseModel):
    message: str

class ChatResponse(BaseModel):
    answer: str
    is_fallback: bool
    citations: list[str]

@app.on_event("startup")
async def startup_event():
    print("Loading internal documents...")
    chunks_added = load_documents()
    print(f"Added {chunks_added} chunks to ChromaDB.")

@app.post("/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    try:
        # Retrieve context manually to supply citations
        context_docs = retriever.invoke(request.message)
        
        # Run RAG chain
        answer = rag_chain.invoke(request.message)
        
        # Check Fallback mode (Path 4)
        is_fallback = "LỖI NGOÀI LUỒNG" in answer or "KHÔNG CÓ THÔNG TIN" in answer.upper()
        
        citations = []
        if not is_fallback:
            for doc in context_docs:
                source = doc.metadata.get("source", "Tài liệu nội bộ")
                filename = os.path.basename(source)
                if filename not in citations:
                    citations.append(filename)
                    
        return ChatResponse(
            answer=answer,
            is_fallback=is_fallback,
            citations=citations
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/document/{filename}")
async def get_document(filename: str):
    try:
        # Đường dẫn an toàn để đọc nội dung file từ thư mục data
        file_path = os.path.join(DATA_DIR, filename)
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="Không tìm thấy tài liệu trong kho lưu trữ.")
            
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
            
        return {"filename": filename, "content": content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    return {"status": "ok", "docs_in_db": vector_store._collection.count()}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
