import { requireUser } from "@/lib/auth";
import { timeslots } from "@/lib/schedule-query";
import ManualScheduler from "@/components/ManualScheduler";

export default async function TeacherEditPage() {
  const u = await requireUser(["TEACHER"]);
  const slots = await timeslots();
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">แก้ไขตารางสอนของฉัน — {u.fullName}</h1>
      <p className="text-sm text-stone-600">วาง ย้าย หรือเอาคาบออกได้เฉพาะวิชาที่ท่านสอน ระบบตรวจไม่ให้ชนกับครู ห้อง และกลุ่มเรียนอื่นทุกครั้ง หากต้องการปรับที่กระทบผู้อื่น โปรดแจ้งที่เมนู &quot;แจ้งปัญหา&quot;</p>
      <ManualScheduler slots={slots} mine />
    </div>
  );
}
