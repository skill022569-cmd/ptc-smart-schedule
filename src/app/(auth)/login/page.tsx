"use client";
import { useState } from "react";

const MARQUEE_TH = "วิทยาลัยการอาชีพโพนทอง  ✦  ";
const MARQUEE_EN = "Phonthong Industrial and Community Education College  ✦  ";

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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-brand-50 via-stone-50 to-gold-300/20 p-4">
      <div aria-hidden className="pointer-events-none absolute inset-0 flex select-none flex-col justify-around">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className={`marquee flex w-max whitespace-nowrap text-4xl font-bold sm:text-6xl ${i % 2 ? "marquee-rev text-gold-500/15" : "text-brand-800/[0.07]"}`}
            style={{ animationDuration: `${45 + i * 7}s` }}>
            {[0, 1].map((k) => <span key={k} className="pr-12">{(i % 2 ? MARQUEE_EN : MARQUEE_TH).repeat(3)}</span>)}
          </div>
        ))}
      </div>
      <form onSubmit={submit} className="card relative z-10 w-full max-w-sm space-y-3 border-t-4 border-t-brand-800 bg-white/95 shadow-xl backdrop-blur">
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
