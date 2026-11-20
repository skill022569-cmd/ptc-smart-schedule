import { NextResponse, type NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  // ลิงก์เดียวกันสำหรับทุกคน: ยังไม่เข้าสู่ระบบ → หน้าแรกแสดงตารางสาธารณะ (URL ยังเป็น "/")
  // ตรวจแค่ว่ามีคุกกี้ (ชื่อเดียวกับ COOKIE ใน src/lib/auth.ts); คุกกี้ปลอม/หมดอายุจะถูก requireUser ส่งไปหน้าเข้าสู่ระบบ
  if (pathname === "/" && !req.cookies.has("ptc_session")) return NextResponse.rewrite(new URL(`/public${search}`, req.url));
  // ส่งหน้าปลายทางให้ requireUser ใช้ทำ /login?next=... (server component ไม่รู้ URL ของตัวเอง)
  const headers = new Headers(req.headers);
  headers.set("x-next-url", pathname + search);
  return NextResponse.next({ request: { headers } });
}
export const config = { matcher: ["/((?!api|_next|.*\\..*).*)"] };
