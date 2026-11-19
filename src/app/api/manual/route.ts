import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth";
import { SEMESTER } from "@/lib/db";
import { loadState } from "@/lib/engine-io";
import { positions } from "@/engine/model";

/** ข้อมูลหน้าจัดตารางเอง ของกลุ่มเรียนหนึ่ง: คาบที่จัดแล้ว + ช่องที่วางคาบถัดไปได้ของแต่ละวิชา */
export async function GET(req: Request) {
  const u = await apiUser(["ADMIN"]);
  if (u instanceof NextResponse) return u;
  const gid = Number(new URL(req.url).searchParams.get("groupId"));
  const { ctx, state } = await loadState(SEMESTER);
  const rooms = new Map(ctx.input.rooms.map((r) => [r.id, r.code]));
  const teacher = (id: number) => ctx.teachers.get(id)?.name ?? "-";
  const mine = ctx.input.enrollments.filter((e) => e.groupId === gid);

  const cells = ctx.sessions.flatMap((s) => {
    const p = state.place[s.idx];
    const e = ctx.enrollments.get(s.enrollmentId)!;
    if (!p || e.groupId !== gid) return [];
    return Array.from({ length: s.length }, (_, k) => ({ day: p.day, period: p.start + k, enrollmentId: e.id,
      subject: `${e.subjectCode} ${e.subjectName}`, teacher: teacher(e.teacherId), room: rooms.get(p.roomId) ?? "-", group: e.label }));
  });

  const enrollments = mine.map((e) => {
    const sessions = ctx.sessions.filter((s) => s.enrollmentId === e.id);
    const next = sessions.filter((s) => !state.place[s.idx]).sort((a, b) => b.length - a.length)[0];
    return {
      id: e.id, subject: `${e.subjectCode} ${e.subjectName}`, teacher: teacher(e.teacherId), hours: e.hours, allowSplit: e.allowSplit,
      placed: sessions.reduce((n, s) => n + (state.place[s.idx] ? s.length : 0), 0),
      nextLength: next?.length ?? 0,
      // ช่องเริ่มต้นที่วางก้อนถัดไปได้ทันที (ผ่าน hard constraints ทั้งครู กลุ่ม ห้อง)
      feasible: next ? positions(ctx, next).filter((q) => state.canPlace(ctx, next, q.day, q.start) != null).map((q) => `${q.day}-${q.start}`) : [],
    };
  });
  return NextResponse.json({ cells, enrollments });
}
