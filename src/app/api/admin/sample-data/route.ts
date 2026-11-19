import { NextResponse } from "next/server";
import { apiUser, clearSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { seedDatabase } from "../../../../../prisma/seed-lib";

export const maxDuration = 60;

/** โหลดข้อมูลตัวอย่างแทนข้อมูลทั้งหมด (แอดมิน + ต้องพิมพ์ยืนยัน) — หลังโหลดต้องเข้าสู่ระบบใหม่ */
export async function POST(req: Request) {
  const u = await apiUser(["ADMIN"]);
  if (u instanceof NextResponse) return u;
  const { scale, confirm } = await req.json().catch(() => ({}));
  if (confirm !== "ยืนยัน") return NextResponse.json({ error: 'กรุณาพิมพ์ "ยืนยัน"' }, { status: 400 });
  if (scale !== "demo" && scale !== "stress") return NextResponse.json({ error: "ขนาดข้อมูลไม่ถูกต้อง" }, { status: 400 });
  const t0 = Date.now();
  const r = await seedDatabase(prisma, scale);
  await clearSession(); // บัญชีแอดมินถูกสร้างใหม่ → คุกกี้เดิมใช้ไม่ได้
  return NextResponse.json({ ok: true, ...r, ms: Date.now() - t0 });
}
