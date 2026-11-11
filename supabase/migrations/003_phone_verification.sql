-- ยืนยันเบอร์โทรด้วย OTP ตอนสมัครบัญชี (รันใน Supabase > SQL Editor ครั้งเดียว)
alter table users add column if not exists phone_verified_at timestamptz;
-- แอดมินเดิมถือว่ายืนยันแล้ว ไม่ให้ถูกล็อกออกจากระบบ
update users set phone_verified_at = now() where role = 'admin' and phone_verified_at is null;
