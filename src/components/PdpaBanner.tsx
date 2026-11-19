"use client";
import { useState } from "react";
import Link from "next/link";

/** แสดงจนกว่าผู้ใช้จะกดยินยอม; บันทึก log ลง TiDB ผ่าน /api/pdpa */
export default function PdpaBanner() {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  async function consent() {
    const r = await fetch("/api/pdpa", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "CONSENT" }) });
    if (r.ok) setHidden(true);
  }
  return (
    <div role="dialog" aria-label="ความยินยอม PDPA" className="no-print fixed inset-x-0 bottom-0 z-40 border-t bg-white p-4 shadow-lg">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center">
        <p className="flex-1 text-sm">
          ระบบนี้เก็บและใช้ข้อมูลส่วนบุคคล (ชื่อ รหัส กลุ่มเรียน ตารางเรียน/สอน) เพื่อการจัดการเรียนการสอนของวิทยาลัยฯ ตาม พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562
          อ่านรายละเอียดและจัดการสิทธิ์ได้ที่ <Link href="/pdpa" className="text-blue-700 underline">นโยบาย PDPA</Link>
        </p>
        <button className="btn" onClick={consent}>ยอมรับและเข้าใช้งาน</button>
      </div>
    </div>
  );
}
