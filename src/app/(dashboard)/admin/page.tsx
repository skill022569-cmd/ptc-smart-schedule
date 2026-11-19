import { requireUser } from "@/lib/auth";
import { timeslots } from "@/lib/schedule-query";
import { loadInput } from "@/lib/engine-io";
import { buildCtx, precheck } from "@/engine";
import AdminPanel from "@/components/AdminPanel";

export default async function AdminPage() {
  await requireUser(["ADMIN"]);
  const [slots, input] = await Promise.all([timeslots(), loadInput()]);
  const warnings = precheck(buildCtx(input).ctx);
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">จัดการข้อมูลและรันจัดตาราง</h1>
      <section className="card text-sm">
        <h2 className="font-semibold">ตรวจสอบข้อมูลก่อนคำนวณ (Pre-check)</h2>
        <p className="text-slate-500">ข้อมูลตั้งต้น: {input.enrollments.length} การลงทะเบียน · {new Set(input.enrollments.map((e) => e.teacherId)).size} ครูที่มีคาบสอน · {new Set(input.enrollments.map((e) => e.homeGroupId)).size} กลุ่มเรียน · {input.rooms.length} ห้อง — แก้ไขข้อมูลตั้งต้นผ่าน <code>npm run db:studio</code> หรือ seed</p>
        {warnings.length ? <ul className="mt-2 list-disc pl-5 text-orange-700">{warnings.map((w) => <li key={w}>{w}</li>)}</ul> : <p className="mt-2 text-emerald-700">✓ ไม่พบปัญหา</p>}
      </section>
      <AdminPanel slots={slots} />
    </div>
  );
}
