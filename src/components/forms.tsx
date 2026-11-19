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
