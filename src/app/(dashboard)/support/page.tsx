import { requireUser } from "@/lib/auth";
import { ISSUE_CATEGORIES, prisma } from "@/lib/db";
import { IssueAdmin, IssueForm } from "@/components/forms";

const STATUS = { PENDING: ["รอดำเนินการ", "bg-slate-200"], IN_PROGRESS: ["กำลังแก้ไข", "bg-yellow-200"], DONE: ["เสร็จสิ้น", "bg-emerald-200"] } as const;

export default async function Support() {
  const u = await requireUser();
  const admin = u.role === "ADMIN";
  const issues = await prisma.issueReport.findMany({
    where: admin ? {} : { reporterId: u.id }, orderBy: { createdAt: "desc" }, take: 200,
    include: { reporter: { select: { fullName: true } } },
  });
  return (
    <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
      <IssueForm categories={ISSUE_CATEGORIES} />
      <section className="space-y-2">
        <h2 className="font-semibold">{admin ? "เรื่องแจ้งทั้งหมด" : "เรื่องที่ฉันแจ้ง"}</h2>
        {!issues.length && <p className="text-sm text-slate-500">ยังไม่มีเรื่องแจ้ง</p>}
        {issues.map((i) => (
          <div key={i.id} className="card text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded px-2 py-0.5 text-xs ${STATUS[i.status][1]}`}>{STATUS[i.status][0]}</span>
              <b>{i.category}</b>
              <span className="text-slate-500">#{i.id} · {i.createdAt.toLocaleString("th-TH")}{admin && ` · ${i.reporter.fullName}`}</span>
            </div>
            <p className="mt-1 whitespace-pre-wrap">{i.description}</p>
            {!admin && i.adminReply && <p className="mt-1 rounded bg-brand-50 p-2">ตอบกลับ: {i.adminReply}</p>}
            {admin && <IssueAdmin id={i.id} status={i.status} reply={i.adminReply} />}
          </div>
        ))}
      </section>
    </div>
  );
}
