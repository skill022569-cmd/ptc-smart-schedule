import { requireUser } from "@/lib/auth";
import { COLLEGE, prisma } from "@/lib/db";
import { PdpaActions } from "@/components/forms";

export default async function Pdpa() {
  const u = await requireUser();
  const logs = await prisma.pdpaConsentLog.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" }, take: 20 });
  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-xl font-bold">นโยบายคุ้มครองข้อมูลส่วนบุคคล (PDPA)</h1>
      <section className="card space-y-2 text-sm leading-relaxed">
        <p><b>ผู้ควบคุมข้อมูล:</b> {COLLEGE}</p>
        <p><b>ข้อมูลที่เก็บ:</b> ชื่อ-สกุล รหัสบุคลากร/รหัสนักเรียน แผนก กลุ่มเรียน ตารางเรียน/สอน เวลาที่ไม่สะดวกสอน เบอร์โทรและอีเมล (เฉพาะบุคลากร) และประวัติการแจ้งปัญหา</p>
        <p><b>วัตถุประสงค์:</b> จัดตารางเรียน-ตารางสอน แสดงทำเนียบบุคลากร และติดต่อประสานงานด้านการเรียนการสอน (ฐานภารกิจของรัฐ/การปฏิบัติหน้าที่ตามกฎหมาย)</p>
        <p><b>การปกปิดข้อมูล:</b> หน้าสาธารณะแสดงรหัสนักเรียนแบบปกปิด (เช่น 6730201xxx) และไม่แสดงเบอร์โทร/อีเมลส่วนตัวของบุคลากร ข้อมูลเต็มเห็นได้เฉพาะเจ้าของและผู้ดูแลระบบ</p>
        <p><b>ผู้ช่วย AI:</b> คำถามและตารางของผู้ถามถูกส่งไปประมวลผลกับผู้ให้บริการ AI ภายนอกเพื่อสร้างคำตอบ ไม่ส่งเบอร์โทร/อีเมล</p>
        <p><b>สิทธิ์ของท่าน:</b> ขอสำเนาข้อมูล ขอแก้ไข ขอลบ หรือถอนความยินยอม ได้จากปุ่มด้านล่าง</p>
        <p>สถานะ: {u.pdpaConsentAt ? `ให้ความยินยอมเมื่อ ${u.pdpaConsentAt.toLocaleString("th-TH")}` : "ยังไม่ได้ให้ความยินยอม"}</p>
        <PdpaActions consented={!!u.pdpaConsentAt} />
      </section>
      <section className="card text-sm">
        <h2 className="font-semibold">ประวัติการดำเนินการ (Consent Log)</h2>
        <ul className="mt-1">{logs.map((l) => <li key={l.id}>{l.createdAt.toLocaleString("th-TH")} — {l.action}</li>)}</ul>
        {!logs.length && <p className="text-slate-500">ยังไม่มีประวัติ</p>}
      </section>
    </div>
  );
}
