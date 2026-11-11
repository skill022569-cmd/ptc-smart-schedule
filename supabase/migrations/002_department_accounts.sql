-- อัปเดตจากเวอร์ชันแรก: เพิ่มบัญชี "ฝ่ายวิชาการแผนก" (รันใน Supabase > SQL Editor ครั้งเดียว)
alter table users add column if not exists department text;
alter table users drop constraint if exists users_role_check;
alter table users add constraint users_role_check check (role in ('admin','dept','teacher','student'));
