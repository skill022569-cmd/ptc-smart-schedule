import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth";
import { SEMESTER, prisma } from "@/lib/db";
import { loadState, saveState } from "@/lib/engine-io";
import { analyze, planSplit, planSwap } from "@/engine/conflict-analyzer";
import { dayName } from "@/engine/validator";

/** รายการที่จัดไม่สำเร็จ + ข้อเสนอแก้ไข */
export async function GET() {
  const u = await apiUser(["ADMIN"]);
  if (u instanceof NextResponse) return u;
  const { ctx, state } = await loadState(SEMESTER);
  return NextResponse.json({ conflicts: analyze(ctx, state), rooms: ctx.input.rooms });
}

/** action: split | swap | manual */
export async function POST(req: Request) {
  const u = await apiUser(["ADMIN"]);
  if (u instanceof NextResponse) return u;
  const { action, enrollmentId, day, start } = await req.json().catch(() => ({}));
  const eid = Number(enrollmentId);
  let { ctx, state } = await loadState(SEMESTER);
  const unplaced = ctx.sessions.filter((s) => s.enrollmentId === eid && !state.place[s.idx]);
  if (!unplaced.length) return NextResponse.json({ error: "รายการนี้จัดครบแล้ว" }, { status: 409 });

  if (action === "split") {
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
    for (const m of plan.moves) { const s = ctx.sessions[m.sessionIdx]; state.remove(ctx, s); }
    state.apply(ctx, unplaced[0], plan.place);
    for (const m of plan.moves) state.apply(ctx, ctx.sessions[m.sessionIdx], m.to);
  } else if (action === "manual") {
    const s = unplaced.sort((a, b) => b.length - a.length)[0];
    const room = state.canPlace(ctx, s, Number(day), Number(start));
    if (room == null) {
      const b = state.blockers(ctx, s, Number(day), Number(start));
      const who = [...b.sessions].map((i) => ctx.enrollments.get(ctx.sessions[i].enrollmentId)!.subjectCode);
      return NextResponse.json({ error: `วาง ${s.length} คาบที่ วัน${dayName(Number(day))} คาบ ${start} ไม่ได้: ${b.fixable ? `ชนกับ ${who.join(", ") || "ห้องไม่ว่าง"}` : "ครูไม่สะดวก/พักเที่ยง/ไม่ใช่วันเรียน/คาบไม่ต่อเนื่อง"}` }, { status: 409 });
    }
    state.apply(ctx, s, { day: Number(day), start: Number(start), roomId: room });
  } else return NextResponse.json({ error: "action ไม่ถูกต้อง" }, { status: 400 });

  const conflicts = await saveState(SEMESTER, ctx, state);
  return NextResponse.json({ ok: true, conflicts: conflicts.length });
}
