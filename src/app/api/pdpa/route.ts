import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const log = (userId: number, action: string, req: Request) => prisma.pdpaConsentLog.create({
  data: { userId, action, ip: req.headers.get("x-forwarded-for")?.split(",")[0] ?? null, userAgent: req.headers.get("user-agent") },
});

/** ขอสำเนาข้อมูลส่วนบุคคลของตนเอง (สิทธิ์ตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล ม.30) */
export async function GET(req: Request) {
  const u = await apiUser();
  if (u instanceof NextResponse) return u;
  await log(u.id, "EXPORT", req);
  const data = await prisma.user.findUnique({
    where: { id: u.id },
    select: { username: true, fullName: true, role: true, department: true, position: true, phone: true, email: true, pdpaConsentAt: true, createdAt: true,
      student: { select: { studentCode: true, fullName: true, isDualVocational: true, group: { select: { name: true } } } },
      constraint: true, issues: true, consentLogs: { select: { action: true, createdAt: true } } },
  });
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="my-data.json"` } });
}

export async function POST(req: Request) {
  const u = await apiUser();
  if (u instanceof NextResponse) return u;
  const { action, note } = await req.json().catch(() => ({}));
  if (action === "CONSENT" || action === "WITHDRAW") {
    await prisma.user.update({ where: { id: u.id }, data: { pdpaConsentAt: action === "CONSENT" ? new Date() : null } });
  } else if (action === "DELETE_REQUEST" || action === "CORRECT_REQUEST") {
    // คำขอลบ/แก้ไขต้องให้เจ้าหน้าที่ตรวจสอบ (ข้อมูลการเรียนต้องเก็บตามระเบียบ) จึงสร้างเป็นเรื่องแจ้งในระบบ
    await prisma.issueReport.create({ data: { reporterId: u.id, category: "PDPA",
      description: `${action === "DELETE_REQUEST" ? "ขอลบข้อมูลส่วนบุคคล" : "ขอแก้ไขข้อมูลส่วนบุคคล"}: ${String(note ?? "").slice(0, 2000)}` } });
  } else return NextResponse.json({ error: "action ไม่ถูกต้อง" }, { status: 400 });
  await log(u.id, action, req);
  return NextResponse.json({ ok: true });
}
