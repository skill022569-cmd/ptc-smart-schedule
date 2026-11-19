import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { COLLEGE, SEMESTER } from "@/lib/db";
import PdpaBanner from "@/components/PdpaBanner";
import AiChatWidget from "@/components/AiChatWidget";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const u = await requireUser();
  const nav = [
    ["/", "ภาพรวม"], ...(u.role === "ADMIN" ? [["/admin", "จัดการ/รันตาราง"]] : []),
    ["/schedule", "ตารางเรียน/สอน"], ["/directory", "ทำเนียบบุคลากร"], ["/support", "แจ้งปัญหา"], ["/pdpa", "PDPA"],
  ];
  return (
    <div className="min-h-screen">
      <header className="no-print border-b-4 border-gold-500 bg-brand-800 text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2">
          <Link href="/" className="mr-4 flex items-center gap-3">
            <img src="/logo.png" alt="ตราวิทยาลัยการอาชีพโพนทอง" width={48} height={48} className="h-12 w-12" />
            <div><div className="font-bold leading-tight">{COLLEGE}</div><div className="text-xs text-gold-300">ระบบจัดตารางเรียน-ตารางสอน · ภาคเรียนที่ {SEMESTER}</div></div>
          </Link>
          <nav className="flex flex-1 flex-wrap gap-4 text-sm">{nav.map(([h, l]) => <Link key={h} href={h} className="hover:text-gold-300 hover:underline">{l}</Link>)}</nav>
          <form action="/api/auth/logout" method="post" className="text-sm">{u.fullName} <button className="ml-2 underline hover:text-gold-300">ออกจากระบบ</button></form>
        </div>
      </header>
      <main className="mx-auto max-w-7xl p-4 pb-24">{children}</main>
      {!u.pdpaConsentAt && <PdpaBanner />}
      <AiChatWidget />
    </div>
  );
}
