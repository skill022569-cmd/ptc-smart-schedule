import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateSchedule } from '../server/scheduler.js';
import { findConflicts } from '../shared/conflicts.js';

const byId = a => Object.fromEntries(a.map(x => [x.id, x]));
const subjects = byId([{ id: 's1', type: 'theory', periods_per_week: 2 }, { id: 's2', type: 'practice', periods_per_week: 6 }, { id: 's3', type: 'theory', periods_per_week: 4 }]);
const groups = byId([{ id: 'g1', size: 30 }, { id: 'g2', size: 30 }, { id: 'g3', size: 30 }]);
const teachers = byId([{ id: 't1', max_hours: 20, unavailable: [{ day: 1, period: 1 }] }, { id: 't2', max_hours: 20, unavailable: [] }]);
const rooms = [{ id: 'r1', room_type: 'lecture', capacity: 40 }, { id: 'r2', room_type: 'workshop', capacity: 40 }];
const periods = [1, 2, 3, 4, 5].flatMap(day => [1, 2, 3, 4, 5, 6, 7, 8].map(period_no => ({ day, period_no })));
const offerings = ['g1', 'g2', 'g3'].flatMap(g => [{ group_id: g, subject_id: 's1', teacher_id: 't1' }, { group_id: g, subject_id: 's2', teacher_id: 't2' }, { group_id: g, subject_id: 's3', teacher_id: 't1' }]);
const blocks = [{ teacher_id: 't1', day: 2, period_from: 1, period_to: 8 }];

test('AI จัดตารางครบและไม่มีคาบชน', () => {
  const { entries, unplaced } = generateSchedule({ offerings, subjects, groups, teachers, rooms, periods, blocks });
  assert.equal(unplaced.length, 0);
  assert.equal(entries.length, 3 * (2 + 6 + 4));
  const withId = entries.map((e, i) => ({ ...e, id: i }));
  assert.equal(findConflicts(withId, { teachers, groups, subjects, rooms: byId(rooms), blocks }).size, 0);
  assert.ok(entries.filter(e => e.subject_id === 's2').every(e => e.room_id === 'r2'), 'วิชาปฏิบัติต้องอยู่โรงฝึกงาน');
  assert.ok(!entries.some(e => e.teacher_id === 't1' && e.day === 2), 'ต้องเคารพคำร้องบล็อกเวลา');
});

test('ตรวจจับครู/ห้อง/กลุ่มชน', () => {
  const c = findConflicts([
    { id: 1, day: 1, period_no: 2, teacher_id: 't1', room_id: 'r1', group_id: 'g1', subject_id: 's1' },
    { id: 2, day: 1, period_no: 2, teacher_id: 't1', room_id: 'r1', group_id: 'g2', subject_id: 's1' },
    { id: 3, day: 1, period_no: 1, teacher_id: 't1', room_id: 'r1', group_id: 'g3', subject_id: 's1' },
  ], { teachers, rooms: byId(rooms), groups, subjects });
  assert.deepEqual(c.get(1), ['ครูสอนซ้อนคาบ', 'ห้องถูกใช้ซ้อน']);
  assert.deepEqual(c.get(3), ['ครูไม่สะดวกสอนช่วงนี้']);
});
