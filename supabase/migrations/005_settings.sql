-- ค่าตั้งระบบที่แอดมินแก้ได้ เช่น คาบสูงสุดต่อสัปดาห์ (รันใน Supabase > SQL Editor ครั้งเดียว)
create table if not exists settings (key text primary key, value jsonb not null);
alter table settings enable row level security;
insert into settings (key, value) values ('weekly_max', '12') on conflict (key) do nothing;
