import { NextResponse } from "next/server";
import { apiUser, viewingUser } from "@/lib/auth";
import { SEMESTER } from "@/lib/db";
import { loadState } from "@/lib/engine-io";
import { positions } from "@/engine/model";

/** ข้อมูลหน้าจัดตารางเอง: ?groupId= (แอดมิน) หรือ ?mine=1 (วิชาที่ผู้ใช้สอน) — คาบที่จัดแล้ว + ช่องที่วางคาบถัดไปได้ */
export async function GET(req: Request) {
  const u = await apiUser(["ADMIN", "TEACHER"]);
  if (u instanceof NextResponse) return u;
  const sp = new URL(req.url).searchParams;
  const mine = sp.get("mine") === "1" || u.role === "TEACHER"; // ครูเห็นได้เฉพาะของตัวเองเสมอ
  const me = (await viewingUser())!.id; // แอดมินที่ดูมุมมองครู จะเห็นของครูคนนั้น
  const gid = Number(sp.get("groupId"));
  const inScope = (e: { groupId: number | null; teacherId: number }) => (mine ? e.teacherId === me : e.groupId === gid);
  const { ctx, state } = await loadState(SEMESTER);
  const rooms = new Map(ctx.input.rooms.map((r) => [r.id, r.code]));
  const teacher = (id: number) => ctx.teachers.get(id)?.name ?? "-";
  const list = ctx.input.enrollments.filter(inScope);

  const cells = ctx.sessions.flatMap((s) => {
    const p = state.place[s.idx];
    const e = ctx.enrollments.get(s.enrollmentId)!;
    if (!p || !inScope(e)) return [];
    return Array.from({ length: s.length }, (_, k) => ({ day: p.day, period: p.start + k, enrollmentId: e.id,
      subject: `${e.subjectCode} ${e.subjectName}`, teacher: teacher(e.teacherId), room: rooms.get(p.roomId) ?? "-", group: e.label }));
  });

  const enrollments = list.map((e) => {
    const sessions = ctx.sessions.filter((s) => s.enrollmentId === e.id);
    const next = sessions.filter((s) => !state.place[s.idx]).sort((a, b) => b.length - a.length)[0];
    return {
      id: e.id, subject: `${e.subjectCode} ${e.subjectName}`, teacher: mine ? e.label : teacher(e.teacherId), hours: e.hours, allowSplit: e.allowSplit,
      placed: sessions.reduce((n, s) => n + (state.place[s.idx] ? s.length : 0), 0),
      nextLength: next?.length ?? 0,
      // ช่องเริ่มต้นที่วางก้อนถัดไปได้ทันที (ผ่าน hard constraints ทั้งครู กลุ่ม ห้อง)
      feasible: next ? positions(ctx, next).filter((q) => state.canPlace(ctx, next, q.day, q.start) != null).map((q) => `${q.day}-${q.start}`) : [],
    };
  });
  return NextResponse.json({ cells, enrollments });
}
