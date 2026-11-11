// AI Scheduling Engine (heuristic constraint solver)
// shortcut: greedy + randomized restarts ใน Node ไม่ใช่ OR-Tools/GA — ถ้าวิทยาลัยมีเกิน ~100 กลุ่มเรียนแล้วจัดไม่ครบ
//           ให้แยกเป็น Python service ที่ใช้ OR-Tools CP-SAT โดยรับ/ส่ง JSON รูปแบบเดียวกับฟังก์ชันนี้
import { roomFits, teacherBlocked, isLunch, contiguous } from '../public/shared/conflicts.js';

const shuffle = (a, rnd) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const rng = seed => () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);

// แตกวิชาเป็นบล็อก: ปฏิบัติเรียนต่อเนื่องได้ถึง 4 คาบ, ทฤษฎีครั้งละไม่เกิน 2 คาบ
function toBlocks(offering, subject) {
  const size = subject.type === 'practice' ? 4 : 2;
  const out = [];
  for (let left = subject.periods_per_week; left > 0; left -= size) out.push({ ...offering, len: Math.min(size, left) });
  return out;
}

function attempt(input, rnd) {
  const { offerings, subjects, rooms, groups, teachers, periods } = input;
  const ctx = { teachers, blocks: input.blocks };
  const used = new Set();
  const hours = {};
  const dayLoad = {};
  const entries = [];
  const unplaced = [];
  const slotsByDay = {};
  for (const p of periods) if (!isLunch(p)) (slotsByDay[p.day] ||= []).push(p); // ไม่ลงคาบในเวลาพักเที่ยง
  for (const d in slotsByDay) slotsByDay[d].sort((a, b) => a.period_no - b.period_no);

  // คาบของแผนกอื่นที่ล็อกไว้ (ครู/ห้องใช้ร่วมกัน) — จองช่องไว้ก่อน ไม่ให้ชน
  for (const e of input.fixed || []) {
    used.add(`t|${e.teacher_id}|${e.day}|${e.period_no}`).add(`g|${e.group_id}|${e.day}|${e.period_no}`).add(`r|${e.room_id}|${e.day}|${e.period_no}`);
    hours[e.teacher_id] = (hours[e.teacher_id] || 0) + 1;
  }
  const blocks = offerings.flatMap(o => toBlocks(o, subjects[o.subject_id]));
  shuffle(blocks, rnd).sort((a, b) => b.len - a.len); // บล็อกใหญ่ (ยากสุด) ก่อน

  for (const b of blocks) {
    const subject = subjects[b.subject_id];
    const group = groups[b.group_id];
    const max = teachers[b.teacher_id]?.max_hours ?? 99;
    const cands = [];
    for (const day in slotsByDay) {
      const d = +day;
      if (used.has(`o|${b.subject_id}|${b.group_id}|${d}`)) continue; // วิชาเดียวกันไม่เรียน 2 ครั้งในวันเดียว
      const ps = slotsByDay[day];
      for (let i = 0; i + b.len <= ps.length; i++) {
        const span = ps.slice(i, i + b.len);
        if (!span.every((p, k) => !k || contiguous(span[k - 1], p))) continue; // ต้องติดกัน ไม่คร่อมพักเที่ยง
        const run = span.map(p => p.period_no);
        cands.push({ d, run, score: (dayLoad[`${b.group_id}|${d}`] || 0) + i * 0.15 + rnd() }); // เกลี่ยวันให้เท่ากัน + ชอบคาบเช้า
      }
    }
    cands.sort((x, y) => x.score - y.score);

    let placed = false;
    for (const { d, run } of cands) {
      if ((hours[b.teacher_id] || 0) + b.len > max) break;
      const ok = run.every(p => !used.has(`t|${b.teacher_id}|${d}|${p}`) && !used.has(`g|${b.group_id}|${d}|${p}`) &&
        !teacherBlocked(ctx, b.teacher_id, d, p));
      if (!ok) continue;
      const room = rooms.filter(r => roomFits(subject, r, group) && run.every(p => !used.has(`r|${r.id}|${d}|${p}`)))
        .sort((x, y) => x.capacity - y.capacity)[0]; // ห้องเล็กสุดที่พอ เก็บห้องใหญ่ไว้ให้กลุ่มใหญ่
      if (!room) continue;
      for (const p of run) {
        used.add(`t|${b.teacher_id}|${d}|${p}`).add(`g|${b.group_id}|${d}|${p}`).add(`r|${room.id}|${d}|${p}`);
        entries.push({ day: d, period_no: p, subject_id: b.subject_id, teacher_id: b.teacher_id, group_id: b.group_id, room_id: room.id });
      }
      used.add(`o|${b.subject_id}|${b.group_id}|${d}`);
      hours[b.teacher_id] = (hours[b.teacher_id] || 0) + b.len;
      dayLoad[`${b.group_id}|${d}`] = (dayLoad[`${b.group_id}|${d}`] || 0) + b.len;
      placed = true;
      break;
    }
    if (!placed) unplaced.push({ subject_id: b.subject_id, group_id: b.group_id, teacher_id: b.teacher_id, periods: b.len });
  }
  return { entries, unplaced };
}

export function generateSchedule(input, { tries = 40, seed = 42 } = {}) {
  const rnd = rng(seed);
  let best;
  for (let i = 0; i < tries; i++) {
    const r = attempt(input, rnd);
    const miss = r.unplaced.reduce((s, u) => s + u.periods, 0);
    if (!best || miss < best.miss) best = { ...r, miss };
    if (miss === 0) break;
  }
  return { entries: best.entries, unplaced: best.unplaced };
}
