import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : undefined);

/** แก้ประวัติ/หน้าที่: เจ้าของแก้ของตัวเองได้, แอดมินแก้ได้ทุกคนรวมชื่อ ตำแหน่ง แผนก และลำดับผู้บริหาร */
export async function PATCH(req: Request) {
  const u = await apiUser(["ADMIN", "TEACHER"]);
  if (u instanceof NextResponse) return u;
  const b = await req.json().catch(() => ({}));
  const id = Number(b.id);
  const admin = u.role === "ADMIN";
  if (!admin && id !== u.id) return NextResponse.json({ error: "แก้ไขได้เฉพาะข้อมูลของตนเอง" }, { status: 403 });
  const data: Record<string, unknown> = { duties: text(b.duties, 5000), bio: text(b.bio, 10000) };
  if (admin) {
    const fullName = text(b.fullName, 190);
    if (fullName === "") return NextResponse.json({ error: "กรุณากรอกชื่อ" }, { status: 400 });
    Object.assign(data, { fullName, position: text(b.position, 190), department: text(b.department, 190) || null,
      boardOrder: b.boardOrder === "" || b.boardOrder == null ? null : Math.max(1, Math.min(99, Number(b.boardOrder) || 1)) });
  }
  const target = await prisma.user.findFirst({ where: { id, role: { in: ["ADMIN", "TEACHER"] } }, select: { id: true } });
  if (!target) return NextResponse.json({ error: "ไม่พบบุคลากร" }, { status: 404 });
  await prisma.user.update({ where: { id }, data });
  return NextResponse.json({ ok: true });
}
