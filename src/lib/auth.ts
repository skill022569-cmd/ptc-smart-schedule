import { createHmac, timingSafeEqual } from "node:crypto";
export { hashPassword, verifyPassword } from "./password";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import type { Role } from "@prisma/client";
import { prisma } from "./db";

const COOKIE = "ptc_session";
const MAX_AGE = 60 * 60 * 12;

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s && process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET is required");
  return s ?? "dev-only-secret";
}
const sig = (v: string) => createHmac("sha256", secret()).update(v).digest("base64url");

export async function setSession(userId: number) {
  const v = `${userId}.${Date.now() + MAX_AGE * 1000}`;
  (await cookies()).set(COOKIE, `${v}.${sig(v)}`, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: MAX_AGE, path: "/" });
}
export async function clearSession() { (await cookies()).delete(COOKIE); }

export async function currentUser() {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [id, exp, s] = raw.split(".");
  const v = `${id}.${exp}`;
  const good = s && Buffer.byteLength(s) === Buffer.byteLength(sig(v)) && timingSafeEqual(Buffer.from(s), Buffer.from(sig(v)));
  if (!good || Number(exp) < Date.now()) return null;
  return prisma.user.findUnique({ where: { id: Number(id) }, include: { student: true } });
}
export type SessionUser = NonNullable<Awaited<ReturnType<typeof currentUser>>>;

/** สำหรับหน้าเว็บ: ไม่ล็อกอิน → /login, สิทธิ์ไม่พอ → หน้าแรก */
export async function requireUser(roles?: Role[]) {
  const u = await currentUser();
  if (!u) redirect("/login");
  if (roles && !roles.includes(u.role)) redirect("/");
  return u;
}

/** สำหรับ API: คืน user หรือ NextResponse ที่เป็น error */
export async function apiUser(roles?: Role[]): Promise<SessionUser | NextResponse> {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (roles && !roles.includes(u.role)) return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  return u;
}
