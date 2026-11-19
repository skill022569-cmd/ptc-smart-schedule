import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const ROLES = { TEACHER: "ครู", STUDENT: "นักเรียน", ADMIN: "แอดมิน" } as const;

export default async function ViewAsPage({ searchParams }: { searchParams: Promise<{ q?: string; role?: string }> }) {
  await requireUser(["ADMIN"]);
  const { q = "", role = "" } = await searchParams;
  const roleFilter = role === "TEACHER" || role === "STUDENT" ? role : undefined;
  const users = await prisma.user.findMany({
    where: { ...(roleFilter ? { role: roleFilter } : { role: { in: ["TEACHER", "STUDENT"] } }),
      ...(q && { OR: [{ fullName: { contains: q } }, { username: { contains: q } }, { department: { contains: q } }] }) },
    include: { student: { include: { group: true } } },
    orderBy: [{ role: "asc" }, { fullName: "asc" }], take: 30,
  });
  return (
    <div className="max-w-4xl space-y-4">
      <h1 className="text-xl font-bold">ดูในมุมมองผู้ใช้</h1>
      <p className="text-sm text-stone-600">เลือกครูหรือนักเรียน เพื่อดูหน้าเว็บแบบที่ผู้ใช้คนนั้นเห็น (ภาพรวม ตารางของเขา เมนูตามสิทธิ์) — ทุกครั้งที่เข้าดูจะถูกบันทึกในประวัติ PDPA ของผู้ใช้คนนั้น</p>
      <form className="flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="ค้นหาชื่อ รหัส หรือแผนก" aria-label="ค้นหาผู้ใช้" className="input" />
        <select name="role" defaultValue={role} aria-label="บทบาท" className="input">
          <option value="">ครูและนักเรียน</option><option value="TEACHER">ครู</option><option value="STUDENT">นักเรียน</option>
        </select>
        <button className="btn-outline">ค้นหา</button>
      </form>
      <ul className="card divide-y p-0">
        {users.map((x) => (
          <li key={x.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
            <span className="rounded bg-brand-50 px-2 py-0.5 text-xs text-brand-800">{ROLES[x.role]}</span>
            <span className="flex-1"><b>{x.fullName}</b> <span className="text-stone-500">· {x.username} · {x.student?.group.name ?? x.position ?? x.department ?? "-"}</span></span>
            <form action="/api/view-as" method="post">
              <input type="hidden" name="userId" value={x.id} />
              <button className="btn">👁 ดูในมุมมองนี้</button>
            </form>
          </li>
        ))}
        {!users.length && <li className="p-3 text-sm text-stone-500">ไม่พบผู้ใช้</li>}
      </ul>
      {users.length === 30 && <p className="text-xs text-stone-500">แสดง 30 รายการแรก — พิมพ์ค้นหาเพื่อหาคนอื่น</p>}
    </div>
  );
}
