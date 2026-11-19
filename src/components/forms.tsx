"use client";
// ส่วนโต้ตอบเล็กๆ ที่หน้า server component ใช้
import { useEffect, useState } from "react";

const send = (url: string, method: string, body: unknown) =>
  fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then(async (r) => ({ ok: r.ok, ...(await r.json()) }));

export function PrintButton({ auto }: { auto?: boolean }) {
  useEffect(() => {
    if (!auto) return;
    const t = setTimeout(() => window.print(), 500);
    return () => clearTimeout(t);
  }, [auto]);
  return <button className="btn no-print" onClick={() => window.print()}>🖨 พิมพ์ / บันทึกเป็น PDF</button>;
}

export function IssueForm({ categories }: { categories: string[] }) {
  const [msg, setMsg] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const r = await send("/api/issues", "POST", Object.fromEntries(new FormData(form)));
    if (r.ok) { form.reset(); location.reload(); } else setMsg(r.error);
  }
  return (
    <form onSubmit={submit} className="card space-y-2">
      <h2 className="font-semibold">แจ้งปัญหา / ขอปรับเปลี่ยนตาราง</h2>
      <label className="block text-sm">หมวดหมู่
        <select name="category" required className="input mt-1 w-full">{categories.map((c) => <option key={c}>{c}</option>)}</select>
      </label>
      <label className="block text-sm">รายละเอียด
        <textarea name="description" required maxLength={5000} rows={4} className="input mt-1 w-full" placeholder="เช่น วิชา 30204-2101 กลุ่ม ปวส.1/1 วันจันทร์คาบ 3 ชนกับ..." />
      </label>
      {msg && <p role="alert" className="text-sm text-red-600">{msg}</p>}
      <button className="btn">ส่งเรื่อง</button>
    </form>
  );
}

export function IssueAdmin({ id, status, reply }: { id: number; status: string; reply: string | null }) {
  const [s, setS] = useState(status);
  const [r, setR] = useState(reply ?? "");
  const [saved, setSaved] = useState("");
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <select aria-label="สถานะ" className="input" value={s} onChange={(e) => setS(e.target.value)}>
        <option value="PENDING">รอดำเนินการ</option><option value="IN_PROGRESS">กำลังแก้ไข</option><option value="DONE">เสร็จสิ้น</option>
      </select>
      <input aria-label="ตอบกลับ" className="input flex-1" value={r} onChange={(e) => setR(e.target.value)} placeholder="ตอบกลับผู้แจ้ง" />
      <button className="btn-outline" onClick={async () => setSaved((await send("/api/issues", "PATCH", { id, status: s, adminReply: r })).ok ? "✓ บันทึกแล้ว" : "❌")}>บันทึก</button>
      <span className="text-sm text-emerald-700">{saved}</span>
    </div>
  );
}

export function PdpaActions({ consented }: { consented: boolean }) {
  const [msg, setMsg] = useState("");
  const act = async (action: string, note?: string) => {
    const r = await send("/api/pdpa", "POST", { action, note });
    setMsg(r.ok ? "✓ บันทึกคำขอแล้ว" : `❌ ${r.error}`);
    if (r.ok && (action === "CONSENT" || action === "WITHDRAW")) location.reload();
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <a className="btn" href="/api/pdpa">⬇ ขอสำเนาข้อมูลของฉัน (JSON)</a>
        {consented
          ? <button className="btn-outline" onClick={() => confirm("ถอนความยินยอม? ระบบจะขอความยินยอมใหม่เมื่อเข้าใช้งาน") && act("WITHDRAW")}>ถอนความยินยอม</button>
          : <button className="btn-outline" onClick={() => act("CONSENT")}>ให้ความยินยอม</button>}
        <button className="btn-outline" onClick={() => { const n = prompt("ระบุข้อมูลที่ต้องการแก้ไข"); if (n) act("CORRECT_REQUEST", n); }}>ขอแก้ไขข้อมูล</button>
        <button className="btn-outline" onClick={() => { const n = prompt("ระบุเหตุผลที่ขอลบข้อมูล"); if (n) act("DELETE_REQUEST", n); }}>ขอลบข้อมูล</button>
      </div>
      {msg && <p className="text-sm">{msg}</p>}
    </div>
  );
}

export function StaffEditForm({ p, admin }: { admin: boolean; p: { id: number; fullName: string; position: string; department: string; duties: string; bio: string; boardOrder: number | null } }) {
  const [msg, setMsg] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const r = await send("/api/staff", "PATCH", { id: p.id, ...Object.fromEntries(new FormData(e.currentTarget)) });
    if (r.ok) location.reload(); else setMsg(`❌ ${r.error}`);
  }
  return (
    <form onSubmit={submit} className="card space-y-2 text-sm">
      <h2 className="font-semibold">แก้ไขข้อมูล</h2>
      {admin && (
        <div className="grid gap-2 sm:grid-cols-2">
          <label>ชื่อ-สกุล<input name="fullName" required defaultValue={p.fullName} className="input mt-1 w-full" /></label>
          <label>ตำแหน่ง<input name="position" defaultValue={p.position} className="input mt-1 w-full" /></label>
          <label>แผนก/ฝ่าย<input name="department" defaultValue={p.department} className="input mt-1 w-full" /></label>
          <label>ลำดับในคณะผู้บริหาร (เว้นว่าง = ไม่ใช่ผู้บริหาร, 1 = ผู้อำนวยการ)
            <input name="boardOrder" type="number" min={1} max={99} defaultValue={p.boardOrder ?? ""} className="input mt-1 w-full" /></label>
        </div>
      )}
      <label className="block">หน้าที่ / ภาระงาน<textarea name="duties" rows={3} maxLength={5000} defaultValue={p.duties} className="input mt-1 w-full" /></label>
      <label className="block">ประวัติ (การศึกษา ประสบการณ์ ผลงาน)<textarea name="bio" rows={6} maxLength={10000} defaultValue={p.bio} className="input mt-1 w-full" /></label>
      {msg && <p role="alert" className="text-red-600">{msg}</p>}
      <button className="btn">บันทึก</button>
    </form>
  );
}

export function ChangePasswordForm({ username }: { username: string }) {
  const [msg, setMsg] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = Object.fromEntries(new FormData(form)) as Record<string, string>;
    if (f.next !== f.confirm) return setMsg("❌ รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน");
    const r = await send("/api/account/password", "POST", { current: f.current, next: f.next });
    setMsg(r.ok ? "✅ เปลี่ยนรหัสผ่านแล้ว ครั้งต่อไปให้เข้าสู่ระบบด้วยรหัสใหม่" : `❌ ${r.error}`);
    if (r.ok) form.reset();
  }
  return (
    <form onSubmit={submit} className="card space-y-2 text-sm">
      <p className="text-stone-600">ชื่อผู้ใช้: <b>{username}</b></p>
      <label className="block">รหัสผ่านปัจจุบัน<input name="current" type="password" required autoComplete="current-password" className="input mt-1 w-full" /></label>
      <label className="block">รหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)<input name="next" type="password" required minLength={8} maxLength={100} autoComplete="new-password" className="input mt-1 w-full" /></label>
      <label className="block">ยืนยันรหัสผ่านใหม่<input name="confirm" type="password" required minLength={8} maxLength={100} autoComplete="new-password" className="input mt-1 w-full" /></label>
      {msg && <p role="alert">{msg}</p>}
      <button className="btn">บันทึกรหัสผ่านใหม่</button>
    </form>
  );
}

export function ResetPasswordButton({ userId, name }: { userId: number; name: string }) {
  const [res, setRes] = useState<{ username: string; password: string } | null>(null);
  const [msg, setMsg] = useState("");
  const [pw, setPw] = useState("");
  async function reset(password?: string) {
    if (!confirm(`ตั้งรหัสผ่านใหม่ให้ ${name}? รหัสเดิมจะใช้ไม่ได้ทันที`)) return;
    const r = await send("/api/account/reset", "POST", { userId, password });
    if (r.ok) { setRes({ username: r.username, password: r.password }); setMsg(""); setPw(""); } else setMsg(`❌ ${r.error}`);
  }
  return (
    <div className="space-y-2 rounded border border-brand-200 p-3 text-sm">
      <h3 className="font-semibold">🔑 แก้ไขรหัสผ่าน (กรณีลืมรหัส)</h3>
      <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); reset(pw); }}>
        <label className="flex-1">ตั้งรหัสผ่านใหม่ให้ (อย่างน้อย 8 ตัวอักษร)
          <input type="text" value={pw} onChange={(e) => setPw(e.target.value)} minLength={8} maxLength={100} required autoComplete="off" className="input mt-1 w-full font-mono" />
        </label>
        <button className="btn">บันทึกรหัสนี้</button>
        <button type="button" className="btn-outline" onClick={() => reset()}>สุ่มรหัสชั่วคราว</button>
      </form>
      {msg && <p role="alert">{msg}</p>}
      {res && (
        <div role="status" className="rounded border border-gold-500 bg-gold-300/20 p-3">
          <p>✅ บันทึกแล้ว แจ้งครูให้เข้าสู่ระบบด้วยข้อมูลนี้ (แนะนำให้เปลี่ยนเป็นรหัสของตนเองที่เมนู &quot;เปลี่ยนรหัสผ่าน&quot;):</p>
          <p className="mt-1 font-mono text-base">ชื่อผู้ใช้: <b>{res.username}</b> · รหัสผ่าน: <b className="select-all">{res.password}</b></p>
        </div>
      )}
    </div>
  );
}
