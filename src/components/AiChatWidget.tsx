"use client";
import { useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };
const EXAMPLES = ["พรุ่งนี้เช้ามีเรียนห้องไหน", "ครูสมศรีว่างวันไหนบ้าง", "ขั้นตอนการแจ้งขอเปลี่ยนห้องเรียนทำอย่างไร"];

export default function AiChatWidget() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function send(text: string) {
    if (!text.trim() || busy) return;
    const next: Msg[] = [...msgs, { role: "user" as const, content: text.trim() }].slice(-10);
    setMsgs(next); setBusy(true);
    if (input.current) input.current.value = "";
    try {
      const r = await fetch("/api/ai-assistant", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: next }) });
      const j = await r.json();
      setMsgs([...next, { role: "assistant", content: j.reply ?? `⚠️ ${j.error ?? "เกิดข้อผิดพลาด"}` }]);
    } catch {
      setMsgs([...next, { role: "assistant", content: "⚠️ เชื่อมต่อไม่ได้" }]);
    } finally { setBusy(false); }
  }

  return (
    <div className="no-print fixed bottom-4 right-4 z-50">
      {open && (
        <div className="mb-2 flex h-[28rem] w-[22rem] max-w-[calc(100vw-2rem)] flex-col rounded-lg border bg-white shadow-xl">
          <div className="flex items-center justify-between rounded-t-lg bg-brand-700 px-3 py-2 text-white">
            <span className="font-semibold">ผู้ช่วย AI ตารางเรียน</span>
            <button aria-label="ปิด" onClick={() => setOpen(false)}>✕</button>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto p-3 text-sm" aria-live="polite">
            {!msgs.length && <div className="space-y-1 text-slate-500">ลองถาม:{EXAMPLES.map((e) => <button key={e} className="block text-left text-brand-700 underline" onClick={() => send(e)}>{e}</button>)}</div>}
            {msgs.map((m, i) => <div key={i} className={`whitespace-pre-wrap rounded-md px-2 py-1 ${m.role === "user" ? "ml-8 bg-brand-50" : "mr-8 bg-slate-100"}`}>{m.content}</div>)}
            {busy && <div className="text-slate-400">กำลังคิด...</div>}
          </div>
          <form className="flex gap-1 border-t p-2" onSubmit={(e) => { e.preventDefault(); send(input.current?.value ?? ""); }}>
            <input ref={input} aria-label="พิมพ์คำถาม" className="input flex-1" placeholder="พิมพ์คำถาม..." maxLength={2000} />
            <button className="btn" disabled={busy}>ส่ง</button>
          </form>
        </div>
      )}
      <button className="btn rounded-full px-4 py-3 shadow-lg" onClick={() => setOpen(!open)} aria-expanded={open}>💬 ถาม AI</button>
    </div>
  );
}
