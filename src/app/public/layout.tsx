import Link from "next/link";
import { COLLEGE, SEMESTER } from "@/lib/db";

// ส่วนหัวของมุมมองสาธารณะ (ไม่ต้องเข้าสู่ระบบ)
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="no-print border-b-4 border-gold-500 bg-brand-800 text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2">
          <Link href="/" className="flex items-center gap-3">
            <img src="/logo.webp" alt="ตราวิทยาลัยการอาชีพโพนทอง" width={48} height={48} className="h-12 w-12" />
            <div><div className="font-bold leading-tight">{COLLEGE}</div><div className="text-xs text-gold-300">ภาคเรียนที่ {SEMESTER} · มุมมองสาธารณะ</div></div>
          </Link>
          <nav className="flex flex-1 flex-wrap gap-4 text-sm">
            <Link href="/" className="hover:text-gold-300 hover:underline">ตารางเรียน-ตารางสอน</Link>
            <Link href="/public/directory" className="hover:text-gold-300 hover:underline">ทำเนียบบุคลากร</Link>
          </nav>
          <Link href="/login" className="rounded border border-white/60 px-3 py-1 text-sm hover:bg-white/10">เข้าสู่ระบบ (บุคลากร)</Link>
        </div>
      </header>
      {children}
    </div>
  );
}
