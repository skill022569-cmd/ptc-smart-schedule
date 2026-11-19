import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { SEMESTER, prisma } from "@/lib/db";

export default async function Overview() {
  const u = await requireUser();
  const [students, teachers, subjects, rooms, placed, conflicts, issues] = await Promise.all([
    prisma.student.count(), prisma.user.count({ where: { role: "TEACHER" } }), prisma.subject.count(), prisma.room.count(),
    prisma.schedule.count({ where: { semester: SEMESTER, status: "VALID" } }),
    prisma.schedule.count({ where: { semester: SEMESTER, status: "CONFLICT" } }),
    prisma.issueReport.count({ where: u.role === "ADMIN" ? { status: { not: "DONE" } } : { reporterId: u.id, status: { not: "DONE" } } }),
  ]);
  const stats: [string, number, string?][] = [
    ["นักเรียน", students], ["ครู", teachers], ["รายวิชา", subjects], ["ห้องเรียน", rooms],
    ["คาบที่จัดแล้ว", placed], ["รายการจัดไม่สำเร็จ/ชน", conflicts, conflicts ? "text-red-600" : "text-emerald-600"], ["เรื่องแจ้งที่ยังไม่เสร็จ", issues],
  ];
  const mine = u.role === "TEACHER" ? `/schedule?view=teacher&id=${u.id}` : u.student ? `/schedule?view=student&id=${u.student.id}` : "/schedule";
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">สวัสดี {u.fullName}</h1>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {stats.map(([l, n, c]) => <div key={l} className="card"><div className="text-xs text-slate-500">{l}</div><div className={`text-2xl font-bold ${c ?? ""}`}>{n.toLocaleString("th-TH")}</div></div>)}
      </div>
      <div className="flex flex-wrap gap-2">
        <Link className="btn" href={mine}>ดูตารางของฉัน</Link>
        {u.role === "ADMIN" && <Link className="btn-outline" href="/admin">ไปหน้าจัดตาราง {conflicts > 0 && `(${conflicts} รายการต้องแก้)`}</Link>}
      </div>
    </div>
  );
}
