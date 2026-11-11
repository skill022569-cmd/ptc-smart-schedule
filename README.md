# 📅 PTC Smart Schedule

ระบบจัดตารางเรียน-ตารางสอนอัตโนมัติ **วิทยาลัยการอาชีพโพนทอง** (Phon Thong Industrial and Community Education College)
รองรับระดับ ปวช. / ปวส. ทั้งภาคปกติและทวิภาคี

**เทคโนโลยี:** Node.js 22 + Express (Backend) · HTML/CSS/JavaScript (Frontend ไม่ต้อง build) · Supabase (PostgreSQL) · GitHub (เก็บโค้ด + CI + สำรองข้อมูลอัตโนมัติ) · Vercel (โฮสต์เว็บ)

---

## สารบัญ
1. [ความสามารถของระบบ](#1-ความสามารถของระบบ)
2. [โครงสร้างโปรเจกต์](#2-โครงสร้างโปรเจกต์)
3. [สิ่งที่ต้องเตรียม](#3-สิ่งที่ต้องเตรียม)
4. [ขั้นที่ 1 สร้างฐานข้อมูล Supabase](#ขั้นที่-1-สร้างฐานข้อมูล-supabase)
5. [ขั้นที่ 2 ติดตั้งและรันบนเครื่องตัวเอง](#ขั้นที่-2-ติดตั้งและรันบนเครื่องตัวเอง)
6. [ขั้นที่ 3 อัปโหลดโค้ดขึ้น GitHub](#ขั้นที่-3-อัปโหลดโค้ดขึ้น-github)
7. [ขั้นที่ 4 ตั้งค่าสำรองข้อมูลอัตโนมัติ (GitHub Actions)](#ขั้นที่-4-ตั้งค่าสำรองข้อมูลอัตโนมัติ-github-actions)
8. [ขั้นที่ 5 นำขึ้นออนไลน์ (Deploy บน Vercel)](#ขั้นที่-5-นำขึ้นออนไลน์-deploy-บน-vercel)
9. [ขั้นที่ 6 เชื่อมต่อ SMS (ThaiBulkSMS)](#ขั้นที่-6-เชื่อมต่อ-sms-thaibulksms)
10. [ขั้นตอนการใช้งานของฝ่ายวิชาการ](#ขั้นตอนการใช้งานของฝ่ายวิชาการ)
11. [ความปลอดภัยและ PDPA](#ความปลอดภัยและ-pdpa)
12. [การกู้คืนข้อมูล](#การกู้คืนข้อมูล)
13. [แก้ปัญหาที่พบบ่อย](#แก้ปัญหาที่พบบ่อย)

---

## 1. ความสามารถของระบบ

| องค์ประกอบ | สิ่งที่ระบบทำ |
|---|---|
| **Input** | รายวิชา (หน่วยกิต, คาบ/สัปดาห์, ทฤษฎี/ปฏิบัติ) · ครู (เวลาไม่สะดวก, คาบสอนสูงสุด) · ห้องเรียน/Lab/โรงฝึกงาน (ความจุ) · คาบเรียน (จ.-ศ. หรือ ส.-อา. ทวิภาคี) · กลุ่มเรียน/นักเรียน (นำเข้า CSV) · แผนการสอน (กลุ่ม-วิชา-ครู) |
| **Process** | 🤖 AI จัดตารางอัตโนมัติ (Constraint Solver: ครู/ห้อง/กลุ่มไม่ชน, ห้องตรงประเภทวิชา, ความจุพอ, เคารพเวลาไม่สะดวก, วิชาปฏิบัติเรียนต่อเนื่อง) · ✋ โหมดมือ ลากวาง + แจ้งเตือนสีแดงเมื่อชน (Live Conflict Detection) · Snapshot/Undo |
| **Output** | ตารางรวมแยกตาม กลุ่มเรียน / ครู / ห้อง · ตารางรายบุคคลของครูและนักเรียน (มือถือ 100%) · Export Excel และ PDF · ประกาศใช้ |
| **Security** | ล็อกอินแยกบทบาท · 2FA OTP ทาง SMS · ล็อกบัญชี 15 นาที เมื่อผิด 5 ครั้ง · JWT ใน httpOnly cookie · เข้ารหัสเบอร์โทร/อีเมล AES-256-GCM · Data Masking (08X-XXX-XX12) · PDPA Consent / ขอสำเนา / ขอลบข้อมูล · System Logs · สำรองข้อมูลทุกวัน 02:00 น. |

**ผู้ใช้ 3 กลุ่ม**
- **ฝ่ายวิชาการ (admin):** แผงควบคุม, จัดการข้อมูลหลัก, จัดตาราง AI/มือ, อนุมัติคำร้อง, สำรองข้อมูล, ดู Logs
- **ครู (teacher):** ตารางสอนของฉัน, แจ้งเวลาไม่สะดวก, รายชื่อนักเรียน, ข้อมูลส่วนตัว & PDPA
- **นักเรียน (student):** ตารางเรียนของฉัน + รายละเอียดคาบ, ข้อมูลส่วนตัว & PDPA

---

## 2. โครงสร้างโปรเจกต์

```
ptc-smart-schedule/
├── server/
│   ├── index.js         # Express API ทั้งหมด (auth, admin, teacher, student)
│   ├── security.js      # รหัสผ่าน scrypt, JWT, OTP, SMS, AES, masking, brute-force
│   ├── scheduler.js     # AI Scheduling Engine
│   ├── backup.js        # ส่งออก .sql / .csv และอัปโหลดขึ้น Storage
│   └── db.js            # เชื่อมต่อ Supabase
├── public/              # หน้าเว็บ (index.html = login, app.html = ระบบหลัก)
│   └── shared/conflicts.js  # ตัวตรวจคาบชน (ใช้ทั้ง server และเบราว์เซอร์)
├── supabase/schema.sql  # โครงสร้างฐานข้อมูล
├── scripts/seed.js      # สร้าง admin + ข้อมูลตัวอย่าง
├── scripts/backup.js    # สคริปต์สำรองข้อมูล (GitHub Actions เรียกใช้)
├── test/                # ทดสอบ AI จัดตาราง + ตัวตรวจคาบชน
├── .github/workflows/   # ci.yml (ทดสอบ), backup.yml (สำรอง 02:00 น.), seed.yml (สร้างแอดมินผ่านเว็บ)
└── index.js             # จุดเข้าสำหรับ Vercel
```

**ตารางในฐานข้อมูล:** `users`, `teachers`, `students`, `student_groups`, `subjects`, `classrooms`, `periods`, `offerings` (แผนการสอน), `timetable_versions` (Restore Point), `timetable`, `time_block_requests`, `logs`

---

## 3. สิ่งที่ต้องเตรียม

| รายการ | ใช้ทำอะไร | ลิงก์ |
|---|---|---|
| Node.js **22 ขึ้นไป** | รันระบบ | https://nodejs.org (เลือก LTS) |
| Git | ส่งโค้ดขึ้น GitHub | https://git-scm.com |
| บัญชี GitHub | เก็บโค้ด, CI, สำรองข้อมูลอัตโนมัติ | https://github.com |
| บัญชี Supabase (ฟรี) | ฐานข้อมูล PostgreSQL + Storage | https://supabase.com |
| บัญชี Vercel (ฟรี) | โฮสต์เว็บออนไลน์ | https://vercel.com |
| บัญชี ThaiBulkSMS (ไม่บังคับ) | ส่ง OTP จริง | https://www.thaibulksms.com |
| VS Code (แนะนำ) | แก้ไขโค้ด | https://code.visualstudio.com |

ตรวจสอบเวอร์ชันหลังติดตั้ง (ต้องได้ v22 ขึ้นไป):

```bash
node -v
```

```bash
git --version
```

---

## ขั้นที่ 1 สร้างฐานข้อมูล Supabase

1. เข้า https://supabase.com → **Start your project** → ล็อกอินด้วย GitHub
2. กด **New project**
   - Name: `ptc-smart-schedule`
   - Database Password: ตั้งรหัสที่เดายาก **แล้วจดเก็บไว้**
   - Region: **Southeast Asia (Singapore)** (ใกล้ไทยที่สุด เร็วที่สุด)
   - กด **Create new project** รอประมาณ 2 นาที
3. ไปที่เมนูซ้าย **SQL Editor** → **New query**
4. เปิดไฟล์ `supabase/schema.sql` คัดลอก **ทั้งหมด** ไปวาง → กด **Run** (ต้องขึ้น `Success. No rows returned`)
5. ตรวจสอบ: เมนู **Table Editor** ต้องเห็น 12 ตาราง และเมนู **Storage** ต้องเห็น bucket ชื่อ `backups`
6. ไปที่ **Project Settings → API** (หรือ **Data API / API Keys**) แล้วจดค่า 2 ค่า:
   - **Project URL** เช่น `https://abcdxyz.supabase.co` → ใช้เป็น `SUPABASE_URL`
   - **service_role key** (กด Reveal) → ใช้เป็น `SUPABASE_SERVICE_ROLE_KEY`

> ⚠️ **service_role key เป็นความลับสูงสุด** ห้ามใส่ในโค้ดหน้าเว็บ ห้าม commit ขึ้น GitHub ระบบนี้ใช้คีย์นี้เฉพาะฝั่ง server
> ทุกตารางเปิด Row Level Security ไว้โดยไม่มี policy จึงไม่มีใครอ่านข้อมูลผ่าน anon key ได้

---

## ขั้นที่ 2 ติดตั้งและรันบนเครื่องตัวเอง

**2.1 เข้าไปที่โฟลเดอร์โปรเจกต์** (ถ้าโค้ดอยู่บน GitHub แล้ว ใช้ `git clone https://github.com/<ชื่อบัญชี>/ptc-smart-schedule.git` ก่อน)

```bash
cd ptc-smart-schedule
```

**2.2 ติดตั้งแพ็กเกจ**

```bash
npm install
```

**2.3 สร้างไฟล์ตั้งค่า `.env`** (Windows ใช้ `copy .env.example .env`)

```bash
cp .env.example .env
```

**2.4 สร้างคีย์ลับ** แล้วคัดลอกผลลัพธ์ 2 บรรทัดไปวางใน `.env`

```bash
npm run gen-keys
```

**2.5 แก้ไขไฟล์ `.env`** ให้ครบ:

```ini
SUPABASE_URL=https://abcdxyz.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
JWT_SECRET=(จาก gen-keys)
DATA_ENCRYPTION_KEY=(จาก gen-keys)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=ตั้งรหัสผ่านแอดมินที่แข็งแรง
ADMIN_PHONE=08xxxxxxxx
OTP_REQUIRED=true
```

> ⚠️ **ห้ามเปลี่ยน `DATA_ENCRYPTION_KEY` หลังใช้งานจริง** — เบอร์โทร/อีเมลที่เข้ารหัสไว้จะถอดรหัสไม่ได้ ให้เก็บสำรองคีย์นี้ไว้ในที่ปลอดภัย

**2.6 สร้างผู้ดูแลระบบ + ข้อมูลตัวอย่าง** (ครู 8 คน, 6 กลุ่มเรียน, 11 วิชา, 7 ห้อง, นักเรียน 18 คน)

```bash
npm run seed
```

ถ้าต้องการสร้าง **แค่ admin** (ใช้งานจริง ไม่เอาข้อมูลตัวอย่าง):

```bash
node scripts/seed.js --admin-only
```

**2.7 รันระบบ**

```bash
npm run dev
```

เปิดเบราว์เซอร์ไปที่ **http://localhost:3000**

**2.8 ทดลองเข้าสู่ระบบ**

| บทบาท | เลือกปุ่ม | รหัสผู้ใช้ | รหัสผ่าน |
|---|---|---|---|
| ฝ่ายวิชาการ | ครูผู้สอน / บุคลากร | `admin` | ค่า `ADMIN_PASSWORD` |
| ครู | ครูผู้สอน / บุคลากร | `T001` – `T008` | เหมือนรหัสผู้ใช้ |
| นักเรียน | นักเรียน / นักศึกษา | `68200001` – `68200018` | เหมือนรหัสผู้ใช้ |

> 💡 ถ้ายังไม่ได้ตั้งค่า ThaiBulkSMS รหัส OTP จะแสดงใน **หน้าต่าง Terminal** ที่รัน `npm run dev` เช่น
> `[SMS-DEV] to 08X-XXX-XX12: รหัส OTP (เข้าสู่ระบบ) ... 482913 ใช้ได้ 5 นาที`
> (ผู้ใช้ที่ไม่มีเบอร์โทรในระบบจะเข้าได้โดยไม่ต้อง OTP)

**2.9 รันชุดทดสอบ**

```bash
npm test
```

---

## ขั้นที่ 3 อัปโหลดโค้ดขึ้น GitHub

**3.1 สร้าง Repository**
1. เข้า https://github.com/new
2. Repository name: `ptc-smart-schedule`
3. เลือก **Private** (แนะนำ เพราะเป็นระบบของสถานศึกษา)
4. **ไม่ต้อง** ติ๊ก Add README / .gitignore (เรามีแล้ว) → **Create repository**

**3.2 ตั้งชื่อผู้ commit (ทำครั้งแรกครั้งเดียว)**

```bash
git config --global user.name "ชื่อของคุณ"
```

```bash
git config --global user.email "อีเมลที่ใช้กับ GitHub"
```

**3.3 ส่งโค้ดขึ้น GitHub** (รันในโฟลเดอร์โปรเจกต์ทีละคำสั่ง)

```bash
git init -b main
```

```bash
git add .
```

ตรวจสอบก่อน commit ว่า **ไม่มี `.env` และ `node_modules`** ในรายการ:

```bash
git status
```

```bash
git commit -m "PTC Smart Schedule เวอร์ชันแรก"
```

```bash
git remote add origin https://github.com/<ชื่อบัญชี>/ptc-smart-schedule.git
```

```bash
git push -u origin main
```

> ถ้าถามรหัสผ่าน ให้ใช้ **Personal Access Token** แทนรหัสผ่าน GitHub: Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token (ติ๊ก `repo` และ `workflow`)

**3.4 ตรวจสอบ CI:** ไปที่แท็บ **Actions** ของ repo จะเห็น workflow **CI** รันทดสอบอัตโนมัติ ต้องขึ้น ✅ สีเขียว

**3.5 การอัปเดตโค้ดครั้งต่อไป**

```bash
git add .
```

```bash
git commit -m "อธิบายสิ่งที่แก้ไข"
```

```bash
git push
```

Vercel จะ deploy เวอร์ชันใหม่ให้อัตโนมัติทุกครั้งที่ push

---

## ขั้นที่ 4 ตั้งค่าสำรองข้อมูลอัตโนมัติ (GitHub Actions)

ไฟล์ `.github/workflows/backup.yml` จะสำรองฐานข้อมูลทั้งหมดเป็น `.sql` ขึ้น Supabase Storage (bucket `backups`) **ทุกวันเวลา 02:00 น.**

1. ใน repo GitHub ไปที่ **Settings → Secrets and variables → Actions → New repository secret**
2. เพิ่ม 2 ค่า:
   - `SUPABASE_URL` = Project URL
   - `SUPABASE_SERVICE_ROLE_KEY` = service_role key
3. ทดสอบทันที: แท็บ **Actions → Daily Backup → Run workflow**
4. ตรวจผล: Supabase → **Storage → backups** ต้องมีไฟล์ `ptc-backup-....sql` หรือดูในเมนู **สำรองข้อมูล** ของระบบ

> หมายเหตุ: GitHub อาจเลื่อนเวลารัน schedule ไปบ้างเล็กน้อยในช่วงที่มีผู้ใช้มาก และจะหยุด schedule อัตโนมัติถ้า repo ไม่มีความเคลื่อนไหว 60 วัน (กด Enable ใหม่ได้ที่แท็บ Actions)

---

## ขั้นที่ 5 นำขึ้นออนไลน์ (Deploy บน Vercel)

1. เข้า https://vercel.com → **Sign Up** → **Continue with GitHub**
2. **Add New… → Project** → กด **Import** ที่ repo `ptc-smart-schedule`
3. Framework Preset: **Express** (Vercel เลือกให้อัตโนมัติ ไม่ต้องแก้ Build/Output)
4. เปิด **Environment Variables** แล้วเพิ่ม:
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   - `JWT_SECRET` (สุ่มยาว ๆ ค่าใดก็ได้)
   - `DATA_ENCRYPTION_KEY` → **ค่าเดียวกับที่ใช้สร้างแอดมิน** (ใน `.env` หรือใน GitHub Secrets)
   - `NODE_ENV` = `production`
   - `THAIBULKSMS_*` (ถ้ามี)
5. กด **Deploy** รอ ~1 นาที จะได้ลิงก์ เช่น `https://ptc-smart-schedule.vercel.app`
6. ถ้าแก้ Environment Variables ทีหลัง ต้องไป **Deployments → … → Redeploy** ค่าใหม่ถึงจะมีผล

> 💡 ดูรหัส OTP (ตอนยังไม่ตั้ง SMS) และ error ได้ที่ Vercel → โปรเจกต์ → **Logs**
> ต้องการใช้โดเมนวิทยาลัย: Vercel → Settings → Domains

### ไม่มีเครื่องสำหรับรัน `npm run seed`? สร้างแอดมินผ่าน GitHub ได้
1. GitHub repo → **Settings → Secrets and variables → Actions** เพิ่ม Secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DATA_ENCRYPTION_KEY`, `ADMIN_PASSWORD`, `ADMIN_PHONE`
2. แท็บ **Actions → Setup Admin & Data → Run workflow** → เลือก `admin-only` (ใช้จริง) หรือ `sample` (มีข้อมูลตัวอย่าง)

สร้างคีย์ 64 ตัวอักษร (สำหรับ `DATA_ENCRYPTION_KEY` / `JWT_SECRET`) ได้โดยกด F12 ในเบราว์เซอร์ → แท็บ Console → วางคำสั่งนี้แล้ว Enter:
```js
[...crypto.getRandomValues(new Uint8Array(32))].map(b=>b.toString(16).padStart(2,'0')).join('')
```

---

## ขั้นที่ 6 เชื่อมต่อ SMS (ThaiBulkSMS)

1. สมัครที่ https://www.thaibulksms.com และเติมเครดิต
2. เมนู **API → API Key** สร้าง Key และ Secret
3. ขอชื่อผู้ส่ง (Sender Name) เช่น `PTC` (ต้องรออนุมัติ)
4. ใส่ใน `.env` และใน Vercel (Settings → Environment Variables แล้ว Redeploy):
   ```ini
   THAIBULKSMS_API_KEY=...
   THAIBULKSMS_API_SECRET=...
   THAIBULKSMS_SENDER=PTC
   ```
5. ระบบส่ง SMS เมื่อ: เข้าสู่ระบบ (OTP), ลืมรหัสผ่าน (OTP), บัญชีถูกล็อกจากการใส่รหัสผิด (แจ้งเตือน)
   ดูสถานะการส่งได้ที่เมนู **บันทึกกิจกรรม** (sms_sent / sms_failed)

ปิด 2FA ชั่วคราวได้ด้วย `OTP_REQUIRED=false`

---

## ขั้นตอนการใช้งานของฝ่ายวิชาการ

เรียงตามลำดับนี้ (ข้อมูลขั้นก่อนจำเป็นต่อขั้นถัดไป):

1. **เวลา-คาบเรียน** — กำหนดวัน/คาบ/เวลา (จ.-ศ. ภาคปกติ หรือ ส.-อา. สำหรับทวิภาคี)
2. **ห้องเรียน/โรงฝึกงาน** — ประเภท: ห้องเรียนทั่วไป (ทฤษฎี) · ห้อง Lab (ทั้งทฤษฎีและปฏิบัติ) · โรงฝึกงาน (ปฏิบัติ) + ความจุ
3. **รายวิชา** — คาบ/สัปดาห์ และประเภททฤษฎี/ปฏิบัติ
4. **ครูผู้สอน** — คาบสอนสูงสุด และติ๊กช่วงเวลาไม่สะดวกสอน (ระบบสร้างบัญชีให้ รหัสผ่านเริ่มต้น = รหัสพนักงาน)
5. **กลุ่มเรียน** — แผนก, ระดับ ปวช./ปวส., ชั้นปี, จำนวนนักเรียน
6. **นักเรียน** — เพิ่มทีละคน หรือ **นำเข้า CSV** (บันทึกจาก Excel เป็น *CSV UTF-8*) หัวคอลัมน์:
   ```
   student_code,full_name,group_code,phone
   68201001,นายสมปอง ตั้งใจเรียน,ชย.1/1,0812345678
   ```
7. **แผนการสอน** — จับคู่ กลุ่มเรียน + รายวิชา + ครูผู้สอน
8. **จัดตารางสอน → 🤖 AI จัดตารางอัตโนมัติ** — ได้เวอร์ชันฉบับร่างใหม่ ถ้ามีวิชาจัดไม่ลงระบบจะแจ้งรายการ
9. **ปรับด้วยมือ** — ลากคาบไปช่องอื่น (ช่องชนจะกะพริบสีแดงพร้อมบอกเหตุผล), คลิกคาบเพื่อเปลี่ยนห้อง/ลบ, ลากคาบที่ยังไม่ได้จัดจากแถบด้านบนลงตาราง, กด **↶ ย้อนกลับ** ได้
10. **📸 Snapshot** ก่อนแก้ครั้งใหญ่ (เป็นจุดกู้คืน เลือกเวอร์ชันเก่าจากรายการแล้ว Snapshot เพื่อกู้กลับมาเป็นฉบับร่าง)
11. **🚀 ประกาศใช้** — ครูและนักเรียนจะเห็นตารางนี้ทันที (ระบบเตือนถ้ายังมีคาบชน)
12. **⬇ Excel / 🖨 PDF** — Excel ได้ไฟล์ตารางรวมทั้งวิทยาลัย, PDF ใช้ปุ่มพิมพ์ แล้วเลือก "บันทึกเป็น PDF" (พิมพ์ได้ทีละมุมมอง กลุ่ม/ครู/ห้อง)
13. **คำร้องบล็อกเวลา** — อนุมัติคำร้องของครู แล้วสั่ง AI ใหม่ ระบบจะเลี่ยงช่วงเวลานั้น

---

## ความปลอดภัยและ PDPA

| มาตรการ | รายละเอียด |
|---|---|
| รหัสผ่าน | เก็บแบบ hash (scrypt + salt) ไม่มีใครเห็นรหัสจริง |
| Session | JWT อายุ 8 ชม. ใน cookie แบบ httpOnly + SameSite=Strict (ป้องกัน XSS ขโมย token และ CSRF) |
| 2FA | OTP 6 หลัก อายุ 5 นาที กรอกผิดได้ไม่เกิน 5 ครั้ง |
| Brute Force | รหัสผิด 5 ครั้ง → ล็อก 15 นาที + SMS แจ้งเจ้าของบัญชี (แอดมินปลดล็อกได้ที่หน้าครู/นักเรียน) |
| เข้ารหัสข้อมูล | เบอร์โทร/อีเมล เข้ารหัส AES-256-GCM ในฐานข้อมูล |
| Data Masking | หน้าเว็บแสดง `08X-XXX-XX12`, `s***@mail.com` |
| สิทธิ์การเข้าถึง | ตรวจบทบาททุก API · ฐานข้อมูลปิด RLS ไม่ให้เข้าถึงจากภายนอก |
| PDPA | ป๊อปอัปขอความยินยอมครั้งแรก · ปุ่มขอสำเนาข้อมูล (JSON) · ปุ่มขอลบข้อมูล (บันทึกใน Logs ให้ฝ่ายวิชาการดำเนินการ) |
| Logs | บันทึกการเข้าสู่ระบบ, ล็อกบัญชี, SMS, ส่งออก, สำรองข้อมูล, คำขอ PDPA พร้อม IP |

**ข้อแนะนำเมื่อใช้งานจริง**
- เปลี่ยนรหัสผ่าน admin และให้ครู/นักเรียนเปลี่ยนรหัสผ่านเริ่มต้นหลังเข้าใช้ครั้งแรก
- เปิด 2FA ในบัญชี GitHub, Supabase และ Vercel ของผู้ดูแล
- ไฟล์สำรองมีข้อมูลส่วนบุคคล ดาวน์โหลดเก็บในที่ปลอดภัยเท่านั้น

---

## การกู้คืนข้อมูล

**ตารางสอนผิดพลาด:** เมนูจัดตารางสอน → เลือกเวอร์ชันก่อนหน้าจากรายการ → 📸 Snapshot → ได้ฉบับร่างใหม่จากเวอร์ชันนั้น → ประกาศใช้

**ฐานข้อมูลเสียหายทั้งระบบ:**
1. ดาวน์โหลดไฟล์ `.sql` ล่าสุด (Supabase → Storage → backups หรือเมนู สำรองข้อมูล)
2. ถ้าเป็นโปรเจกต์ใหม่ ให้รัน `supabase/schema.sql` ก่อน
3. Supabase → SQL Editor → วางเนื้อหาไฟล์ `.sql` → Run (แถวที่มีอยู่แล้วจะถูกข้าม)
4. ใช้ `DATA_ENCRYPTION_KEY` เดิม

---

## แก้ปัญหาที่พบบ่อย

| อาการ | วิธีแก้ |
|---|---|
| `กรุณาตั้งค่า SUPABASE_URL ...` | ยังไม่มีไฟล์ `.env` หรือกรอกไม่ครบ (บน Vercel ให้ตั้งใน Settings → Environment Variables แล้ว Redeploy) |
| `relation "users" does not exist` | ยังไม่ได้รัน `supabase/schema.sql` ใน SQL Editor |
| `Invalid API key` | ใช้ anon key แทน service_role key — ต้องใช้ **service_role** |
| ไม่ได้รับ OTP | ยังไม่ตั้ง ThaiBulkSMS → ดู OTP ใน Terminal / Vercel Logs · หรือเบอร์ในระบบผิด · หรือเครดิต SMS หมด |
| `Unsupported state or unable to authenticate data` | `DATA_ENCRYPTION_KEY` ไม่ตรงกับตอนที่บันทึกข้อมูล |
| `process.loadEnvFile is not a function` | Node.js เก่ากว่า 22 → อัปเดต Node.js |
| AI จัดไม่ครบบางวิชา | เพิ่มห้องประเภทที่ขาด, เพิ่มคาบสอนสูงสุดของครู, ลดเวลาไม่สะดวก หรือเพิ่มคาบเรียน แล้วสั่ง AI ใหม่ |
| ภาษาไทยในไฟล์ CSV เพี้ยนใน Excel | ระบบใส่ BOM ให้แล้ว ถ้ายังเพี้ยนให้ใช้ Excel → Data → From Text/CSV → เลือก UTF-8 |
| Daily Backup ใน Actions ไม่ผ่าน | ตรวจ Secrets `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` และมี bucket `backups` |

---

### หมายเหตุสำหรับการพัฒนาต่อ
- AI Engine เป็น heuristic (greedy + randomized restarts) เหมาะกับขนาดวิทยาลัยการอาชีพ ถ้าข้อมูลใหญ่มากแล้วจัดไม่ครบ สามารถแยกเป็น Python service ที่ใช้ Google OR-Tools (CP-SAT) โดยรับ/ส่ง JSON รูปแบบเดียวกับ `generateSchedule()` ใน `server/scheduler.js`
- Excel ส่งออกเป็น CSV (UTF-8 BOM) ซึ่ง Excel เปิดได้โดยตรง; PDF ใช้การพิมพ์จากเบราว์เซอร์ (รองรับฟอนต์ไทยสมบูรณ์)
- ลืมรหัสผ่านรองรับเฉพาะ SMS (ช่องอีเมลมีให้กรอกแล้ว แต่ยังไม่ได้เชื่อมบริการส่งอีเมล)
