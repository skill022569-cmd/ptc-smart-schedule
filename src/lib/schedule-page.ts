// ตรรกะร่วมของหน้า /schedule และ /schedule/print: แปลง searchParams → ตารางที่ผู้ใช้มีสิทธิ์ดู
import type { SessionUser } from "./auth";
import { SEMESTER, prisma } from "./db";
import { VIEWS, entityOptions, isView, scheduleFor, type View } from "./schedule-query";
import { maskCode } from "./mask";

export async function resolveSchedule(u: SessionUser, sp: Record<string, string | undefined>) {
  let view: View = isView(sp.view) ? sp.view : u.role === "TEACHER" ? "teacher" : u.student ? "student" : "group";
  let id = Number(sp.id) || (view === "teacher" && u.role === "TEACHER" ? u.id : 0);
  let error = "";
  if (view === "student") {
    if (u.role === "STUDENT") id = u.student?.id ?? 0; // นักเรียนดูได้เฉพาะตารางตัวเอง
    else if (sp.q) {
      const s = await prisma.student.findUnique({ where: { studentCode: sp.q.trim() } });
      if (s) id = s.id; else error = "ไม่พบรหัสนักเรียน";
    }
  }
  const options = await entityOptions(view);
  if (!id && options.length) id = options[0].id;
  const cells = id ? await scheduleFor(SEMESTER, view, id) : [];
  const fullAccess = u.role === "ADMIN";
  let title = options.find((o) => o.id === id)?.label ?? "";
  let members: { code: string; name: string }[] = [];
  if (view === "student" && id) {
    const s = await prisma.student.findUnique({ where: { id }, include: { group: true } });
    if (s) title = `${s.fullName} (${fullAccess || s.id === u.student?.id ? s.studentCode : maskCode(s.studentCode)}) ${s.group.name}`;
  }
  if (view === "group" && id) {
    members = (await prisma.student.findMany({ where: { groupId: id }, orderBy: { studentCode: "asc" } }))
      .map((s) => ({ code: fullAccess || s.id === u.student?.id ? s.studentCode : maskCode(s.studentCode), name: s.fullName }));
  }
  return { view, id, options, cells, title: `ตาราง${VIEWS[view]}: ${title}`, members, error, viewLabel: VIEWS[view] };
}
