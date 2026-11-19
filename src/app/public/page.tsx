import Link from "next/link";
import { COLLEGE, SEMESTER } from "@/lib/db";
import { entityOptions, scheduleFor, timeslots, type View } from "@/lib/schedule-query";
import ScheduleGrid from "@/components/ScheduleGrid";
import { PrintButton } from "@/components/forms";

export const metadata = { title: `ตารางเรียน-ตารางสอน (สาธารณะ) | ${COLLEGE}` };

// มุมมองสาธารณะ: ไม่ต้องเข้าสู่ระบบ ดูอย่างเดียว ไม่มีข้อมูลส่วนบุคคล (ไม่มีรายชื่อ/รหัสนักเรียน เบอร์โทร อีเมล)
const TABS = { group: "กลุ่มเรียน", teacher: "ครู", room: "ห้องเรียน", subject: "รายวิชา" } as const;
type Tab = keyof typeof TABS;

export default async function PublicSchedule({ searchParams }: { searchParams: Promise<{ view?: string; id?: string }> }) {
  const sp = await searchParams;
  const view: Tab = sp.view && sp.view in TABS ? (sp.view as Tab) : "group";
  const [options, slots] = await Promise.all([entityOptions(view as View), timeslots()]);
  const id = options.some((o) => o.id === Number(sp.id)) ? Number(sp.id) : options[0]?.id ?? 0;
  const cells = id ? await scheduleFor(SEMESTER, view as View, id) : [];
  const title = options.find((o) => o.id === id)?.label ?? "";
  const show = view === "teacher" ? ["group", "room"] as const : view === "room" ? ["teacher", "group"] as const : ["teacher", "group", "room"] as const;
  return (
    <div className="min-h-screen">
      <header className="no-print border-b-4 border-gold-500 bg-brand-800 text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-2">
          <img src="/logo.webp" alt="ตราวิทยาลัยการอาชีพโพนทอง" width={48} height={48} className="h-12 w-12" />
          <div className="flex-1"><div className="font-bold leading-tight">{COLLEGE}</div><div className="text-xs text-gold-300">ตารางเรียน-ตารางสอน · ภาคเรียนที่ {SEMESTER} · มุมมองสาธารณะ</div></div>
          <Link href="/login" className="rounded border border-white/60 px-3 py-1 text-sm hover:bg-white/10">เข้าสู่ระบบ (บุคลากร)</Link>
        </div>
      </header>
      <main className="mx-auto max-w-7xl space-y-3 p-4">
        <div className="no-print flex flex-wrap gap-2 text-sm">
          {Object.entries(TABS).map(([v, l]) => <Link key={v} href={`/public?view=${v}`} className={v === view ? "btn" : "btn-outline"}>ตาม{l}</Link>)}
        </div>
        <form className="no-print flex flex-wrap items-center gap-2">
          <input type="hidden" name="view" value={view} />
          <select name="id" aria-label={`เลือก${TABS[view]}`} defaultValue={id} className="input max-w-md">{options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select>
          <button className="btn-outline">แสดง</button>
          <span className="flex-1" />
          <PrintButton />
        </form>
        <section className="card space-y-2">
          <div className="hidden text-center print:block"><p className="text-lg font-bold">{COLLEGE}</p></div>
          <h1 className="font-semibold">ตาราง{TABS[view]}: {title} <span className="font-normal text-stone-500">ภาคเรียนที่ {SEMESTER}</span></h1>
          {cells.length ? <ScheduleGrid slots={slots} cells={cells} show={[...show]} /> : <p className="rounded bg-stone-100 p-4 text-sm text-stone-600">ยังไม่มีคาบในตารางนี้</p>}
          <p className="text-xs text-stone-500">รวม {cells.length} คาบ/สัปดาห์ · ข้อมูลอาจเปลี่ยนแปลงได้ ติดต่อฝ่ายวิชาการ</p>
        </section>
      </main>
    </div>
  );
}
