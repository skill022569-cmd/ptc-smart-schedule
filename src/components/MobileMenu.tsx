"use client";
import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/** เมนูแบบพับบนจอเล็ก (<details> ใช้ได้แม้ JS ยังไม่โหลด) — ปิดเองเมื่อเปลี่ยนหน้า */
export default function MobileMenu({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const path = usePathname(), qs = useSearchParams();
  useEffect(() => { if (ref.current) ref.current.open = false; }, [path, qs]);
  return (
    <details ref={ref} className="no-print relative md:hidden">
      <summary className="cursor-pointer list-none rounded border border-white/60 px-3 py-1 text-sm">☰ เมนู</summary>
      <div className="absolute right-0 z-40 mt-2 flex w-64 flex-col gap-1 rounded-lg border border-gold-500 bg-brand-800 p-3 text-sm shadow-xl [&_a]:rounded [&_a]:px-2 [&_a]:py-1.5 [&_a:hover]:bg-white/10">
        {children}
      </div>
    </details>
  );
}
