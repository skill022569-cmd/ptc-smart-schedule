// จุดเข้าสำหรับ Vercel (Express) — ไฟล์หน้าเว็บใน public/ Vercel เสิร์ฟให้เองผ่าน CDN
import 'express'; // Vercel ตรวจหา entrypoint จากไฟล์ที่ import express — ห้ามลบ
import app from './server/index.js';
export default app;
