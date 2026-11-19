import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { maskPhone } from "@/lib/mask";

export default async function Directory({ searchParams }: { searchParams: Promise<{ q?: string; dept?: string }> }) {
  const u = await requireUser();
  const { q = "", dept = "" } = await searchParams;
  const staff = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "TEACHER"] }, ...(dept && { department: dept }),
      ...(q && { OR: [{ fullName: { contains: q } }, { position: { contains: q } }, { department: { contains: q } }] }) },
    orderBy: [{ department: "asc" }, { fullName: "asc" }],
  });
  const depts = (await prisma.user.findMany({ where: { role: { in: ["ADMIN", "TEACHER"] } }, distinct: ["department"], select: { department: true } }))
    .map((d) => d.department ?? "ฝ่ายบริหาร").sort();
  const groups = new Map<string, typeof staff>();
  for (const s of staff) { const k = s.department ?? "ฝ่ายบริหาร"; groups.set(k, [...(groups.get(k) ?? []), s]); }
  const canSeeContact = (id: number) => u.role === "ADMIN" || u.id === id; // PDPA: ข้อมูลติดต่อส่วนตัวเห็นเฉพาะแอดมิน/เจ้าของ
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">ทำเนียบบุคลากร</h1>
      <form className="flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="ค้นหาชื่อ ตำแหน่ง แผนก" aria-label="ค้นหา" className="input" />
        <select name="dept" defaultValue={dept} aria-label="แผนก" className="input"><option value="">ทุกแผนก</option>{depts.map((d) => <option key={d}>{d}</option>)}</select>
        <button className="btn-outline">ค้นหา</button>
      </form>
      {[...groups].map(([d, list]) => (
        <section key={d} className="card">
          <h2 className="mb-2 font-semibold text-blue-800">{d} ({list.length})</h2>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((s) => (
              <li key={s.id} className="rounded border p-2 text-sm">
                <div className="font-semibold">{s.fullName}</div>
                <div className="text-slate-600">{s.position ?? "-"}</div>
                <div className="text-xs text-slate-500">โทร {canSeeContact(s.id) ? s.phone ?? "-" : maskPhone(s.phone)} · {canSeeContact(s.id) ? s.email ?? "-" : "อีเมลปกปิดตาม PDPA"}</div>
                {s.role === "TEACHER" && <Link className="text-xs text-blue-700 underline" href={`/schedule?view=teacher&id=${s.id}`}>ดูตารางสอน</Link>}
              </li>
            ))}
          </ul>
        </section>
      ))}
      {!staff.length && <p className="text-sm text-slate-500">ไม่พบบุคลากร</p>}
    </div>
  );
}
