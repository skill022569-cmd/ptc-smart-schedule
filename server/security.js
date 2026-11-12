import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import { db, log } from './db.js';

const need = k => { if (!process.env[k]) throw new Error(`ยังไม่ได้ตั้งค่า ${k} ใน .env`); return process.env[k]; };
const JWT_SECRET = () => need('JWT_SECRET');
const ENC_KEY = () => Buffer.from(need('DATA_ENCRYPTION_KEY'), 'hex'); // 32 bytes = 64 ตัวอักษร hex

// ---------- รหัสผ่าน (scrypt) ----------
export function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  return `${salt.toString('hex')}:${crypto.scryptSync(pw, salt, 64).toString('hex')}`;
}
export function verifyPassword(pw, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const a = crypto.scryptSync(pw, Buffer.from(salt, 'hex'), 64);
  return crypto.timingSafeEqual(a, Buffer.from(hash, 'hex'));
}

// ---------- เข้ารหัสข้อมูลส่วนบุคคล AES-256-GCM ----------
export function encrypt(text) {
  if (!text) return null;
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', ENC_KEY(), iv);
  const data = Buffer.concat([c.update(String(text), 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), data].map(b => b.toString('base64')).join('.');
}
export function decrypt(blob) {
  if (!blob) return null;
  const [iv, tag, data] = blob.split('.').map(s => Buffer.from(s, 'base64'));
  const d = crypto.createDecipheriv('aes-256-gcm', ENC_KEY(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(data), d.final()]).toString('utf8');
}
// Data masking: 0812345612 -> 08X-XXX-XX12
export const maskEmail = e => (e ? e.replace(/^(.).*(@.*)$/, '$1***$2') : '');

// ---------- JWT ใน httpOnly cookie ----------
export const COOKIE = 'ptc_token';
export function setSession(res, user) {
  const token = jwt.sign({ sub: user.id, role: user.role, name: user.full_name, dept: user.department }, JWT_SECRET(), { expiresIn: '8h' });
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', maxAge: 8 * 3600e3 });
}
export const signTemp = (userId, purpose, extra = {}) => jwt.sign({ ...extra, sub: userId, purpose }, JWT_SECRET(), { expiresIn: '10m' });
export function tempPayload(token, purpose) {
  const p = jwt.verify(token, JWT_SECRET());
  if (p.purpose !== purpose) throw new Error('bad token');
  return p;
}
export const verifyTemp = (token, purpose) => tempPayload(token, purpose).sub;

function readCookie(req, name) {
  const m = (req.headers.cookie || '').split(/;\s*/).find(c => c.startsWith(name + '='));
  return m && decodeURIComponent(m.slice(name.length + 1));
}

export function auth(...roles) {
  return (req, res, next) => {
    try {
      req.user = jwt.verify(readCookie(req, COOKIE), JWT_SECRET());
      if (req.user.purpose) throw new Error('temp token');
    } catch { return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ' }); }
    // ปุ่ม "มุมมอง" ของแอดมิน: จำลองเป็นฝ่ายวิชาการแผนกนั้นจริง ๆ ทั้งสิทธิ์และขอบเขตข้อมูล
    const viewAs = req.headers['x-view-as-dept'] || req.query?.viewAs; // query ใช้กับลิงก์ดาวน์โหลด
    if (viewAs && req.user.role === 'admin') req.user = { ...req.user, role: 'dept', dept: decodeURIComponent(viewAs), viewAs: true };
    if (roles.length && !roles.includes(req.user.role)) return res.status(403).json({ error: 'ไม่มีสิทธิ์เข้าถึง' });
    next();
  };
}

// ---------- Brute force: ผิดเกิน 5 ครั้ง ล็อก 15 นาที ----------
export const MAX_FAILS = 5;
export const LOCK_MIN = 15;
export async function registerFail(user, ip) {
  const fails = user.failed_attempts + 1;
  const locked = fails >= MAX_FAILS;
  await db.from('users').update({
    failed_attempts: locked ? 0 : fails,
    locked_until: locked ? new Date(Date.now() + LOCK_MIN * 60e3).toISOString() : user.locked_until,
  }).eq('id', user.id);
  await log(user.id, locked ? 'account_locked' : 'login_failed', { fails }, ip);
  if (locked) await sendMail(decrypt(user.email_enc), 'แจ้งเตือน: บัญชีถูกล็อกชั่วคราว', `บัญชี ${user.username} ในระบบตารางเรียน-ตารางสอน วิทยาลัยการอาชีพโพนทอง ถูกล็อก ${LOCK_MIN} นาที เนื่องจากใส่รหัสผ่านผิดหลายครั้ง หากไม่ใช่คุณ โปรดแจ้งผู้ดูแลระบบ`, user.id).catch(() => {});
  return locked;
}
export const isLocked = u => u.locked_until && new Date(u.locked_until) > new Date();

// ---------- OTP 6 หลัก ----------
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
// ส่งไปอีเมลของบัญชี หรืออีเมลใหม่ที่กำลังขอเปลี่ยน (to)
export async function issueOtp(user, purpose, to = decrypt(user.email_enc)) {
  const otp = String(crypto.randomInt(0, 1e6)).padStart(6, '0');
  await db.from('users').update({ otp_hash: sha(otp + user.id), otp_expires: new Date(Date.now() + 5 * 60e3).toISOString(), otp_attempts: 0 }).eq('id', user.id);
  await sendMail(to, `รหัส OTP (${purpose}) ระบบตารางเรียน วก.โพนทอง`,
    `รหัส OTP (${purpose}) PTC Smart Schedule: ${otp} ใช้ได้ 5 นาที ห้ามบอกผู้อื่น\n\nหากคุณไม่ได้ทำรายการนี้ โปรดเพิกเฉยต่ออีเมลนี้`, user.id);
}
export async function checkOtp(userId, otp) {
  const { data: u } = await db.from('users').select('*').eq('id', userId).single();
  if (!u?.otp_hash || new Date(u.otp_expires) < new Date() || u.otp_attempts >= 5) return null;
  if (sha(String(otp) + u.id) !== u.otp_hash) {
    await db.from('users').update({ otp_attempts: u.otp_attempts + 1 }).eq('id', u.id);
    return null;
  }
  await db.from('users').update({ otp_hash: null, otp_expires: null, failed_attempts: 0, locked_until: null }).eq('id', u.id);
  return u;
}

// ---------- อีเมล (รับ OTP) ----------
export function validEmail(v) {
  const e = String(v || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw Object.assign(new Error('รูปแบบอีเมลไม่ถูกต้อง'), { status: 400 });
  return e;
}

// ส่งอีเมลผ่าน SMTP (เช่น Google Workspace ของวิทยาลัย) — ยังไม่ตั้งค่า = โหมดทดสอบ แสดงใน log ของเซิร์ฟเวอร์
let transport;
export async function sendMail(to, subject, text, userId) {
  if (!to) return;
  const { SMTP_HOST, SMTP_PORT = '465', SMTP_USER, SMTP_PASS, MAIL_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.log(`[MAIL-DEV] to ${maskEmail(to)}: ${text}`); // ห้ามใช้บน production
    return log(userId, 'mail_dev', { to: maskEmail(to) });
  }
  transport ||= nodemailer.createTransport({ host: SMTP_HOST, port: +SMTP_PORT, secure: +SMTP_PORT === 465, auth: { user: SMTP_USER, pass: SMTP_PASS } });
  try {
    await transport.sendMail({ from: MAIL_FROM || `ระบบตารางเรียน วก.โพนทอง <${SMTP_USER}>`, to, subject, text });
    await log(userId, 'mail_sent', { to: maskEmail(to) });
  } catch (e) {
    await log(userId, 'mail_failed', { to: maskEmail(to), error: String(e.message).slice(0, 200) });
    throw Object.assign(new Error('ส่งอีเมลไม่สำเร็จ กรุณาลองใหม่ หรือแจ้งผู้ดูแลระบบให้ตรวจการตั้งค่าอีเมล (SMTP)'), { status: 502 });
  }
}
