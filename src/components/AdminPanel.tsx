"use client";
import { useCallback, useEffect, useState } from "react";
import ScheduleGrid, { type Highlight } from "./ScheduleGrid";
import type { ConflictReport } from "@/engine/conflict-analyzer";
import type { SlotRow } from "@/lib/schedule-query";

const DAYS = ["", "จ.", "อ.", "พ.", "พฤ.", "ศ."];
const post = (url: string, body: unknown) => fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
  .then(async (r) => ({ ok: r.ok, ...(await r.json()) }));

export default function AdminPanel({ slots }: { slots: SlotRow[] }) {
  const [conflicts, setConflicts] = useState<ConflictReport[] | null>(null);
  const [empty, setEmpty] = useState(false);
  const [rooms, setRooms] = useState<{ id: number; code: string }[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState<number | null>(null);
  const [backups, setBackups] = useState<{ id: number; backupName: string; createdAt: string; createdBy: { fullName: string } }[]>([]);
  const room = (id: number) => rooms.find((r) => r.id === id)?.code ?? id;

  const refresh = useCallback(async () => {
    const [c, b] = await Promise.all([fetch("/api/resolve").then((r) => r.json()), fetch("/api/backup").then((r) => r.json())]);
    setConflicts(c.conflicts ?? []); setRooms(c.rooms ?? []); setEmpty(!!c.empty); setBackups(Array.isArray(b) ? b : []);
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  async function act(label: string, fn: () => Promise<{ ok: boolean; error?: string } & Record<string, unknown>>, done: (r: Record<string, unknown>) => string) {
    setBusy(true); setMsg(`${label}...`);
    try { const r = await fn(); setMsg(r.ok ? done(r) : `❌ ${r.error}`); if (r.ok) { setManual(null); await refresh(); } }
    catch { setMsg("❌ เชื่อมต่อเซิร์ฟเวอร์ไม่ได้"); }
    finally { setBusy(false); }
  }
  const run = (keepExisting: boolean) => act(keepExisting ? "กำลังจัดเฉพาะที่เหลือ (คงคาบเดิม)" : "กำลังจัดตารางใหม่ทั้งหมด (CSP + GA)", () => post("/api/generate", { timeLimitMs: 15000, keepExisting }), (r) => {
    const s = r.stats as { placed: number; sessions: number; ms: number; generations: number; penalty: number };
    return `✅ จัดแล้ว ${s.placed}/${s.sessions} ก้อน ใน ${(s.ms / 1000).toFixed(1)} วินาที (GA ${s.generations} รุ่น, soft penalty ${s.penalty}) จัดไม่สำเร็จ ${r.conflicts} รายการ`
      + ((r.warnings as string[]).length ? `\n⚠️ ${(r.warnings as string[]).join("\n⚠️ ")}` : "");
  });
  const resolve = (enrollmentId: number, action: string, extra = {}) =>
    act("กำลังแก้ไข", () => post("/api/resolve", { action, enrollmentId, ...extra }), (r) => `✅ แก้ไขแล้ว เหลือรายการจัดไม่สำเร็จ ${r.conflicts} รายการ`);

  return (
    <div className="space-y-4">
      <section className="card space-y-2">
        <h2 className="font-semibold">สั่งจัดตารางอัตโนมัติ</h2>
        <ul className="list-disc pl-5 text-sm text-stone-600">
          <li><b>จัดใหม่ทั้งหมด</b> — ล้างตารางเดิมของภาคเรียนนี้แล้วจัดด้วย CSP + Genetic Algorithm (แนะนำให้สร้างจุดสำรองก่อน)</li>
          <li><b>จัดเฉพาะที่เหลือ</b> — คงคาบที่จัดไว้แล้ว (รวมที่<a href="/admin/manual" className="text-brand-700 underline">จัดเอง</a>) และจัดเฉพาะวิชาที่ยังไม่ครบ</li>
        </ul>
        <div className="flex flex-wrap gap-2">
          <button className="btn" disabled={busy} onClick={() => (empty || confirm("จัดใหม่ทั้งหมด? คาบที่จัดไว้ (รวมที่จัดเอง) จะถูกแทนที่")) && run(false)}>▶ จัดใหม่ทั้งหมด</button>
          <button className="btn-outline" disabled={busy || empty} onClick={() => run(true)}>➕ จัดเฉพาะที่เหลือ</button>
          <a className="btn-outline" href="/admin/manual">✋ จัดตารางเอง</a>
          <button className="btn-outline" disabled={busy} onClick={() => act("กำลังสร้างจุดสำรอง", () => post("/api/backup", { action: "create", name: prompt("ชื่อจุดสำรอง") || undefined }), () => "✅ สร้างจุดสำรองแล้ว")}>💾 สร้างจุดสำรอง (Snapshot)</button>
        </div>
        {msg && <pre className="whitespace-pre-wrap rounded bg-slate-100 p-2 text-sm" aria-live="polite">{msg}</pre>}
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">รายการที่จัดตารางไม่สำเร็จ (Unscheduled Conflicts) {conflicts && `— ${conflicts.length} รายการ`}</h2>
        {conflicts === null && <p className="text-sm text-slate-500">กำลังโหลด...</p>}
        {empty && <p className="card text-sm text-stone-600">ยังไม่ได้จัดตารางภาคเรียนนี้ — กด <b>▶ จัดใหม่ทั้งหมด</b> หรือไปที่ <a href="/admin/manual" className="text-brand-700 underline">จัดตารางเอง</a></p>}
        {!empty && conflicts?.length === 0 && <p className="card text-sm text-emerald-700">✅ ไม่มีรายการที่จัดไม่สำเร็จ</p>}
        {conflicts?.map((c) => (
          <div key={c.enrollmentId} className="card border-l-4 border-l-red-500 bg-orange-50/40">
            <p className="font-semibold text-red-700">[{c.title}]</p>
            <ul className="mt-1 list-disc pl-5 text-sm">
              <li><b>รายวิชา:</b> [{c.subjectCode}] {c.subjectName} (ต้องการ {c.hours} คาบ/สัปดาห์, ขาด {c.missingHours} คาบ)</li>
              <li><b>ครูผู้สอน:</b> {c.teacher} | <b>กลุ่มเรียน:</b> {c.group}</li>
              <li><b>สาเหตุ:</b> {c.reasons.map((r, i) => <span key={i} className="block">{r}</span>)}</li>
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="btn-outline" disabled={busy || !c.split} onClick={() => resolve(c.enrollmentId, "split")}
                title={c.split ? c.split.map((r) => `วัน${DAYS[r.day]} คาบ ${r.start}${r.length > 1 ? `-${r.start + r.length - 1}` : ""} ห้อง ${room(r.roomId)}`).join(" + ") : "แบ่งแล้วก็ยังไม่มีช่องว่างพอ"}>
                1️⃣ อนุญาตให้แบ่งสอนเป็น {c.missingHours > 2 ? "2+" + (c.missingHours - 2) : "ก้อนย่อย"} คาบ {c.split ? `(${c.split.map((r) => `${DAYS[r.day]}${r.start}${r.length > 1 ? `-${r.start + r.length - 1}` : ""}`).join(", ")})` : "(ไม่พบช่อง)"}
              </button>
              <button className="btn-outline" disabled={busy || !c.swap} onClick={() => resolve(c.enrollmentId, "swap")}>
                2️⃣ สลับตารางอัตโนมัติ {c.swap ? `(ย้าย ${c.swap.moves[0].subject} จาก ${DAYS[c.swap.moves[0].from.day]}${c.swap.moves[0].from.start} → ${DAYS[c.swap.moves[0].to.day]}${c.swap.moves[0].to.start})` : "(ไม่พบการสลับ)"}
              </button>
              <button className="btn-outline" disabled={busy} onClick={() => setManual(manual === c.enrollmentId ? null : c.enrollmentId)}>3️⃣ จัดเอง (Manual Override)</button>
            </div>
            {manual === c.enrollmentId && (
              <div className="mt-3 space-y-2">
                <p className="text-sm">คลิกช่อง <b>คาบเริ่มต้น</b> ที่ต้องการวาง ({c.missingHours} คาบ):
                  <span className="ml-2 bg-emerald-200 px-1">ครูและนักเรียนว่าง</span>
                  <span className="ml-1 bg-green-100 px-1">ครูว่าง</span>
                  <span className="ml-1 bg-yellow-100 px-1">นักเรียนว่าง</span></p>
                <ScheduleGrid slots={slots} cells={[]}
                  highlight={Object.fromEntries(c.grid.flatMap((g): [string, Highlight][] =>
                    g.teacherFree && g.groupFree ? [[`${g.day}-${g.period}`, "both"]] : g.teacherFree ? [[`${g.day}-${g.period}`, "teacher"]] : g.groupFree ? [[`${g.day}-${g.period}`, "group"]] : []))}
                  onCellClick={(day, start) => resolve(c.enrollmentId, "manual", { day, start })} />
              </div>
            )}
          </div>
        ))}
      </section>

      <section className="card space-y-2">
        <h2 className="font-semibold">จุดสำรองข้อมูล (Backup & Restore)</h2>
        <p className="text-xs text-slate-500">ระดับฐานข้อมูลใช้ Automated Backup / Point-in-Time Recovery ของ TiDB Cloud; ส่วนนี้คือ snapshot ระดับแอป (ตารางทุกภาคเรียน + การอนุญาตแบ่งคาบ)</p>
        {!backups.length && <p className="text-sm text-slate-500">ยังไม่มีจุดสำรอง</p>}
        <ul className="divide-y text-sm">
          {backups.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center gap-2 py-2">
              <span className="flex-1">{b.backupName} <span className="text-slate-500">— {new Date(b.createdAt).toLocaleString("th-TH")} โดย {b.createdBy.fullName}</span></span>
              <a className="btn-outline" href={`/api/backup?id=${b.id}`}>⬇ JSON</a>
              <button className="btn-outline" disabled={busy} onClick={() => confirm(`ย้อนตารางกลับไปที่ "${b.backupName}"? ตารางปัจจุบันจะถูกแทนที่`) &&
                act("กำลังกู้คืน", () => post("/api/backup", { action: "restore", id: b.id }), (r) => `✅ กู้คืน ${r.restored} แถว${r.skipped ? ` (ข้าม ${r.skipped} แถวที่ข้อมูลอ้างอิงถูกลบ)` : ""}`)}>↩ Restore</button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
