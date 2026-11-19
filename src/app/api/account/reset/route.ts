import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { apiUser, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";

// ไม่มีตัวที่สับสนง่าย (0/O, 1/l/I) เพื่อให้ครูพิมพ์ตามได้ถูก
const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

/** แอดมินตั้งรหัสผ่านใหม่ให้บุคลากร: ส่ง password มา = ใช้รหัสนั้น, ไม่ส่ง = สุ่มรหัสชั่วคราว (แสดงครั้งเดียว) */
export async function POST(req: Request) {
  const u = await apiUser(["ADMIN"]);
  if (u instanceof NextResponse) return u;
  const { userId, password } = await req.json().catch(() => ({}));
  const target = await prisma.user.findFirst({ where: { id: Number(userId), role: { in: ["ADMIN", "TEACHER"] } }, select: { id: true, username: true } });
  if (!target) return NextResponse.json({ error: "ไม่พบบุคลากร" }, { status: 404 });
  if (target.id === u.id) return NextResponse.json({ error: "เปลี่ยนรหัสของตนเองที่เมนู \"เปลี่ยนรหัสผ่าน\"" }, { status: 400 });
  if (password != null && (typeof password !== "string" || password.length < 8 || password.length > 100))
    return NextResponse.json({ error: "รหัสผ่านใหม่ต้องยาว 8–100 ตัวอักษร" }, { status: 400 });
  if (password === target.username) return NextResponse.json({ error: "รหัสผ่านต้องไม่เหมือนชื่อผู้ใช้" }, { status: 400 });
  const temp = password ?? Array.from({ length: 10 }, () => CHARS[randomInt(CHARS.length)]).join("");
  await prisma.$transaction([
    prisma.user.update({ where: { id: target.id }, data: { passwordHash: hashPassword(temp) } }),
    prisma.pdpaConsentLog.create({ data: { userId: target.id, action: `PASSWORD_RESET_BY:${u.username}`,
      ip: req.headers.get("x-forwarded-for")?.split(",")[0] ?? null, userAgent: req.headers.get("user-agent") } }),
  ]);
  return NextResponse.json({ ok: true, username: target.username, password: temp });
}
