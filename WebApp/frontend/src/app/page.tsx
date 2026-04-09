"use client";

import { useState, useRef, useEffect } from "react";
import axios from "axios";
import { Send, User, Bot, AlertTriangle, FileText, CheckCircle2, Moon, Sun, X } from "lucide-react";

interface Message {
  role: "user" | "bot";
  content: string;
  is_fallback?: boolean;
  citations?: string[];
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "bot",
      content: "Chào bạn! Tôi là Trợ lý Nhân sự nội bộ. Tôi có thể giúp bạn tra cứu nhanh các quy chế lương, chuẩn mực IT, và thủ tục hành chính. Bạn cần giúp gì?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  // Document Viewer State
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);
  const [docContent, setDocContent] = useState<string>("");
  const [isDocLoading, setIsDocLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  // Xem tài liệu khi click vào Citation
  const handleViewCitation = async (filename: string) => {
    setSelectedDoc(filename);
    setDocContent("");
    setIsDocLoading(true);
    try {
        const res = await axios.get(`http://localhost:8000/document/${filename}`);
        setDocContent(res.data.content);
    } catch {
        setDocContent("Lỗi: Không thể tải hoặc không tìm thấy tài liệu này trên máy chủ.");
    } finally {
        setIsDocLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMsg = input.trim();
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setInput("");
    setIsLoading(true);

    try {
      // Gọi API Backend
      const res = await axios.post("http://localhost:8000/chat", {
        message: userMsg
      });

      setMessages(prev => [...prev, {
        role: "bot",
        content: res.data.answer,
        is_fallback: res.data.is_fallback,
        citations: res.data.citations
      }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: "bot",
        content: "Lỗi kết nối tới Server. Đảm bảo Backend FastAPI đang chạy ở cổng 8000. (Lỗi mạng hoặc Timeout)",
        is_fallback: true
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`min-h-screen font-sans flex items-center justify-center p-4 transition-colors duration-300 ${isDarkMode ? 'dark bg-gray-900' : 'bg-gray-100'}`}>
      <div className="w-full max-w-2xl bg-white dark:bg-slate-800 shadow-xl rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 flex flex-col transition-colors duration-300" style={{ height: "85vh" }}>
        
        {/* Header */}
        <div className="bg-blue-600 dark:bg-slate-900 p-4 text-white flex justify-between items-center transition-colors duration-300">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-blue-600 font-bold text-lg"><CheckCircle2 /></div>
                <div>
                    <h1 className="font-bold">Trợ lý Phân tích - HR Copilot</h1>
                    <p className="text-xs text-blue-200">Nhóm 30 - AI RAG Engine</p>
                </div>
            </div>
            <div className="flex gap-3 items-center">
                <button onClick={toggleTheme} className="p-2 bg-blue-700 dark:bg-slate-800 hover:bg-blue-800 dark:hover:bg-slate-700 rounded-full transition" title="Đổi giao diện">
                   {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
                </button>
                <div className="flex gap-2">
                    <span className="bg-blue-800 dark:bg-slate-800 text-xs px-2 py-1 rounded-md border border-blue-500 dark:border-slate-600">FastAPI</span>
                    <span className="bg-blue-800 dark:bg-slate-800 text-xs px-2 py-1 rounded-md border border-blue-500 dark:border-slate-600">ChromaDB</span>
                </div>
            </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-50 dark:bg-slate-900 transition-colors duration-300 relative">
          {messages.map((msg, index) => (
            <div key={index} className={`flex gap-3 max-w-[90%] ${msg.role === 'user' ? 'ml-auto justify-end' : ''}`}>
              
              {/* Bot Avatar */}
              {msg.role === 'bot' && (
                <div className="w-8 h-8 bg-blue-600 dark:bg-blue-500 rounded-full flex-shrink-0 flex items-center justify-center text-white"><Bot size={18} /></div>
              )}

              {/* Message Bubble */}
              <div className={`p-4 rounded-2xl shadow-sm text-sm w-full ${
                msg.role === 'user' 
                  ? 'bg-blue-500 dark:bg-blue-600 text-white rounded-tr-none' 
                  : msg.is_fallback 
                    ? 'bg-red-50 dark:bg-red-900/40 border border-red-100 dark:border-red-900 text-gray-800 dark:text-red-100 rounded-tl-none' 
                    : 'bg-white dark:bg-slate-800 border dark:border-slate-700 text-gray-800 dark:text-slate-200 rounded-tl-none'
              }`}>
                {msg.is_fallback && <p className="text-red-700 dark:text-red-300 mb-2 font-semibold flex items-center gap-2"><AlertTriangle size={16} /> Lời yêu cầu xử lý ngoại lệ</p>}
                
                <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>

                {/* Citations */}
                {msg.citations && msg.citations.length > 0 && (
                  <div className="mt-3 pt-3 border-t dark:border-slate-700">
                    <p className="text-xs text-gray-500 dark:text-slate-400 mb-2 font-semibold">Tài liệu tham chiếu (Nhấn để xem):</p>
                    {msg.citations.map((cite, i) => (
                      <div key={i} onClick={() => handleViewCitation(cite)} className="mb-1 p-2 bg-blue-50 dark:bg-slate-800/80 border border-blue-100 dark:border-slate-700 rounded-lg text-xs flex items-center gap-2 text-blue-700 dark:text-blue-400 cursor-pointer hover:bg-blue-100 dark:hover:bg-slate-700 transition">
                          <FileText size={14} />
                          <span>Mật: {cite}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* User Avatar */}
              {msg.role === 'user' && (
                <div className="w-8 h-8 bg-gray-300 rounded-full flex-shrink-0 flex items-center justify-center text-white"><User size={18} /></div>
              )}
            </div>
          ))}

          {/* Skeleton Loading */}
          {isLoading && (
            <div className="flex gap-3 max-w-[85%]">
               <div className="w-8 h-8 bg-blue-600 rounded-full flex-shrink-0 flex items-center justify-center text-white"><Bot size={18} /></div>
               <div className="bg-white p-4 rounded-2xl rounded-tl-none border shadow-sm w-24 flex gap-1 justify-center items-center">
                 <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
                 <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                 <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
               </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Document Modal */}
        {selectedDoc && (
          <div className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 w-full max-w-lg h-3/4 rounded-xl shadow-2xl flex flex-col border border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center p-4 border-b dark:border-gray-700 bg-slate-50 dark:bg-slate-900 rounded-t-xl">
                 <div className="flex flex-col">
                    <span className="font-semibold text-sm dark:text-slate-200 px-2">📄 {selectedDoc}</span>
                    <span className="text-xs text-gray-400 px-2">Bảo mật cấp độ 3 (Nội bộ)</span>
                 </div>
                 <button onClick={() => setSelectedDoc(null)} className="p-1 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-full dark:text-slate-300 transition">
                    <X size={20} />
                 </button>
              </div>
              <div className="p-4 flex-1 overflow-y-auto whitespace-pre-wrap text-sm text-gray-700 dark:text-slate-300 font-mono bg-slate-50/50 dark:bg-slate-900/50">
                 {isDocLoading ? (
                    <div className="flex items-center justify-center h-full animate-pulse text-blue-500">Đang tải tài liệu gốc...</div>
                 ) : (
                    docContent
                 )}
              </div>
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="bg-white dark:bg-slate-800 p-3 border-t dark:border-slate-700 flex items-center gap-2 shadow-inner transition-colors duration-300 z-10">
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Hỏi về nghỉ phép, công tác, lương thưởng..." 
              className="flex-1 bg-gray-100 dark:bg-slate-900 dark:text-white rounded-full px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 border border-transparent dark:border-slate-700 transition" 
              disabled={isLoading}
            />
            <button 
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className="w-12 h-12 flex-shrink-0 bg-blue-600 rounded-full text-white hover:bg-blue-700 transition flex items-center justify-center disabled:bg-gray-400 dark:disabled:bg-slate-700"
            >
              <Send size={18} className={`transform relative right-0.5 ${isLoading ? "animate-pulse" : ""}`} />
            </button>
        </div>
        <div className="bg-gray-50 dark:bg-slate-950 p-2 text-center text-xs text-gray-400 transition-colors duration-300">
            Hệ thống đang tích hợp Langchain RAG với OpenAI GPT-4o-mini
        </div>
      </div>
    </div>
  );
}
