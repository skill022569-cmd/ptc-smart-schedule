import { prisma } from "./db";

export const VIEWS = { teacher: "ครู", room: "ห้อง", group: "กลุ่มเรียน", student: "นักเรียน", subject: "รายวิชา" } as const;
export type View = keyof typeof VIEWS;
export const isView = (v: unknown): v is View => typeof v === "string" && v in VIEWS;

export interface Cell { day: number; period: number; enrollmentId: number; subject: string; teacher: string; room: string; group: string }

export async function entityOptions(view: View): Promise<{ id: number; label: string }[]> {
  switch (view) {
    case "teacher": return (await prisma.user.findMany({ where: { role: "TEACHER" }, orderBy: { fullName: "asc" } })).map((t) => ({ id: t.id, label: t.fullName }));
    case "room": return (await prisma.room.findMany({ orderBy: { code: "asc" } })).map((r) => ({ id: r.id, label: `${r.code} ${r.name}` }));
    case "group": return (await prisma.studentGroup.findMany({ orderBy: { code: "asc" } })).map((g) => ({ id: g.id, label: g.name }));
    case "subject": return (await prisma.subject.findMany({ orderBy: { code: "asc" } })).map((s) => ({ id: s.id, label: `${s.code} ${s.name}` }));
    case "student": return []; // นักเรียนมีจำนวนมาก: ค้นหาด้วยรหัสแทน dropdown
  }
}

async function rows(semester: string) {
  return prisma.schedule.findMany({
    where: { semester, slotId: { not: null } },
    include: { slot: true, room: true, enrollment: { include: { subject: true, teacher: true, group: true, student: true } } },
  });
}
type Row = Awaited<ReturnType<typeof rows>>[number];

function toCell(r: Row): Cell {
  const e = r.enrollment;
  return { day: r.slot!.dayOfWeek, period: r.slot!.periodNo, enrollmentId: e.id, subject: `${e.subject.code} ${e.subject.name}`,
    teacher: e.teacher.fullName, room: r.room?.code ?? "-", group: e.group?.name ?? e.student?.fullName ?? "-" };
}

async function matcher(view: View, id: number): Promise<(r: Row) => boolean> {
  if (view === "student") {
    const s = await prisma.student.findUnique({ where: { id } });
    return (r) => !!s && (r.enrollment.groupId === s.groupId || r.enrollment.studentId === s.id);
  }
  return (r) => view === "teacher" ? r.enrollment.teacherId === id
    : view === "room" ? r.roomId === id
    : view === "group" ? r.enrollment.groupId === id
    : r.enrollment.subjectId === id;
}

export async function scheduleFor(semester: string, view: View, id: number): Promise<Cell[]> {
  const m = await matcher(view, id);
  return (await rows(semester)).filter(m).map(toCell);
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
