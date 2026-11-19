import { NextResponse } from "next/server";
import { apiUser, hashPassword, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** เปลี่ยนรหัสผ่านของตนเอง (บัญชีที่ล็อกอินจริง ไม่ใช่บัญชีที่แอดมินกำลังดูมุมมอง) */
export async function POST(req: Request) {
  const u = await apiUser(["ADMIN", "TEACHER"]);
  if (u instanceof NextResponse) return u;
  const { current, next } = await req.json().catch(() => ({}));
  if (typeof current !== "string" || typeof next !== "string") return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
  if (!verifyPassword(current, u.passwordHash)) return NextResponse.json({ error: "รหัสผ่านปัจจุบันไม่ถูกต้อง" }, { status: 400 });
  if (next.length < 8 || next.length > 100) return NextResponse.json({ error: "รหัสผ่านใหม่ต้องยาว 8–100 ตัวอักษร" }, { status: 400 });
  if (next === u.username || next === current) return NextResponse.json({ error: "รหัสผ่านใหม่ต้องไม่เหมือนชื่อผู้ใช้หรือรหัสเดิม" }, { status: 400 });
  await prisma.user.update({ where: { id: u.id }, data: { passwordHash: hashPassword(next) } });
  return NextResponse.json({ ok: true });
}
