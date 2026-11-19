import Link from "next/link";
import { COLLEGE, prisma } from "@/lib/db";

export const metadata = { title: `ทำเนียบบุคลากร | ${COLLEGE}` };

// ทำเนียบสาธารณะ: ชื่อ ตำแหน่ง หน้าที่ ประวัติ — ไม่แสดงเบอร์โทร/อีเมล (PDPA)
const PUBLIC = { id: true, fullName: true, position: true, department: true, duties: true, bio: true, role: true, boardOrder: true } as const;

export default async function PublicDirectory({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const [board, staff] = await Promise.all([
    prisma.user.findMany({ where: { boardOrder: { not: null } }, orderBy: { boardOrder: "asc" }, select: PUBLIC }),
    prisma.user.findMany({
      where: { role: "TEACHER", boardOrder: null,
        ...(q && { OR: [{ fullName: { contains: q } }, { position: { contains: q } }, { department: { contains: q } }, { duties: { contains: q } }] }) },
      orderBy: [{ department: "asc" }, { fullName: "asc" }], select: PUBLIC,
    }),
  ]);
  const groups = new Map<string, typeof staff>();
  for (const s of staff) { const k = s.department ?? "อื่นๆ"; groups.set(k, [...(groups.get(k) ?? []), s]); }
  const [director, ...deputies] = board;

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4">
      <h1 className="text-xl font-bold">ทำเนียบบุคลากร</h1>
      {director && !q && (
        <section className="card border-t-4 border-t-gold-500">
          <h2 className="mb-4 text-center text-lg font-bold text-brand-800">คณะผู้บริหาร</h2>
          <div className="flex justify-center"><Person p={director} big /></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{deputies.map((p) => <Person key={p.id} p={p} />)}</div>
        </section>
      )}
      <form className="flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="ค้นหาชื่อ ตำแหน่ง แผนก หน้าที่" aria-label="ค้นหา" className="input" />
        <button className="btn-outline">ค้นหา</button>
      </form>
      {[...groups].map(([d, list]) => (
        <section key={d} className="card">
          <h2 className="mb-2 font-semibold text-brand-800">{d} ({list.length})</h2>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{list.map((p) => <li key={p.id}><Person p={p} /></li>)}</ul>
        </section>
      ))}
      {!staff.length && <p className="text-sm text-stone-500">ไม่พบบุคลากร</p>}
    </main>
  );
}

function Person({ p, big }: { p: { id: number; fullName: string; position: string | null; duties: string | null; bio: string | null; boardOrder: number | null }; big?: boolean }) {
  const board = p.boardOrder != null;
  return (
    <div className={`h-full rounded-lg border p-3 text-sm ${board ? "border-brand-200 bg-brand-50 text-center" : "border-stone-200"} ${big ? "w-full max-w-sm" : ""}`}>
      {board && (
        <div aria-hidden className={`mx-auto mb-2 flex items-center justify-center rounded-full bg-brand-800 font-bold text-gold-300 ${big ? "h-20 w-20 text-2xl" : "h-14 w-14 text-lg"}`}>
          {p.fullName.replace(/^(ครู|นาย|นางสาว|นาง|ดร\.)/, "").trim().charAt(0) || "?"}
        </div>
      )}
      <div className={`font-semibold ${big ? "text-lg" : ""}`}>{p.fullName}</div>
      <div className={board ? "text-brand-800" : "text-stone-600"}>{p.position ?? "-"}</div>
      {p.duties && <p className="mt-1 text-xs text-stone-700"><b>หน้าที่:</b> {p.duties}</p>}
      {p.bio && (
        <details className="mt-1 text-left text-xs">
          <summary className="cursor-pointer text-brand-700 underline">ดูประวัติ</summary>
          <p className="mt-1 whitespace-pre-wrap text-stone-700">{p.bio}</p>
        </details>
      )}
      {!board && <Link className="mt-1 inline-block text-xs text-brand-700 underline" href={`/?view=teacher&id=${p.id}`}>ดูตารางสอน</Link>}
    </div>
  );
}
