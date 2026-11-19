// npm run db:seed            → ข้อมูลตัวอย่างขนาดเล็ก (demo)
// SEED_SCALE=stress npm run db:seed → นักเรียน 2,000 / ครู 100+ / วิชา 500+
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";
import { LUNCH, SLOT_TIMES, makeDataset } from "./data";

const prisma = new PrismaClient();
const scale = process.env.SEED_SCALE === "stress" ? "stress" : "demo";
const BATCH = 500;

async function insert<T>(rows: T[], fn: (chunk: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += BATCH) await fn(rows.slice(i, i + BATCH));
}

async function main() {
  const ds = makeDataset(scale);
  console.log(`seed (${scale}): นักเรียน ${ds.students.length}, ครู ${ds.teachers.length}, วิชา ${ds.subjects.length}, ห้อง ${ds.rooms.length}`);

  // ล้างข้อมูลเดิม (ลำดับตาม foreign key)
  for (const m of ["schedule", "enrollment", "pdpaConsentLog", "issueReport", "systemBackup", "student", "teacherConstraint", "user", "studentGroup", "subject", "room", "timeslot"] as const)
    await (prisma[m] as unknown as { deleteMany: () => Promise<unknown> }).deleteMany();

  await prisma.timeslot.createMany({ data: [1, 2, 3, 4, 5].flatMap((day) => SLOT_TIMES.map(([startTime, endTime], i) =>
    ({ dayOfWeek: day, periodNo: i + 1, startTime, endTime, isLunchBreak: i + 1 === LUNCH }))) });

  // demo password: admin = "admin1234", บุคลากร = รหัสบุคลากร, นักเรียน = รหัสนักเรียน (ต้องเปลี่ยนก่อนใช้งานจริง)
  const pw = (s: string) => hashPassword(s);
  await prisma.user.create({ data: { username: "admin", passwordHash: pw("admin1234"), fullName: ds.admins[0].name, role: "ADMIN", position: ds.admins[0].position, department: "ฝ่ายบริหาร", phone: "0812345678", email: "academic@ptc.ac.th" } });
  await insert(ds.teachers, (c) => prisma.user.createMany({ data: c.map((t, i) => ({
    username: t.code, passwordHash: pw(t.code), fullName: t.name, role: "TEACHER" as const, department: t.department, position: t.position,
    phone: `08${String(10000000 + i * 7919).slice(0, 8)}`, email: `${t.code.toLowerCase()}@ptc.ac.th` })) }));
  const users = new Map((await prisma.user.findMany()).map((u) => [u.username, u.id]));
  await prisma.teacherConstraint.createMany({ data: ds.teachers.map((t) => ({ teacherId: users.get(t.code)!, maxHoursPerWeek: t.maxHours, unavailableSlots: t.unavailable, preferredTime: t.preferred })) });

  await prisma.studentGroup.createMany({ data: ds.groups.map((g) => ({ code: g.code, name: g.name, level: g.level, department: g.department, isDualVocational: g.isDual, studyDays: g.studyDays })) });
  const groups = new Map((await prisma.studentGroup.findMany()).map((g) => [g.code, g.id]));
  await insert(ds.students, (c) => prisma.user.createMany({ data: c.map((s) => ({ username: s.code, passwordHash: pw(s.code), fullName: s.name, role: "STUDENT" as const })) }));
  const users2 = new Map((await prisma.user.findMany({ where: { role: "STUDENT" } })).map((u) => [u.username, u.id]));
  await insert(ds.students, (c) => prisma.student.createMany({ data: c.map((s) => ({ studentCode: s.code, fullName: s.name, groupId: groups.get(s.groupCode)!, isDualVocational: s.isDual, userId: users2.get(s.code) })) }));
  const students = new Map((await prisma.student.findMany()).map((s) => [s.studentCode, s.id]));

  await insert(ds.subjects, (c) => prisma.subject.createMany({ data: c.map((s) => ({ code: s.code, name: s.name, theoryHours: s.theory, practiceHours: s.practice, requiredRoomType: s.roomType })) }));
  const subjects = new Map((await prisma.subject.findMany()).map((s) => [s.code, s.id]));
  await prisma.room.createMany({ data: ds.rooms.map((r) => ({ code: r.code, name: r.name, capacity: r.capacity, roomType: r.type, building: r.building })) });
  await insert(ds.enrollments, (c) => prisma.enrollment.createMany({ data: c.map((e) => ({
    subjectId: subjects.get(e.subjectCode)!, teacherId: users.get(e.teacherCode)!,
    groupId: e.groupCode ? groups.get(e.groupCode)! : null, studentId: e.studentCode ? students.get(e.studentCode)! : null })) }));
  console.log("เสร็จ: เข้าสู่ระบบด้วย admin / admin1234 แล้วกด 'รันจัดตาราง' ที่หน้า /admin");
}

main().finally(() => prisma.$disconnect());
