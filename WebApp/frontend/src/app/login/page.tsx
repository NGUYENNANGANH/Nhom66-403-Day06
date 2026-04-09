"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { LogIn, Eye, EyeOff } from "lucide-react";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/auth/login`, { username, password });
      localStorage.setItem("user", JSON.stringify(res.data.user));
      router.push("/");
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        setError("Sai tên đăng nhập hoặc mật khẩu.");
      } else {
        setError("Lỗi kết nối server. Kiểm tra backend đang chạy.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <LogIn className="text-white" size={28} />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">HR Copilot</h1>
          <p className="text-gray-500 text-sm mt-1">Đăng nhập để sử dụng hệ thống</p>
        </div>

        <form onSubmit={handleLogin} className="bg-white rounded-2xl shadow-xl p-8 space-y-5 border border-gray-100">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Tên đăng nhập</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-sm"
              placeholder="Nhập username..."
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Mật khẩu</label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-sm pr-12"
                placeholder="Nhập mật khẩu..."
                required
              />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 transition disabled:bg-blue-300 flex items-center justify-center gap-2"
          >
            {loading ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>

          <p className="text-center text-sm text-gray-500">
            Chưa có tài khoản?{" "}
            <Link href="/register" className="text-blue-600 font-medium hover:underline">
              Đăng ký ngay
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
