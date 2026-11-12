-- หน้าที่พิเศษของครู และคาบนอกเวลา (รันใน Supabase > SQL Editor ครั้งเดียว)
alter table teachers add column if not exists special_duty text;            -- เช่น หัวหน้างานทะเบียน, ครูเวร
alter table periods add column if not exists overtime boolean not null default false; -- true = คาบนอกเวลา
-- คาบนอกเวลา 9-11 (17:00-20:00 น.) จันทร์-ศุกร์ — ถ้ามีคาบเลขเดียวกันอยู่แล้วจะข้ามไป
insert into periods (day, period_no, start_time, end_time, overtime)
select d, p.n, p.s::time, p.e::time, true
from generate_series(1, 5) d, (values (9, '17:00', '18:00'), (10, '18:00', '19:00'), (11, '19:00', '20:00')) as p(n, s, e)
on conflict (day, period_no) do nothing;
