// npm run db:seed            → ข้อมูลตัวอย่างขนาดเล็ก (demo)
// SEED_SCALE=stress npm run db:seed → ทั้งวิทยาลัย 8 แผนก: นักเรียน 2,000 / ครู 100+ / วิชา 500+
import { PrismaClient } from "@prisma/client";
import { DEMO_STUDENT_PASSWORD, seedDatabase } from "./seed-lib";

const prisma = new PrismaClient();
seedDatabase(prisma, process.env.SEED_SCALE === "stress" ? "stress" : "demo", console.log)
  .then(() => console.log(`เสร็จ: เข้าสู่ระบบด้วย admin / admin1234 (นักเรียนตัวอย่างใช้รหัสผ่าน ${DEMO_STUDENT_PASSWORD})`))
  .finally(() => prisma.$disconnect());
