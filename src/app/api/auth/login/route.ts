import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { setSession, verifyPassword } from "@/lib/auth";

export async function POST(req: Request) {
  const { username, password } = await req.json().catch(() => ({}));
  if (typeof username !== "string" || typeof password !== "string") return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
  const user = await prisma.user.findUnique({ where: { username: username.trim() } });
  if (!user || !verifyPassword(password, user.passwordHash)) return NextResponse.json({ error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" }, { status: 401 });
  await setSession(user.id);
  return NextResponse.json({ ok: true });
}
