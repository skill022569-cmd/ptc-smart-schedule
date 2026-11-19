import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { apiUser } from "@/lib/auth";
import { COLLEGE, SEMESTER, prisma } from "@/lib/db";
import { scheduleFor, timeslots, type Cell } from "@/lib/schedule-query";
import { dayName } from "@/engine/validator";

const client = new Anthropic();

// ส่วนคงที่ของ system prompt (ไม่เปลี่ยนต่อ request → cache ได้)
const SYSTEM = `คุณคือผู้ช่วยตอบคำถามเรื่องตารางเรียน-ตารางสอนของ${COLLEGE} ตอบเป็นภาษาไทย สุภาพ กระชับ
ตอบจากข้อมูลตารางที่ให้ไว้ในข้อความของผู้ใช้เท่านั้น ถ้าข้อมูลไม่พอให้บอกตรงๆ และแนะนำให้แจ้งที่เมนู "แจ้งปัญหา"
ห้ามเปิดเผยเบอร์โทร อีเมล หรือรหัสนักเรียนของผู้อื่น

ระเบียบการใช้งานระบบ:
- ขอเปลี่ยนห้อง/คาบเรียน: เมนู "แจ้งปัญหา" เลือกหมวด "ขอเปลี่ยนห้อง/คาบ" ระบุรหัสวิชา กลุ่มเรียน และเหตุผล ฝ่ายวิชาการจะตอบกลับในระบบ (สถานะ รอดำเนินการ → กำลังแก้ไข → เสร็จสิ้น)
- ตารางชนหรือชื่อ/รหัสนักเรียนตกหล่น: แจ้งที่เมนู "แจ้งปัญหา" หมวดที่ตรงกัน
- ครูที่ไม่สะดวกสอนบางช่วง (ประชุม/ลา): แจ้งฝ่ายวิชาการให้บันทึกเวลาไม่สะดวกก่อนรันจัดตาราง
- ข้อมูลส่วนบุคคล: เมนู "PDPA" ขอสำเนาข้อมูล ถอนความยินยอม หรือขอลบ/แก้ไขข้อมูลได้
- ดาวน์โหลดตาราง: เมนู "ตารางเรียน/สอน" มีปุ่ม Excel และพิมพ์/บันทึกเป็น PDF`;

const fmt = (cells: Cell[]) => cells.sort((a, b) => a.day - b.day || a.period - b.period)
  .map((c) => `วัน${dayName(c.day)} คาบ ${c.period}: ${c.subject} | ${c.teacher} | ${c.group} | ห้อง ${c.room}`).join("\n") || "(ไม่มีคาบ)";

export async function POST(req: Request) {
  const u = await apiUser();
  if (u instanceof NextResponse) return u;
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "ยังไม่ได้ตั้งค่า ANTHROPIC_API_KEY" }, { status: 503 });
  const { messages } = await req.json().catch(() => ({}));
  if (!Array.isArray(messages) || !messages.length || messages.length > 20) return NextResponse.json({ error: "รูปแบบข้อความไม่ถูกต้อง" }, { status: 400 });
  const history: Anthropic.MessageParam[] = messages
    .filter((m) => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: String(m.content).slice(0, 2000) }));
  const last = history[history.length - 1];
  if (last?.role !== "user") return NextResponse.json({ error: "ข้อความสุดท้ายต้องเป็นของผู้ใช้" }, { status: 400 });

  // Context injection: ตารางของผู้ถาม + ตารางครูที่ถูกเอ่ยชื่อในคำถาม
  const parts: string[] = [];
  const slots = await timeslots();
  parts.push("เวลาคาบ: " + [...new Map(slots.map((s) => [s.period, s])).values()].map((s) => `คาบ ${s.period} ${s.start}-${s.end}${s.lunch ? " (พักกลางวัน)" : ""}`).join(", "));
  if (u.role === "TEACHER") parts.push(`ตารางสอนของ ${u.fullName}:\n${fmt(await scheduleFor(SEMESTER, "teacher", u.id))}`);
  if (u.student) parts.push(`ตารางเรียนของ ${u.fullName}:\n${fmt(await scheduleFor(SEMESTER, "student", u.student.id))}`);
  const teachers = await prisma.user.findMany({ where: { role: "TEACHER" }, select: { id: true, fullName: true } });
  const q = last.content as string;
  const mentioned = teachers.filter((t) => { const n = t.fullName.replace(/^ครู/, "").split(" ")[0]; return n.length > 1 && q.includes(n); }).slice(0, 3);
  for (const t of mentioned) parts.push(`ตารางสอนของ ${t.fullName} (คาบที่ไม่อยู่ในรายการ = ว่าง):\n${fmt(await scheduleFor(SEMESTER, "teacher", t.id))}`);
  const now = new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok", weekday: "long", dateStyle: "full", timeStyle: "short" });
  const context = `ข้อมูลประกอบ (ภาคเรียน ${SEMESTER}, ขณะนี้ ${now}, ผู้ถาม: ${u.fullName} บทบาท ${u.role}):\n${parts.join("\n\n")}`;
  history[history.length - 1] = { role: "user", content: [{ type: "text", text: context }, { type: "text", text: q }] };

  try {
    const res = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 4096,
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
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
