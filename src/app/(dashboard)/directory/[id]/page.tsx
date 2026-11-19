import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { maskPhone } from "@/lib/mask";
import { ResetPasswordButton, StaffEditForm } from "@/components/forms";

export default async function StaffProfile({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser();
  const p = await prisma.user.findFirst({ where: { id: Number((await params).id), role: { in: ["ADMIN", "TEACHER"] } } });
  if (!p) notFound();
  const full = u.role === "ADMIN" || u.id === p.id; // PDPA: ข้อมูลติดต่อเต็มเฉพาะแอดมิน/เจ้าของ
  return (
    <div className="max-w-3xl space-y-4">
      <Link href="/directory" className="text-sm text-brand-700 underline">← กลับทำเนียบบุคลากร</Link>
      <section className="card border-t-4 border-t-gold-500">
        <h1 className="text-xl font-bold">{p.fullName}</h1>
        <p className="text-brand-800">{p.position ?? "-"}{p.department && ` · ${p.department}`}</p>
        {p.boardOrder != null && <span className="mt-1 inline-block rounded bg-gold-300 px-2 py-0.5 text-xs">คณะผู้บริหาร</span>}
        <dl className="mt-4 space-y-3 text-sm">
          <div><dt className="font-semibold">หน้าที่ / ภาระงาน</dt><dd className="whitespace-pre-wrap">{p.duties || "ยังไม่ได้ระบุ"}</dd></div>
          <div><dt className="font-semibold">ประวัติ</dt><dd className="whitespace-pre-wrap">{p.bio || "ยังไม่มีข้อมูลประวัติ"}</dd></div>
          <div><dt className="font-semibold">ติดต่อ</dt><dd>โทร {full ? p.phone ?? "-" : maskPhone(p.phone)} · {full ? p.email ?? "-" : "อีเมลปกปิดตาม PDPA"}</dd></div>
        </dl>
        <div className="mt-4 flex flex-wrap gap-2">
          {p.role === "TEACHER" && p.boardOrder == null && <Link className="btn-outline" href={`/schedule?view=teacher&id=${p.id}`}>ดูตารางสอน</Link>}
          {u.role === "ADMIN" && !u.previewBy && p.role === "TEACHER" && p.boardOrder == null && (
            <form action="/api/view-as" method="post"><input type="hidden" name="userId" value={p.id} /><button className="btn-outline">👁 ดูในมุมมองครูท่านนี้</button></form>
          )}
        </div>
        {u.role === "ADMIN" && !u.previewBy && u.id !== p.id && <div className="mt-3"><ResetPasswordButton userId={p.id} name={p.fullName} /></div>}
      </section>
      {(u.role === "ADMIN" || u.id === p.id) && (
        <StaffEditForm admin={u.role === "ADMIN"}
          p={{ id: p.id, fullName: p.fullName, position: p.position ?? "", department: p.department ?? "", duties: p.duties ?? "", bio: p.bio ?? "", boardOrder: p.boardOrder }} />
      )}
    </div>
  );
}
