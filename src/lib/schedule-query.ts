import type { Prisma } from "@prisma/client";
import { prisma } from "./db";

export const VIEWS = { teacher: "ครู", room: "ห้อง", group: "กลุ่มเรียน", student: "นักเรียน", subject: "รายวิชา" } as const;
export type View = keyof typeof VIEWS;
export const isView = (v: unknown): v is View => typeof v === "string" && v in VIEWS;

/** ข้อมูลในแต่ละช่อง ตามมุมมอง — ไม่ซ้ำกับสิ่งที่หัวตารางบอกอยู่แล้ว */
export const cellFields = (view: View): ("teacher" | "group" | "room")[] =>
  view === "teacher" ? ["group", "room"] : view === "room" ? ["teacher", "group"] : view === "subject" ? ["teacher", "group", "room"] : ["teacher", "room"];

export interface Cell { day: number; period: number; enrollmentId: number; subject: string; teacher: string; room: string; group: string }

export async function entityOptions(view: View): Promise<{ id: number; label: string }[]> {
  switch (view) {
    // ต่อท้ายแผนก เพราะชื่อครูซ้ำกันได้ (เช่น ครูกมล คนละแผนก)
    case "teacher": return (await prisma.user.findMany({ where: { role: "TEACHER", boardOrder: null }, orderBy: { fullName: "asc" } })).map((t) => ({ id: t.id, label: t.department ? `${t.fullName} · ${t.department}` : t.fullName }));
    case "room": return (await prisma.room.findMany({ orderBy: { code: "asc" } })).map((r) => ({ id: r.id, label: `${r.code} ${r.name}` }));
    case "group": return (await prisma.studentGroup.findMany({ orderBy: { code: "asc" } })).map((g) => ({ id: g.id, label: g.name }));
    case "subject": return (await prisma.subject.findMany({ orderBy: { code: "asc" } })).map((s) => ({ id: s.id, label: `${s.code} ${s.name}` }));
    case "student": return []; // นักเรียนมีจำนวนมาก: ค้นหาด้วยรหัสแทน dropdown
  }
}

async function rows(semester: string, where: Prisma.ScheduleWhereInput = {}) {
  return prisma.schedule.findMany({
    where: { semester, slotId: { not: null }, ...where },
    include: { slot: true, room: true, enrollment: { include: { subject: true, teacher: true, group: true, student: true } } },
  });
}
type Row = Awaited<ReturnType<typeof rows>>[number];

function toCell(r: Row): Cell {
  const e = r.enrollment;
  return { day: r.slot!.dayOfWeek, period: r.slot!.periodNo, enrollmentId: e.id, subject: `${e.subject.code} ${e.subject.name}`,
    teacher: e.teacher.fullName, room: r.room?.code ?? "-", group: e.group?.name ?? e.student?.fullName ?? "-" };
}

/** เงื่อนไขของแต่ละมุมมอง ให้ฐานข้อมูลกรองเอง (ไม่โหลดทั้งภาคเรียนมากรองในหน่วยความจำ) */
async function whereFor(view: View, id: number): Promise<Prisma.ScheduleWhereInput> {
  switch (view) {
    case "teacher": return { enrollment: { teacherId: id } };
    case "room": return { roomId: id };
    case "group": return { enrollment: { groupId: id } };
    case "subject": return { enrollment: { subjectId: id } };
    case "student": {
      const s = await prisma.student.findUnique({ where: { id }, select: { groupId: true } });
      return s ? { enrollment: { OR: [{ groupId: s.groupId }, { studentId: id }] } } : { id: -1 };
    }
  }
}

export async function scheduleFor(semester: string, view: View, id: number): Promise<Cell[]> {
  return (await rows(semester, await whereFor(view, id))).map(toCell);
}

/** ทุก entity ของมุมมองนี้ (ใช้ export Excel แยก sheet) — query เดียวแล้วจัดกลุ่มในหน่วยความจำ */
export async function scheduleForAll(semester: string, view: Exclude<View, "student">) {
  const [all, opts] = await Promise.all([rows(semester), entityOptions(view)]);
  const key = (r: Row) => view === "teacher" ? r.enrollment.teacherId : view === "room" ? r.roomId : view === "group" ? r.enrollment.groupId : r.enrollment.subjectId;
  const by = new Map<number, Cell[]>();
  for (const r of all) { const k = key(r); if (k != null) by.set(k, [...(by.get(k) ?? []), toCell(r)]); }
  return opts.filter((o) => by.has(o.id)).map((o) => ({ ...o, cells: by.get(o.id)! }));
}

export async function timeslots() {
  return (await prisma.timeslot.findMany({ orderBy: [{ dayOfWeek: "asc" }, { periodNo: "asc" }] }))
    .map((s) => ({ day: s.dayOfWeek, period: s.periodNo, start: s.startTime, end: s.endTime, lunch: s.isLunchBreak }));
}
export type SlotRow = Awaited<ReturnType<typeof timeslots>>[number];
