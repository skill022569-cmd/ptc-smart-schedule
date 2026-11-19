"use client";
import { useState } from "react";

export default function LoginPage() {
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setErr("");
    const f = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.fromEntries(f)) });
      if (res.ok) { location.href = "/"; return; }
      const j = await res.json().catch(() => ({}));
      setErr(j.error ?? `เซิร์ฟเวอร์ผิดพลาด (HTTP ${res.status})`);
    } catch {
      setErr("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    }
    setBusy(false);
  }
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-3 border-t-4 border-t-brand-800">
        <img src="/logo.png" alt="ตราวิทยาลัยการอาชีพโพนทอง" width={96} height={96} className="mx-auto h-24 w-24" />
        <div className="text-center">
          <h1 className="text-lg font-bold">วิทยาลัยการอาชีพโพนทอง</h1>
          <p className="text-sm text-stone-600">ระบบจัดตารางเรียน-ตารางสอน (PTC Smart Schedule)</p>
        </div>
        <hr className="border-gold-500" />
        <p className="text-sm text-stone-500">เข้าสู่ระบบด้วยรหัสบุคลากร / รหัสนักเรียน</p>
        <label className="block text-sm">ชื่อผู้ใช้<input name="username" required autoComplete="username" className="input mt-1 w-full" /></label>
        <label className="block text-sm">รหัสผ่าน<input name="password" type="password" required autoComplete="current-password" className="input mt-1 w-full" /></label>
        {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
        <button className="btn w-full justify-center" disabled={busy}>{busy ? "กำลังตรวจสอบ..." : "เข้าสู่ระบบ"}</button>
      </form>
    </main>
  );
}
