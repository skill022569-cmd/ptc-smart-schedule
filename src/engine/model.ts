import type { EngineInput, Enrollment, Room, Run, Teacher } from "./types";

export interface Session { idx: number; enrollmentId: number; length: number }
export type Placement = { day: number; start: number; roomId: number } | null;

export interface Ctx {
  input: EngineInput;
  teaching: Map<number, Set<number>>; // day -> คาบที่สอนได้ (ไม่รวมพักเที่ยง)
  days: number[];
  maxRun: number; // จำนวนคาบติดกันสูงสุดที่เป็นไปได้ในตาราง
  teachers: Map<number, Teacher>;
  unavailable: Map<number, Set<string>>;
  enrollments: Map<number, Enrollment>;
  rooms: Map<number, Room>;
  roomCandidates: Map<number, number[]>; // enrollment -> ห้องที่ใช้ได้ (เล็กสุดก่อน)
  marks: Map<number, string[]>; // ทรัพยากรที่ enrollment ครอบครอง
  blocks: Map<number, string[]>; // ทรัพยากรที่ต้องว่าง
  sessions: Session[];
  locked: Set<number>; // session ที่ห้ามขยับ (คาบที่จัดเองแล้วเลือก "คงไว้")
}

export const sk = (day: number, period: number) => `${day}-${period}`;

/** แบ่งชั่วโมงเป็นก้อน: ไม่อนุญาตแบ่ง = ก้อนเดียว (ถ้ายาวเกินตารางจะตัดตาม maxRun), อนุญาต = ก้อนละ 2 */
export function chunks(hours: number, allowSplit: boolean, maxRun: number): number[] {
  const size = allowSplit ? Math.min(2, maxRun) : maxRun;
  const out: number[] = [];
  for (let h = hours; h > 0; h -= size) out.push(Math.min(size, h));
  return out;
}

/**
 * กุญแจทรัพยากร: T=ครู, G=กลุ่ม (เรียนทั้งกลุ่ม), S=นักเรียนรายคน, GI=มีนักเรียนของกลุ่มนี้เรียนรายบุคคลอยู่
 * วิชาทั้งกลุ่มชนกับนักเรียนรายคนของกลุ่มนั้น แต่นักเรียนรายคน 2 คนในกลุ่มเดียวกันไม่ชนกันเอง
 */
function keysOf(e: Enrollment) {
  const T = `T${e.teacherId}`;
  if (e.studentId == null) return { marks: [T, `G${e.homeGroupId}`], blocks: [T, `G${e.homeGroupId}`, `GI${e.homeGroupId}`] };
  return { marks: [T, `S${e.studentId}`, `GI${e.homeGroupId}`], blocks: [T, `S${e.studentId}`, `G${e.homeGroupId}`] };
}

export function buildCtx(input: EngineInput, fixed: Run[] = [], lock = false): { ctx: Ctx; state: State } {
  const teaching = new Map<number, Set<number>>();
  for (const s of input.slots) {
    if (!teaching.has(s.day)) teaching.set(s.day, new Set());
    if (!s.isLunch) teaching.get(s.day)!.add(s.period);
  }
  let maxRun = 1;
  for (const set of teaching.values()) {
    let run = 0;
    for (let p = 1; p <= 12; p++) { run = set.has(p) ? run + 1 : 0; maxRun = Math.max(maxRun, run); }
  }
  const rooms = new Map(input.rooms.map((r) => [r.id, r]));
  const sortedRooms = [...input.rooms].sort((a, b) => a.capacity - b.capacity);
  const ctx: Ctx = {
    input, teaching, days: [...teaching.keys()].sort(), maxRun,
    teachers: new Map(input.teachers.map((t) => [t.id, t])),
    unavailable: new Map(input.teachers.map((t) => [t.id, new Set(t.unavailable.map((u) => sk(u.day, u.period)))])),
    enrollments: new Map(input.enrollments.map((e) => [e.id, e])),
    rooms,
    roomCandidates: new Map(input.enrollments.map((e) => [e.id,
      sortedRooms.filter((r) => (e.roomType == null || r.type === e.roomType) && r.capacity >= e.size).map((r) => r.id)])),
    marks: new Map(), blocks: new Map(), sessions: [], locked: new Set(),
  };
  for (const e of input.enrollments) { const k = keysOf(e); ctx.marks.set(e.id, k.marks); ctx.blocks.set(e.id, k.blocks); }

  const place: Placement[] = [];
  const placedHours = new Map<number, number>();
  for (const r of fixed) {
    if (!ctx.enrollments.has(r.enrollmentId)) continue;
    if (lock) ctx.locked.add(ctx.sessions.length);
    ctx.sessions.push({ idx: ctx.sessions.length, enrollmentId: r.enrollmentId, length: r.length });
    place.push({ day: r.day, start: r.start, roomId: r.roomId });
    placedHours.set(r.enrollmentId, (placedHours.get(r.enrollmentId) ?? 0) + r.length);
  }
  for (const e of input.enrollments) {
    const missing = e.hours - (placedHours.get(e.id) ?? 0);
    if (missing <= 0) continue;
    for (const len of chunks(missing, e.allowSplit, maxRun)) {
      ctx.sessions.push({ idx: ctx.sessions.length, enrollmentId: e.id, length: len });
      place.push(null);
    }
  }
  const state = new State(ctx.sessions.length);
  place.forEach((p, i) => p && state.apply(ctx, ctx.sessions[i], p));
  return { ctx, state };
}

/** ตำแหน่งเริ่มต้นที่เป็นไปได้ของก้อนยาว length ในวันที่กลุ่มมาเรียน */
export function positions(ctx: Ctx, s: Session): { day: number; start: number }[] {
  const e = ctx.enrollments.get(s.enrollmentId)!;
  const out: { day: number; start: number }[] = [];
  for (const day of ctx.days) {
    if (!e.allowedDays.includes(day)) continue;
    const set = ctx.teaching.get(day)!;
    for (const start of set) {
      let ok = true;
      for (let p = start; p < start + s.length; p++) if (!set.has(p)) { ok = false; break; }
      if (ok) out.push({ day, start });
    }
  }
  return out;
}

export class State {
  occ = new Map<string, number[]>(); // "day-period|KEY" -> sessions ที่ครอบครอง
  place: Placement[];
  constructor(n: number) { this.place = new Array(n).fill(null); }

  clone(): State {
    const s = new State(0);
    s.place = [...this.place];
    for (const [k, v] of this.occ) s.occ.set(k, [...v]);
    return s;
  }
  has(slot: string, key: string) { return (this.occ.get(`${slot}|${key}`)?.length ?? 0) > 0; }
  holders(slot: string, key: string) { return this.occ.get(`${slot}|${key}`) ?? []; }

  /** คืน roomId ถ้าวางได้โดยไม่ละเมิด hard constraint, ไม่งั้น null */
  canPlace(ctx: Ctx, s: Session, day: number, start: number, onlyRoom?: number): number | null {
    const e = ctx.enrollments.get(s.enrollmentId)!;
    if (!e.allowedDays.includes(day)) return null;
    const set = ctx.teaching.get(day);
    const un = ctx.unavailable.get(e.teacherId);
    const blocks = ctx.blocks.get(e.id)!;
    for (let p = start; p < start + s.length; p++) {
      if (!set?.has(p)) return null; // ไม่มีคาบ หรือเป็นพักเที่ยง
      const k = sk(day, p);
      if (un?.has(k)) return null;
      for (const b of blocks) if (this.has(k, b)) return null;
    }
    const rooms = onlyRoom != null ? [onlyRoom] : ctx.roomCandidates.get(e.id)!;
    for (const r of rooms) {
      let free = true;
      for (let p = start; p < start + s.length; p++) if (this.has(sk(day, p), `R${r}`)) { free = false; break; }
      if (free) return r;
    }
    return null;
  }

  apply(ctx: Ctx, s: Session, p: NonNullable<Placement>) {
    const keys = [...ctx.marks.get(s.enrollmentId)!, `R${p.roomId}`];
    for (let q = p.start; q < p.start + s.length; q++)
      for (const key of keys) {
        const k = `${sk(p.day, q)}|${key}`;
        const arr = this.occ.get(k);
        if (arr) arr.push(s.idx); else this.occ.set(k, [s.idx]);
      }
    this.place[s.idx] = p;
  }

  remove(ctx: Ctx, s: Session) {
    const p = this.place[s.idx];
    if (!p) return;
    const keys = [...ctx.marks.get(s.enrollmentId)!, `R${p.roomId}`];
    for (let q = p.start; q < p.start + s.length; q++)
      for (const key of keys) {
        const k = `${sk(p.day, q)}|${key}`;
        const arr = this.occ.get(k)!.filter((i) => i !== s.idx);
        if (arr.length) this.occ.set(k, arr); else this.occ.delete(k);
      }
    this.place[s.idx] = null;
  }

  /** หา session ที่ขวางการวาง s ที่ตำแหน่งนี้; fixable=false ถ้าติดเงื่อนไขที่ย้ายใครก็แก้ไม่ได้ */
  blockers(ctx: Ctx, s: Session, day: number, start: number): { fixable: boolean; sessions: Set<number> } {
    const e = ctx.enrollments.get(s.enrollmentId)!;
    const set = ctx.teaching.get(day);
    const un = ctx.unavailable.get(e.teacherId);
    const out = new Set<number>();
    if (!e.allowedDays.includes(day)) return { fixable: false, sessions: out };
    for (let p = start; p < start + s.length; p++) {
      if (!set?.has(p) || un?.has(sk(day, p))) return { fixable: false, sessions: out };
      for (const b of ctx.blocks.get(e.id)!) for (const i of this.holders(sk(day, p), b)) out.add(i);
    }
    // ห้อง: เลือกห้องที่มีผู้ครอบครองน้อยที่สุด
    let best: Set<number> | null = null;
    for (const r of ctx.roomCandidates.get(e.id)!) {
      const occ = new Set<number>();
      for (let p = start; p < start + s.length; p++) for (const i of this.holders(sk(day, p), `R${r}`)) occ.add(i);
      if (!best || occ.size < best.size) best = occ;
      if (occ.size === 0) break;
    }
    if (!best) return { fixable: false, sessions: out };
    for (const i of best) out.add(i);
    return { fixable: true, sessions: out };
  }
}

/** สุ่มแบบกำหนด seed ได้ (ผลลัพธ์ทำซ้ำได้) */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function shuffle<T>(arr: T[], r: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}
