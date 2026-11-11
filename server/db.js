import { createClient } from '@supabase/supabase-js';

try { process.loadEnvFile(); } catch { /* บน Render/Railway ใช้ env ของแพลตฟอร์มแทน .env */ }

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
  throw new Error('กรุณาตั้งค่า SUPABASE_URL และ SUPABASE_SERVICE_ROLE_KEY ในไฟล์ .env');

// ตัด path ที่วางเกินมา (เช่น /rest/v1/ หรือ / ท้าย URL) เหลือแค่ https://xxxx.supabase.co
const url = new URL(process.env.SUPABASE_URL.trim());
if (url.hostname === 'supabase.com') throw new Error('SUPABASE_URL ผิด: ใช้ Project URL (https://xxxx.supabase.co) ไม่ใช่ลิงก์หน้า Dashboard');

// service_role key ใช้ฝั่ง server เท่านั้น ห้ามส่งไปเบราว์เซอร์
export const db = createClient(url.origin, process.env.SUPABASE_SERVICE_ROLE_KEY.trim(), {
  auth: { persistSession: false },
});

export async function log(user_id, action, detail = null, ip = null) {
  await db.from('logs').insert({ user_id: user_id || null, action, detail, ip });
}

// โยน error ของ Supabase ออกมา เพื่อให้ express ตอบ 500/400
export async function q(promise) {
  const { data, error } = await promise;
  if (error) { const e = new Error(error.message); e.status = 400; throw e; }
  return data;
}
