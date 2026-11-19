import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { betaJSONSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/beta/json-schema";
import { apiUser } from "@/lib/auth";
import { SEMESTER } from "@/lib/db";
import { loadState } from "@/lib/engine-io";
import { positions, sk } from "@/engine/model";
import { analyze } from "@/engine/conflict-analyzer";
import { dayName } from "@/engine/validator";

export const maxDuration = 60;
const client = new Anthropic();

const SYSTEM = `คุณคือผู้ช่วยฝ่ายวิชาการ วิทยาลัยการอาชีพโพนทอง ช่วยจัดตารางเรียน-ตารางสอนด้วยมือ ตอบเป็นภาษาไทย กระชับ เป็นข้อๆ
กติกาที่ห้ามละเมิด: ครู 1 คนสอนได้ที่เดียว, ห้องเดียวซ้อนไม่ได้, กลุ่มเรียนซ้อนไม่ได้, ห้ามลงเวลาที่ครูไม่สะดวก, ห้ามคร่อมพักกลางวัน, วิชาที่ไม่อนุญาตแบ่งต้องเรียนต่อเนื่องในวันเดียว
ใช้เฉพาะข้อมูลที่ให้มา ห้ามเดา ถ้าข้อมูลไม่พอให้บอก
การเสนอ actions (ไม่บังคับ สูงสุด 5 รายการ เรียงตามลำดับที่ต้องทำ):
- place: วางก้อนถัดไปของวิชา ที่ day/start ซึ่งต้องอยู่ใน "ช่องที่วางได้" ของวิชานั้นเท่านั้น
- move: ย้ายคาบที่อยู่ใน fromDay/fromPeriod ไป day/start (ระบบจะตรวจซ้ำ ถ้าชนจะไม่ยอม)
- remove: เอาคาบที่ day/start ออก
- setSplit: เปิด/ปิดการแบ่งคาบ (allowSplit) เมื่อไม่มีช่องต่อเนื่องพอ
ฟิลด์ที่ไม่ใช้ให้ใส่ 0 หรือ false; label คือข้อความบนปุ่มภาษาไทยสั้นๆ เช่น "วาง 20001 วันพุธ คาบ 1-3"
day: 1=จันทร์ ... 5=ศุกร์, คาบ 5 คือพักกลางวัน`;

const SCHEMA = {
  type: "object",
  properties: {
    answer: { type: "string" },
    actions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["place", "move", "remove", "setSplit"] },
          enrollmentId: { type: "integer" }, day: { type: "integer" }, start: { type: "integer" },
          fromDay: { type: "integer" }, fromPeriod: { type: "integer" }, allowSplit: { type: "boolean" }, label: { type: "string" },
        },
        required: ["type", "enrollmentId", "day", "start", "fromDay", "fromPeriod", "allowSplit", "label"],
        additionalProperties: false,
      },
    },
  },
  required: ["answer", "actions"],
  additionalProperties: false,
} as const;

const D = (d: number) => dayName(d).slice(0, 3);

/** ผู้ช่วย AI ในหน้าจัดตารางเอง: ส่งสถานะตารางของกลุ่มเข้า prompt แล้วขอคำตอบ + การกระทำที่เสนอ (ผู้ใช้กดยืนยันเอง) */
export async function POST(req: Request) {
  const u = await apiUser(["ADMIN"]);
  if (u instanceof NextResponse) return u;
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "ยังไม่ได้ตั้งค่า ANTHROPIC_API_KEY ใน Vercel" }, { status: 503 });
  const { groupId, messages } = await req.json().catch(() => ({}));
  const gid = Number(groupId);
  if (!Array.isArray(messages) || !messages.length || messages.length > 20) return NextResponse.json({ error: "รูปแบบข้อความไม่ถูกต้อง" }, { status: 400 });
  const history: Anthropic.Beta.BetaMessageParam[] = messages
    .filter((m) => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: String(m.content).slice(0, 2000) }));
  const last = history[history.length - 1];
  if (last?.role !== "user") return NextResponse.json({ error: "ข้อความสุดท้ายต้องเป็นของผู้ใช้" }, { status: 400 });

  // ---- สร้างบริบทจากสถานะตารางจริง ----
  const { ctx, state } = await loadState(SEMESTER);
  const mine = ctx.input.enrollments.filter((e) => e.groupId === gid);
  if (!mine.length) return NextResponse.json({ error: "กลุ่มนี้ยังไม่มีรายวิชาที่ลงทะเบียน" }, { status: 400 });
  const ids = new Set(mine.map((e) => e.id));
  const teacherName = (id: number) => ctx.teachers.get(id)?.name ?? `ครู #${id}`;
  const subj = (eid: number) => { const e = ctx.enrollments.get(eid)!; return `${e.subjectCode} ${e.subjectName}`; };

  const lines: string[] = [`กลุ่มเรียน: ${mine[0].label} | วันที่มาเรียน: ${mine[0].allowedDays.map(D).join(" ")} | ภาคเรียน ${SEMESTER}`];
  lines.push("คาบเรียน: " + [...new Map(ctx.input.slots.map((s) => [s.period, s])).values()].map((s) => `${s.period}=${s.start}${s.isLunch ? "(พัก)" : ""}`).join(" "));
  lines.push("", "ตารางปัจจุบันของกลุ่ม:");
  ctx.sessions.forEach((s, i) => {
    const p = state.place[i];
    if (p && ids.has(s.enrollmentId)) lines.push(`- ${D(p.day)} คาบ ${p.start}-${p.start + s.length - 1}: [id ${s.enrollmentId}] ${subj(s.enrollmentId)} ห้อง ${ctx.rooms.get(p.roomId)?.code}`);
  });
  lines.push("", "รายวิชาของกลุ่ม:");
  for (const e of mine) {
    const ss = ctx.sessions.filter((s) => s.enrollmentId === e.id);
    const placed = ss.reduce((n, s) => n + (state.place[s.idx] ? s.length : 0), 0);
    const next = ss.filter((s) => !state.place[s.idx]).sort((a, b) => b.length - a.length)[0];
    const feasible = next ? positions(ctx, next).filter((q) => state.canPlace(ctx, next, q.day, q.start) != null).map((q) => `${D(q.day)}${q.start}`) : [];
    // ครูไม่ว่าง: ติดสอนกลุ่มอื่น/ไม่สะดวก
    const busy = ctx.input.slots.filter((s) => !s.isLunch && (ctx.unavailable.get(e.teacherId)?.has(sk(s.day, s.period)) || state.has(sk(s.day, s.period), `T${e.teacherId}`)))
      .map((s) => `${D(s.day)}${s.period}`);
    lines.push(`- [id ${e.id}] ${e.subjectCode} ${e.subjectName} | ${teacherName(e.teacherId)} | ${e.hours} คาบ/สัปดาห์ จัดแล้ว ${placed} | แบ่งคาบได้: ${e.allowSplit ? "ใช่" : "ไม่"} | ห้องประเภท ${e.roomType ?? "ใดก็ได้"}`
      + (next ? `\n  ก้อนถัดไป ${next.length} คาบ, ช่องที่วางได้ (วัน+คาบเริ่ม): ${feasible.join(" ") || "ไม่มี"}` : "")
      + `\n  ครูไม่ว่าง: ${busy.join(" ") || "-"}`);
  }
  const reports = analyze(ctx, state).filter((r) => ids.has(r.enrollmentId));
  if (reports.length) {
    lines.push("", "ผลวิเคราะห์ของระบบสำหรับวิชาที่ยังจัดไม่ครบ:");
    for (const r of reports) lines.push(`- [id ${r.enrollmentId}] ${r.reasons.join(" / ")}`
      + (r.split ? ` | แบ่งคาบได้ที่: ${r.split.map((x) => `${D(x.day)}${x.start}(${x.length})`).join(", ")}` : "")
      + (r.swap ? ` | สลับได้: ย้าย ${r.swap.moves[0].subject} จาก ${D(r.swap.moves[0].from.day)}${r.swap.moves[0].from.start} ไป ${D(r.swap.moves[0].to.day)}${r.swap.moves[0].to.start}` : ""));
  }
  history[history.length - 1] = { role: "user", content: [{ type: "text", text: lines.join("\n") }, { type: "text", text: `คำถาม: ${last.content}` }] };

  try {
    const res = await client.beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 8000,
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      output_config: { effort: "medium", format: betaJSONSchemaOutputFormat(SCHEMA) },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      messages: history,
    });
    if (res.stop_reason === "refusal" || !res.parsed_output) return NextResponse.json({ answer: "ขออภัย ไม่สามารถตอบคำถามนี้ได้", actions: [] });
    // AI แค่เสนอ — กรองให้เหลือเฉพาะวิชาของกลุ่มนี้ แล้วผู้ใช้กดยืนยันเอง (/api/resolve ตรวจ hard constraints ซ้ำ)
    const actions = res.parsed_output.actions.filter((a) => ids.has(a.enrollmentId)).slice(0, 5);
    return NextResponse.json({ answer: res.parsed_output.answer, actions });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return NextResponse.json({ error: "มีผู้ใช้งานจำนวนมาก กรุณาลองใหม่อีกครั้ง" }, { status: 429 });
    if (err instanceof Anthropic.APIError) return NextResponse.json({ error: `AI ไม่พร้อมใช้งาน (${err.status ?? "network"})` }, { status: 502 });
    throw err;
  }
}
