import { type Ctx, State, positions, shuffle } from "./model";
import { domainSize } from "./validator";

/**
 * จัดตารางเบื้องต้นแบบ CSP:
 * - เรียงตัวแปรด้วย MRV (session ที่มีตำแหน่งเป็นไปได้น้อยสุด/ยาวสุดก่อน)
 * - วางตำแหน่งแรกที่ผ่าน hard constraints (forward check ผ่าน State.canPlace)
 * - วางไม่ได้ → ซ่อมด้วยการ "ย้ายผู้ขวาง 1 รายการ" (ejection) ก่อนยอมแพ้
 * shortcut: ไม่มี backtracking เต็มรูปแบบ เพราะข้อมูลวิทยาลัยใหญ่เกินจะค้นหมด; ถ้ายังเหลือรายการชนมาก ค่อยเพิ่ม ejection หลายชั้น
 */
export function solve(ctx: Ctx, rand: () => number): State {
  const st = new State(ctx.sessions.length);
  const dom = ctx.sessions.map((_, i) => domainSize(ctx, i) + rand()); // +rand = tie-break ให้ GA ได้ประชากรหลากหลาย
  const order = ctx.sessions.map((s) => s.idx).sort((a, b) => dom[a] - dom[b] || ctx.sessions[b].length - ctx.sessions[a].length);
  for (const i of order) placeOrRepair(ctx, st, i, rand);
  return st;
}

export function placeRandom(ctx: Ctx, st: State, idx: number, rand: () => number): boolean {
  const s = ctx.sessions[idx];
  for (const pos of shuffle(positions(ctx, s), rand)) {
    const room = st.canPlace(ctx, s, pos.day, pos.start);
    if (room != null) { st.apply(ctx, s, { ...pos, roomId: room }); return true; }
  }
  return false;
}

export function placeOrRepair(ctx: Ctx, st: State, idx: number, rand: () => number): boolean {
  if (placeRandom(ctx, st, idx, rand)) return true;
  return findSwap(ctx, st, idx, rand, true) != null;
}

export interface Move { sessionIdx: number; from: { day: number; start: number; roomId: number }; to: { day: number; start: number; roomId: number } }

/**
 * หาตำแหน่งที่มีผู้ขวางเพียง 1 รายการ แล้วย้ายผู้ขวางไปที่อื่นได้
 * apply=true จะแก้ State จริง, false จะคืนแผนการย้ายโดยไม่แตะ State
 */
export function findSwap(ctx: Ctx, st: State, idx: number, rand: () => number, apply: boolean):
  { place: { day: number; start: number; roomId: number }; moves: Move[] } | null {
  const s = ctx.sessions[idx];
  for (const pos of shuffle(positions(ctx, s), rand)) {
    const b = st.blockers(ctx, s, pos.day, pos.start);
    if (!b.fixable || b.sessions.size !== 1) continue;
    const bi = [...b.sessions][0];
    const from = st.place[bi]!;
    const trial = st.clone();
    trial.remove(ctx, ctx.sessions[bi]);
    const room = trial.canPlace(ctx, s, pos.day, pos.start);
    if (room == null) continue;
    trial.apply(ctx, s, { ...pos, roomId: room });
    for (const alt of shuffle(positions(ctx, ctx.sessions[bi]), rand)) {
      if (alt.day === from.day && alt.start === from.start) continue;
      const r2 = trial.canPlace(ctx, ctx.sessions[bi], alt.day, alt.start);
      if (r2 == null) continue;
      const to = { ...alt, roomId: r2 };
      if (apply) {
        st.remove(ctx, ctx.sessions[bi]);
        st.apply(ctx, s, { ...pos, roomId: room });
        st.apply(ctx, ctx.sessions[bi], to);
      }
      return { place: { ...pos, roomId: room }, moves: [{ sessionIdx: bi, from, to }] };
    }
  }
  return null;
}
