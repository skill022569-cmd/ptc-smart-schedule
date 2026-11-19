// Stress test ของ engine ล้วน (ไม่ต้องมีฐานข้อมูล): npm run stress
import { makeDataset, toEngineInput } from "../prisma/data";
import { runEngine, validate } from "../src/engine";

const ds = makeDataset("stress");
const input = toEngineInput(ds);
console.log(`นักเรียน ${ds.students.length} | ครู ${ds.teachers.length} | วิชา ${ds.subjects.length} | ห้อง ${ds.rooms.length} | กลุ่ม ${ds.groups.length} | การลงทะเบียน ${ds.enrollments.length}`);
const t0 = Date.now();
const res = runEngine(input, { timeLimitMs: Number(process.env.GA_MS ?? 20000), seed: Number(process.env.SEED ?? 42), autoSplit: process.env.AUTO_SPLIT !== "0" });
const v = validate(res.ctx, res.state.place);
console.log(`เวลา ${Date.now() - t0} ms | GA ${res.stats.generations} รุ่น | วางแล้ว ${res.stats.placed}/${res.stats.sessions} ก้อน | soft penalty ${res.stats.penalty}`);
console.log(`hard-constraint violations: ${v.size} ${v.size === 0 ? "✓ ไม่มีตารางชน 100%" : "✗"}`);
console.log(`จัดไม่สำเร็จ ${res.conflicts.length} รายการ`);
for (const c of res.conflicts.slice(0, 5)) console.log(`- ${c.subjectCode} ${c.teacher} / ${c.group}: ${c.reasons[0]} | split=${!!c.split} swap=${!!c.swap}`);
if (res.warnings.length) console.log(`คำเตือน pre-check ${res.warnings.length} รายการ เช่น: ${res.warnings[0]}`);
process.exit(v.size ? 1 : 0);
