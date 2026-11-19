import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { maskPhone } from "@/lib/mask";

type Staff = Awaited<ReturnType<typeof prisma.user.findMany>>[number];

export default async function Directory({ searchParams }: { searchParams: Promise<{ q?: string; dept?: string }> }) {
  const u = await requireUser();
  const { q = "", dept = "" } = await searchParams;
  const [board, staff, deptRows] = await Promise.all([
    prisma.user.findMany({ where: { boardOrder: { not: null } }, orderBy: { boardOrder: "asc" } }),
    prisma.user.findMany({
      where: { role: { in: ["ADMIN", "TEACHER"] }, boardOrder: null, ...(dept && { department: dept }),
        ...(q && { OR: [{ fullName: { contains: q } }, { position: { contains: q } }, { department: { contains: q } }, { duties: { contains: q } }] }) },
      orderBy: [{ department: "asc" }, { fullName: "asc" }],
    }),
    prisma.user.findMany({ where: { role: { in: ["ADMIN", "TEACHER"] }, boardOrder: null }, distinct: ["department"], select: { department: true } }),
  ]);
  const depts = deptRows.map((d) => d.department ?? "ฝ่ายบริหาร").sort();
  const groups = new Map<string, Staff[]>();
  for (const s of staff) { const k = s.department ?? "ฝ่ายบริหาร"; groups.set(k, [...(groups.get(k) ?? []), s]); }
  const canSeeContact = (id: number) => u.role === "ADMIN" || u.id === id; // PDPA: ข้อมูลติดต่อส่วนตัวเห็นเฉพาะแอดมิน/เจ้าของ
  const [director, ...deputies] = board;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">ทำเนียบบุคลากร</h1>

      {director && !q && !dept && (
        <section className="card border-t-4 border-t-gold-500">
          <h2 className="mb-4 text-center text-lg font-bold text-brand-800">คณะผู้บริหาร</h2>
          <div className="flex justify-center"><BoardCard p={director} big /></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{deputies.map((p) => <BoardCard key={p.id} p={p} />)}</div>
        </section>
      )}

      <form className="flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="ค้นหาชื่อ ตำแหน่ง แผนก หน้าที่" aria-label="ค้นหา" className="input" />
        <select name="dept" defaultValue={dept} aria-label="แผนก" className="input"><option value="">ทุกแผนก</option>{depts.map((d) => <option key={d}>{d}</option>)}</select>
        <button className="btn-outline">ค้นหา</button>
      </form>
      {[...groups].map(([d, list]) => (
        <section key={d} className="card">
          <h2 className="mb-2 font-semibold text-brand-800">{d} ({list.length})</h2>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((s) => (
              <li key={s.id} className="rounded border p-2 text-sm">
                <Link href={`/directory/${s.id}`} className="font-semibold hover:underline">{s.fullName}</Link>
                <div className="text-stone-600">{s.position ?? "-"}</div>
                {s.duties && <div className="mt-1 line-clamp-2 text-xs text-stone-700"><b>หน้าที่:</b> {s.duties}</div>}
                <div className="text-xs text-stone-500">โทร {canSeeContact(s.id) ? s.phone ?? "-" : maskPhone(s.phone)} · {canSeeContact(s.id) ? s.email ?? "-" : "อีเมลปกปิดตาม PDPA"}</div>
                <div className="mt-1 flex gap-3 text-xs">
                  <Link className="text-brand-700 underline" href={`/directory/${s.id}`}>ดูประวัติ</Link>
                  {s.role === "TEACHER" && <Link className="text-brand-700 underline" href={`/schedule?view=teacher&id=${s.id}`}>ดูตารางสอน</Link>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {!staff.length && <p className="text-sm text-stone-500">ไม่พบบุคลากร</p>}
    </div>
  );
}

function BoardCard({ p, big }: { p: Staff; big?: boolean }) {
  return (
    <Link href={`/directory/${p.id}`} className={`block rounded-lg border border-brand-200 bg-brand-50 p-3 text-center hover:border-brand-700 ${big ? "w-full max-w-sm" : ""}`}>
      <div aria-hidden className={`mx-auto mb-2 flex items-center justify-center rounded-full bg-brand-800 font-bold text-gold-300 ${big ? "h-20 w-20 text-2xl" : "h-14 w-14 text-lg"}`}>
        {p.fullName.replace(/^\(.*\)$/, "?").replace(/^(ครู|นาย|นางสาว|นาง|ดร\.)/, "").trim().charAt(0) || "?"}
      </div>
      <div className={`font-bold ${big ? "text-lg" : ""}`}>{p.fullName}</div>
      <div className="text-sm text-brand-800">{p.position}</div>
      {p.duties && <p className="mt-1 line-clamp-3 text-xs text-stone-600">{p.duties}</p>}
    </Link>
  );
}
