import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { SEMESTER, prisma } from "@/lib/db";
import { timeslots } from "@/lib/schedule-query";
import { resolveSchedule } from "@/lib/schedule-page";
import ScheduleGrid from "@/components/ScheduleGrid";

export default async function Overview({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const u = await requireUser();
  const sp = await searchParams;
  const admin = u.role === "ADMIN";
  // แอดมินเลือกดูตารางกลุ่มเรียน; ครู/นักเรียนเห็นตารางของตัวเอง
  const scheduleQuery = admin ? { view: "group", id: sp.id } : {};
  const [students, teachers, subjects, rooms, placed, conflicts, issues, sched, slots] = await Promise.all([
    prisma.student.count(), prisma.user.count({ where: { role: "TEACHER", boardOrder: null } }), prisma.subject.count(), prisma.room.count(),
    prisma.schedule.count({ where: { semester: SEMESTER, status: "VALID" } }),
    prisma.schedule.count({ where: { semester: SEMESTER, status: "CONFLICT" } }),
    prisma.issueReport.count({ where: admin ? { status: { not: "DONE" } } : { reporterId: u.id, status: { not: "DONE" } } }),
    resolveSchedule(u, scheduleQuery), timeslots(),
  ]);
  const stats: [string, number, string?][] = admin
    ? [["นักเรียน", students], ["ครู", teachers], ["รายวิชา", subjects], ["ห้องเรียน", rooms],
      ["คาบที่จัดแล้ว", placed], ["รายการจัดไม่สำเร็จ/ชน", conflicts, conflicts ? "text-red-600" : "text-emerald-600"], ["เรื่องแจ้งที่ยังไม่เสร็จ", issues]]
    : [["คาบของฉัน/สัปดาห์", sched.cells.length], ["เรื่องแจ้งที่ยังไม่เสร็จ", issues]];
  const show = sched.view === "teacher" ? (["group", "room"] as const) : (["teacher", "room"] as const);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">สวัสดี {u.fullName}</h1>
      <div className={`grid grid-cols-2 gap-3 ${admin ? "sm:grid-cols-4 lg:grid-cols-7" : "sm:grid-cols-4"}`}>
        {stats.map(([l, n, c]) => <div key={l} className="card py-3"><div className="text-xs text-stone-500">{l}</div><div className={`text-2xl font-bold ${c ?? ""}`}>{n.toLocaleString("th-TH")}</div></div>)}
      </div>

      <section className="card space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-semibold text-brand-800">{sched.title} <span className="font-normal text-stone-500">ภาคเรียนที่ {SEMESTER}</span></h2>
          <span className="flex-1" />
          {admin && (
            <form className="flex gap-2">
              <select name="id" aria-label="เลือกกลุ่มเรียน" defaultValue={sched.id} className="input max-w-xs">{sched.options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select>
              <button className="btn-outline">แสดง</button>
            </form>
          )}
          <Link className="btn-outline" href={`/schedule?view=${sched.view}&id=${sched.id}`}>ดูแบบเต็ม / Export</Link>
        </div>
        {sched.cells.length
          ? <ScheduleGrid slots={slots} cells={sched.cells} show={[...show]} />
          : <p className="rounded bg-stone-100 p-4 text-sm text-stone-600">
              ยังไม่มีคาบในตารางนี้{admin && placed === 0 && <> — ภาคเรียนนี้ยังไม่ได้จัดตาราง ไปที่ <Link href="/admin" className="text-brand-700 underline">จัดตารางอัตโนมัติ</Link> หรือ <Link href="/admin/manual" className="text-brand-700 underline">จัดตารางเอง</Link></>}
            </p>}
      </section>

      {u.role === "TEACHER" && <Link className="btn" href="/teacher/edit">✏️ แก้ไขตารางสอนของฉัน</Link>}
      {admin && (
        <div className="flex flex-wrap gap-2">
          <Link className="btn" href="/admin">จัดตารางอัตโนมัติ {conflicts > 0 && `(${conflicts} รายการต้องแก้)`}</Link>
          <Link className="btn-outline" href="/admin/manual">จัดตารางเอง</Link>
        </div>
      )}
    </div>
  );
}
