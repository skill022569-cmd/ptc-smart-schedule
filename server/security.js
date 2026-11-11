import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
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
export const maskPhone = p => (p && p.length >= 4 ? `${p.slice(0, 2)}X-XXX-XX${p.slice(-2)}` : '');
export const maskEmail = e => (e ? e.replace(/^(.).*(@.*)$/, '$1***$2') : '');

// ---------- JWT ใน httpOnly cookie ----------
export const COOKIE = 'ptc_token';
export function setSession(res, user) {
  const token = jwt.sign({ sub: user.id, role: user.role, name: user.full_name, dept: user.department }, JWT_SECRET(), { expiresIn: '8h' });
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', maxAge: 8 * 3600e3 });
}
export const signTemp = (userId, purpose) => jwt.sign({ sub: userId, purpose }, JWT_SECRET(), { expiresIn: '5m' });
export function verifyTemp(token, purpose) {
  const p = jwt.verify(token, JWT_SECRET());
  if (p.purpose !== purpose) throw new Error('bad token');
  return p.sub;
}

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
  if (locked) await sendSms(decrypt(user.phone_enc), `PTC Smart Schedule: บัญชีของคุณถูกล็อก ${LOCK_MIN} นาที เนื่องจากใส่รหัสผ่านผิดหลายครั้ง`, user.id);
  return locked;
}
export const isLocked = u => u.locked_until && new Date(u.locked_until) > new Date();

// ---------- OTP 6 หลัก ----------
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
export async function issueOtp(user, purpose) {
  const otp = String(crypto.randomInt(0, 1e6)).padStart(6, '0');
  await db.from('users').update({ otp_hash: sha(otp + user.id), otp_expires: new Date(Date.now() + 5 * 60e3).toISOString(), otp_attempts: 0 }).eq('id', user.id);
  await sendSms(decrypt(user.phone_enc), `รหัส OTP (${purpose}) PTC Smart Schedule: ${otp} ใช้ได้ 5 นาที ห้ามบอกผู้อื่น`, user.id);
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

// ---------- SMS Gateway (ThaiBulkSMS API v2) ----------
export async function sendSms(phone, message, userId) {
  if (!phone) return;
  const { THAIBULKSMS_API_KEY: key, THAIBULKSMS_API_SECRET: secret, THAIBULKSMS_SENDER: sender } = process.env;
  if (!key || !secret) {
    // โหมดทดสอบ: ยังไม่มีบัญชี SMS ให้ดู OTP ใน log ของเซิร์ฟเวอร์ (ห้ามใช้บน production)
    console.log(`[SMS-DEV] to ${maskPhone(phone)}: ${message}`);
    return log(userId, 'sms_dev', { to: maskPhone(phone) });
  }
  const r = await fetch('https://api-v2.thaibulksms.com/sms', {
    method: 'POST',
    headers: { Authorization: 'Basic ' + Buffer.from(`${key}:${secret}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ msisdn: phone, message, sender: sender || 'SMS' }),
  });
  await log(userId, r.ok ? 'sms_sent' : 'sms_failed', { to: maskPhone(phone), status: r.status });
}
