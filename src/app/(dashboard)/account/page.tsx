import { requireUser } from "@/lib/auth";
import { ChangePasswordForm } from "@/components/forms";

export default async function AccountPage() {
  const u = await requireUser(["ADMIN", "TEACHER"]);
  return (
    <div className="max-w-md space-y-3">
      <h1 className="text-xl font-bold">เปลี่ยนรหัสผ่าน</h1>
      {u.previewBy
        ? <p className="card text-sm">กำลังดูในมุมมองผู้ใช้อื่น — กด &quot;กลับเป็นแอดมิน&quot; ก่อนเปลี่ยนรหัสผ่านของตนเอง</p>
        : <ChangePasswordForm username={u.username} />}
    </div>
  );
}
