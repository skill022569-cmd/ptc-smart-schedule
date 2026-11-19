// แปลงข้อมูลระหว่าง TiDB ↔ engine
import { prisma } from "./db";
import { analyze, buildCtx, validate, type EngineInput, type Run } from "@/engine";
import type { Ctx, State } from "@/engine/model";
import type { ConflictReport } from "@/engine/conflict-analyzer";

export async function loadInput(): Promise<EngineInput> {
  const [slots, rooms, teachers, enrollments, groupSizes] = await Promise.all([
    prisma.timeslot.findMany(),
    prisma.room.findMany(),
    prisma.user.findMany({ where: { role: "TEACHER" }, include: { constraint: true } }),
    prisma.enrollment.findMany({ include: { subject: true, group: true, student: { include: { group: true } } } }),
    prisma.student.groupBy({ by: ["groupId"], _count: true }),
  ]);
  const size = new Map(groupSizes.map((g) => [g.groupId, g._count]));
  return {
    slots: slots.map((s) => ({ id: s.id, day: s.dayOfWeek, period: s.periodNo, isLunch: s.isLunchBreak, start: s.startTime, end: s.endTime })),
    rooms: rooms.map((r) => ({ id: r.id, code: r.code, type: r.roomType, capacity: r.capacity })),
    teachers: teachers.map((t) => ({
      id: t.id, name: t.fullName, maxHours: t.constraint?.maxHoursPerWeek ?? 24,
      unavailable: (t.constraint?.unavailableSlots as { day: number; period: number }[] | null) ?? [],
      preferred: (t.constraint?.preferredTime as "MORNING" | "AFTERNOON" | "ANY") ?? "ANY",
    })),
    enrollments: enrollments.flatMap((e) => {
      const g = e.group ?? e.student?.group;
      if (!g) return []; // ข้อมูลไม่ครบ ข้ามไป (pre-check จะไม่เห็นรายการนี้)
      return [{
        id: e.id, subjectCode: e.subject.code, subjectName: e.subject.name, teacherId: e.teacherId,
        groupId: e.groupId, studentId: e.studentId, homeGroupId: g.id, label: e.student ? e.student.fullName : g.name,
        hours: e.subject.theoryHours + e.subject.practiceHours, roomType: e.subject.requiredRoomType,
        size: e.student ? 1 : size.get(g.id) ?? 0, allowedDays: (g.studyDays as number[]) ?? [1, 2, 3, 4, 5], allowSplit: e.allowSplit,
      }];
    }),
  };
}

/** คาบที่บันทึกไว้ → ก้อน Run (แถวต่อเนื่องห้องเดียวกันรวมเป็นก้อนเดียว) */
export async function loadRuns(semester: string): Promise<Run[]> {
  const rows = await prisma.schedule.findMany({ where: { semester, slotId: { not: null } }, include: { slot: true } });
  const sorted = rows.filter((r) => r.slot && r.roomId != null)
    .sort((a, b) => a.enrollmentId - b.enrollmentId || a.slot!.dayOfWeek - b.slot!.dayOfWeek || a.slot!.periodNo - b.slot!.periodNo);
  const runs: Run[] = [];
  for (const r of sorted) {
    const last = runs[runs.length - 1];
    const d = r.slot!.dayOfWeek, p = r.slot!.periodNo;
    if (last && last.enrollmentId === r.enrollmentId && last.day === d && last.roomId === r.roomId && last.start + last.length === p) last.length++;
    else runs.push({ enrollmentId: r.enrollmentId, day: d, start: p, length: 1, roomId: r.roomId! });
  }
  return runs;
}

/** โหลดตารางที่บันทึกไว้ → ctx/state */
export async function loadState(semester: string) {
  const [input, runs] = await Promise.all([loadInput(), loadRuns(semester)]);
  return buildCtx(input, runs);
}

/** บันทึกทั้งภาคเรียนใหม่ (แทนที่ของเดิม) พร้อมแถวรายการที่จัดไม่สำเร็จ */
export async function saveState(semester: string, ctx: Ctx, state: State): Promise<ConflictReport[]> {
  const slotId = new Map(ctx.input.slots.map((s) => [`${s.day}-${s.period}`, s.id]));
  const bad = validate(ctx, state.place);
  const conflicts = analyze(ctx, state);
  const data = [
    ...ctx.sessions.flatMap((s, i) => {
      const p = state.place[i];
      if (!p) return [];
      return Array.from({ length: s.length }, (_, k) => ({
        semester, enrollmentId: s.enrollmentId, roomId: p.roomId, slotId: slotId.get(`${p.day}-${p.start + k}`)!,
        status: bad.has(i) ? ("CONFLICT" as const) : ("VALID" as const), conflictReason: bad.get(i) ?? null,
      }));
    }),
    ...conflicts.map((c) => ({ semester, enrollmentId: c.enrollmentId, roomId: null, slotId: null, status: "CONFLICT" as const,
      conflictReason: `[${c.title}] ขาด ${c.missingHours} คาบ: ${c.reasons.join(" | ")}` })),
  ];
  await prisma.$transaction([
    prisma.schedule.deleteMany({ where: { semester } }),
    prisma.schedule.createMany({ data }),
  ]);
  return conflicts;
}

