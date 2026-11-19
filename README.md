# PTC Smart Schedule

ระบบจัดตารางเรียน-ตารางสอนอัตโนมัติ วิทยาลัยการอาชีพโพนทอง — Next.js 15 + Prisma + TiDB Serverless + Hybrid CSP/Genetic Algorithm + Claude AI

รายละเอียดสถาปัตยกรรมและอัลกอริทึม: [docs/ARCHITECTURE_GUIDE.md](docs/ARCHITECTURE_GUIDE.md)

## เริ่มต้นใช้งาน

```bash
npm install
cp .env.example .env        # ใส่ DATABASE_URL ของ TiDB, AUTH_SECRET, ANTHROPIC_API_KEY
npm run db:push             # สร้างตาราง
npm run db:seed             # ข้อมูลตัวอย่าง (SEED_SCALE=stress สำหรับ 2,000 คน ใช้เวลา ~1 นาทีเพราะ hash รหัสผ่าน)
npm run dev
```

เข้าสู่ระบบ: `admin` / `admin1234` → เมนู "จัดตารางอัตโนมัติ" → ▶ จัดใหม่ทั้งหมด (หรือเมนู "จัดตารางเอง")
บัญชีตัวอย่าง: ครู = รหัสบุคลากร (เช่น `T0001`) รหัสผ่านเดียวกัน — ครูแก้ได้เฉพาะตารางสอนของตนเอง (เมนู "แก้ไขตารางสอนของฉัน") — **เปลี่ยนรหัสก่อนใช้งานจริง**

มุมมองสาธารณะ (ไม่ต้องเข้าสู่ระบบ): เปิดหน้าแรก `/` ได้เลย — ดูตารางตามกลุ่ม/ครู/ห้อง/วิชา และทำเนียบบุคลากร (`/public/directory`, ไม่มีเบอร์โทร/อีเมล); บัญชีนักเรียนเข้าสู่ระบบไม่ได้ · ครู/แอดมินเปลี่ยนรหัสผ่านที่เมนู "เปลี่ยนรหัสผ่าน"

## คำสั่ง

| คำสั่ง | ทำอะไร |
|---|---|
| `npm test` | unit test ของ engine |
| `npm run stress` | stress test engine 2,000 นักเรียน (ไม่ต้องมีฐานข้อมูล) |
| `npm run typecheck` / `npm run build` | ตรวจ type / build production |
| `npm run db:studio` | แก้ไขข้อมูลตั้งต้น (ครู วิชา ห้อง การลงทะเบียน) |
| หน้าแอดมิน → ข้อมูลตัวอย่าง | โหลดข้อมูลจำลองทั้งวิทยาลัย 8 แผนก (2,000 คน) จากหน้าเว็บ — ลบข้อมูลเดิมทั้งหมด |

## Deploy (Vercel)
ตั้ง Environment Variables เหมือน `.env.example` แล้วเชื่อม GitHub repo; build command `npm run build` (รัน `prisma generate` ให้แล้ว) — `/api/generate` ตั้ง `maxDuration = 60` วินาที
