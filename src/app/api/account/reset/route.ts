import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { apiUser, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";

// ไม่มีตัวที่สับสนง่าย (0/O, 1/l/I) เพื่อให้ครูพิมพ์ตามได้ถูก
const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

/** แอดมินรีเซ็ตรหัสผ่านให้บุคลากร → คืนรหัสชั่วคราว (แสดงครั้งเดียว ไม่ได้เก็บแบบอ่านได้) */
export async function POST(req: Request) {
  const u = await apiUser(["ADMIN"]);
  if (u instanceof NextResponse) return u;
  const { userId } = await req.json().catch(() => ({}));
  const target = await prisma.user.findFirst({ where: { id: Number(userId), role: { in: ["ADMIN", "TEACHER"] } }, select: { id: true, username: true } });
  if (!target) return NextResponse.json({ error: "ไม่พบบุคลากร" }, { status: 404 });
  if (target.id === u.id) return NextResponse.json({ error: "เปลี่ยนรหัสของตนเองที่เมนู \"เปลี่ยนรหัสผ่าน\"" }, { status: 400 });
  const temp = Array.from({ length: 10 }, () => CHARS[randomInt(CHARS.length)]).join("");
  await prisma.$transaction([
    prisma.user.update({ where: { id: target.id }, data: { passwordHash: hashPassword(temp) } }),
    prisma.pdpaConsentLog.create({ data: { userId: target.id, action: `PASSWORD_RESET_BY:${u.username}`,
      ip: req.headers.get("x-forwarded-for")?.split(",")[0] ?? null, userAgent: req.headers.get("user-agent") } }),
  ]);
  return NextResponse.json({ ok: true, username: target.username, password: temp });
}
