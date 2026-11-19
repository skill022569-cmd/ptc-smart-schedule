import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { setSession, verifyPassword } from "@/lib/auth";

export async function POST(req: Request) {
  const { username, password } = await req.json().catch(() => ({}));
  if (typeof username !== "string" || typeof password !== "string") return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
  let user;
  try {
    user = await prisma.user.findUnique({ where: { username: username.trim() } });
  } catch (e) {
    // บอกชนิดปัญหาฐานข้อมูลโดยไม่เปิดเผย connection string; รายละเอียดเต็มดูใน Vercel → Logs
    console.error("login db error", e);
    const code = (e as { errorCode?: string; code?: string }).errorCode ?? (e as { code?: string }).code ?? (e as Error).name;
    // ข้อความของ Prisma ไม่มีรหัสผ่าน แต่ตัด URL ทิ้งเผื่อไว้
    const detail = String((e as Error).message ?? "").replace(/mysql:\/\/\S+/g, "mysql://***").replace(/\s+/g, " ").trim().slice(-300);
    return NextResponse.json({ error: `เชื่อมต่อฐานข้อมูลไม่ได้ (${code}): ${detail}` }, { status: 503 });
  }
  if (!user || !verifyPassword(password, user.passwordHash)) return NextResponse.json({ error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" }, { status: 401 });
  await setSession(user.id);
  return NextResponse.json({ ok: true });
}
