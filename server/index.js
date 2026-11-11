import express from 'express';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { db, q, log } from './db.js';
import {
  auth, setSession, signTemp, verifyTemp, COOKIE, hashPassword, verifyPassword, encrypt, decrypt, maskPhone, maskEmail,
  registerFail, isLocked, issueOtp, checkOtp, LOCK_MIN,
} from './security.js';
import { generateSchedule } from './scheduler.js';
import { findConflicts, DAYS } from '../shared/conflicts.js';
import { toSql, tableCsv, toCsv, BACKUP_TABLES } from './backup.js';

const app = express();
const root = fileURLToPath(new URL('..', import.meta.url));
app.set('trust proxy', 1);
app.use(express.json({ limit: '2mb' }));
app.use((req, res, next) => {
  res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'same-origin' });
  next();
});
app.use(express.static(root + 'public'));
app.use('/shared', express.static(root + 'shared'));

const bad = (msg, status = 400) => Object.assign(new Error(msg), { status });
const OTP_REQUIRED = process.env.OTP_REQUIRED !== 'false';

// ======================= Authentication =======================
app.post('/api/auth/login', async (req, res) => {
  const { username, password, role } = req.body || {};
  if (!username || !password) throw bad('กรุณากรอกรหัสผู้ใช้และรหัสผ่าน');
  const { data: user } = await db.from('users').select('*').eq('username', String(username).trim()).maybeSingle();
  const roleOk = user && (role === 'student' ? user.role === 'student' : user.role !== 'student');
  if (!roleOk) { await log(null, 'login_failed', { username }, req.ip); throw bad('รหัสผู้ใช้หรือรหัสผ่านไม่ถูกต้อง', 401); }
  if (isLocked(user)) throw bad(`บัญชีถูกล็อกชั่วคราว ${LOCK_MIN} นาที กรุณาลองใหม่ภายหลัง`, 423);
  if (!verifyPassword(password, user.password_hash)) {
    const locked = await registerFail(user, req.ip);
    throw bad(locked ? `ใส่รหัสผิดเกินกำหนด บัญชีถูกล็อก ${LOCK_MIN} นาที` : 'รหัสผู้ใช้หรือรหัสผ่านไม่ถูกต้อง', 401);
  }
  await db.from('users').update({ failed_attempts: 0 }).eq('id', user.id);
  if (OTP_REQUIRED && user.phone_enc) {
    await issueOtp(user, 'เข้าสู่ระบบ');
    return res.json({ otp: true, temp: signTemp(user.id, 'login'), phone: maskPhone(decrypt(user.phone_enc)) });
  }
  setSession(res, user);
  await log(user.id, 'login_ok', null, req.ip);
  res.json({ ok: true, role: user.role });
});

app.post('/api/auth/otp', async (req, res) => {
  let id; try { id = verifyTemp(req.body.temp, 'login'); } catch { throw bad('หมดเวลา กรุณาเข้าสู่ระบบใหม่', 401); }
  const user = await checkOtp(id, req.body.otp);
  if (!user) { await log(id, 'otp_failed', null, req.ip); throw bad('รหัส OTP ไม่ถูกต้องหรือหมดอายุ', 401); }
  setSession(res, user);
  await log(user.id, 'login_ok', { otp: true }, req.ip);
  res.json({ ok: true, role: user.role });
});

app.post('/api/auth/forgot', async (req, res) => {
  const { data: user } = await db.from('users').select('*').eq('username', String(req.body.username || '').trim()).maybeSingle();
  if (user?.phone_enc && !isLocked(user)) { await issueOtp(user, 'รีเซ็ตรหัสผ่าน'); await log(user.id, 'password_reset_requested', null, req.ip); }
  // ตอบเหมือนกันทุกกรณี ป้องกันการเดารหัสผู้ใช้
  res.json({ temp: signTemp(user?.id || crypto.randomUUID(), 'reset'), message: 'หากรหัสผู้ใช้ถูกต้องและมีเบอร์โทรในระบบ จะได้รับ OTP ทาง SMS' });
});

app.post('/api/auth/reset', async (req, res) => {
  let id; try { id = verifyTemp(req.body.temp, 'reset'); } catch { throw bad('หมดเวลา กรุณาขอ OTP ใหม่', 401); }
  if (String(req.body.password || '').length < 8) throw bad('รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร');
  const user = await checkOtp(id, req.body.otp);
  if (!user) throw bad('รหัส OTP ไม่ถูกต้องหรือหมดอายุ', 401);
  await db.from('users').update({ password_hash: hashPassword(req.body.password) }).eq('id', id);
  await log(id, 'password_reset', null, req.ip);
  res.json({ ok: true });
});

app.post('/api/auth/logout', (req, res) => { res.clearCookie(COOKIE); res.json({ ok: true }); });

// ======================= ข้อมูลของฉัน + PDPA =======================
async function profileOf(userId) {
  const u = await q(db.from('users').select('id,username,full_name,role,phone_enc,email_enc,pdpa_consent_at,created_at').eq('id', userId).single());
  const teacher = await q(db.from('teachers').select('*').eq('user_id', userId).maybeSingle());
  const student = await q(db.from('students').select('*, group:student_groups(*)').eq('user_id', userId).maybeSingle());
  return { u, teacher, student };
}

app.get('/api/me', auth(), async (req, res) => {
  const { u, teacher, student } = await profileOf(req.user.sub);
  res.json({
    id: u.id, username: u.username, full_name: u.full_name, role: u.role, pdpa_consent_at: u.pdpa_consent_at,
    phone: maskPhone(decrypt(u.phone_enc)), email: maskEmail(decrypt(u.email_enc)), teacher, student,
  });
});

app.post('/api/me/consent', auth(), async (req, res) => {
  await q(db.from('users').update({ pdpa_consent_at: new Date().toISOString() }).eq('id', req.user.sub));
  await log(req.user.sub, 'pdpa_consent', null, req.ip);
  res.json({ ok: true });
});

app.put('/api/me', auth(), async (req, res) => {
  const patch = {};
  if (req.body.phone !== undefined) {
    const p = String(req.body.phone).replace(/\D/g, '');
    if (p && !/^0\d{9}$/.test(p)) throw bad('เบอร์โทรศัพท์ต้องเป็นตัวเลข 10 หลัก');
    patch.phone_enc = encrypt(p);
  }
  if (req.body.email !== undefined) patch.email_enc = encrypt(String(req.body.email).trim());
  await q(db.from('users').update(patch).eq('id', req.user.sub));
  await log(req.user.sub, 'profile_update', { fields: Object.keys(patch) }, req.ip);
  res.json({ ok: true });
});

app.put('/api/me/password', auth(), async (req, res) => {
  const u = await q(db.from('users').select('password_hash').eq('id', req.user.sub).single());
  if (!verifyPassword(String(req.body.old || ''), u.password_hash)) throw bad('รหัสผ่านเดิมไม่ถูกต้อง');
  if (String(req.body.password || '').length < 8) throw bad('รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร');
  await q(db.from('users').update({ password_hash: hashPassword(req.body.password) }).eq('id', req.user.sub));
  await log(req.user.sub, 'password_change', null, req.ip);
  res.json({ ok: true });
});

// PDPA: สิทธิ์ขอรับสำเนาข้อมูล และขอลบข้อมูล
app.get('/api/me/export', auth(), async (req, res) => {
  const { u, teacher, student } = await profileOf(req.user.sub);
  const { phone_enc, email_enc, ...rest } = u;
  await log(req.user.sub, 'pdpa_export', null, req.ip);
  res.attachment('my-data.json').json({ ...rest, phone: decrypt(phone_enc), email: decrypt(email_enc), teacher, student });
});
app.post('/api/me/delete-request', auth(), async (req, res) => {
  await log(req.user.sub, 'pdpa_delete_request', { reason: String(req.body.reason || '').slice(0, 500) }, req.ip);
  res.json({ ok: true, message: 'ส่งคำขอลบข้อมูลถึงฝ่ายวิชาการแล้ว' });
});

// ======================= ข้อมูลอ้างอิง (ทุกบทบาท) =======================
app.get('/api/lookup', auth(), async (req, res) => {
  const [subjects, rooms, groups, periods, teachers, offerings] = await Promise.all([
    q(db.from('subjects').select('*').order('code')),
    q(db.from('classrooms').select('*').order('code')),
    q(db.from('student_groups').select('*').order('code')),
    q(db.from('periods').select('*').order('day').order('period_no')),
    q(db.from('teachers').select('id,employee_code,department,max_hours,unavailable,user:users(full_name)')),
    q(db.from('offerings').select('*')),
  ]);
  res.json({ subjects, rooms, groups, periods, offerings, teachers: teachers.map(({ user, ...t }) => ({ ...t, full_name: user?.full_name })) });
});

const publishedVersion = async () => (await q(db.from('timetable_versions').select('*').eq('status', 'published').limit(1)))[0];

app.get('/api/my/schedule', auth(), async (req, res) => {
  const v = await publishedVersion();
  if (!v) return res.json({ version: null, entries: [] });
  const { teacher, student } = await profileOf(req.user.sub);
  let qq = db.from('timetable').select('*').eq('version_id', v.id);
  if (teacher) qq = qq.eq('teacher_id', teacher.id);
  else if (student?.group_id) qq = qq.eq('group_id', student.group_id);
  else if (req.user.role !== 'admin') return res.json({ version: v, entries: [] });
  res.json({ version: v, entries: await q(qq) });
});

// ======================= ครู =======================
const myTeacher = async req => {
  const t = await q(db.from('teachers').select('*').eq('user_id', req.user.sub).maybeSingle());
  if (!t) throw bad('ไม่พบข้อมูลครู', 404);
  return t;
};

app.get('/api/my/students', auth('teacher'), async (req, res) => {
  const t = await myTeacher(req);
  const groupIds = [...new Set((await q(db.from('offerings').select('group_id').eq('teacher_id', t.id))).map(o => o.group_id))];
  if (!groupIds.length) return res.json([]);
  const groups = await q(db.from('student_groups').select('*').in('id', groupIds).order('code'));
  const students = await q(db.from('students').select('student_code,group_id,special_needs,user:users(full_name)').in('group_id', groupIds).order('student_code'));
  res.json(groups.map(g => ({ ...g, students: students.filter(s => s.group_id === g.id).map(s => ({ code: s.student_code, name: s.user?.full_name, special: s.special_needs })) })));
});

app.get('/api/my/timeblocks', auth('teacher'), async (req, res) => {
  const t = await myTeacher(req);
  res.json(await q(db.from('time_block_requests').select('*').eq('teacher_id', t.id).order('created_at', { ascending: false })));
});
app.post('/api/my/timeblocks', auth('teacher'), async (req, res) => {
  const t = await myTeacher(req);
  const day = +req.body.day, from = +req.body.period_from, to = +req.body.period_to;
  if (!(day >= 1 && day <= 7) || !(from >= 1) || !(to >= from)) throw bad('ข้อมูลวัน/คาบไม่ถูกต้อง');
  await q(db.from('time_block_requests').insert({ teacher_id: t.id, day, period_from: from, period_to: to, reason: String(req.body.reason || '').slice(0, 300) }));
  await log(req.user.sub, 'timeblock_request', { day, from, to }, req.ip);
  res.json({ ok: true });
});

// ======================= ฝ่ายวิชาการ / Admin =======================
const admin = auth('admin');

app.get('/api/admin/dashboard', admin, async (req, res) => {
  const count = async t => (await db.from(t).select('*', { count: 'exact', head: true })).count || 0;
  const [teachers, students, rooms, subjects, groups] = await Promise.all(['teachers', 'students', 'classrooms', 'subjects', 'student_groups'].map(count));
  const v = await publishedVersion();
  const entries = v ? await q(db.from('timetable').select('teacher_id,room_id,day').eq('version_id', v.id)) : [];
  const perTeacher = {};
  for (const e of entries) perTeacher[e.teacher_id] = (perTeacher[e.teacher_id] || 0) + 1;
  const perDay = [1, 2, 3, 4, 5, 6, 7].map(d => entries.filter(e => e.day === d).length);
  const since = new Date(Date.now() - 7 * 864e5).toISOString();
  const suspicious = await q(db.from('logs').select('*, user:users(username,full_name)').in('action', ['login_failed', 'account_locked', 'otp_failed']).gte('created_at', since).order('created_at', { ascending: false }).limit(20));
  const pending = (await db.from('time_block_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending')).count || 0;
  res.json({
    teachers, students, rooms, subjects, groups, pending, version: v,
    roomsUsed: new Set(entries.map(e => e.room_id)).size,
    avgTeacherHours: teachers ? +(entries.length / teachers).toFixed(1) : 0,
    perDay, suspicious,
  });
});

// CRUD ทั่วไปสำหรับข้อมูลหลัก (whitelist คอลัมน์ที่แก้ไขได้)
const CRUD = {
  subjects: ['code', 'name', 'credits', 'periods_per_week', 'type'],
  classrooms: ['code', 'building', 'room_type', 'capacity'],
  student_groups: ['code', 'department', 'level', 'year', 'size', 'program'],
  periods: ['day', 'period_no', 'start_time', 'end_time'],
  offerings: ['group_id', 'subject_id', 'teacher_id'],
};
const pick = (body, cols) => Object.fromEntries(cols.filter(c => body[c] !== undefined && body[c] !== '').map(c => [c, body[c]]));
const crudTable = req => { if (!CRUD[req.params.table]) throw bad('ไม่รู้จักตารางนี้', 404); return req.params.table; };

app.get('/api/admin/data/:table', admin, async (req, res) => res.json(await q(db.from(crudTable(req)).select('*'))));
app.post('/api/admin/data/:table', admin, async (req, res) => {
  const t = crudTable(req);
  res.json(await q(db.from(t).insert(pick(req.body, CRUD[t])).select().single()));
});
app.put('/api/admin/data/:table/:id', admin, async (req, res) => {
  const t = crudTable(req);
  res.json(await q(db.from(t).update(pick(req.body, CRUD[t])).eq('id', req.params.id).select().single()));
});
app.delete('/api/admin/data/:table/:id', admin, async (req, res) => {
  await q(db.from(crudTable(req)).delete().eq('id', req.params.id));
  await log(req.user.sub, 'data_delete', { table: req.params.table, id: req.params.id }, req.ip);
  res.json({ ok: true });
});

// ครู/นักเรียน = แถวใน users + โปรไฟล์ (สร้างบัญชีให้อัตโนมัติ รหัสผ่านเริ่มต้น = รหัสพนักงาน/นักเรียน)
const PEOPLE = {
  teachers: { code: 'employee_code', role: 'teacher', cols: ['employee_code', 'department', 'max_hours', 'unavailable'] },
  students: { code: 'student_code', role: 'student', cols: ['student_code', 'group_id', 'special_needs'] },
};
const people = req => { const p = PEOPLE[req.params.kind]; if (!p) throw bad('ไม่รู้จักประเภท', 404); return p; };

async function createPerson(kind, body) {
  const p = PEOPLE[kind];
  const code = String(body[p.code] || '').trim();
  if (!code || !body.full_name) throw bad('กรุณากรอกรหัสและชื่อ-สกุล');
  const phone = String(body.phone || '').replace(/\D/g, '');
  const user = await q(db.from('users').insert({
    username: code, full_name: body.full_name, role: p.role, password_hash: hashPassword(body.password || code),
    phone_enc: phone ? encrypt(phone) : null,
  }).select().single());
  try { return await q(db.from(kind).insert({ ...pick(body, p.cols), [p.code]: code, user_id: user.id }).select().single()); }
  catch (e) { await db.from('users').delete().eq('id', user.id); throw e; }
}

app.get('/api/admin/people/:kind', admin, async (req, res) => {
  const p = people(req);
  const rows = await q(db.from(req.params.kind).select('*, user:users(full_name,phone_enc,locked_until)').order(p.code));
  res.json(rows.map(({ user, ...r }) => ({ ...r, full_name: user?.full_name, phone: maskPhone(decrypt(user?.phone_enc)), locked: isLocked(user || {}) })));
});
app.post('/api/admin/people/:kind', admin, async (req, res) => { people(req); res.json(await createPerson(req.params.kind, req.body)); });
app.put('/api/admin/people/:kind/:id', admin, async (req, res) => {
  const p = people(req);
  const row = await q(db.from(req.params.kind).update(pick(req.body, p.cols.filter(c => c !== p.code))).eq('id', req.params.id).select().single());
  const patch = {};
  if (req.body.full_name) patch.full_name = req.body.full_name;
  if (req.body.phone) patch.phone_enc = encrypt(String(req.body.phone).replace(/\D/g, ''));
  if (req.body.unlock) Object.assign(patch, { locked_until: null, failed_attempts: 0 });
  if (req.body.password) patch.password_hash = hashPassword(req.body.password);
  if (Object.keys(patch).length) await q(db.from('users').update(patch).eq('id', row.user_id));
  res.json(row);
});
app.delete('/api/admin/people/:kind/:id', admin, async (req, res) => {
  people(req);
  const row = await q(db.from(req.params.kind).select('user_id').eq('id', req.params.id).single());
  await q(db.from('users').delete().eq('id', row.user_id)); // cascade ลบโปรไฟล์
  await log(req.user.sub, 'data_delete', { table: req.params.kind, id: req.params.id }, req.ip);
  res.json({ ok: true });
});

// นำเข้านักเรียนจาก CSV: student_code,full_name,group_code,phone
app.post('/api/admin/students/import', admin, async (req, res) => {
  const groups = Object.fromEntries((await q(db.from('student_groups').select('id,code'))).map(g => [g.code, g.id]));
  const result = { ok: 0, errors: [] };
  for (const [i, r] of (req.body.rows || []).entries()) {
    try {
      if (r.group_code && !groups[r.group_code]) throw bad(`ไม่พบกลุ่มเรียน ${r.group_code}`);
      await createPerson('students', { ...r, group_id: groups[r.group_code] });
      result.ok++;
    } catch (e) { result.errors.push(`แถว ${i + 1} (${r.student_code || '-'}): ${e.message}`); }
  }
  await log(req.user.sub, 'students_import', { ok: result.ok, errors: result.errors.length }, req.ip);
  res.json(result);
});

// คำร้องบล็อกเวลา
app.get('/api/admin/timeblocks', admin, async (req, res) => {
  res.json(await q(db.from('time_block_requests').select('*, teacher:teachers(employee_code, user:users(full_name))').order('created_at', { ascending: false })));
});
app.put('/api/admin/timeblocks/:id', admin, async (req, res) => {
  if (!['approved', 'rejected'].includes(req.body.status)) throw bad('สถานะไม่ถูกต้อง');
  await q(db.from('time_block_requests').update({ status: req.body.status }).eq('id', req.params.id));
  res.json({ ok: true });
});

// ---------- ตารางสอน: เวอร์ชัน / AI / โหมดมือ ----------
async function loadCtx() {
  const [teachers, rooms, groups, subjects, blocks] = await Promise.all([
    q(db.from('teachers').select('id,max_hours,unavailable')), q(db.from('classrooms').select('*')),
    q(db.from('student_groups').select('*')), q(db.from('subjects').select('*')),
    q(db.from('time_block_requests').select('*').eq('status', 'approved')),
  ]);
  const byId = a => Object.fromEntries(a.map(x => [x.id, x]));
  return { teachers: byId(teachers), rooms: byId(rooms), roomList: rooms, groups: byId(groups), subjects: byId(subjects), blocks };
}

async function insertEntries(versionId, entries) {
  for (let i = 0; i < entries.length; i += 500)
    await q(db.from('timetable').insert(entries.slice(i, i + 500).map(({ id, ...e }) => ({ ...e, version_id: versionId }))));
}

app.get('/api/admin/versions', admin, async (req, res) => {
  res.json(await q(db.from('timetable_versions').select('*').order('created_at', { ascending: false })));
});

app.post('/api/admin/versions/generate', admin, async (req, res) => {
  const ctx = await loadCtx();
  const offerings = await q(db.from('offerings').select('*'));
  const periods = await q(db.from('periods').select('day,period_no'));
  if (!offerings.length || !periods.length || !ctx.roomList.length) throw bad('ต้องมีข้อมูล แผนการสอน, คาบเรียน และห้องเรียน ก่อนสั่ง AI จัดตาราง');
  const t0 = Date.now();
  const { entries, unplaced } = generateSchedule({ offerings, periods, rooms: ctx.roomList, subjects: ctx.subjects, groups: ctx.groups, teachers: ctx.teachers, blocks: ctx.blocks });
  const v = await q(db.from('timetable_versions').insert({ name: req.body.name || `AI ${new Date().toLocaleString('th-TH')}`, created_by: req.user.sub }).select().single());
  await insertEntries(v.id, entries);
  await log(req.user.sub, 'ai_generate', { version: v.id, entries: entries.length, unplaced: unplaced.length, ms: Date.now() - t0 }, req.ip);
  res.json({ version: v, placed: entries.length, unplaced, ms: Date.now() - t0 });
});

// Snapshot = จุดกู้คืน: คัดลอกเวอร์ชันเดิมเป็นฉบับร่างใหม่
app.post('/api/admin/versions/:id/snapshot', admin, async (req, res) => {
  const src = await q(db.from('timetable_versions').select('*').eq('id', req.params.id).single());
  const entries = await q(db.from('timetable').select('*').eq('version_id', src.id));
  const v = await q(db.from('timetable_versions').insert({ name: req.body.name || `สำเนา: ${src.name}`, created_by: req.user.sub }).select().single());
  await insertEntries(v.id, entries);
  await log(req.user.sub, 'snapshot', { from: src.id, to: v.id }, req.ip);
  res.json(v);
});

app.post('/api/admin/versions/:id/publish', admin, async (req, res) => {
  const entries = await q(db.from('timetable').select('*').eq('version_id', req.params.id));
  const conflicts = findConflicts(entries, await loadCtx());
  if (conflicts.size && !req.body.force) throw bad(`ยังมีคาบที่ชนกัน ${conflicts.size} รายการ แก้ไขก่อนประกาศใช้`, 409);
  await q(db.from('timetable_versions').update({ status: 'archived' }).eq('status', 'published'));
  await q(db.from('timetable_versions').update({ status: 'published' }).eq('id', req.params.id));
  await log(req.user.sub, 'publish', { version: req.params.id }, req.ip);
  res.json({ ok: true });
});

app.delete('/api/admin/versions/:id', admin, async (req, res) => {
  await q(db.from('timetable_versions').delete().eq('id', req.params.id).neq('status', 'published'));
  res.json({ ok: true });
});

app.get('/api/admin/versions/:id/entries', admin, async (req, res) => {
  res.json(await q(db.from('timetable').select('*').eq('version_id', req.params.id)));
});

const ENTRY_COLS = ['day', 'period_no', 'subject_id', 'teacher_id', 'group_id', 'room_id'];
const editable = async versionId => {
  const v = await q(db.from('timetable_versions').select('status').eq('id', versionId).single());
  if (v.status === 'published') throw bad('ตารางที่ประกาศแล้วแก้ไม่ได้ กรุณาสร้างสำเนา (Snapshot) แล้วแก้ในฉบับร่าง');
};
app.post('/api/admin/entries', admin, async (req, res) => {
  await editable(req.body.version_id);
  res.json(await q(db.from('timetable').insert({ ...pick(req.body, ENTRY_COLS), version_id: req.body.version_id }).select().single()));
});
app.put('/api/admin/entries/:id', admin, async (req, res) => {
  const e = await q(db.from('timetable').select('version_id').eq('id', req.params.id).single());
  await editable(e.version_id);
  res.json(await q(db.from('timetable').update(pick(req.body, ['day', 'period_no', 'room_id'])).eq('id', req.params.id).select().single()));
});
app.delete('/api/admin/entries/:id', admin, async (req, res) => {
  const e = await q(db.from('timetable').select('version_id').eq('id', req.params.id).single());
  await editable(e.version_id);
  await q(db.from('timetable').delete().eq('id', req.params.id));
  res.json({ ok: true });
});

// ส่งออก Excel (CSV UTF-8 BOM เปิดใน Excel ได้ภาษาไทยถูก) — PDF ใช้ปุ่มพิมพ์ในหน้าเว็บ (Save as PDF)
app.get('/api/admin/versions/:id/export.csv', admin, async (req, res) => {
  const [entries, ctx, periods, teachers] = await Promise.all([
    q(db.from('timetable').select('*').eq('version_id', req.params.id)), loadCtx(),
    q(db.from('periods').select('*')), q(db.from('teachers').select('id, user:users(full_name)')),
  ]);
  const tName = Object.fromEntries(teachers.map(t => [t.id, t.user?.full_name]));
  const time = Object.fromEntries(periods.map(p => [`${p.day}|${p.period_no}`, `${p.start_time.slice(0, 5)}-${p.end_time.slice(0, 5)}`]));
  const rows = entries.sort((a, b) => a.day - b.day || a.period_no - b.period_no).map(e => ({
    'วัน': DAYS[e.day], 'คาบ': e.period_no, 'เวลา': time[`${e.day}|${e.period_no}`] || '',
    'กลุ่มเรียน': ctx.groups[e.group_id]?.code, 'แผนก': ctx.groups[e.group_id]?.department,
    'รหัสวิชา': ctx.subjects[e.subject_id]?.code, 'ชื่อวิชา': ctx.subjects[e.subject_id]?.name,
    'ครูผู้สอน': tName[e.teacher_id], 'ห้อง': ctx.rooms[e.room_id]?.code, 'อาคาร': ctx.rooms[e.room_id]?.building,
  }));
  await log(req.user.sub, 'export', { version: req.params.id, format: 'csv' }, req.ip);
  res.attachment('timetable.csv').type('text/csv; charset=utf-8').send(toCsv(rows));
});

// ---------- สำรองข้อมูล / Logs ----------
app.get('/api/admin/backup.sql', admin, async (req, res) => {
  await log(req.user.sub, 'backup', { format: 'sql', manual: true }, req.ip);
  res.attachment(`ptc-backup-${new Date().toISOString().slice(0, 10)}.sql`).type('application/sql').send(await toSql());
});
app.get('/api/admin/backup/:table.csv', admin, async (req, res) => {
  if (!BACKUP_TABLES.includes(req.params.table)) throw bad('ไม่รู้จักตารางนี้', 404);
  await log(req.user.sub, 'backup', { format: 'csv', table: req.params.table }, req.ip);
  res.attachment(`${req.params.table}.csv`).type('text/csv; charset=utf-8').send(await tableCsv(req.params.table));
});
app.get('/api/admin/backups', admin, async (req, res) => {
  const { data } = await db.storage.from('backups').list('', { sortBy: { column: 'created_at', order: 'desc' }, limit: 30 });
  res.json(data || []);
});
app.get('/api/admin/logs', admin, async (req, res) => {
  let qq = db.from('logs').select('*, user:users(username,full_name)').order('created_at', { ascending: false }).limit(300);
  if (req.query.action) qq = qq.eq('action', req.query.action);
  res.json(await q(qq));
});

// ---------- error handler ----------
app.use('/api', (req, res) => res.status(404).json({ error: 'ไม่พบ API' }));
app.use((err, req, res, next) => {
  if (!err.status) console.error(err);
  res.status(err.status || 500).json({ error: err.status ? err.message : 'เกิดข้อผิดพลาดภายในระบบ' });
});

// บน Vercel ไม่ต้อง listen (Vercel เรียก app ผ่าน api/index.js)
if (!process.env.VERCEL) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`PTC Smart Schedule พร้อมใช้งานที่ http://localhost:${port}`));
}
export default app;
