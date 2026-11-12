// ตัวตรวจข้อขัดแย้ง ใช้ร่วมกันทั้ง server (AI/บันทึก) และเบราว์เซอร์ (โหมดมือ แจ้งเตือนสีแดงแบบ real-time)
// entry = { id, day, period_no, teacher_id, room_id, group_id, subject_id }
// ctx   = { teachers, rooms, groups, subjects } (object id -> row), blocks = คำร้องที่อนุมัติแล้ว

export const DAYS = ['', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'];

// จำนวนคาบสูงสุดต่อสัปดาห์ ทั้งครูแต่ละคน และกลุ่มเรียนแต่ละกลุ่ม
export const WEEKLY_MAX = 12;
export const teacherMax = t => Math.min(t?.max_hours || WEEKLY_MAX, WEEKLY_MAX);

// พักเที่ยงทุกวัน: ห้ามลงคาบที่เวลาทับช่วงนี้ และห้ามเรียนต่อเนื่องคร่อมช่วงนี้
export const LUNCH = { start: '12:00', end: '13:00' };
const hm = t => String(t || '').slice(0, 5);
export const isLunch = p => !!p?.start_time && hm(p.start_time) < LUNCH.end && hm(p.end_time) > LUNCH.start;
// คาบ b ต่อจาก a ทันทีโดยไม่มีช่วงพักคั่น (ไม่มีเวลา = ดูจากเลขคาบอย่างเดียว)
export const contiguous = (a, b) => !!a && !!b && b.period_no === a.period_no + 1 && (!a.end_time || hm(a.end_time) === hm(b.start_time));
// มีพักเที่ยงคั่นระหว่างคาบ a กับ b
export const lunchBetween = (a, b) => !!a?.end_time && !!b?.start_time && hm(a.end_time) <= LUNCH.start && hm(b.start_time) >= LUNCH.end;

// ห้องที่ใช้ได้กับประเภทวิชา: ปฏิบัติ -> lab/workshop, ทฤษฎี -> lecture/lab
export function roomFits(subject, room, group) {
  if (!room) return true;
  if (group && room.capacity < group.size) return false;
  if (!subject) return true;
  return subject.type === 'practice' ? room.room_type !== 'lecture' : room.room_type !== 'workshop';
}

export function teacherBlocked(ctx, teacherId, day, period) {
  const t = ctx.teachers?.[teacherId];
  if (t?.unavailable?.some(u => u.day === day && u.period === period)) return true;
  return (ctx.blocks || []).some(b => b.teacher_id === teacherId && b.day === day &&
    period >= b.period_from && period <= b.period_to);
}

export function findConflicts(entries, ctx = {}) {
  const out = new Map();
  const add = (e, msg) => { if (!out.has(e.id)) out.set(e.id, []); out.get(e.id).push(msg); };
  const slot = new Map();
  const hours = new Map();
  const ghours = new Map();
  const lunch = new Set((ctx.periods || []).filter(isLunch).map(p => `${p.day}|${p.period_no}`));

  for (const e of entries) {
    for (const [kind, key, msg] of [
      ['t', e.teacher_id, 'ครูสอนซ้อนคาบ'],
      ['r', e.room_id, 'ห้องถูกใช้ซ้อน'],
      ['g', e.group_id, 'กลุ่มเรียนเรียนซ้อน'],
    ]) {
      if (!key) continue;
      const k = `${kind}|${key}|${e.day}|${e.period_no}`;
      const other = slot.get(k);
      if (other) { add(e, msg); add(other, msg); } else slot.set(k, e);
    }
    if (teacherBlocked(ctx, e.teacher_id, e.day, e.period_no)) add(e, 'ครูไม่สะดวกสอนช่วงนี้');
    if (lunch.has(`${e.day}|${e.period_no}`)) add(e, 'ทับเวลาพักเที่ยง');
    if (!roomFits(ctx.subjects?.[e.subject_id], ctx.rooms?.[e.room_id], ctx.groups?.[e.group_id]))
      add(e, 'ห้องไม่เหมาะกับวิชา/ความจุไม่พอ');
    hours.set(e.teacher_id, (hours.get(e.teacher_id) || 0) + 1);
    ghours.set(e.group_id, (ghours.get(e.group_id) || 0) + 1);
  }
  for (const e of entries) {
    const max = teacherMax(ctx.teachers?.[e.teacher_id]);
    if (hours.get(e.teacher_id) > max) add(e, `ครูสอนเกิน ${max} คาบ/สัปดาห์`);
    if (ghours.get(e.group_id) > WEEKLY_MAX) add(e, `กลุ่มเรียนเกิน ${WEEKLY_MAX} คาบ/สัปดาห์`);
  }
  return out;
}
