// สร้างผู้ดูแลระบบ + ข้อมูลตัวอย่าง (รันซ้ำได้ ไม่สร้างซ้ำ)  ใช้: npm run seed   (ใส่ --admin-only เพื่อสร้างแค่ admin)
import { db, q } from '../server/db.js';
import { hashPassword, encrypt } from '../server/security.js';

const up = (t, rows, key = 'code') => q(db.from(t).upsert(rows, { onConflict: key }).select());

async function user(username, full_name, role, password, phone) {
  const found = await q(db.from('users').select('id').eq('username', username).maybeSingle());
  if (found) return found.id;
  return (await q(db.from('users').insert({
    username, full_name, role, password_hash: hashPassword(password), phone_enc: phone ? encrypt(phone) : null,
    phone_verified_at: role === 'admin' ? new Date().toISOString() : null, // แอดมินคนแรกสร้างจาก Secrets ที่เชื่อถือได้
  }).select().single())).id;
}

const { ADMIN_USERNAME = 'admin', ADMIN_PASSWORD, ADMIN_PHONE } = process.env;
if (!ADMIN_PASSWORD) throw new Error('กรุณาตั้งค่า ADMIN_PASSWORD ใน .env');
await user(ADMIN_USERNAME, 'ฝ่ายวิชาการ วก.โพนทอง', 'admin', ADMIN_PASSWORD, ADMIN_PHONE);
console.log(`✔ ผู้ดูแลระบบ: ${ADMIN_USERNAME}`);
if (process.argv.includes('--admin-only')) process.exit(0);

// คาบเรียน จันทร์-ศุกร์ 11 คาบ: คาบ 1-8 ในเวลา, คาบ 9-11 นอกเวลา ถึง 20:00 น. (พักกลางวัน 12:00-13:00)
const times = [['08:00', '09:00'], ['09:00', '10:00'], ['10:00', '11:00'], ['11:00', '12:00'], ['13:00', '14:00'], ['14:00', '15:00'], ['15:00', '16:00'], ['16:00', '17:00'],
  ['17:00', '18:00'], ['18:00', '19:00'], ['19:00', '20:00']]; // คาบ 9-11 = นอกเวลา (ถึง 20:00 น.)
await up('periods', [1, 2, 3, 4, 5].flatMap(day => times.map(([s, e], i) => ({ day, period_no: i + 1, start_time: s, end_time: e, overtime: i >= 8 }))), 'day,period_no');

const groups = await up('student_groups', [
  { code: 'ชย.1/1', department: 'ช่างยนต์', level: 'ปวช.', year: 1, size: 30, program: 'ปกติ' },
  { code: 'ชฟ.1/1', department: 'ไฟฟ้ากำลัง', level: 'ปวช.', year: 1, size: 28, program: 'ปกติ' },
  { code: 'บช.1/1', department: 'การบัญชี', level: 'ปวช.', year: 1, size: 32, program: 'ปกติ' },
  { code: 'ทส.1/1', department: 'เทคโนโลยีสารสนเทศ', level: 'ปวช.', year: 1, size: 25, program: 'ปกติ' },
  { code: 'ชย.ส1/1', department: 'ช่างยนต์', level: 'ปวส.', year: 1, size: 24, program: 'ปกติ' },
  { code: 'ชฟ.ส1/1', department: 'ไฟฟ้ากำลัง', level: 'ปวส.', year: 1, size: 20, program: 'ทวิภาคี' },
]);
const subjects = await up('subjects', [
  { code: '20000-1101', name: 'ภาษาไทยเพื่อใช้ในชีวิตจริง', credits: 1, periods_per_week: 2, type: 'theory' },
  { code: '20000-1201', name: 'ภาษาอังกฤษในชีวิตจริง', credits: 1, periods_per_week: 2, type: 'theory' },
  { code: '20000-1401', name: 'คณิตศาสตร์เพื่อพัฒนาทักษะการคิด', credits: 2, periods_per_week: 2, type: 'theory' },
  { code: '20000-1301', name: 'หน้าที่พลเมืองและศีลธรรม', credits: 1, periods_per_week: 2, type: 'theory' },
  { code: '20101-2001', name: 'งานเครื่องยนต์เล็ก', credits: 2, periods_per_week: 4, type: 'practice' },
  { code: '20101-2104', name: 'งานเครื่องยนต์แก๊สโซลีน', credits: 3, periods_per_week: 6, type: 'practice' },
  { code: '20104-2001', name: 'วงจรไฟฟ้ากระแสตรง', credits: 2, periods_per_week: 4, type: 'practice' },
  { code: '20104-2101', name: 'การติดตั้งไฟฟ้าในอาคาร', credits: 3, periods_per_week: 6, type: 'practice' },
  { code: '20201-2001', name: 'การบัญชีเบื้องต้น 1', credits: 3, periods_per_week: 4, type: 'theory' },
  { code: '20204-2001', name: 'คอมพิวเตอร์และสารสนเทศเพื่องานอาชีพ', credits: 2, periods_per_week: 4, type: 'practice' },
  { code: '20204-2103', name: 'การเขียนโปรแกรมคอมพิวเตอร์', credits: 3, periods_per_week: 6, type: 'practice' },
]);
const rooms = await up('classrooms', [
  { code: '311', building: 'อาคาร 3', room_type: 'lecture', capacity: 40 },
  { code: '312', building: 'อาคาร 3', room_type: 'lecture', capacity: 40 },
  { code: '313', building: 'อาคาร 3', room_type: 'lecture', capacity: 35 },
  { code: 'COM-1', building: 'อาคาร 4', room_type: 'lab', capacity: 35 },
  { code: 'COM-2', building: 'อาคาร 4', room_type: 'lab', capacity: 30 },
  { code: 'WS-AUTO', building: 'โรงฝึกช่างยนต์', room_type: 'workshop', capacity: 35 },
  { code: 'WS-ELEC', building: 'โรงฝึกช่างไฟฟ้า', room_type: 'workshop', capacity: 35 },
]);

const teacherData = [
  ['T001', 'นางสาวสมศรี ใจดี', 'สามัญ'], ['T002', 'นายวิชัย เก่งภาษา', 'สามัญ'], ['T003', 'นางมาลี คิดเลข', 'สามัญ'],
  ['T004', 'นายประยุทธ ช่างยนต์', 'ช่างยนต์'], ['T005', 'นายสมชาย เครื่องกล', 'ช่างยนต์'],
  ['T006', 'นายสุรชัย ไฟฟ้า', 'ไฟฟ้ากำลัง'], ['T007', 'นางสาวอรุณี บัญชี', 'การบัญชี'], ['T008', 'นายธนา โค้ดดี', 'เทคโนโลยีสารสนเทศ'],
  ['T009', 'นางสาวกมลา คอมพิวเตอร์', 'เทคโนโลยีสารสนเทศ'],
];
const teachers = [];
for (const [code, name, dept] of teacherData) {
  const user_id = await user(code, name, 'teacher', code);
  teachers.push((await up('teachers', [{ employee_code: code, user_id, department: dept, max_hours: 12 }], 'employee_code'))[0]);
}

const g = Object.fromEntries(groups.map(x => [x.code, x.id]));
const s = Object.fromEntries(subjects.map(x => [x.code, x.id]));
const t = Object.fromEntries(teachers.map(x => [x.employee_code, x.id]));
// แต่ละกลุ่มรวมไม่เกิน 12 คาบ/สัปดาห์ และครูแต่ละคนไม่เกิน 12 คาบ/สัปดาห์
const common = gc => [['20000-1101', 'T001'], ['20000-1201', 'T002']].map(([sc, tc]) => [gc, sc, tc]);
const plan = [
  ...['ชย.1/1', 'ชฟ.1/1', 'บช.1/1', 'ทส.1/1'].flatMap(common),
  ['ชย.1/1', '20101-2001', 'T004'], ['ชย.1/1', '20204-2001', 'T008'],
  ['ชฟ.1/1', '20104-2001', 'T006'], ['ชฟ.1/1', '20204-2001', 'T009'],
  ['บช.1/1', '20201-2001', 'T007'], ['บช.1/1', '20204-2001', 'T009'],
  ['ทส.1/1', '20204-2103', 'T008'],
  ['ชย.ส1/1', '20101-2104', 'T005'], ['ชย.ส1/1', '20000-1201', 'T002'],
  ['ชฟ.ส1/1', '20104-2101', 'T006'], ['ชฟ.ส1/1', '20000-1401', 'T003'],
];
await up('offerings', plan.map(([gc, sc, tc]) => ({ group_id: g[gc], subject_id: s[sc], teacher_id: t[tc] })), 'group_id,subject_id');

// นักเรียนตัวอย่าง กลุ่มละ 3 คน (รหัสผ่านเริ่มต้น = รหัสนักเรียน)
let n = 0;
for (const grp of groups) for (let i = 1; i <= 3; i++) {
  const code = `6820${String(++n).padStart(4, '0')}`;
  const user_id = await user(code, `นักเรียนตัวอย่าง ${grp.code} คนที่ ${i}`, 'student', code);
  await up('students', [{ student_code: code, user_id, group_id: grp.id }], 'student_code');
}
console.log('✔ ข้อมูลตัวอย่างพร้อม: ครู T001-T009 (รหัสผ่าน = รหัสพนักงาน), นักเรียน 68200001-68200018 (รหัสผ่าน = รหัสนักเรียน)');
