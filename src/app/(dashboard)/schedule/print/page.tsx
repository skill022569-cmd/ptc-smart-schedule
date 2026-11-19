import { requireUser } from "@/lib/auth";
import { COLLEGE, SEMESTER } from "@/lib/db";
import { timeslots } from "@/lib/schedule-query";
import { resolveSchedule } from "@/lib/schedule-page";
import ScheduleGrid from "@/components/ScheduleGrid";
import { PrintButton } from "@/components/forms";

/** หน้าพิมพ์ตารางแบบราชการ (A4 แนวนอน) → ใช้ "บันทึกเป็น PDF" ของเบราว์เซอร์ */
export default async function PrintPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const u = await requireUser();
  const [r, slots] = await Promise.all([resolveSchedule(u, await searchParams), timeslots()]);
  return (
    <div className="space-y-3 bg-white p-4">
      <PrintButton auto />
      <div className="text-center">
        <img src="/logo.png" alt="ตราวิทยาลัยการอาชีพโพนทอง" width={72} height={72} className="mx-auto mb-1 h-[72px] w-[72px]" />
        <p className="text-lg font-bold">{COLLEGE}</p>
        <p className="font-semibold">{r.title}</p>
        <p>ภาคเรียนที่ {SEMESTER}</p>
      </div>
      <ScheduleGrid slots={slots} cells={r.cells} />
      <p className="text-sm">รวม {r.cells.length} คาบ/สัปดาห์</p>
      <div className="grid grid-cols-3 gap-6 pt-10 text-center text-sm">
        {["ผู้จัดตาราง", "รองผู้อำนวยการฝ่ายวิชาการ", "ผู้อำนวยการ" + COLLEGE].map((x) => (
          <div key={x}><p>ลงชื่อ ......................................</p><p>(......................................)</p><p>{x}</p></div>
        ))}
      </div>
    </div>
  );
}
