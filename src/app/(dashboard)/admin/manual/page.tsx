import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { entityOptions, timeslots } from "@/lib/schedule-query";
import ManualScheduler from "@/components/ManualScheduler";

export default async function ManualPage() {
  await requireUser(["ADMIN"]);
  const [slots, groups] = await Promise.all([timeslots(), entityOptions("group")]);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">จัดตารางเอง</h1>
        <Link href="/admin" className="text-sm text-brand-700 underline">← จัดตารางอัตโนมัติ</Link>
      </div>
      <p className="text-sm text-stone-600">ระบบตรวจครูซ้อน ห้องซ้อน กลุ่มซ้อน เวลาที่ครูไม่สะดวก และพักเที่ยงให้ทุกครั้งที่วาง/ย้าย — จัดเองบางส่วนแล้วกด &quot;จัดเฉพาะที่เหลือ&quot; ในหน้าอัตโนมัติ ระบบจะคงคาบที่จัดไว้</p>
      <ManualScheduler slots={slots} groups={groups} />
    </div>
  );
}
