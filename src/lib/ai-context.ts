// บริบทข้อมูลทั้งวิทยาลัยสำหรับผู้ช่วย AI — ไม่มีเบอร์โทร/อีเมล/ชื่อหรือรหัสนักเรียนรายคน (PDPA)
// ผลลัพธ์เรียงแน่นอนทุกครั้ง เพื่อให้ prompt cache ใช้ซ้ำได้ระหว่างผู้ใช้
import { COLLEGE, SEMESTER, prisma } from "./db";
import { dayName } from "@/engine/validator";

const D = (d: number) => dayName(d).slice(0, 3);

export async function buildCollegeContext(): Promise<string> {
  const [slots, staff, groups, rooms, subjects, rows, counts] = await Promise.all([
    prisma.timeslot.findMany({ where: { dayOfWeek: 1 }, orderBy: { periodNo: "asc" } }),
    prisma.user.findMany({ where: { role: { in: ["ADMIN", "TEACHER"] } }, orderBy: [{ boardOrder: "asc" }, { department: "asc" }, { fullName: "asc" }],
      select: { fullName: true, position: true, department: true, duties: true, bio: true, boardOrder: true } }),
    prisma.studentGroup.findMany({ orderBy: { code: "asc" }, include: { _count: { select: { students: true } } } }),
    prisma.room.findMany({ orderBy: { code: "asc" } }),
    prisma.subject.findMany({ orderBy: { code: "asc" } }),
    prisma.schedule.findMany({ where: { semester: SEMESTER, slotId: { not: null } }, orderBy: { id: "asc" },
      include: { slot: true, room: true, enrollment: { include: { subject: true, teacher: true, group: true, student: { include: { group: true } } } } } }),
    prisma.schedule.count({ where: { semester: SEMESTER, slotId: null } }),
  ]);
  const out: string[] = [`# ข้อมูล${COLLEGE} ภาคเรียนที่ ${SEMESTER}`];
  out.push("## เวลาคาบ (ทุกวัน จันทร์-ศุกร์)", slots.map((s) => `คาบ ${s.periodNo} ${s.startTime}-${s.endTime}${s.isLunchBreak ? " พักกลางวัน" : ""}`).join(" | "));

  const clip = (s: string | null, n: number) => (s ? s.replace(/\s*\n\s*/g, "; ").slice(0, n) : "-");
  out.push("## คณะผู้บริหาร");
  for (const p of staff.filter((x) => x.boardOrder != null)) out.push(`- ${p.fullName} | ${p.position} | หน้าที่: ${clip(p.duties, 400)} | ประวัติ: ${clip(p.bio, 600)}`);
  out.push("## บุคลากร (แยกแผนก)");
  for (const p of staff.filter((x) => x.boardOrder == null)) out.push(`- [${p.department ?? "-"}] ${p.fullName} | ${p.position ?? "-"} | หน้าที่: ${clip(p.duties, 250)} | ประวัติ: ${clip(p.bio, 300)}`);

  out.push("## กลุ่มเรียน");
  for (const g of groups) out.push(`- ${g.name} | ${g.level} แผนก${g.department} | ${g._count.students} คน | ${g.isDualVocational ? `ทวิภาคี มาเรียนวัน ${(g.studyDays as number[]).map(D).join(" ")}` : "ปกติ"}`);
  out.push("## ห้องเรียน", rooms.map((r) => `${r.code} (${r.roomType}, ${r.capacity} ที่, ${r.building})`).join(" | "));
  out.push("## รายวิชา (ทฤษฎี-ปฏิบัติ คาบ/สัปดาห์)", subjects.map((s) => `${s.code} ${s.name} (${s.theoryHours}-${s.practiceHours})`).join(" | "));

  // ตารางทั้งหมด จัดกลุ่มตามกลุ่มเรียน รวมคาบต่อเนื่องเป็นช่วงเดียว
  out.push(`## ตารางเรียน-สอนทั้งหมด (จัดแล้ว ${rows.length} คาบ, จัดไม่สำเร็จ ${counts} รายการ)`);
  if (!rows.length) out.push("ยังไม่ได้จัดตารางภาคเรียนนี้");
  type R = (typeof rows)[number];
  const label = (r: R) => r.enrollment.group?.name ?? `นักเรียนรายบุคคล (${r.enrollment.student?.group.name ?? "-"})`;
  const by = new Map<string, R[]>();
  for (const r of rows) by.set(label(r), [...(by.get(label(r)) ?? []), r]);
  for (const [g, list] of [...by].sort(([a], [b]) => a.localeCompare(b, "th"))) {
    list.sort((a, b) => a.slot!.dayOfWeek - b.slot!.dayOfWeek || a.slot!.periodNo - b.slot!.periodNo);
    const parts: string[] = [];
    for (let i = 0; i < list.length; i++) {
      const r = list[i];
      let j = i;
      while (j + 1 < list.length && list[j + 1].enrollmentId === r.enrollmentId && list[j + 1].slot!.dayOfWeek === r.slot!.dayOfWeek && list[j + 1].slot!.periodNo === list[j].slot!.periodNo + 1) j++;
      const p1 = r.slot!.periodNo, p2 = list[j].slot!.periodNo;
      parts.push(`${D(r.slot!.dayOfWeek)} ${p1 === p2 ? p1 : `${p1}-${p2}`}: ${r.enrollment.subject.code} ${r.enrollment.subject.name} (${r.enrollment.teacher.fullName}, ห้อง ${r.room?.code ?? "-"})`);
      i = j;
    }
    out.push(`- ${g}: ${parts.join("; ")}`);
  }
  return out.join("\n");
}
