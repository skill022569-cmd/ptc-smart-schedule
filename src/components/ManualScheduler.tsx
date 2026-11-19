"use client";
import { useCallback, useEffect, useState } from "react";
import ScheduleGrid, { type Highlight } from "./ScheduleGrid";
import type { Cell, SlotRow } from "@/lib/schedule-query";

type AiAction = { type: "place" | "move" | "remove" | "setSplit"; enrollmentId: number; day: number; start: number; fromDay: number; fromPeriod: number; allowSplit: boolean; label: string };
type ChatMsg = { role: "user" | "assistant"; content: string; actions?: AiAction[] };
const AI_EXAMPLES = ["แนะนำการวางวิชาที่ยังจัดไม่ครบ", "ทำไมวิชาที่ยังไม่ครบถึงวางไม่ได้", "ช่วยลดคาบว่างระหว่างวันของกลุ่มนี้"];
type Enr = { id: number; subject: string; teacher: string; hours: number; placed: number; allowSplit: boolean; nextLength: number; feasible: string[] };
const DAYS = ["", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์"];
const post = (body: unknown) => fetch("/api/resolve", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
  .then(async (r) => ({ ok: r.ok, ...(await r.json().catch(() => ({ error: `HTTP ${r.status}` }))) }));

export default function ManualScheduler({ slots, groups }: { slots: SlotRow[]; groups: { id: number; label: string }[] }) {
  const [gid, setGid] = useState(groups[0]?.id ?? 0);
  const [data, setData] = useState<{ cells: Cell[]; enrollments: Enr[] } | null>(null);
  const [sel, setSel] = useState<number | null>(null); // วิชาที่กำลังจะวาง
  const [picked, setPicked] = useState<Cell | null>(null); // คาบที่คลิกในตาราง
  const [moving, setMoving] = useState<Cell | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [aiBusy, setAiBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(`/api/manual?groupId=${gid}`);
    setData(r.ok ? await r.json() : { cells: [], enrollments: [] });
  }, [gid]);
  useEffect(() => { setSel(null); setPicked(null); setMoving(null); setChat([]); load(); }, [load]);

  async function ask(q: string) {
    if (!q.trim() || aiBusy) return;
    const next: ChatMsg[] = [...chat, { role: "user" as const, content: q.trim() }].slice(-10);
    setChat(next); setAiBusy(true);
    try {
      const r = await fetch("/api/manual/ai", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ groupId: gid, messages: next.map(({ role, content }) => ({ role, content })) }) });
      const j = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
      setChat([...next, { role: "assistant", content: j.answer ?? `⚠️ ${j.error ?? "เกิดข้อผิดพลาด"}`, actions: j.actions ?? [] }]);
    } catch { setChat([...next, { role: "assistant", content: "⚠️ เชื่อมต่อไม่ได้" }]); }
    setAiBusy(false);
  }
  // คำแนะนำจาก AI ผ่าน /api/resolve เหมือนการกดเอง จึงถูกตรวจ hard constraints ทุกครั้ง
  const applyAi = (a: AiAction) =>
    a.type === "place" ? act({ action: "manual", enrollmentId: a.enrollmentId, day: a.day, start: a.start }, a.label)
    : a.type === "move" ? act({ action: "move", enrollmentId: a.enrollmentId, fromDay: a.fromDay, fromPeriod: a.fromPeriod, day: a.day, start: a.start }, a.label)
    : a.type === "remove" ? act({ action: "remove", enrollmentId: a.enrollmentId, day: a.day, start: a.start }, a.label)
    : act({ action: "setSplit", enrollmentId: a.enrollmentId, value: a.allowSplit }, a.label);

  async function act(body: Record<string, unknown>, ok: string) {
    setBusy(true);
    const r = await post(body);
    setMsg(r.ok ? `✅ ${ok}` : `❌ ${r.error}`);
    if (r.ok) { setSel(null); setPicked(null); setMoving(null); await load(); }
    setBusy(false);
  }

  const selected = data?.enrollments.find((e) => e.id === sel);
  const highlight: Record<string, Highlight> = Object.fromEntries((selected?.feasible ?? []).map((k) => [k, "both"]));
  const cellAt = (d: number, p: number) => data?.cells.find((c) => c.day === d && c.period === p) ?? null;

  function click(day: number, period: number) {
    if (busy) return;
    if (moving) return act({ action: "move", enrollmentId: moving.enrollmentId, fromDay: moving.day, fromPeriod: moving.period, day, start: period }, `ย้ายไปวัน${DAYS[day]} คาบ ${period} แล้ว`);
    const c = cellAt(day, period);
    if (c) { setSel(null); setPicked(c); return; }
    if (sel) return act({ action: "manual", enrollmentId: sel, day, start: period }, `วางวัน${DAYS[day]} คาบ ${period} แล้ว`);
    setMsg("เลือกรายวิชาทางซ้ายก่อน แล้วคลิกช่องสีเขียว");
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm">กลุ่มเรียน
          <select className="input ml-2" value={gid} onChange={(e) => setGid(Number(e.target.value))}>{groups.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}</select>
        </label>
        {msg && <span className="text-sm" aria-live="polite">{msg}</span>}
      </div>
      <div className="grid gap-3 lg:grid-cols-[20rem_1fr]">
        <section className="card space-y-2">
          <h2 className="font-semibold">รายวิชาของกลุ่ม</h2>
          <p className="text-xs text-stone-500">คลิกวิชาที่ยังจัดไม่ครบ แล้วคลิกช่อง<span className="bg-emerald-200 px-1">สีเขียว</span>ในตารางเพื่อวาง</p>
          {!data && <p className="text-sm text-stone-500">กำลังโหลด...</p>}
          <ul className="space-y-1">
            {data?.enrollments.map((e) => {
              const done = e.placed >= e.hours;
              return (
                <li key={e.id}>
                  <button disabled={done || busy} onClick={() => { setSel(e.id); setPicked(null); setMoving(null); }}
                    className={`w-full rounded border p-2 text-left text-sm ${sel === e.id ? "border-brand-700 bg-brand-50 ring-2 ring-brand-400" : "border-stone-200"} ${done ? "opacity-60" : "hover:border-brand-400"}`}>
                    <div className="font-semibold">{e.subject}</div>
                    <div className="text-xs text-stone-600">{e.teacher}</div>
                    <div className={`text-xs ${done ? "text-emerald-700" : "text-red-700"}`}>{done ? "✓ จัดครบ" : `จัดแล้ว ${e.placed}/${e.hours} คาบ — ก้อนถัดไป ${e.nextLength} คาบ${e.feasible.length ? "" : " (ไม่มีช่องว่าง)"}`}</div>
                  </button>
                  <label className="ml-1 flex items-center gap-1 text-xs text-stone-600">
                    <input type="checkbox" checked={e.allowSplit} disabled={busy}
                      onChange={(ev) => act({ action: "setSplit", enrollmentId: e.id, value: ev.target.checked }, ev.target.checked ? "อนุญาตแบ่งคาบแล้ว (ก้อนละ ≤2 คาบ สำหรับคาบที่ยังไม่จัด)" : "ยกเลิกการแบ่งคาบแล้ว")} />
                    แบ่งสอนเป็นก้อนย่อยได้
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
        <section className="card min-w-0 space-y-2">
          {moving ? <p className="rounded bg-yellow-100 p-2 text-sm">กำลังย้าย <b>{moving.subject}</b> — คลิกคาบเริ่มต้นใหม่ในตาราง <button className="ml-2 underline" onClick={() => setMoving(null)}>ยกเลิก</button></p>
            : selected ? <p className="rounded bg-emerald-50 p-2 text-sm">กำลังวาง <b>{selected.subject}</b> ({selected.nextLength} คาบ) — คลิกช่องสีเขียว = คาบเริ่มต้น <button className="ml-2 underline" onClick={() => setSel(null)}>ยกเลิก</button></p>
            : <p className="text-sm text-stone-500">คลิกวิชาในตารางเพื่อย้ายหรือลบ</p>}
          {picked && (
            <div className="flex flex-wrap items-center gap-2 rounded border border-brand-200 bg-brand-50 p-2 text-sm">
              <span><b>{picked.subject}</b> วัน{DAYS[picked.day]} คาบ {picked.period} · {picked.teacher} · ห้อง {picked.room}</span>
              <button className="btn-outline" disabled={busy} onClick={() => { setMoving(picked); setPicked(null); }}>↔ ย้าย</button>
              <button className="btn-outline" disabled={busy} onClick={() => confirm("เอาคาบนี้ออกจากตาราง?") && act({ action: "remove", enrollmentId: picked.enrollmentId, day: picked.day, start: picked.period }, "เอาออกจากตารางแล้ว")}>🗑 ลบออก</button>
              <button className="underline" onClick={() => setPicked(null)}>ปิด</button>
            </div>
          )}
          <ScheduleGrid slots={slots} cells={data?.cells ?? []} highlight={highlight} onCellClick={click} show={["teacher", "room"]} />
          <div className="space-y-2 rounded-lg border border-gold-500/50 bg-gold-300/10 p-3">
            <h3 className="font-semibold text-brand-800">🤖 ผู้ช่วย AI จัดตาราง</h3>
            <p className="text-xs text-stone-500">AI เห็นตารางของกลุ่มนี้ ช่องว่าง และเวลาที่ครูติด — คำแนะนำเป็นปุ่มให้กดยืนยันเอง ระบบตรวจการชนซ้ำทุกครั้ง</p>
            <div className="max-h-80 space-y-2 overflow-y-auto text-sm" aria-live="polite">
              {!chat.length && <div className="flex flex-wrap gap-2">{AI_EXAMPLES.map((e) => <button key={e} className="btn-outline text-xs" onClick={() => ask(e)}>{e}</button>)}</div>}
              {chat.map((m, i) => (
                <div key={i} className={`rounded-md px-2 py-1 ${m.role === "user" ? "ml-10 bg-brand-50" : "mr-10 bg-white"}`}>
                  <div className="whitespace-pre-wrap">{m.content}</div>
                  {!!m.actions?.length && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {m.actions.map((a, k) => <button key={k} className="btn text-xs" disabled={busy} onClick={() => applyAi(a)}>✔ {a.label}</button>)}
                    </div>
                  )}
                </div>
              ))}
              {aiBusy && <div className="text-stone-400">AI กำลังวิเคราะห์ตาราง...</div>}
            </div>
            <form className="flex gap-1" onSubmit={(e) => { e.preventDefault(); const f = e.currentTarget; ask(String(new FormData(f).get("q") ?? "")); f.reset(); }}>
              <input name="q" aria-label="ถามผู้ช่วย AI" className="input flex-1" placeholder="เช่น วิชา 20001 ควรวางวันไหนดี" maxLength={2000} />
              <button className="btn" disabled={aiBusy}>ถาม</button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
