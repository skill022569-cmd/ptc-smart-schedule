import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { viewingUser } from "@/lib/auth";
import { buildCollegeContext } from "@/lib/ai-context";
import { allow } from "@/lib/rate-limit";
import { COLLEGE, SEMESTER } from "@/lib/db";
import { scheduleFor, type Cell } from "@/lib/schedule-query";
import { dayName } from "@/engine/validator";

const client = new Anthropic();

// ส่วนคงที่ของ system prompt (ไม่เปลี่ยนต่อ request → cache ได้)
const SYSTEM = `คุณคือผู้ช่วยตอบคำถามเรื่องตารางเรียน-ตารางสอนของ${COLLEGE} ตอบเป็นภาษาไทย สุภาพ กระชับ
ตอบจากข้อมูลของวิทยาลัยที่ให้ไว้เท่านั้น (ตารางทั้งหมด บุคลากร ผู้บริหาร รายวิชา ห้อง กลุ่มเรียน) ห้ามเดา ถ้าข้อมูลไม่พอให้บอกตรงๆ และแนะนำเมนู "แจ้งปัญหา"
เมื่อถามว่าใครว่างเมื่อไร ให้ดูจากตารางทั้งหมด: คาบที่ไม่มีชื่อครูคนนั้น = ว่าง (ไม่นับพักกลางวัน)
ระบบไม่มีเบอร์โทร อีเมล หรือรหัส/ชื่อนักเรียนรายคนของผู้อื่น ถ้าถามให้แจ้งว่าต้องติดต่อฝ่ายวิชาการ

ระเบียบการใช้งานระบบ:
- ขอเปลี่ยนห้อง/คาบเรียน: เมนู "แจ้งปัญหา" เลือกหมวด "ขอเปลี่ยนห้อง/คาบ" ระบุรหัสวิชา กลุ่มเรียน และเหตุผล ฝ่ายวิชาการจะตอบกลับในระบบ (สถานะ รอดำเนินการ → กำลังแก้ไข → เสร็จสิ้น)
- ตารางชนหรือชื่อ/รหัสนักเรียนตกหล่น: แจ้งที่เมนู "แจ้งปัญหา" หมวดที่ตรงกัน
- ครูที่ไม่สะดวกสอนบางช่วง (ประชุม/ลา): แจ้งฝ่ายวิชาการให้บันทึกเวลาไม่สะดวกก่อนรันจัดตาราง
- ข้อมูลส่วนบุคคล: เมนู "PDPA" ขอสำเนาข้อมูล ถอนความยินยอม หรือขอลบ/แก้ไขข้อมูลได้
- ดาวน์โหลดตาราง: เมนู "ตารางเรียน/สอน" มีปุ่ม Excel และพิมพ์/บันทึกเป็น PDF`;

const fmt = (cells: Cell[]) => cells.sort((a, b) => a.day - b.day || a.period - b.period)
  .map((c) => `วัน${dayName(c.day)} คาบ ${c.period}: ${c.subject} | ${c.teacher} | ${c.group} | ห้อง ${c.room}`).join("\n") || "(ไม่มีคาบ)";

export const maxDuration = 60;

export async function POST(req: Request) {
  // ไม่ล็อกอิน = บุคคลทั่วไป (หน้าสาธารณะ) ตอบจากข้อมูลส่วนกลางเท่านั้น; โหมดดูมุมมอง: ตอบในมุมมองผู้ใช้ที่แอดมินดูอยู่
  const u = await viewingUser();
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "ยังไม่ได้ตั้งค่า ANTHROPIC_API_KEY" }, { status: 503 });
  // ทุกคำถามมีค่าใช้จ่าย → จำกัดต่อ IP (คนทั่วไป) หรือต่อบัญชี (บุคลากร)
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!(u ? allow(`u:${u.id}`, 60, 3_600_000) : allow(`ip:${ip}`, 15, 3_600_000)))
    return NextResponse.json({ error: "ถามครบโควตาชั่วโมงนี้แล้ว กรุณาลองใหม่ภายหลัง" }, { status: 429 });
  const { messages } = await req.json().catch(() => ({}));
  if (!Array.isArray(messages) || !messages.length || messages.length > 20) return NextResponse.json({ error: "รูปแบบข้อความไม่ถูกต้อง" }, { status: 400 });
  const history: Anthropic.Beta.BetaMessageParam[] = messages
    .filter((m) => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: String(m.content).slice(0, 2000) }));
  const last = history[history.length - 1];
  if (last?.role !== "user") return NextResponse.json({ error: "ข้อความสุดท้ายต้องเป็นของผู้ใช้" }, { status: 400 });

  // ข้อมูลทั้งวิทยาลัย (เหมือนกันทุกคน → cache) + ข้อมูลเฉพาะผู้ถาม (ท้าย prompt)
  const [college, own] = await Promise.all([
    buildCollegeContext(),
    u?.role === "TEACHER" ? scheduleFor(SEMESTER, "teacher", u.id) : u?.student ? scheduleFor(SEMESTER, "student", u.student.id) : Promise.resolve(null),
  ]);
  const now = new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "full", timeStyle: "short" });
  const role = !u ? "" : u.role === "ADMIN" ? "ผู้ดูแลระบบ" : u.role === "TEACHER" ? "ครู" : "นักเรียน";
  const me = (u ? `ผู้ถาม: ${u.fullName} (${role})` : "ผู้ถาม: บุคคลทั่วไป/นักเรียน (ไม่ได้เข้าสู่ระบบ) — ถ้าถามตารางของตัวเองให้ถามกลุ่มเรียนก่อน")
    + ` | ขณะนี้: ${now}` + (own ? `\nตารางของผู้ถาม:\n${fmt(own)}` : "");
  history[history.length - 1] = { role: "user", content: [{ type: "text", text: me }, { type: "text", text: last.content as string }] };

  try {
    const res = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 4096,
      system: [
        { type: "text", text: SYSTEM },
        { type: "text", text: college, cache_control: { type: "ephemeral" } },
      ],
      output_config: { effort: "low" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      messages: history,
    });
    if (res.stop_reason === "refusal") return NextResponse.json({ reply: "ขออภัย ไม่สามารถตอบคำถามนี้ได้" });
    const reply = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n");
    return NextResponse.json({ reply });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return NextResponse.json({ error: "มีผู้ใช้งานจำนวนมาก กรุณาลองใหม่อีกครั้ง" }, { status: 429 });
    if (err instanceof Anthropic.APIError) return NextResponse.json({ error: `AI ไม่พร้อมใช้งาน (${err.status ?? "network"})` }, { status: 502 });
    throw err;
  }
}
