import { type Ctx, type Placement, State, positions, sk } from "./model";
import type { EngineInput } from "./types";

const DAY = ["", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์", "อาทิตย์"];
export const dayName = (d: number) => DAY[d] ?? `วัน ${d}`;

/** ตรวจก่อนเริ่มคำนวณ: ภาระครูเกิน, ไม่มีห้องที่ใช้ได้, ชั่วโมงกลุ่มเกินคาบที่มี */
export function precheck(ctx: Ctx): string[] {
  const w: string[] = [];
  const tHours = new Map<number, number>();
  const gHours = new Map<number, number>();
  for (const e of ctx.input.enrollments) {
    tHours.set(e.teacherId, (tHours.get(e.teacherId) ?? 0) + e.hours);
    if (e.studentId == null) gHours.set(e.homeGroupId, (gHours.get(e.homeGroupId) ?? 0) + e.hours);
    if (!ctx.roomCandidates.get(e.id)!.length)
      w.push(`วิชา ${e.subjectCode} (${e.label}): ไม่มีห้องประเภท ${e.roomType ?? "ใดๆ"} ที่จุได้ ${e.size} คน`);
  }
  for (const [tid, h] of tHours) {
    const t = ctx.teachers.get(tid);
    if (!t) { w.push(`ไม่พบข้อมูลครูรหัส ${tid}`); continue; }
    if (h > t.maxHours) w.push(`${t.name}: ชั่วโมงสอนรวม ${h} คาบ เกินภาระสูงสุด ${t.maxHours} คาบ/สัปดาห์`);
  }
  const byGroup = new Map<number, { label: string; days: number[] }>();
  for (const e of ctx.input.enrollments) if (e.studentId == null) byGroup.set(e.homeGroupId, { label: e.label, days: e.allowedDays });
  for (const [gid, h] of gHours) {
    const g = byGroup.get(gid)!;
    const cap = g.days.reduce((n, d) => n + (ctx.teaching.get(d)?.size ?? 0), 0);
    if (h > cap) w.push(`${g.label}: ต้องเรียน ${h} คาบ แต่มีคาบเรียนในวันที่มาเรียนเพียง ${cap} คาบ`);
  }
  return w;
}

/** ตรวจผลลัพธ์ทั้งหมดใหม่ตั้งแต่ต้น (ใช้ทดสอบ และตรวจข้อมูลที่โหลดจากฐานข้อมูล) */
export function validate(ctx: Ctx, place: Placement[]): Map<number, string> {
  const st = new State(ctx.sessions.length);
  const bad = new Map<number, string>();
  ctx.sessions.forEach((s, i) => {
    const p = place[i];
    if (!p) return;
    const e = ctx.enrollments.get(s.enrollmentId)!;
    const room = ctx.rooms.get(p.roomId);
    if (!room) bad.set(i, "ไม่พบห้อง");
    else if (!ctx.roomCandidates.get(e.id)!.includes(room.id)) bad.set(i, `ห้อง ${room.code} ไม่ตรงประเภท/ความจุ`);
    else if (st.canPlace(ctx, s, p.day, p.start, p.roomId) == null)
      bad.set(i, `ชนกับรายการอื่น หรืออยู่ในเวลาที่ไม่อนุญาต (${dayName(p.day)} คาบ ${p.start})`);
    st.apply(ctx, s, p);
  });
  return bad;
}

/** โทษของ soft constraints (ยิ่งต่ำยิ่งดี) */
export function softPenalty(ctx: Ctx, place: Placement[]): number {
  let pen = 0;
  const busy = new Map<string, Set<number>>(); // "T1|day" -> คาบ
  const add = (k: string, p: number) => { let s = busy.get(k); if (!s) busy.set(k, (s = new Set())); s.add(p); };
  const perDay = new Map<string, number>(); // enrollment-day -> จำนวนก้อน
  ctx.sessions.forEach((s, i) => {
    const p = place[i];
    if (!p) return;
    const e = ctx.enrollments.get(s.enrollmentId)!;
    const pref = ctx.teachers.get(e.teacherId)?.preferred ?? "ANY";
    for (let q = p.start; q < p.start + s.length; q++) {
      add(`T${e.teacherId}|${p.day}`, q);
      if (e.studentId == null) add(`G${e.homeGroupId}|${p.day}`, q);
      if (q >= 10) pen += 2; // คาบเย็น
      if (pref === "MORNING" && q > 5) pen += 1;
      if (pref === "AFTERNOON" && q < 5) pen += 1;
    }
    const k = `${e.id}|${p.day}`;
    perDay.set(k, (perDay.get(k) ?? 0) + 1);
  });
  for (const [k, set] of busy) {
    const day = Number(k.split("|")[1]);
    const ps = [...set].sort((a, b) => a - b);
    let gaps = 0;
    for (let p = ps[0]; p <= ps[ps.length - 1]; p++) if (!set.has(p) && ctx.teaching.get(day)?.has(p)) gaps++;
    pen += gaps * (k.startsWith("G") ? 3 : 2); // คาบว่างคั่นกลางของนักเรียนแย่กว่าของครู
  }
  for (const n of perDay.values()) if (n > 1) pen += 4 * (n - 1); // ก้อนของวิชาเดียวกันวันเดียวกันแต่ไม่ติดกัน
  return pen;
}

/** ข้อมูลช่วยตัดสินใจ: ขนาดโดเมนของแต่ละ session (ยิ่งน้อยยิ่งยาก) */
export function domainSize(ctx: Ctx, idx: number): number {
  const s = ctx.sessions[idx];
  const e = ctx.enrollments.get(s.enrollmentId)!;
  const un = ctx.unavailable.get(e.teacherId);
  let n = 0;
  for (const pos of positions(ctx, s)) {
    let ok = true;
    for (let p = pos.start; p < pos.start + s.length; p++) if (un?.has(sk(pos.day, p))) { ok = false; break; }
    if (ok) n++;
  }
  return n * Math.max(1, ctx.roomCandidates.get(e.id)!.length) || 0;
}

export type { EngineInput };
