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
      <header className="no-print border-b bg-blue-800 text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2">
          <div className="mr-4"><div className="font-bold">PTC Smart Schedule</div><div className="text-xs opacity-80">{COLLEGE} · ภาคเรียน {SEMESTER}</div></div>
          <nav className="flex flex-1 flex-wrap gap-3 text-sm">{nav.map(([h, l]) => <Link key={h} href={h} className="hover:underline">{l}</Link>)}</nav>
          <form action="/api/auth/logout" method="post" className="text-sm">{u.fullName} ({u.role}) <button className="ml-2 underline">ออกจากระบบ</button></form>
        </div>
      </header>
      <main className="mx-auto max-w-7xl p-4 pb-24">{children}</main>
      {!u.pdpaConsentAt && <PdpaBanner />}
      <AiChatWidget />
    </div>
  );
}
