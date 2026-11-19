import { NextResponse } from "next/server";
import { apiUser, setViewAs } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** เริ่ม/เลิกดูในมุมมองผู้ใช้ (ฟอร์ม HTML) — แอดมินเท่านั้น และบันทึกลง log PDPA ของผู้ถูกดู */
export async function POST(req: Request) {
  const u = await apiUser(["ADMIN"]);
  if (u instanceof NextResponse) return u;
  const f = await req.formData();
  if (f.get("exit")) {
    await setViewAs(null);
    return NextResponse.redirect(new URL("/admin/view-as", req.url), 303);
  }
  const target = await prisma.user.findUnique({ where: { id: Number(f.get("userId")) }, select: { id: true } });
  if (!target) return NextResponse.json({ error: "ไม่พบผู้ใช้" }, { status: 404 });
  await setViewAs(target.id);
  await prisma.pdpaConsentLog.create({ data: { userId: target.id, action: `ADMIN_VIEW_AS:${u.username}`,
    ip: req.headers.get("x-forwarded-for")?.split(",")[0] ?? null, userAgent: req.headers.get("user-agent") } });
  return NextResponse.redirect(new URL("/", req.url), 303);
}
