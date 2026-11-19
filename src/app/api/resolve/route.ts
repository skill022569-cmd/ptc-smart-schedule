import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth";
import { SEMESTER, prisma } from "@/lib/db";
import { loadState, saveState } from "@/lib/engine-io";
import { analyze, planSplit, planSwap } from "@/engine/conflict-analyzer";
import { dayName } from "@/engine/validator";
import type { Ctx, Session, State } from "@/engine/model";

/** รายการที่จัดไม่สำเร็จ + ข้อเสนอแก้ไข (ยังไม่เคยรันจัดตาราง → empty) */
export async function GET() {
  const u = await apiUser(["ADMIN"]);
  if (u instanceof NextResponse) return u;
  if (!(await prisma.schedule.count({ where: { semester: SEMESTER } }))) return NextResponse.json({ conflicts: [], rooms: [], empty: true });
  const { ctx, state } = await loadState(SEMESTER);
  return NextResponse.json({ conflicts: analyze(ctx, state), rooms: ctx.input.rooms });
}

function whyNot(ctx: Ctx, st: State, s: Session, day: number, start: number) {
  const b = st.blockers(ctx, s, day, start);
  const who = [...b.sessions].map((i) => ctx.enrollments.get(ctx.sessions[i].enrollmentId)!.subjectCode);
  return `วาง ${s.length} คาบที่ วัน${dayName(day)} คาบ ${start} ไม่ได้: ${b.fixable ? `ชนกับ ${who.join(", ") || "ห้องไม่ว่าง"}` : "ครูไม่สะดวก/พักเที่ยง/ไม่ใช่วันเรียน/คาบไม่ต่อเนื่อง"}`;
}
/** session ของ enrollment ที่ครอบคาบ (day, period) */
const sessionAt = (ctx: Ctx, st: State, eid: number, day: number, period: number) =>
  ctx.sessions.find((s) => { const p = st.place[s.idx]; return s.enrollmentId === eid && p && p.day === day && period >= p.start && period < p.start + s.length; });

/** action: split | swap | manual (วางคาบที่ค้าง) | move | remove | setSplit */
export async function POST(req: Request) {
  const u = await apiUser(["ADMIN"]);
  if (u instanceof NextResponse) return u;
  const { action, enrollmentId, day, start, fromDay, fromPeriod, value } = await req.json().catch(() => ({}));
  const eid = Number(enrollmentId), d = Number(day), p = Number(start);

  if (action === "setSplit") {
    await prisma.enrollment.update({ where: { id: eid }, data: { allowSplit: !!value } });
    return NextResponse.json({ ok: true });
  }

  let { ctx, state } = await loadState(SEMESTER);
  if (!ctx.enrollments.has(eid)) return NextResponse.json({ error: "ไม่พบรายวิชาที่ลงทะเบียน" }, { status: 404 });
  const unplaced = ctx.sessions.filter((s) => s.enrollmentId === eid && !state.place[s.idx]);

  if (action === "remove" || action === "move") {
    const s = sessionAt(ctx, state, eid, Number(fromDay ?? day), Number(fromPeriod ?? start));
    if (!s) return NextResponse.json({ error: "ไม่พบคาบนี้ในตาราง" }, { status: 404 });
    state.remove(ctx, s);
    if (action === "move") {
      const room = state.canPlace(ctx, s, d, p);
      if (room == null) return NextResponse.json({ error: whyNot(ctx, state, s, d, p) }, { status: 409 });
      state.apply(ctx, s, { day: d, start: p, roomId: room });
    }
  } else if (!unplaced.length) {
    return NextResponse.json({ error: "รายวิชานี้จัดครบแล้ว" }, { status: 409 });
  } else if (action === "split") {
    const plan = planSplit(ctx, state, eid, unplaced.reduce((n, s) => n + s.length, 0));
    if (!plan) return NextResponse.json({ error: "แบ่งคาบแล้วยังหาช่องว่างไม่พอ" }, { status: 409 });
    await prisma.enrollment.update({ where: { id: eid }, data: { allowSplit: true } });
    ({ ctx, state } = await loadState(SEMESTER)); // สร้าง session ใหม่เป็นก้อนย่อย
    const todo = ctx.sessions.filter((s) => s.enrollmentId === eid && !state.place[s.idx]);
    for (const run of plan) {
      const i = todo.findIndex((s) => s.length === run.length);
      if (i < 0 || state.canPlace(ctx, todo[i], run.day, run.start, run.roomId) == null)
        return NextResponse.json({ error: "ข้อมูลเปลี่ยนระหว่างดำเนินการ กรุณาลองใหม่" }, { status: 409 });
      state.apply(ctx, todo.splice(i, 1)[0], run);
    }
  } else if (action === "swap") {
    const plan = planSwap(ctx, state, unplaced[0].idx);
    if (!plan) return NextResponse.json({ error: "ไม่พบการสลับที่ทำได้" }, { status: 409 });
    for (const m of plan.moves) state.remove(ctx, ctx.sessions[m.sessionIdx]);
    state.apply(ctx, unplaced[0], plan.place);
    for (const m of plan.moves) state.apply(ctx, ctx.sessions[m.sessionIdx], m.to);
  } else if (action === "manual") {
    const s = unplaced.sort((a, b) => b.length - a.length)[0];
    const room = state.canPlace(ctx, s, d, p);
    if (room == null) return NextResponse.json({ error: whyNot(ctx, state, s, d, p) }, { status: 409 });
    state.apply(ctx, s, { day: d, start: p, roomId: room });
  } else return NextResponse.json({ error: "action ไม่ถูกต้อง" }, { status: 400 });

  const conflicts = await saveState(SEMESTER, ctx, state);
  return NextResponse.json({ ok: true, conflicts: conflicts.length });
}
