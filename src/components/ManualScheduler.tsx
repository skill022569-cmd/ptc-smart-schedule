"use client";
import { useCallback, useEffect, useState } from "react";
import ScheduleGrid, { type Highlight } from "./ScheduleGrid";
import type { Cell, SlotRow } from "@/lib/schedule-query";

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

  const load = useCallback(async () => {
    const r = await fetch(`/api/manual?groupId=${gid}`);
    setData(r.ok ? await r.json() : { cells: [], enrollments: [] });
  }, [gid]);
  useEffect(() => { setSel(null); setPicked(null); setMoving(null); load(); }, [load]);

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
        </section>
      </div>
    </div>
  );
}
