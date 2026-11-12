-- ครูที่ปรึกษาของกลุ่มเรียน (แสดงบนหัวฟอร์มตารางเรียน) — รันใน Supabase > SQL Editor ครั้งเดียว
alter table student_groups add column if not exists advisor text;
