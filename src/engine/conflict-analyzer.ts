import { type Ctx, State, chunks, positions, rng, sk } from "./model";
import { type Move, findSwap } from "./csp-solver";
import { dayName } from "./validator";

export interface SlotInfo { day: number; period: number; lunch: boolean; teacherFree: boolean; groupFree: boolean; roomFree: boolean }
export interface PlannedRun { day: number; start: number; length: number; roomId: number }
export interface ConflictReport {
  enrollmentId: number;
  subjectCode: string;
  subjectName: string;
  teacher: string;
  group: string;
  hours: number;
  missingHours: number;
  title: string;
  reasons: string[];
  split: PlannedRun[] | null; // แนวทางที่ 1
  swap: { place: PlannedRun; moves: (Move & { subject: string; length: number })[] } | null; // แนวทางที่ 2
  grid: SlotInfo[]; // แนวทางที่ 3 (ช่องเขียว/เหลือง)
}

const range = (a: number, b: number) => (a === b ? `คาบ ${a}` : `คาบ ${a}-${b}`);

/** ใครครองทรัพยากรนี้ในคาบนี้ → ชื่อวิชา */
function holderName(ctx: Ctx, st: State, slot: string, keys: string[]): string | null {
  for (const k of keys) for (const i of st.holders(slot, k)) {
    const e = ctx.enrollments.get(ctx.sessions[i].enrollmentId)!;
    return `${e.subjectCode} ${e.subjectName}`;
  }
  return null;
}

export function analyze(ctx: Ctx, st: State): ConflictReport[] {
  const missing = new Map<number, number[]>(); // enrollment -> sessions ที่ยังไม่ได้วาง
  ctx.sessions.forEach((s, i) => { if (!st.place[i]) missing.set(s.enrollmentId, [...(missing.get(s.enrollmentId) ?? []), i]); });
  return [...missing].map(([eid, idxs]) => analyzeOne(ctx, st, eid, idxs));
}

function analyzeOne(ctx: Ctx, st: State, eid: number, idxs: number[]): ConflictReport {
  const e = ctx.enrollments.get(eid)!;
  const teacher = ctx.teachers.get(e.teacherId)?.name ?? `ครู #${e.teacherId}`;
  const miss = idxs.reduce((n, i) => n + ctx.sessions[i].length, 0);
  const need = Math.max(...idxs.map((i) => ctx.sessions[i].length));
  const un = ctx.unavailable.get(e.teacherId);
  const groupKeys = ctx.blocks.get(eid)!.filter((k) => !k.startsWith("T"));
  const rooms = ctx.roomCandidates.get(eid)!;

  const grid: SlotInfo[] = [];
  const reasons: string[] = [];
  for (const s of [...ctx.input.slots].sort((a, b) => a.day - b.day || a.period - b.period)) {
    const k = sk(s.day, s.period);
    grid.push({
      day: s.day, period: s.period, lunch: s.isLunch,
      teacherFree: !s.isLunch && !un?.has(k) && !st.has(k, `T${e.teacherId}`),
      groupFree: !s.isLunch && e.allowedDays.includes(s.day) && groupKeys.every((g) => !st.has(k, g)),
      roomFree: !s.isLunch && rooms.some((r) => !st.has(k, `R${r}`)),
    });
  }
  if (!rooms.length) reasons.push(`ไม่มีห้องประเภท ${e.roomType ?? "ใดๆ"} ที่จุนักเรียนได้ ${e.size} คน`);

  // หาช่วงที่ครู+กลุ่ม+ห้องว่างตรงกัน แยกตามวัน และอธิบายว่าทำไมต่อไม่ถึง need คาบ
  for (const day of e.allowedDays) {
    const cells = grid.filter((g) => g.day === day);
    const runs: [number, number][] = [];
    let a: number | null = null;
    for (const c of cells) {
      const ok = c.teacherFree && c.groupFree && c.roomFree;
      if (ok && a == null) a = c.period;
      if (!ok && a != null) { runs.push([a, c.period - 1]); a = null; }
    }
    if (a != null) runs.push([a, cells[cells.length - 1].period]);
    if (!runs.length) continue;
    const best = Math.max(...runs.map(([x, y]) => y - x + 1));
    if (best >= need) continue;
    const parts = runs.map(([x, y]) => range(x, y)).join(", ");
    let why = `วัน${dayName(day)} ว่างตรงกันเพียง ${parts} (ต่อเนื่องสูงสุด ${best} คาบ) ไม่พอสำหรับ ${need} คาบติดต่อกัน`;
    // อธิบายคาบที่ติดกับช่วงว่าง และคาบที่ครูว่างแต่ติดอย่างอื่น (กลุ่ม/ห้อง)
    const edges = new Set(runs.flatMap(([x, y]) => [x - 1, y + 1]));
    const notes: string[] = [];
    for (const c of cells) {
      if (c.teacherFree && c.groupFree && c.roomFree) continue;
      const k = sk(day, c.period), p = c.period;
      const busyT = st.has(k, `T${e.teacherId}`);
      if (c.lunch) { if (edges.has(p)) notes.push(`คาบ ${p} เป็นพักกลางวัน`); }
      else if (un?.has(k)) { if (edges.has(p)) notes.push(`คาบ ${p} ${teacher} ไม่สะดวกสอน`); }
      else if (busyT) notes.push(`คาบ ${p} ${teacher} สอนวิชา ${holderName(ctx, st, k, [`T${e.teacherId}`])} อยู่แล้ว`);
      else if (!c.groupFree) notes.push(`คาบ ${p} กลุ่มเรียน ${e.label} มีเรียนวิชา ${holderName(ctx, st, k, groupKeys)} อยู่แล้ว`);
      else notes.push(`คาบ ${p} ห้อง${e.roomType ? `ประเภท ${e.roomType} ` : ""}ไม่ว่าง`);
    }
    notes.splice(4);
    if (notes.length) why += ` และ${notes.join(", ")}`;
    reasons.push(why);
  }
  if (!reasons.length) {
    const tFree = grid.filter((g) => g.teacherFree).length;
    const both = grid.filter((g) => g.teacherFree && g.groupFree).length;
    reasons.push(tFree === 0 ? `${teacher} ไม่มีคาบว่างเหลือเลย`
      : both === 0 ? `ไม่มีคาบที่ ${teacher} และกลุ่ม ${e.label} ว่างตรงกัน`
      : grid.some((g) => g.teacherFree && g.groupFree && g.roomFree) ? "ยังไม่ได้จัด (มีช่องว่างพอ) — กดจัดเฉพาะที่เหลือ หรือจัดเอง"
      : "คาบที่ครูและกลุ่มเรียนว่างตรงกัน ไม่มีห้องที่ตรงประเภทว่าง");
  }

  return {
    enrollmentId: eid, subjectCode: e.subjectCode, subjectName: e.subjectName, teacher, group: e.label,
    hours: e.hours, missingHours: miss,
    title: need > 1 ? "จัดตารางไม่สำเร็จ - คาบต่อเนื่องไม่เพียงพอ / คาบชน" : "จัดตารางไม่สำเร็จ - คาบชน",
    reasons, grid,
    split: planSplit(ctx, st, eid, miss),
    swap: planSwap(ctx, st, idxs[0]),
  };
}

/** แนวทางที่ 1: ลองแบ่งชั่วโมงที่ขาดเป็นก้อนละ 2 (เช่น 3 = 2+1) แล้ววางทีละก้อน */
export function planSplit(ctx: Ctx, st: State, eid: number, miss: number): PlannedRun[] | null {
  const parts = chunks(miss, true, ctx.maxRun);
  if (parts.length < 2) return null;
  const trial = st.clone();
  const out: PlannedRun[] = [];
  const usedDays = new Set<number>();
  for (const length of parts) {
    const s = { idx: -1, enrollmentId: eid, length };
    // เลือกวันที่ยังไม่ได้ใช้ก่อน เพื่อไม่ให้ก้อนกระจุกวันเดียว
    const cand = positions(ctx, s).sort((a, b) => Number(usedDays.has(a.day)) - Number(usedDays.has(b.day)));
    let done = false;
    for (const pos of cand) {
      const room = trial.canPlace(ctx, s, pos.day, pos.start);
      if (room == null) continue;
      trial.apply(ctx, s, { ...pos, roomId: room });
      out.push({ ...pos, length, roomId: room });
      usedDays.add(pos.day);
      done = true;
      break;
    }
    if (!done) return null;
  }
  return out;
}

/** แนวทางที่ 2: ย้ายวิชาที่ขวางอยู่ 1 รายการไปช่องอื่น เพื่อให้วางก้อนเต็มได้ */
export function planSwap(ctx: Ctx, st: State, idx: number) {
  const r = findSwap(ctx, st, idx, rng(7), false);
  if (!r) return null;
  const len = ctx.sessions[idx].length;
  return {
    place: { ...r.place, length: len },
    moves: r.moves.map((m) => {
      const s = ctx.sessions[m.sessionIdx];
      const e = ctx.enrollments.get(s.enrollmentId)!;
      return { ...m, subject: `${e.subjectCode} ${e.subjectName} (${e.label})`, length: s.length };
    }),
  };
}
