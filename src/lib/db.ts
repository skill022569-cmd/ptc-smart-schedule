import { PrismaClient } from "@prisma/client";

const g = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = g.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") g.prisma = prisma;

export const COLLEGE = "วิทยาลัยการอาชีพโพนทอง";
export const SEMESTER = process.env.CURRENT_SEMESTER ?? "2/2569";
export const ISSUE_CATEGORIES = ["ตารางเรียนชน", "ห้องเรียนไม่ตรงกับประเภทวิชา", "ชื่อ-รหัสนักเรียนตกหล่น", "ขอเปลี่ยนห้อง/คาบ", "PDPA", "อื่นๆ"];
