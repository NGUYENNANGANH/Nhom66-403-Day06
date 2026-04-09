"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import Link from "next/link";
import {
  Users, AlertTriangle, FileText, Bot, Trash2, ArrowLeft,
  BarChart3, Database, RefreshCw, Shield, CalendarDays, Check,
  XCircle, Clock, MessageCircle, TrendingUp, LogOut
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface UserItem {
  username: string;
  fullname: string;
  role: string;
  created_at: string;
}

interface ErrorReport {
  timestamp: string;
  original_question: string;
  ai_answer: string;
  user_note: string;
}

interface DocItem {
  filename: string;
  size_bytes: number;
}

interface Stats {
  total_users: number;
  total_error_reports: number;
  total_docs_in_vectordb: number;
  pending_leaves: number;
  total_chats: number;
  model: string;
  tools: string[];
}

interface LeaveRequest {
  _id: string;
  username: string;
  fullname: string;
  date_from: string;
  date_to: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
}

interface ToolStat { tool: string; count: number; }
interface DailyStat { date: string; count: number; }
interface RecentQuestion { username: string; question: string; tool_used: string; timestamp: string; }

type TabId = "stats" | "users" | "leaves" | "reports" | "faq" | "docs";

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("stats");
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [reports, setReports] = useState<ErrorReport[]>([]);
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);
  const [docContent, setDocContent] = useState("");

  const [toolStats, setToolStats] = useState<ToolStat[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyStat[]>([]);
  const [recentQuestions, setRecentQuestions] = useState<RecentQuestion[]>([]);
  const [totalChats, setTotalChats] = useState(0);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (!stored) { router.push("/login"); return; }
    const parsed = JSON.parse(stored);
    if (parsed.role !== "hr") { router.push("/"); return; }
    loadStats();
  }, [router]);

  useEffect(() => {
    if (tab === "users") loadUsers();
    else if (tab === "reports") loadReports();
    else if (tab === "docs") loadDocs();
    else if (tab === "leaves") loadLeaves();
    else if (tab === "faq") loadFaqStats();
    else loadStats();
  }, [tab]);

  const loadStats = async () => {
    try { const res = await axios.get(`${API_BASE}/admin/stats`); setStats(res.data); }
    catch { /* ignore */ }
  };

  const loadUsers = async () => {
    setLoading(true);
    try { const res = await axios.get(`${API_BASE}/admin/users`); setUsers(res.data.users); }
    catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const loadReports = async () => {
    setLoading(true);
    try { const res = await axios.get(`${API_BASE}/admin/error-reports`); setReports(res.data.reports); }
    catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const loadDocs = async () => {
    setLoading(true);
    try { const res = await axios.get(`${API_BASE}/admin/documents`); setDocs(res.data.documents); }
    catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const loadLeaves = async () => {
    setLoading(true);
    try { const res = await axios.get(`${API_BASE}/admin/leave-requests`); setLeaves(res.data.leaves); }
    catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const loadFaqStats = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/admin/faq-stats`);
      setToolStats(res.data.tool_stats);
      setDailyStats(res.data.daily_stats);
      setRecentQuestions(res.data.recent_questions);
      setTotalChats(res.data.total_chats);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const deleteUser = async (username: string) => {
    if (!confirm(`Xoá user "${username}"?`)) return;
    try { await axios.delete(`${API_BASE}/admin/users/${username}`); loadUsers(); loadStats(); }
    catch { alert("Không thể xoá user."); }
  };

  const toggleRole = async (username: string, currentRole: string) => {
    const newRole = currentRole === "hr" ? "employee" : "hr";
    if (!confirm(`Đổi role "${username}" thành ${newRole}?`)) return;
    try { await axios.put(`${API_BASE}/admin/users/${username}/role`, { role: newRole }); loadUsers(); }
    catch { alert("Không thể đổi role."); }
  };

  const clearReports = async () => {
    if (!confirm("Xoá toàn bộ báo lỗi?")) return;
    try { await axios.delete(`${API_BASE}/admin/error-reports`); loadReports(); loadStats(); }
    catch { alert("Không thể xoá."); }
  };

  const viewDoc = async (filename: string) => {
    setSelectedDoc(filename); setDocContent("");
    try { const res = await axios.get(`${API_BASE}/document/${filename}`); setDocContent(res.data.content); }
    catch { setDocContent("Không thể tải tài liệu."); }
  };

  const approveLeave = async (id: string) => {
    try { await axios.put(`${API_BASE}/admin/leave-requests/${id}/approve`); loadLeaves(); loadStats(); }
    catch { alert("Lỗi khi duyệt đơn."); }
  };

  const rejectLeave = async (id: string) => {
    try { await axios.put(`${API_BASE}/admin/leave-requests/${id}/reject`); loadLeaves(); loadStats(); }
    catch { alert("Lỗi khi từ chối đơn."); }
  };

  const pendingCount = leaves.filter(l => l.status === "pending").length;

  const refreshAll = () => {
    loadStats();
    if (tab === "users") loadUsers();
    else if (tab === "reports") loadReports();
    else if (tab === "docs") loadDocs();
    else if (tab === "leaves") loadLeaves();
    else if (tab === "faq") loadFaqStats();
  };

  const toolLabel = (t: string) => {
    const map: Record<string, string> = {
      search_policy: "Tra cứu chính sách",
      calculate_leave: "Tính ngày phép",
      escalate_to_hr: "Chuyển HR",
      reject_out_of_scope: "Ngoài phạm vi",
      submit_leave_request: "Xin nghỉ phép",
      none: "Chào hỏi / Khác",
    };
    return map[t] || t;
  };

  const tabs: { id: TabId; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: "stats", label: "Tổng quan", icon: <BarChart3 size={16} /> },
    { id: "leaves", label: "Đơn phép", icon: <CalendarDays size={16} />, badge: pendingCount || undefined },
    { id: "users", label: "Người dùng", icon: <Users size={16} /> },
    { id: "faq", label: "FAQ & Thống kê", icon: <TrendingUp size={16} /> },
    { id: "reports", label: "Báo lỗi", icon: <AlertTriangle size={16} /> },
    { id: "docs", label: "Tài liệu", icon: <FileText size={16} /> },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-2 hover:bg-gray-100 rounded-lg transition"><ArrowLeft size={18} /></Link>
            <Shield className="text-blue-600" size={22} />
            <h1 className="font-bold text-gray-800">HR Admin Dashboard</h1>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={refreshAll} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600 transition">
              <RefreshCw size={14} /> Làm mới
            </button>
            <button onClick={() => { localStorage.removeItem("user"); router.push("/login"); }} className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-600 transition font-medium">
              <LogOut size={14} /> Đăng xuất
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition relative ${tab === t.id ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-100 border'}`}>
              {t.icon} {t.label}
              {t.badge && t.badge > 0 && (
                <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full font-bold ${tab === t.id ? 'bg-white text-blue-600' : 'bg-red-500 text-white'}`}>{t.badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* ══════ Stats ══════ */}
        {tab === "stats" && stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border p-5 flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center"><Users className="text-blue-600" size={24} /></div>
              <div><p className="text-2xl font-bold text-gray-800">{stats.total_users}</p><p className="text-xs text-gray-500">Người dùng</p></div>
            </div>
            <div className="bg-white rounded-xl border p-5 flex items-center gap-4 cursor-pointer hover:border-orange-300 transition" onClick={() => setTab("leaves")}>
              <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center"><CalendarDays className="text-orange-500" size={24} /></div>
              <div><p className="text-2xl font-bold text-gray-800">{stats.pending_leaves}</p><p className="text-xs text-gray-500">Đơn phép chờ duyệt</p></div>
            </div>
            <div className="bg-white rounded-xl border p-5 flex items-center gap-4 cursor-pointer hover:border-indigo-300 transition" onClick={() => setTab("faq")}>
              <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center"><MessageCircle className="text-indigo-600" size={24} /></div>
              <div><p className="text-2xl font-bold text-gray-800">{stats.total_chats}</p><p className="text-xs text-gray-500">Lượt chat</p></div>
            </div>
            <div className="bg-white rounded-xl border p-5 flex items-center gap-4">
              <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center"><AlertTriangle className="text-red-500" size={24} /></div>
              <div><p className="text-2xl font-bold text-gray-800">{stats.total_error_reports}</p><p className="text-xs text-gray-500">Báo lỗi</p></div>
            </div>
            <div className="bg-white rounded-xl border p-5 flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center"><Database className="text-emerald-600" size={24} /></div>
              <div><p className="text-2xl font-bold text-gray-800">{stats.total_docs_in_vectordb}</p><p className="text-xs text-gray-500">Chunks trong DB</p></div>
            </div>
            <div className="bg-white rounded-xl border p-5 flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center"><Bot className="text-purple-600" size={24} /></div>
              <div><p className="text-sm font-bold text-gray-800">{stats.model}</p><p className="text-xs text-gray-500">{stats.tools.length} tools</p></div>
            </div>
          </div>
        )}

        {/* ══════ Leave Requests ══════ */}
        {tab === "leaves" && (
          <div className="space-y-3">
            {/* Filter pills */}
            <div className="flex gap-2 mb-2 text-xs">
              <span className="px-2.5 py-1 bg-yellow-100 text-yellow-700 rounded-full">Chờ duyệt: {leaves.filter(l => l.status === "pending").length}</span>
              <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-full">Đã duyệt: {leaves.filter(l => l.status === "approved").length}</span>
              <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-full">Từ chối: {leaves.filter(l => l.status === "rejected").length}</span>
            </div>

            {loading ? (
              <div className="text-center py-8 text-gray-400">Đang tải...</div>
            ) : leaves.length === 0 ? (
              <div className="bg-white rounded-xl border p-8 text-center text-gray-400">Chưa có đơn xin phép</div>
            ) : leaves.map(lv => (
              <div key={lv._id} className={`bg-white rounded-xl border p-4 transition ${lv.status === "pending" ? "border-yellow-200" : ""}`}>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold text-sm text-gray-800">{lv.fullname}</span>
                      <span className="text-xs text-gray-400">@{lv.username}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        lv.status === "pending" ? "bg-yellow-100 text-yellow-700" :
                        lv.status === "approved" ? "bg-green-100 text-green-700" :
                        "bg-red-100 text-red-700"
                      }`}>
                        {lv.status === "pending" ? "Chờ duyệt" : lv.status === "approved" ? "Đã duyệt" : "Từ chối"}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600 mb-1">
                      <span className="flex items-center gap-1"><CalendarDays size={14} /> {lv.date_from} → {lv.date_to}</span>
                    </div>
                    <p className="text-sm text-gray-500">Lý do: {lv.reason}</p>
                    <p className="text-xs text-gray-400 mt-1">Gửi lúc: {new Date(lv.created_at).toLocaleString("vi-VN")}</p>
                    {lv.reviewed_by && <p className="text-xs text-gray-400">Duyệt bởi: {lv.reviewed_by} — {lv.reviewed_at ? new Date(lv.reviewed_at).toLocaleString("vi-VN") : ""}</p>}
                  </div>

                  {lv.status === "pending" && (
                    <div className="flex gap-2 flex-shrink-0 ml-4">
                      <button onClick={() => approveLeave(lv._id)} className="flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition text-xs font-medium border border-green-200">
                        <Check size={14} /> Duyệt
                      </button>
                      <button onClick={() => rejectLeave(lv._id)} className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition text-xs font-medium border border-red-200">
                        <XCircle size={14} /> Từ chối
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ══════ Users ══════ */}
        {tab === "users" && (
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Username</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Họ tên</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Role</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Ngày tạo</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="text-center py-8 text-gray-400">Đang tải...</td></tr>
                ) : users.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-8 text-gray-400">Chưa có người dùng</td></tr>
                ) : users.map((u, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{u.username}</td>
                    <td className="px-4 py-3 text-gray-600">{u.fullname}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => toggleRole(u.username, u.role || "employee")} className={`text-xs px-2.5 py-1 rounded-full font-medium transition ${u.role === "hr" ? "bg-purple-100 text-purple-700 hover:bg-purple-200" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                        {u.role === "hr" ? "HR" : "Nhân viên"}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{new Date(u.created_at).toLocaleString("vi-VN")}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => deleteUser(u.username)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition" title="Xoá">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-3 bg-gray-50 border-t text-xs text-gray-400">Tổng: {users.length} người dùng</div>
          </div>
        )}

        {/* ══════ FAQ & Stats ══════ */}
        {tab === "faq" && (
          <div className="space-y-6">
            {loading ? (
              <div className="text-center py-8 text-gray-400">Đang tải...</div>
            ) : (
              <>
                {/* Tool usage breakdown */}
                <div className="bg-white rounded-xl border p-5">
                  <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><BarChart3 size={16} /> Phân bổ theo loại Tool ({totalChats} lượt chat)</h3>
                  {toolStats.length === 0 ? (
                    <p className="text-gray-400 text-sm">Chưa có dữ liệu</p>
                  ) : (
                    <div className="space-y-2">
                      {toolStats.map((s, i) => {
                        const maxCount = toolStats[0]?.count || 1;
                        const pct = Math.round((s.count / maxCount) * 100);
                        return (
                          <div key={i} className="flex items-center gap-3">
                            <span className="text-xs text-gray-600 w-36 flex-shrink-0 truncate">{toolLabel(s.tool)}</span>
                            <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                              <div className="bg-blue-500 h-full rounded-full flex items-center justify-end pr-2 transition-all" style={{ width: `${Math.max(pct, 8)}%` }}>
                                <span className="text-xs text-white font-medium">{s.count}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Daily chat chart */}
                <div className="bg-white rounded-xl border p-5">
                  <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><TrendingUp size={16} /> Lượt chat theo ngày</h3>
                  {dailyStats.length === 0 ? (
                    <p className="text-gray-400 text-sm">Chưa có dữ liệu</p>
                  ) : (
                    <div className="flex items-end gap-2 h-32">
                      {[...dailyStats].reverse().map((d, i) => {
                        const maxDay = Math.max(...dailyStats.map(x => x.count));
                        const h = Math.max((d.count / maxDay) * 100, 8);
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`${d.date}: ${d.count} lượt`}>
                            <span className="text-xs text-gray-500 font-medium">{d.count}</span>
                            <div className="w-full bg-blue-400 rounded-t-md transition-all hover:bg-blue-500" style={{ height: `${h}%` }} />
                            <span className="text-[10px] text-gray-400">{d.date.slice(5)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Recent questions */}
                <div className="bg-white rounded-xl border p-5">
                  <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><MessageCircle size={16} /> Câu hỏi gần đây</h3>
                  {recentQuestions.length === 0 ? (
                    <p className="text-gray-400 text-sm">Chưa có dữ liệu</p>
                  ) : (
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                      {recentQuestions.map((q, i) => (
                        <div key={i} className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 transition">
                          <div className="w-8 h-8 bg-blue-50 rounded-full flex items-center justify-center flex-shrink-0"><MessageCircle className="text-blue-500" size={14} /></div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-800 truncate">{q.question}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-gray-400">@{q.username}</span>
                              <span className="text-xs px-1.5 py-0.5 bg-gray-100 rounded text-gray-500">{toolLabel(q.tool_used)}</span>
                              <span className="text-xs text-gray-400">{new Date(q.timestamp).toLocaleString("vi-VN")}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ══════ Error Reports ══════ */}
        {tab === "reports" && (
          <div>
            {reports.length > 0 && (
              <div className="flex justify-end mb-3">
                <button onClick={clearReports} className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition border border-red-200">
                  <Trash2 size={12} /> Xoá tất cả
                </button>
              </div>
            )}
            <div className="space-y-3">
              {loading ? (
                <div className="text-center py-8 text-gray-400">Đang tải...</div>
              ) : reports.length === 0 ? (
                <div className="bg-white rounded-xl border p-8 text-center text-gray-400">Chưa có báo lỗi nào</div>
              ) : reports.map((r, i) => (
                <div key={i} className="bg-white rounded-xl border p-4 space-y-2">
                  <div className="flex justify-between items-start">
                    <span className="text-xs text-gray-400">{new Date(r.timestamp).toLocaleString("vi-VN")}</span>
                    {r.user_note && <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full border border-red-200">{r.user_note}</span>}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Câu hỏi:</p>
                    <p className="text-sm text-gray-800 bg-blue-50 rounded-lg px-3 py-2">{r.original_question}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">AI trả lời (sai):</p>
                    <p className="text-sm text-gray-600 bg-red-50 rounded-lg px-3 py-2 line-clamp-3">{r.ai_answer}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══════ Documents ══════ */}
        {tab === "docs" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {loading ? (
              <div className="col-span-2 text-center py-8 text-gray-400">Đang tải...</div>
            ) : docs.map((d, i) => (
              <button key={i} onClick={() => viewDoc(d.filename)} className="bg-white rounded-xl border p-4 flex items-center gap-4 hover:border-blue-300 hover:bg-blue-50/50 transition text-left">
                <div className="w-10 h-10 bg-cyan-50 rounded-lg flex items-center justify-center flex-shrink-0"><FileText className="text-cyan-600" size={20} /></div>
                <div className="min-w-0">
                  <p className="font-medium text-gray-800 text-sm truncate">{d.filename}</p>
                  <p className="text-xs text-gray-400">{(d.size_bytes / 1024).toFixed(1)} KB</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Document Viewer Modal */}
        {selectedDoc && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setSelectedDoc(null)}>
            <div className="bg-white w-full max-w-2xl h-3/4 rounded-xl shadow-2xl flex flex-col border" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center p-4 border-b bg-gray-50 rounded-t-xl">
                <div>
                  <p className="font-semibold text-sm">{selectedDoc}</p>
                  <p className="text-xs text-gray-400">Tài liệu nội bộ</p>
                </div>
                <button onClick={() => setSelectedDoc(null)} className="p-1.5 hover:bg-gray-200 rounded-full transition text-gray-500">&#10005;</button>
              </div>
              <div className="p-4 flex-1 overflow-y-auto whitespace-pre-wrap text-sm text-gray-700 font-mono">
                {docContent || <span className="text-gray-400 animate-pulse">Đang tải...</span>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
