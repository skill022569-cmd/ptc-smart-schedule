import express from 'express';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { db, q, log } from './db.js';
import {
  auth, setSession, signTemp, verifyTemp, COOKIE, hashPassword, verifyPassword, encrypt, decrypt, maskPhone, maskEmail,
  registerFail, isLocked, issueOtp, checkOtp, LOCK_MIN,
} from './security.js';
import { generateSchedule } from './scheduler.js';
import { findConflicts, DAYS } from '../public/shared/conflicts.js';
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

const bad = (msg, status = 400) => Object.assign(new Error(msg), { status });
const OTP_REQUIRED = process.env.OTP_REQUIRED !== 'false';
const LOGIN_ROLES = ['admin', 'dept']; // ครู/นักเรียนเป็นข้อมูลในระบบเท่านั้น ไม่มีบัญชีเข้าใช้

// ======================= หน้าสาธารณะ (ไม่ต้องล็อกอิน) =======================
app.get('/api/public/schedule', async (req, res) => {
  const [v, groups, subjects, teachers, rooms, periods] = await Promise.all([
    publishedVersion(),
    q(db.from('student_groups').select('*').order('code')), // * = ไม่พังถ้ายังไม่ได้รัน migration 004 (advisor)
    q(db.from('subjects').select('id,code,name,type,credits')),
    q(db.from('teachers').select('id, user:users(full_name)')),
    q(db.from('classrooms').select('id,code,building')),
    q(db.from('periods').select('day,period_no,start_time,end_time').order('day').order('period_no')),
  ]);
  const entries = v ? await q(db.from('timetable').select('id,day,period_no,subject_id,teacher_id,room_id,group_id').eq('version_id', v.id)) : [];
  res.json({ version: v && { name: v.name, created_at: v.created_at }, groups, subjects, rooms, periods, entries, teachers: teachers.map(t => ({ id: t.id, full_name: t.user?.full_name })) });
});

// ======================= Authentication =======================
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) throw bad('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
  const { data: user } = await db.from('users').select('*').eq('username', String(username).trim()).maybeSingle();
  if (!user || !LOGIN_ROLES.includes(user.role)) { await log(null, 'login_failed', { username }, req.ip); throw bad('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง', 401); }
  if (isLocked(user)) throw bad(`บัญชีถูกล็อกชั่วคราว ${LOCK_MIN} นาที กรุณาลองใหม่ภายหลัง`, 423);
  if (!verifyPassword(password, user.password_hash)) {
    const locked = await registerFail(user, req.ip);
    throw bad(locked ? `ใส่รหัสผิดเกินกำหนด บัญชีถูกล็อก ${LOCK_MIN} นาที` : 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง', 401);
  }
  if (!user.phone_verified_at) throw bad('บัญชียังไม่ได้ยืนยันเบอร์โทรด้วย OTP กรุณาติดต่อผู้ดูแลระบบ', 403);
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
  if (user?.phone_enc && LOGIN_ROLES.includes(user.role) && !isLocked(user)) { await issueOtp(user, 'รีเซ็ตรหัสผ่าน'); await log(user.id, 'password_reset_requested', null, req.ip); }
  // ตอบเหมือนกันทุกกรณี ป้องกันการเดาชื่อผู้ใช้
  res.json({ temp: signTemp(user?.id || crypto.randomUUID(), 'reset'), message: 'หากชื่อผู้ใช้ถูกต้องและมีเบอร์โทรในระบบ จะได้รับ OTP ทาง SMS' });
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
const staff = auth(...LOGIN_ROLES);
const admin = auth('admin');
const myUser = id => q(db.from('users').select('id,username,full_name,role,department,phone_enc,email_enc,pdpa_consent_at,created_at').eq('id', id).single());

app.get('/api/me', staff, async (req, res) => {
  const u = await myUser(req.user.sub);
  res.json({
    id: u.id, username: u.username, full_name: u.full_name, role: u.role, department: u.department, pdpa_consent_at: u.pdpa_consent_at,
    phone: maskPhone(decrypt(u.phone_enc)), email: maskEmail(decrypt(u.email_enc)),
    view: req.user.viewAs ? { role: 'dept', department: req.user.dept } : null,
  });
});

app.post('/api/me/consent', staff, async (req, res) => {
  await q(db.from('users').update({ pdpa_consent_at: new Date().toISOString() }).eq('id', req.user.sub));
  await log(req.user.sub, 'pdpa_consent', null, req.ip);
  res.json({ ok: true });
});

app.put('/api/me', staff, async (req, res) => {
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

app.put('/api/me/password', staff, async (req, res) => {
  const u = await q(db.from('users').select('password_hash').eq('id', req.user.sub).single());
  if (!verifyPassword(String(req.body.old || ''), u.password_hash)) throw bad('รหัสผ่านเดิมไม่ถูกต้อง');
  if (String(req.body.password || '').length < 8) throw bad('รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร');
  await q(db.from('users').update({ password_hash: hashPassword(req.body.password) }).eq('id', req.user.sub));
  await log(req.user.sub, 'password_change', null, req.ip);
  res.json({ ok: true });
});

// PDPA: สิทธิ์ขอรับสำเนาข้อมูล และขอลบข้อมูล
app.get('/api/me/export', staff, async (req, res) => {
  const { phone_enc, email_enc, ...rest } = await myUser(req.user.sub);
  await log(req.user.sub, 'pdpa_export', null, req.ip);
  res.attachment('my-data.json').json({ ...rest, phone: decrypt(phone_enc), email: decrypt(email_enc) });
});
app.post('/api/me/delete-request', staff, async (req, res) => {
  await log(req.user.sub, 'pdpa_delete_request', { reason: String(req.body.reason || '').slice(0, 500) }, req.ip);
  res.json({ ok: true, message: 'ส่งคำขอลบข้อมูลถึงผู้ดูแลระบบแล้ว' });
});

// ======================= ขอบเขตแผนก =======================
// null = แอดมิน (ทุกแผนก), ไม่งั้นคือชื่อแผนกของบัญชี dept
const deptOf = req => (req.user.role === 'dept' ? req.user.dept : null);
async function myGroupIds(req) {
  const d = deptOf(req);
  return d === null ? null : (await q(db.from('student_groups').select('id').eq('department', d))).map(g => g.id);
}
async function assertGroup(req, groupId) {
  const ids = await myGroupIds(req);
  if (ids && !ids.includes(groupId)) throw bad('ไม่มีสิทธิ์จัดการกลุ่มเรียนของแผนกอื่น', 403);
}

app.get('/api/lookup', staff, async (req, res) => {
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

// ======================= แอดมิน: แผงควบคุม / บัญชีผู้ใช้ =======================
app.get('/api/admin/dashboard', admin, async (req, res) => {
  const count = async t => (await db.from(t).select('*', { count: 'exact', head: true })).count || 0;
  const [teachers, students, rooms, subjects, groups] = await Promise.all(['teachers', 'students', 'classrooms', 'subjects', 'student_groups'].map(count));
  const v = await publishedVersion();
  const entries = v ? await q(db.from('timetable').select('teacher_id,room_id,day').eq('version_id', v.id)) : [];
  const perDay = [1, 2, 3, 4, 5, 6, 7].map(d => entries.filter(e => e.day === d).length);
  const since = new Date(Date.now() - 7 * 864e5).toISOString();
  const suspicious = await q(db.from('logs').select('*, user:users(username,full_name)').in('action', ['login_failed', 'account_locked', 'otp_failed']).gte('created_at', since).order('created_at', { ascending: false }).limit(20));
  res.json({
    teachers, students, rooms, subjects, groups, version: v,
    roomsUsed: new Set(entries.map(e => e.room_id)).size,
    avgTeacherHours: teachers ? +(entries.length / teachers).toFixed(1) : 0,
    perDay, suspicious,
  });
});

const accountRow = u => ({ id: u.id, username: u.username, full_name: u.full_name, role: u.role, department: u.department, phone: maskPhone(decrypt(u.phone_enc)), verified: !!u.phone_verified_at, locked: !!isLocked(u), created_at: u.created_at });
function accountPatch(body) {
  const patch = {};
  if (body.full_name) patch.full_name = String(body.full_name).trim();
  if (body.role) { if (!LOGIN_ROLES.includes(body.role)) throw bad('บทบาทไม่ถูกต้อง'); patch.role = body.role; }
  if (body.department !== undefined) patch.department = String(body.department).trim() || null;
  if (body.phone) {
    const p = String(body.phone).replace(/\D/g, '');
    if (!/^0\d{9}$/.test(p)) throw bad('เบอร์โทรศัพท์ต้องเป็นตัวเลข 10 หลัก');
    Object.assign(patch, { phone_enc: encrypt(p), phone_verified_at: null }); // เบอร์ใหม่ต้องยืนยัน OTP ใหม่
  }
  if (body.password) { if (String(body.password).length < 8) throw bad('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร'); patch.password_hash = hashPassword(body.password); }
  if (body.unlock) Object.assign(patch, { locked_until: null, failed_attempts: 0 });
  return patch;
}
app.get('/api/admin/accounts', admin, async (req, res) => {
  res.json((await q(db.from('users').select('*').in('role', LOGIN_ROLES).order('username'))).map(accountRow));
});
app.post('/api/admin/accounts', admin, async (req, res) => {
  const patch = accountPatch({ role: 'dept', ...req.body });
  if (!req.body.username || !patch.full_name || !patch.password_hash) throw bad('กรุณากรอกชื่อผู้ใช้ ชื่อ-สกุล และรหัสผ่าน');
  if (!patch.phone_enc) throw bad('กรุณากรอกเบอร์มือถือของเจ้าของบัญชี (ใช้ยืนยัน OTP)');
  if (patch.role === 'dept' && !patch.department) throw bad('บัญชีฝ่ายวิชาการต้องระบุแผนก');
  const u = await q(db.from('users').insert({ ...patch, username: String(req.body.username).trim() }).select().single());
  await issueOtp(u, 'ยืนยันการสมัครบัญชี');
  await log(req.user.sub, 'account_create', { username: u.username, role: u.role, department: u.department }, req.ip);
  res.json(accountRow(u));
});
app.put('/api/admin/accounts/:id', admin, async (req, res) => {
  if (req.params.id === req.user.sub && req.body.role && req.body.role !== 'admin') throw bad('เปลี่ยนบทบาทของบัญชีตัวเองไม่ได้');
  const patch = accountPatch(req.body);
  const u = await q(db.from('users').update(patch).eq('id', req.params.id).in('role', LOGIN_ROLES).select().single());
  if (patch.phone_enc) await issueOtp(u, 'ยืนยันเบอร์โทรใหม่');
  await log(req.user.sub, 'account_update', { username: u.username }, req.ip);
  res.json(accountRow(u));
});
// ยืนยันเบอร์ของผู้สมัคร: เจ้าของเบอร์ได้ OTP ทาง SMS แล้วแจ้งรหัสให้ผู้ดูแลระบบกรอก
app.post('/api/admin/accounts/:id/verify', admin, async (req, res) => {
  const u = await checkOtp(req.params.id, req.body.otp);
  if (!u) throw bad('รหัส OTP ไม่ถูกต้องหรือหมดอายุ (กรอกผิดได้ไม่เกิน 5 ครั้ง กดส่งรหัสใหม่ได้)');
  const row = await q(db.from('users').update({ phone_verified_at: new Date().toISOString() }).eq('id', u.id).select().single());
  await log(req.user.sub, 'account_verified', { username: u.username }, req.ip);
  res.json(accountRow(row));
});
app.post('/api/admin/accounts/:id/resend', admin, async (req, res) => {
  const u = await q(db.from('users').select('*').eq('id', req.params.id).in('role', LOGIN_ROLES).single());
  if (!u.phone_enc) throw bad('บัญชีนี้ยังไม่มีเบอร์โทร');
  await issueOtp(u, 'ยืนยันการสมัครบัญชี');
  res.json({ ok: true, phone: maskPhone(decrypt(u.phone_enc)) });
});
app.delete('/api/admin/accounts/:id', admin, async (req, res) => {
  if (req.params.id === req.user.sub) throw bad('ลบบัญชีตัวเองไม่ได้');
  await q(db.from('users').delete().eq('id', req.params.id).in('role', LOGIN_ROLES));
  await log(req.user.sub, 'data_delete', { table: 'users', id: req.params.id }, req.ip);
  res.json({ ok: true });
});

// ======================= ข้อมูลหลัก (แอดมิน = ทั้งหมด, ฝ่ายวิชาการ = แผนกตัวเอง) =======================
const CRUD = {
  subjects: ['code', 'name', 'credits', 'periods_per_week', 'type'],
  classrooms: ['code', 'building', 'room_type', 'capacity'],
  student_groups: ['code', 'department', 'level', 'year', 'size', 'program', 'advisor'],
  periods: ['day', 'period_no', 'start_time', 'end_time'],
  offerings: ['group_id', 'subject_id', 'teacher_id'],
};
const pick = (body, cols) => Object.fromEntries(cols.filter(c => body[c] !== undefined && body[c] !== '').map(c => [c, body[c]]));
const crudTable = req => { if (!CRUD[req.params.table]) throw bad('ไม่รู้จักตารางนี้', 404); return req.params.table; };

// ตรวจสิทธิ์ฝ่ายวิชาการแผนก: แก้ได้เฉพาะกลุ่มเรียน/แผนการสอนของแผนกตัวเอง (รายวิชา ห้อง คาบเรียน = แอดมินเท่านั้น)
async function guardData(req, t, body, id) {
  const d = deptOf(req);
  if (d === null) return;
  if (t === 'student_groups') {
    if (body) body.department = d;
    if (id && (await q(db.from(t).select('department').eq('id', id).single())).department !== d) throw bad('ไม่มีสิทธิ์แก้ไขกลุ่มเรียนของแผนกอื่น', 403);
  } else if (t === 'offerings') {
    if (body?.group_id) await assertGroup(req, body.group_id);
    if (id) await assertGroup(req, (await q(db.from(t).select('group_id').eq('id', id).single())).group_id);
  } else throw bad('ข้อมูลส่วนนี้แก้ไขได้เฉพาะผู้ดูแลระบบ', 403);
}

app.get('/api/data/:table', staff, async (req, res) => {
  const t = crudTable(req), d = deptOf(req);
  let qq = db.from(t).select('*');
  if (d !== null && t === 'student_groups') qq = qq.eq('department', d);
  if (d !== null && t === 'offerings') qq = qq.in('group_id', await myGroupIds(req));
  res.json(await q(qq));
});
app.post('/api/data/:table', staff, async (req, res) => {
  const t = crudTable(req), body = pick(req.body, CRUD[t]);
  await guardData(req, t, body);
  res.json(await q(db.from(t).insert(body).select().single()));
});
app.put('/api/data/:table/:id', staff, async (req, res) => {
  const t = crudTable(req), body = pick(req.body, CRUD[t]);
  await guardData(req, t, body, req.params.id);
  res.json(await q(db.from(t).update(body).eq('id', req.params.id).select().single()));
});
app.delete('/api/data/:table/:id', staff, async (req, res) => {
  const t = crudTable(req);
  await guardData(req, t, null, req.params.id);
  await q(db.from(t).delete().eq('id', req.params.id));
  await log(req.user.sub, 'data_delete', { table: t, id: req.params.id }, req.ip);
  res.json({ ok: true });
});

// ครู/นักเรียน: เก็บชื่อไว้ในตาราง users (ไม่มีสิทธิ์เข้าระบบ)
const PEOPLE = {
  teachers: { code: 'employee_code', role: 'teacher', cols: ['employee_code', 'department', 'max_hours', 'unavailable'] },
  students: { code: 'student_code', role: 'student', cols: ['student_code', 'group_id', 'special_needs'] },
};
const people = req => { const p = PEOPLE[req.params.kind]; if (!p) throw bad('ไม่รู้จักประเภท', 404); return p; };

async function guardPerson(req, kind, body, id) {
  const d = deptOf(req);
  if (d === null) return;
  if (kind === 'teachers') {
    if (body) body.department = d;
    if (id && (await q(db.from(kind).select('department').eq('id', id).single())).department !== d) throw bad('ไม่มีสิทธิ์แก้ไขครูของแผนกอื่น', 403);
  } else {
    if (body && (body.group_id || !id)) await assertGroup(req, body.group_id);
    if (id) await assertGroup(req, (await q(db.from(kind).select('group_id').eq('id', id).single())).group_id);
  }
}

async function createPerson(kind, body) {
  const p = PEOPLE[kind];
  const code = String(body[p.code] || '').trim();
  if (!code || !body.full_name) throw bad('กรุณากรอกรหัสและชื่อ-สกุล');
  const user = await q(db.from('users').insert({
    username: `${p.role}:${code}`, full_name: body.full_name, role: p.role, password_hash: hashPassword(crypto.randomUUID()),
  }).select().single());
  try { return await q(db.from(kind).insert({ ...pick(body, p.cols), [p.code]: code, user_id: user.id }).select().single()); }
  catch (e) { await db.from('users').delete().eq('id', user.id); throw e; }
}

app.get('/api/people/:kind', staff, async (req, res) => {
  const p = people(req), d = deptOf(req);
  let qq = db.from(req.params.kind).select('*, user:users(full_name)').order(p.code);
  if (d !== null) qq = req.params.kind === 'teachers' ? qq.eq('department', d) : qq.in('group_id', await myGroupIds(req));
  res.json((await q(qq)).map(({ user, ...r }) => ({ ...r, full_name: user?.full_name })));
});
app.post('/api/people/:kind', staff, async (req, res) => {
  people(req);
  const body = { ...req.body };
  await guardPerson(req, req.params.kind, body);
  res.json(await createPerson(req.params.kind, body));
});
app.put('/api/people/:kind/:id', staff, async (req, res) => {
  const p = people(req), body = pick(req.body, p.cols.filter(c => c !== p.code));
  await guardPerson(req, req.params.kind, body, req.params.id);
  const row = await q(db.from(req.params.kind).update(body).eq('id', req.params.id).select().single());
  if (req.body.full_name) await q(db.from('users').update({ full_name: req.body.full_name }).eq('id', row.user_id));
  res.json(row);
});
app.delete('/api/people/:kind/:id', staff, async (req, res) => {
  people(req);
  await guardPerson(req, req.params.kind, null, req.params.id);
  const row = await q(db.from(req.params.kind).select('user_id').eq('id', req.params.id).single());
  await q(db.from('users').delete().eq('id', row.user_id)); // cascade ลบโปรไฟล์
  await log(req.user.sub, 'data_delete', { table: req.params.kind, id: req.params.id }, req.ip);
  res.json({ ok: true });
});

// นำเข้านักเรียนจาก CSV: student_code,full_name,group_code
app.post('/api/students/import', staff, async (req, res) => {
  const groups = Object.fromEntries((await q(db.from('student_groups').select('id,code'))).map(g => [g.code, g.id]));
  const result = { ok: 0, errors: [] };
  for (const [i, r] of (req.body.rows || []).entries()) {
    try {
      if (!groups[r.group_code]) throw bad(`ไม่พบกลุ่มเรียน ${r.group_code || '(ว่าง)'}`);
      const body = { ...r, group_id: groups[r.group_code] };
      await guardPerson(req, 'students', body);
      await createPerson('students', body);
      result.ok++;
    } catch (e) { result.errors.push(`แถว ${i + 1} (${r.student_code || '-'}): ${e.message}`); }
  }
  await log(req.user.sub, 'students_import', { ok: result.ok, errors: result.errors.length }, req.ip);
  res.json(result);
});

// ======================= ตารางสอน: เวอร์ชัน / AI / โหมดมือ =======================
async function loadCtx() {
  const [teachers, rooms, groups, subjects, periods] = await Promise.all([
    q(db.from('teachers').select('id,max_hours,unavailable')), q(db.from('classrooms').select('*')),
    q(db.from('student_groups').select('*')), q(db.from('subjects').select('*')), q(db.from('periods').select('*')),
  ]);
  const byId = a => Object.fromEntries(a.map(x => [x.id, x]));
  return { teachers: byId(teachers), rooms: byId(rooms), roomList: rooms, groups: byId(groups), subjects: byId(subjects), periods };
}

async function insertEntries(versionId, entries) {
  for (let i = 0; i < entries.length; i += 500)
    await q(db.from('timetable').insert(entries.slice(i, i + 500).map(({ id, version_id, ...e }) => ({ ...e, version_id: versionId }))));
}
const newVersion = (req, name, status = 'draft') => q(db.from('timetable_versions').insert({ name, status, created_by: req.user.sub }).select().single());
const entriesOf = versionId => q(db.from('timetable').select('*').eq('version_id', versionId));

// ฝ่ายวิชาการเห็นเฉพาะฉบับที่ประกาศแล้ว และฉบับร่างที่ตัวเองสร้าง
const canView = (req, v) => deptOf(req) === null || v.status === 'published' || v.created_by === req.user.sub;
async function versionFor(req, id) {
  const v = await q(db.from('timetable_versions').select('*').eq('id', id).single());
  if (!canView(req, v)) throw bad('ไม่มีสิทธิ์เข้าถึงตารางฉบับนี้', 403);
  return v;
}

app.get('/api/versions', staff, async (req, res) => {
  res.json((await q(db.from('timetable_versions').select('*').order('created_at', { ascending: false }))).filter(v => canView(req, v)));
});

app.post('/api/versions/generate', staff, async (req, res) => {
  const d = deptOf(req), ids = await myGroupIds(req);
  const ctx = await loadCtx();
  let offerings = await q(db.from('offerings').select('*'));
  const periods = await q(db.from('periods').select('day,period_no,start_time,end_time'));
  let fixed = [];
  if (ids) {
    offerings = offerings.filter(o => ids.includes(o.group_id));
    // ตั้งต้นจากตารางที่เลือก (หรือที่ประกาศอยู่) แล้วล็อกคาบของแผนกอื่นไว้
    const base = req.body.base_version_id ? await versionFor(req, req.body.base_version_id) : await publishedVersion();
    if (base) fixed = (await entriesOf(base.id)).filter(e => !ids.includes(e.group_id));
  }
  if (!offerings.length || !periods.length || !ctx.roomList.length) throw bad('ต้องมีข้อมูล แผนการสอน, คาบเรียน และห้องเรียน ก่อนสั่ง AI จัดตาราง');
  const t0 = Date.now();
  const { entries, unplaced } = generateSchedule({ offerings, periods, rooms: ctx.roomList, subjects: ctx.subjects, groups: ctx.groups, teachers: ctx.teachers, fixed });
  const v = await newVersion(req, req.body.name || `AI ${d ? `แผนก${d} ` : ''}${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}`);
  await insertEntries(v.id, [...fixed, ...entries]);
  await log(req.user.sub, 'ai_generate', { version: v.id, dept: d, entries: entries.length, unplaced: unplaced.length, ms: Date.now() - t0, viewAs: req.user.viewAs }, req.ip);
  res.json({ version: v, placed: entries.length, unplaced, ms: Date.now() - t0 });
});

// Snapshot = จุดกู้คืน: คัดลอกเวอร์ชันเดิมเป็นฉบับร่างใหม่
app.post('/api/versions/:id/snapshot', staff, async (req, res) => {
  const src = await versionFor(req, req.params.id);
  const v = await newVersion(req, req.body.name || `สำเนา: ${src.name}`);
  await insertEntries(v.id, await entriesOf(src.id));
  await log(req.user.sub, 'snapshot', { from: src.id, to: v.id }, req.ip);
  res.json(v);
});

app.post('/api/versions/:id/publish', staff, async (req, res) => {
  const src = await versionFor(req, req.params.id);
  const ids = await myGroupIds(req);
  let entries = await entriesOf(src.id);
  let target = src;
  if (ids) {
    // ฝ่ายวิชาการแผนก: นำเฉพาะคาบของแผนกตัวเองไปรวมกับตารางที่ประกาศอยู่ ไม่ทับงานของแผนกอื่น
    const pub = await publishedVersion();
    const others = pub ? (await entriesOf(pub.id)).filter(e => !ids.includes(e.group_id)) : [];
    entries = [...others, ...entries.filter(e => ids.includes(e.group_id))];
  }
  const conflicts = findConflicts(entries.map((e, i) => ({ ...e, id: e.id || i })), await loadCtx());
  if (conflicts.size && !req.body.force) throw bad(`ยังมีคาบที่ชนกัน ${conflicts.size} รายการ แก้ไขก่อนประกาศใช้`, 409);
  if (ids) { target = await newVersion(req, `ประกาศ: ${src.name}`); await insertEntries(target.id, entries); }
  await q(db.from('timetable_versions').update({ status: 'archived' }).eq('status', 'published'));
  await q(db.from('timetable_versions').update({ status: 'published' }).eq('id', target.id));
  await log(req.user.sub, 'publish', { version: target.id, from: src.id, dept: deptOf(req), viewAs: req.user.viewAs }, req.ip);
  res.json({ ok: true, version: target });
});

app.delete('/api/versions/:id', staff, async (req, res) => {
  const v = await versionFor(req, req.params.id);
  if (v.status === 'published') throw bad('ลบตารางที่ประกาศใช้อยู่ไม่ได้');
  if (deptOf(req) !== null && v.created_by !== req.user.sub) throw bad('ลบได้เฉพาะฉบับร่างที่ตัวเองสร้าง', 403);
  await q(db.from('timetable_versions').delete().eq('id', v.id));
  res.json({ ok: true });
});

app.get('/api/versions/:id/entries', staff, async (req, res) => {
  res.json(await entriesOf((await versionFor(req, req.params.id)).id));
});

const ENTRY_COLS = ['day', 'period_no', 'subject_id', 'teacher_id', 'group_id', 'room_id'];
async function editable(req, versionId, groupId) {
  const v = await versionFor(req, versionId);
  if (v.status === 'published') throw bad('ตารางที่ประกาศแล้วแก้ไม่ได้ กรุณาสร้างสำเนา (Snapshot) แล้วแก้ในฉบับร่าง');
  await assertGroup(req, groupId);
}
app.post('/api/entries', staff, async (req, res) => {
  await editable(req, req.body.version_id, req.body.group_id);
  res.json(await q(db.from('timetable').insert({ ...pick(req.body, ENTRY_COLS), version_id: req.body.version_id }).select().single()));
});
app.put('/api/entries/:id', staff, async (req, res) => {
  const e = await q(db.from('timetable').select('version_id,group_id').eq('id', req.params.id).single());
  await editable(req, e.version_id, e.group_id);
  res.json(await q(db.from('timetable').update(pick(req.body, ['day', 'period_no', 'room_id'])).eq('id', req.params.id).select().single()));
});
app.delete('/api/entries/:id', staff, async (req, res) => {
  const e = await q(db.from('timetable').select('version_id,group_id').eq('id', req.params.id).single());
  await editable(req, e.version_id, e.group_id);
  await q(db.from('timetable').delete().eq('id', req.params.id));
  res.json({ ok: true });
});

// ส่งออก Excel (CSV UTF-8 BOM เปิดใน Excel ได้ภาษาไทยถูก) — PDF ใช้ปุ่มพิมพ์ในหน้าเว็บ (Save as PDF)
app.get('/api/versions/:id/export.csv', staff, async (req, res) => {
  const v = await versionFor(req, req.params.id);
  const ids = await myGroupIds(req);
  const [all, ctx, periods, teachers] = await Promise.all([
    entriesOf(v.id), loadCtx(), q(db.from('periods').select('*')), q(db.from('teachers').select('id, user:users(full_name)')),
  ]);
  const entries = ids ? all.filter(e => ids.includes(e.group_id)) : all;
  const tName = Object.fromEntries(teachers.map(t => [t.id, t.user?.full_name]));
  const time = Object.fromEntries(periods.map(p => [`${p.day}|${p.period_no}`, `${p.start_time.slice(0, 5)}-${p.end_time.slice(0, 5)}`]));
  const rows = entries.sort((a, b) => a.day - b.day || a.period_no - b.period_no).map(e => ({
    'วัน': DAYS[e.day], 'คาบ': e.period_no, 'เวลา': time[`${e.day}|${e.period_no}`] || '',
    'กลุ่มเรียน': ctx.groups[e.group_id]?.code, 'แผนก': ctx.groups[e.group_id]?.department,
    'รหัสวิชา': ctx.subjects[e.subject_id]?.code, 'ชื่อวิชา': ctx.subjects[e.subject_id]?.name,
    'ครูผู้สอน': tName[e.teacher_id], 'ห้อง': ctx.rooms[e.room_id]?.code, 'อาคาร': ctx.rooms[e.room_id]?.building,
  }));
  await log(req.user.sub, 'export', { version: v.id, format: 'csv' }, req.ip);
  res.attachment('timetable.csv').type('text/csv; charset=utf-8').send(toCsv(rows));
});

// ======================= แอดมิน: สำรองข้อมูล / Logs =======================
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

// บน Vercel ไม่ต้อง listen (Vercel เรียก app ผ่าน index.js ที่ราก)
if (!process.env.VERCEL) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`PTC Smart Schedule พร้อมใช้งานที่ http://localhost:${port}`));
}
export default app;
