import { NextResponse, type NextRequest } from "next/server";

// ลิงก์เดียวกันสำหรับทุกคน: ยังไม่เข้าสู่ระบบ → หน้าแรกแสดงตารางสาธารณะ (URL ยังเป็น "/")
// ตรวจแค่ว่ามีคุกกี้ (ชื่อเดียวกับ COOKIE ใน src/lib/auth.ts); คุกกี้ปลอม/หมดอายุจะถูก requireUser ส่งไปหน้าเข้าสู่ระบบ
export function middleware(req: NextRequest) {
  if (!req.cookies.has("ptc_session")) return NextResponse.rewrite(new URL(`/public${req.nextUrl.search}`, req.url));
}
export const config = { matcher: "/" };
