"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import {
  MessageSquare, FileText, Shield, LogOut, Bot, BookOpen, Users, Zap,
  Send, User, AlertTriangle, CheckCircle2, Moon, Sun, X, Flag
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Message {
  role: "user" | "bot";
  content: string;
  is_fallback?: boolean;
  is_escalated?: boolean;
  citations?: string[];
}

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<{ username: string; fullname: string } | null>(null);
  const [showChat, setShowChat] = useState(false);

  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);
  const [docContent, setDocContent] = useState<string>("");
  const [isDocLoading, setIsDocLoading] = useState(false);

  const [reportingIdx, setReportingIdx] = useState<number | null>(null);
  const [reportNote, setReportNote] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (!stored) { router.push("/login"); return; }
    setUser(JSON.parse(stored));
  }, [router]);

  useEffect(() => {
    if (!showChat || messages.length > 0) return;
    const fetchInit = async () => {
      try {
        const res = await axios.get(`${API_BASE}/init`);
        setMessages([{ role: "bot", content: res.data.welcome }]);
        setSuggestions(res.data.suggestions || []);
      } catch {
        setMessages([{ role: "bot", content: "Chào bạn! Tôi là HR Copilot. Bạn cần hỏi về vấn đề gì?" }]);
      }
    };
    fetchInit();
  }, [showChat, messages.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleLogout = () => { localStorage.removeItem("user"); router.push("/login"); };

  const handleViewCitation = async (filename: string) => {
    setSelectedDoc(filename); setDocContent(""); setIsDocLoading(true);
    try { const res = await axios.get(`${API_BASE}/document/${filename}`); setDocContent(res.data.content); }
    catch { setDocContent("Lỗi: Không thể tải tài liệu."); }
    finally { setIsDocLoading(false); }
  };

  const handleReportError = async (msgIdx: number) => {
    const botMsg = messages[msgIdx]; const userMsg = messages[msgIdx - 1];
    if (!botMsg || botMsg.role !== "bot") return;
    try {
      await axios.post(`${API_BASE}/report-error`, { question: userMsg?.content || "", answer: botMsg.content, note: reportNote });
      setReportingIdx(null); setReportNote("");
      alert("Đã gửi báo lỗi thành công!");
    } catch { alert("Không thể gửi báo lỗi."); }
  };

  const handleSend = async (overrideMsg?: string) => {
    const userMsg = (overrideMsg || input).trim();
    if (!userMsg) return;
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setInput(""); setSuggestions([]); setIsLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/chat`, { message: userMsg });
      setMessages(prev => [...prev, { role: "bot", content: res.data.answer, is_fallback: res.data.is_fallback, is_escalated: res.data.is_escalated, citations: res.data.citations }]);
    } catch {
      setMessages(prev => [...prev, { role: "bot", content: "Lỗi kết nối tới Server.", is_fallback: true }]);
    } finally { setIsLoading(false); }
  };

  if (!user) return null;

  const features = [
    { icon: <BookOpen className="text-emerald-600" size={28} />, title: "Nghỉ phép & Nghỉ ốm", desc: "12-15 ngày phép/năm tùy thâm niên, 10 ngày ốm hưởng 70% lương", color: "bg-emerald-50 border-emerald-200 hover:bg-emerald-100" },
    { icon: <Shield className="text-purple-600" size={28} />, title: "Bảo hiểm", desc: "BHXH, BHYT, BHTN + PVI Care Premium với hạn mức nha khoa 5 triệu/năm", color: "bg-purple-50 border-purple-200 hover:bg-purple-100" },
    { icon: <Zap className="text-amber-600" size={28} />, title: "Lương thưởng & KPI", desc: "Thưởng Tết 1 tháng lương, thưởng KPI quý lên tới 150%", color: "bg-amber-50 border-amber-200 hover:bg-amber-100" },
    { icon: <Users className="text-rose-600" size={28} />, title: "Onboarding", desc: "Checklist ngày đầu, thử việc 2 tháng 85% lương, 5 khóa e-learning", color: "bg-rose-50 border-rose-200 hover:bg-rose-100" },
    { icon: <FileText className="text-cyan-600" size={28} />, title: "Xem tài liệu gốc", desc: "Truy cập trực tiếp văn bản chính sách nội bộ kèm trích dẫn", color: "bg-cyan-50 border-cyan-200 hover:bg-cyan-100" },
    { icon: <MessageSquare className="text-indigo-600" size={28} />, title: "Hỗ trợ từ HR", desc: "Escalate câu hỏi phức tạp sang HR Business Partner xử lý trực tiếp", color: "bg-indigo-50 border-indigo-200 hover:bg-indigo-100" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
              <Bot className="text-white" size={20} />
            </div>
            <span className="font-bold text-gray-800">HR Copilot</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">Xin chào, <span className="font-medium text-gray-700">{user.fullname}</span></span>
            <button onClick={handleLogout} className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-600 transition font-medium">
              <LogOut size={16} /> Đăng xuất
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div className="max-w-5xl mx-auto px-4 pt-12 pb-8">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-800 mb-3">Chào mừng đến với HR Copilot</h1>
          <p className="text-gray-500 max-w-xl mx-auto">Hệ thống tra cứu chính sách nhân sự nội bộ sử dụng AI. Hỏi bất kỳ điều gì về nghỉ phép, bảo hiểm, lương thưởng, onboarding.</p>
          <button onClick={() => setShowChat(true)} className="inline-flex items-center gap-2 mt-6 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition shadow-lg shadow-blue-200">
            <MessageSquare size={18} /> Bắt đầu Chat với AI
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f, i) => (
            <button key={i} onClick={() => setShowChat(true)} className={`p-5 rounded-xl border transition ${f.color} flex flex-col gap-3 text-left`}>
              <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center">{f.icon}</div>
              <h3 className="font-semibold text-gray-800">{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
            </button>
          ))}
        </div>

        <div className="mt-12 text-center text-xs text-gray-400 pb-8">
          Nhóm 66 — Phòng E403 — AI Hackathon 2026 — FastAPI + LangChain + ChromaDB + Next.js
        </div>
      </div>

      {/* ════════ FAB Button ════════ */}
      {!showChat && (
        <button onClick={() => setShowChat(true)} className="fixed bottom-6 right-6 z-40 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg shadow-blue-300 hover:bg-blue-700 hover:scale-105 transition-all flex items-center justify-center" title="Chat với AI">
          <MessageSquare size={24} />
        </button>
      )}

      {/* ════════ CHAT POPUP (slide-in right) ════════ */}
      {showChat && (
        <div className="fixed inset-0 bg-black/30 z-50" onClick={() => setShowChat(false)}>
          <div className={`absolute top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl flex flex-col animate-[slideIn_0.2s_ease-out] ${isDarkMode ? 'dark' : ''}`} onClick={(e) => e.stopPropagation()}>

            {/* Chat Header */}
            <div className={`p-4 text-white flex justify-between items-center ${isDarkMode ? 'bg-slate-900' : 'bg-blue-600'}`}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-white rounded-full flex items-center justify-center text-blue-600"><CheckCircle2 size={20} /></div>
                <div>
                  <h1 className="font-bold text-sm">HR Copilot</h1>
                  <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-blue-200'}`}>Nhóm 66 - AI RAG Engine</p>
                </div>
              </div>
              <div className="flex gap-2 items-center">
                <button onClick={() => setIsDarkMode(!isDarkMode)} className={`p-2 rounded-full transition ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700' : 'bg-blue-700 hover:bg-blue-800'}`} title="Đổi giao diện">
                  {isDarkMode ? <Sun size={14} /> : <Moon size={14} />}
                </button>
                <button onClick={() => setShowChat(false)} className={`p-2 rounded-full transition ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700' : 'bg-blue-700 hover:bg-blue-800'}`} title="Đóng">
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Chat Messages */}
            <div className={`flex-1 overflow-y-auto p-4 space-y-6 ${isDarkMode ? 'bg-slate-900' : 'bg-slate-50'}`}>
              {messages.map((msg, index) => (
                <div key={index} className={`flex gap-3 max-w-[90%] ${msg.role === 'user' ? 'ml-auto justify-end' : ''}`}>
                  {msg.role === 'bot' && <div className={`w-8 h-8 ${isDarkMode ? 'bg-blue-500' : 'bg-blue-600'} rounded-full flex-shrink-0 flex items-center justify-center text-white`}><Bot size={18} /></div>}
                  <div className={`p-4 rounded-2xl shadow-sm text-sm w-full ${
                    msg.role === 'user'
                      ? `${isDarkMode ? 'bg-blue-600' : 'bg-blue-500'} text-white rounded-tr-none`
                      : msg.is_fallback
                        ? `${isDarkMode ? 'bg-red-900/40 border-red-900 text-red-100' : 'bg-red-50 border-red-100 text-gray-800'} border rounded-tl-none`
                        : msg.is_escalated
                          ? `${isDarkMode ? 'bg-amber-900/30 border-amber-800 text-amber-100' : 'bg-amber-50 border-amber-200 text-gray-800'} border rounded-tl-none`
                          : `${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white text-gray-800'} border rounded-tl-none`
                  }`}>
                    {msg.is_fallback && <p className={`${isDarkMode ? 'text-red-300' : 'text-red-700'} mb-2 font-semibold flex items-center gap-2`}><AlertTriangle size={16} /> Ngoài phạm vi hỗ trợ</p>}
                    {msg.is_escalated && <p className={`${isDarkMode ? 'text-amber-300' : 'text-amber-700'} mb-2 font-semibold flex items-center gap-2`}><Flag size={16} /> Đã chuyển yêu cầu tới HR</p>}
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>

                    {msg.citations && msg.citations.length > 0 && (
                      <div className={`mt-3 pt-3 border-t ${isDarkMode ? 'border-slate-700' : ''}`}>
                        <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-gray-500'} mb-2 font-semibold`}>Tài liệu tham chiếu:</p>
                        {msg.citations.map((cite, i) => (
                          <div key={i} onClick={() => handleViewCitation(cite)} className={`mb-1 p-2 rounded-lg text-xs flex items-center gap-2 cursor-pointer transition ${isDarkMode ? 'bg-slate-800/80 border-slate-700 text-blue-400 hover:bg-slate-700' : 'bg-blue-50 border-blue-100 text-blue-700 hover:bg-blue-100'} border`}>
                            <FileText size={14} /><span>{cite}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {msg.role === 'bot' && !msg.is_fallback && index > 0 && (
                      <div className={`mt-2 pt-2 border-t ${isDarkMode ? 'border-slate-700' : ''} flex items-center gap-2`}>
                        {reportingIdx === index ? (
                          <div className="flex flex-col gap-2 w-full">
                            <input type="text" value={reportNote} onChange={(e) => setReportNote(e.target.value)} placeholder="Mô tả lỗi..." className={`text-xs px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-red-400 ${isDarkMode ? 'bg-slate-900 border-slate-600 text-white' : ''}`} />
                            <div className="flex gap-2">
                              <button onClick={() => handleReportError(index)} className="text-xs px-3 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600 transition">Gửi báo lỗi</button>
                              <button onClick={() => { setReportingIdx(null); setReportNote(""); }} className={`text-xs px-3 py-1 rounded-lg transition ${isDarkMode ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-gray-200 hover:bg-gray-300'}`}>Hủy</button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => setReportingIdx(index)} className={`text-xs flex items-center gap-1 transition ${isDarkMode ? 'text-slate-500 hover:text-red-400' : 'text-gray-400 hover:text-red-500'}`}>
                            <AlertTriangle size={12} /> Báo lỗi
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  {msg.role === 'user' && <div className="w-8 h-8 bg-gray-300 rounded-full flex-shrink-0 flex items-center justify-center text-white"><User size={18} /></div>}
                </div>
              ))}

              {suggestions.length > 0 && messages.length <= 1 && (
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((q, i) => (
                    <button key={i} onClick={() => handleSend(q)} className={`text-xs px-3 py-2 border rounded-full transition ${isDarkMode ? 'bg-slate-800 border-slate-600 text-blue-400 hover:bg-slate-700' : 'bg-white border-blue-200 text-blue-600 hover:bg-blue-50'}`}>
                      {q}
                    </button>
                  ))}
                </div>
              )}

              {isLoading && (
                <div className="flex gap-3 max-w-[85%]">
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex-shrink-0 flex items-center justify-center text-white"><Bot size={18} /></div>
                  <div className={`p-4 rounded-2xl rounded-tl-none border shadow-sm w-24 flex gap-1 justify-center items-center ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white'}`}>
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
              <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
                <div className={`w-full max-w-lg h-3/4 rounded-xl shadow-2xl flex flex-col border ${isDarkMode ? 'bg-slate-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                  <div className={`flex justify-between items-center p-4 border-b rounded-t-xl ${isDarkMode ? 'border-gray-700 bg-slate-900' : 'border-gray-200 bg-slate-50'}`}>
                    <div className="flex flex-col">
                      <span className={`font-semibold text-sm px-2 ${isDarkMode ? 'text-slate-200' : ''}`}>{selectedDoc}</span>
                      <span className="text-xs text-gray-400 px-2">Tài liệu nội bộ</span>
                    </div>
                    <button onClick={() => setSelectedDoc(null)} className={`p-1 rounded-full transition ${isDarkMode ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-gray-200'}`}><X size={20} /></button>
                  </div>
                  <div className={`p-4 flex-1 overflow-y-auto whitespace-pre-wrap text-sm font-mono ${isDarkMode ? 'text-slate-300 bg-slate-900/50' : 'text-gray-700 bg-slate-50/50'}`}>
                    {isDocLoading ? <div className="flex items-center justify-center h-full animate-pulse text-blue-500">Đang tải...</div> : docContent}
                  </div>
                </div>
              </div>
            )}

            {/* Input */}
            <div className={`p-3 border-t flex items-center gap-2 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white'}`}>
              <input
                type="text" value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Hỏi về nghỉ phép, lương thưởng..."
                className={`flex-1 rounded-full px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 border transition ${isDarkMode ? 'bg-slate-900 text-white border-slate-700' : 'bg-gray-100 border-transparent'}`}
                disabled={isLoading}
              />
              <button onClick={() => handleSend()} disabled={isLoading || !input.trim()} className="w-12 h-12 flex-shrink-0 bg-blue-600 rounded-full text-white hover:bg-blue-700 transition flex items-center justify-center disabled:bg-gray-400">
                <Send size={18} className={`relative right-0.5 ${isLoading ? "animate-pulse" : ""}`} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

