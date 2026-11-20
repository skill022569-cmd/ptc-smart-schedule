import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { COLLEGE, SEMESTER } from "@/lib/db";
import PdpaBanner from "@/components/PdpaBanner";
import AiChatWidget from "@/components/AiChatWidget";
import ScrollReveal from "@/components/ScrollReveal";
import MobileMenu from "@/components/MobileMenu";
import { Suspense } from "react";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const u = await requireUser();
  const nav = [
    ["/", "ภาพรวม"], ...(u.role === "ADMIN" ? [["/admin", "จัดตารางอัตโนมัติ"], ["/admin/manual", "จัดตารางเอง"], ["/admin/view-as", "มุมมองผู้ใช้"]] : []),
    ...(u.role === "TEACHER" ? [["/teacher/edit", "แก้ไขตารางสอนของฉัน"]] : []),
    ["/schedule", "ตารางเรียน/สอน"], ["/directory", "ทำเนียบบุคลากร"], ["/support", "แจ้งปัญหา"], ["/pdpa", "PDPA"],
  ];
  return (
    <div className="min-h-screen">
      <header className="no-print border-b-4 border-gold-500 bg-brand-800 text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2">
          <Link href="/" className="mr-4 flex items-center gap-3">
            <img src="/logo.webp" alt="ตราวิทยาลัยการอาชีพโพนทอง" width={48} height={48} className="h-12 w-12" />
            <div><div className="font-bold leading-tight">{COLLEGE}</div><div className="text-xs text-gold-300">ระบบจัดตารางเรียน-ตารางสอน · ภาคเรียนที่ {SEMESTER}</div></div>
          </Link>
          <nav aria-label="เมนูหลัก" className="hidden flex-1 flex-wrap gap-4 text-sm md:flex">{nav.map(([h, l]) => <Link key={h} href={h} className="hover:text-gold-300 hover:underline">{l}</Link>)}</nav>
          <form action="/api/auth/logout" method="post" className="hidden text-sm md:block">{u.fullName} <Link href="/account" className="ml-2 underline hover:text-gold-300">เปลี่ยนรหัสผ่าน</Link> <button className="ml-2 underline hover:text-gold-300">ออกจากระบบ</button></form>
          <div className="ml-auto md:hidden">
            <Suspense>
              <MobileMenu>
                <nav aria-label="เมนูหลัก" className="flex flex-col">{nav.map(([h, l]) => <Link key={h} href={h}>{l}</Link>)}</nav>
                <hr className="my-1 border-white/30" />
                <span className="px-2 text-xs text-gold-300">{u.fullName}</span>
                <Link href="/account">เปลี่ยนรหัสผ่าน</Link>
                <form action="/api/auth/logout" method="post"><button className="w-full rounded px-2 py-1.5 text-left hover:bg-white/10">ออกจากระบบ</button></form>
              </MobileMenu>
            </Suspense>
          </div>
        </div>
      </header>
      {u.previewBy && (
        <div className="no-print sticky top-0 z-30 border-b border-yellow-300 bg-yellow-100 text-sm">
          <form action="/api/view-as" method="post" className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-2">
            <span>👁 กำลังดูในมุมมองของ <b>{u.fullName}</b> ({u.role === "STUDENT" ? "นักเรียน" : u.role === "TEACHER" ? "ครู" : "แอดมิน"}) — โดย {u.previewBy}</span>
            <input type="hidden" name="exit" value="1" />
            <button className="btn ml-auto">กลับเป็นแอดมิน</button>
          </form>
        </div>
      )}
      <main className="mx-auto max-w-7xl p-4 pb-24">{children}</main>
      <ScrollReveal />
      {!u.pdpaConsentAt && !u.previewBy && <PdpaBanner />}
      <AiChatWidget />
    </div>
  );
}
