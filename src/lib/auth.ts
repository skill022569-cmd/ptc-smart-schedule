import { createHmac, timingSafeEqual } from "node:crypto";
export { hashPassword, verifyPassword } from "./password";
import { cookies, headers } from "next/headers";
import { cache } from "react";
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

export async function setSession(userId: number) { await writeSigned(COOKIE, userId); }
export async function clearSession() { const c = await cookies(); c.delete(COOKIE); c.delete(VIEW_AS); }

/** แอดมินดูเว็บในมุมมองผู้ใช้อื่น (อ่านอย่างเดียวในระดับหน้าเว็บ) */
const VIEW_AS = "ptc_view_as";
export async function setViewAs(userId: number | null) {
  if (userId == null) (await cookies()).delete(VIEW_AS); else await writeSigned(VIEW_AS, userId);
}

/** อ่านคุกกี้ที่ลงลายมือชื่อ "id.exp.sig" → id หรือ null */
async function readSigned(name: string): Promise<number | null> {
  const raw = (await cookies()).get(name)?.value;
  if (!raw) return null;
  const [id, exp, s] = raw.split(".");
  const v = `${id}.${exp}`;
  const good = s && Buffer.byteLength(s) === Buffer.byteLength(sig(v)) && timingSafeEqual(Buffer.from(s), Buffer.from(sig(v)));
  return good && Number(exp) >= Date.now() ? Number(id) : null;
}
async function writeSigned(name: string, id: number) {
  const v = `${id}.${Date.now() + MAX_AGE * 1000}`;
  (await cookies()).set(name, `${v}.${sig(v)}`, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: MAX_AGE, path: "/" });
}

/** ผู้ใช้ที่ล็อกอินจริง (API ใช้ตัวนี้เสมอ — โหมดดูมุมมองไม่ให้สิทธิ์เขียนแทนใคร) */
// cache(): layout กับหน้าเดียวกันเรียกซ้ำได้ แต่ query ฐานข้อมูลครั้งเดียวต่อ request
export const currentUser = cache(async () => {
  const id = await readSigned(COOKIE);
  return id == null ? null : prisma.user.findUnique({ where: { id }, include: { student: true } });
});
export type SessionUser = NonNullable<Awaited<ReturnType<typeof currentUser>>>;

/**
 * สำหรับหน้าเว็บ: ไม่ล็อกอิน → /login, สิทธิ์ไม่พอ → หน้าแรก
 * ถ้าแอดมินเปิดโหมดดูมุมมองผู้ใช้ จะคืนผู้ใช้เป้าหมาย พร้อม previewBy = ชื่อแอดมิน
 */
export async function requireUser(roles?: Role[]): Promise<SessionUser & { previewBy?: string }> {
  const u = await viewingUser();
  if (!u) {
    const next = (await headers()).get("x-next-url");
    redirect(next && next !== "/" ? `/login?next=${encodeURIComponent(next)}` : "/login");
  }
  if (roles && !roles.includes(u.role)) redirect("/");
  return u;
}

/** ผู้ใช้ที่ "กำลังดู" (คนที่แอดมินเลือกดูมุมมอง หรือตัวเอง) — ใช้เพื่ออ่านข้อมูลเท่านั้น ห้ามใช้ตัดสินสิทธิ์เขียน */
export const viewingUser = cache(async (): Promise<(SessionUser & { previewBy?: string }) | null> => {
  const real = await currentUser();
  if (!real) return null;
  const viewId = real.role === "ADMIN" ? await readSigned(VIEW_AS) : null;
  if (viewId != null && viewId !== real.id) {
    const target = await prisma.user.findUnique({ where: { id: viewId }, include: { student: true } });
    if (target) return { ...target, previewBy: real.fullName };
  }
  return real;
});

/** สำหรับ API: คืน user หรือ NextResponse ที่เป็น error */
export async function apiUser(roles?: Role[]): Promise<SessionUser | NextResponse> {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (roles && !roles.includes(u.role)) return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  return u;
}
