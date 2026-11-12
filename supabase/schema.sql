-- PTC Smart Schedule : โครงสร้างฐานข้อมูล (รันใน Supabase > SQL Editor ครั้งเดียว)
-- ทุกตารางเปิด RLS และไม่มี policy => เข้าถึงได้เฉพาะ server ที่ใช้ service_role key เท่านั้น
-- (anon key จากฝั่งเบราว์เซอร์อ่าน/เขียนอะไรไม่ได้เลย)

create extension if not exists pgcrypto;

-- ผู้ใช้งานทุกบทบาท
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,              -- รหัสนักเรียน / รหัสพนักงาน
  password_hash text not null,                -- scrypt
  full_name text not null,
  role text not null check (role in ('admin','dept','teacher','student')), -- เข้าระบบได้เฉพาะ admin และ dept (ฝ่ายวิชาการแผนก)
  department text,                            -- แผนกของบัญชี dept
  phone_enc text,                             -- เบอร์โทร เข้ารหัส AES-256-GCM
  email_enc text,
  phone_verified_at timestamptz,              -- ยืนยันเบอร์ด้วย OTP แล้ว (ยังไม่ยืนยัน = ล็อกอินไม่ได้)
  pdpa_consent_at timestamptz,
  failed_attempts int not null default 0,
  locked_until timestamptz,
  otp_hash text,
  otp_expires timestamptz,
  otp_attempts int not null default 0,
  created_at timestamptz not null default now()
);

-- กลุ่มเรียน (ปวช./ปวส. แยกแผนก)
create table if not exists student_groups (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,                  -- เช่น ชย.1/1
  department text not null,                   -- ช่างยนต์, ไฟฟ้ากำลัง, การบัญชี ...
  level text not null check (level in ('ปวช.','ปวส.')),
  year int not null check (year between 1 and 3),
  size int not null default 30,
  program text not null default 'ปกติ',       -- ปกติ / ทวิภาคี
  advisor text                                -- ครูที่ปรึกษา
);

create table if not exists teachers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references users(id) on delete cascade,
  employee_code text unique not null,
  department text,
  special_duty text,                          -- หน้าที่พิเศษ
  max_hours int not null default 12,          -- คาบสูงสุด/สัปดาห์ (ไม่เกิน 12)
  unavailable jsonb not null default '[]'     -- [{ "day":1, "period":3 }, ...]
);

create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references users(id) on delete cascade,
  student_code text unique not null,
  group_id uuid references student_groups(id) on delete set null,
  special_needs text                          -- เงื่อนไขพิเศษ (เช่น เรียนคู่ขนาน)
);

create table if not exists subjects (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  credits int not null default 2,
  periods_per_week int not null default 2,
  type text not null default 'theory' check (type in ('theory','practice'))
);

create table if not exists classrooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  building text,
  room_type text not null default 'lecture' check (room_type in ('lecture','lab','workshop')),
  capacity int not null default 40
);

-- คาบเรียน: day 1=จันทร์ ... 7=อาทิตย์
create table if not exists periods (
  id uuid primary key default gen_random_uuid(),
  day int not null check (day between 1 and 7),
  period_no int not null,
  start_time time not null,
  end_time time not null,
  overtime boolean not null default false,    -- true = คาบนอกเวลา
  unique (day, period_no)
);

-- แผนการสอน: กลุ่มไหน เรียนวิชาอะไร กับครูคนไหน (Input ของ AI)
create table if not exists offerings (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references student_groups(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  teacher_id uuid not null references teachers(id) on delete cascade,
  unique (group_id, subject_id)
);

-- เวอร์ชันตาราง (Restore Point / Snapshot)
create table if not exists timetable_versions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists timetable (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references timetable_versions(id) on delete cascade,
  day int not null,
  period_no int not null,
  subject_id uuid not null references subjects(id) on delete cascade,
  teacher_id uuid not null references teachers(id) on delete cascade,
  room_id uuid references classrooms(id) on delete set null,
  group_id uuid not null references student_groups(id) on delete cascade
);
create index if not exists timetable_version_idx on timetable(version_id);

-- คำร้องขอบล็อกเวลา (ครู -> ฝ่ายวิชาการ)
create table if not exists time_block_requests (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teachers(id) on delete cascade,
  day int not null,
  period_from int not null,
  period_to int not null,
  reason text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);

-- ค่าตั้งระบบที่แอดมินแก้ได้ (เช่น weekly_max = คาบสูงสุดต่อสัปดาห์ของครูและกลุ่มเรียน)
create table if not exists settings (key text primary key, value jsonb not null);
insert into settings (key, value) values ('weekly_max', '12') on conflict (key) do nothing;

create table if not exists logs (
  id bigint generated always as identity primary key,
  user_id uuid references users(id) on delete set null,
  action text not null,                       -- login_ok, login_failed, account_locked, sms_sent, backup, pdpa_export ...
  detail jsonb,
  ip text,
  created_at timestamptz not null default now()
);
create index if not exists logs_created_idx on logs(created_at desc);

do $$ declare t text; begin
  foreach t in array array['users','student_groups','teachers','students','subjects','classrooms','periods',
                           'offerings','timetable_versions','timetable','time_block_requests','logs','settings'] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- ที่เก็บไฟล์สำรองข้อมูล (private)
insert into storage.buckets (id, name, public) values ('backups','backups', false)
on conflict (id) do nothing;
