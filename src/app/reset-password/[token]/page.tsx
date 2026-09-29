"use client";

import { FormEvent, useState } from "react";
import { useParams } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5293/api/v1";

export default function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password.length < 6 || password !== confirm) {
      setMessage(password !== confirm ? "Mật khẩu xác nhận không khớp." : "Mật khẩu phải có ít nhất 6 ký tự.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`${API_URL}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const payload = await response.json().catch(() => ({}));
      setMessage(response.ok ? "Đặt lại mật khẩu thành công. Bạn có thể đăng nhập." : payload.message || "Liên kết không hợp lệ hoặc đã hết hạn.");
    } catch {
      setMessage("Không thể kết nối máy chủ. Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4"><form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm"><h1 className="mb-2 text-2xl font-bold text-gray-900">Đặt lại mật khẩu</h1><p className="mb-6 text-sm text-gray-500">Tạo mật khẩu mới cho tài khoản của bạn.</p><label className="mb-4 block text-sm font-medium">Mật khẩu mới<input className="mt-2 w-full rounded-lg border p-3" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label><label className="mb-4 block text-sm font-medium">Xác nhận mật khẩu<input className="mt-2 w-full rounded-lg border p-3" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required /></label>{message && <p className="mb-4 text-sm text-red-600">{message}</p>}<button disabled={busy} className="w-full rounded-lg bg-indigo-600 p-3 font-semibold text-white disabled:opacity-50">{busy ? "Đang xử lý..." : "Đổi mật khẩu"}</button></form></main>;
}
