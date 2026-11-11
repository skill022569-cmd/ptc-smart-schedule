// สำรองฐานข้อมูลเป็นไฟล์ .sql ขึ้น Supabase Storage (bucket: backups) — GitHub Actions เรียกทุกวัน 02:00 น.
import { backupToStorage } from '../server/backup.js';
console.log('✔ สำรองข้อมูลแล้ว:', await backupToStorage());
