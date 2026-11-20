import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { SEMESTER } from "@/lib/db";
import { VIEWS, cellFields, timeslots } from "@/lib/schedule-query";
import { resolveSchedule } from "@/lib/schedule-page";
import ScheduleGrid from "@/components/ScheduleGrid";
import { AutoSubmitSelect } from "@/components/forms";

export default async function SchedulePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const u = await requireUser();
  const sp = await searchParams;
  const [r, slots] = await Promise.all([resolveSchedule(u, sp), timeslots()]);
  const qs = new URLSearchParams({ view: r.view, id: String(r.id) }).toString();
  return (
    <div className="space-y-3">
      <div className="no-print flex flex-wrap gap-2 text-sm">
        {Object.entries(VIEWS).map(([v, l]) => <Link key={v} href={`/schedule?view=${v}`} className={v === r.view ? "btn" : "btn-outline"}>ตาม{l}</Link>)}
      </div>
      <form className="no-print flex flex-wrap items-center gap-2">
        <input type="hidden" name="view" value={r.view} />
        {r.view === "student"
          ? u.role !== "STUDENT" && <><input name="q" aria-label="รหัสนักเรียน" placeholder="รหัสนักเรียน" defaultValue={sp.q} className="input" /><button className="btn-outline">ค้นหา</button></>
          : <><AutoSubmitSelect name="id" aria-label={`เลือก${r.viewLabel}`} defaultValue={r.id} className="input max-w-md">{r.options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</AutoSubmitSelect><noscript><button className="btn-outline">แสดง</button></noscript></>}
        <span className="flex-1" />
        <Link className="btn-outline" href={`/schedule/print?${qs}`} target="_blank">📄 Export PDF</Link>
        {u.role !== "STUDENT" && r.view !== "student" && <a className="btn-outline" href={`/api/export?view=${r.view}`}>📊 Export Excel (ทุก{r.viewLabel} แยก Sheet)</a>}
      </form>
      {r.error && <p className="text-sm text-red-600">{r.error}</p>}
      <div className="card space-y-2">
        <h1 className="font-semibold">{r.title} <span className="font-normal text-slate-500">ภาคเรียน {SEMESTER}</span></h1>
        <ScheduleGrid slots={slots} cells={r.cells} show={cellFields(r.view)} />
        <p className="text-xs text-slate-500">รวม {r.cells.length} คาบ/สัปดาห์</p>
      </div>
      {r.members.length > 0 && (
        <details className="card text-sm">
          <summary className="cursor-pointer font-semibold">รายชื่อนักเรียน ({r.members.length} คน) — รหัสแสดงแบบปกปิดตาม PDPA</summary>
          <ol className="mt-2 grid list-decimal gap-x-6 pl-6 sm:grid-cols-2 lg:grid-cols-3">{r.members.map((m) => <li key={m.code + m.name}>{m.code} {m.name}</li>)}</ol>
        </details>
      )}
    </div>
  );
}
