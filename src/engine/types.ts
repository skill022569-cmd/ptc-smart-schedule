// โมเดลข้อมูลของ engine (ไม่ผูกกับฐานข้อมูล ทดสอบได้ด้วยข้อมูลในหน่วยความจำ)
export interface Slot { id: number; day: number; period: number; isLunch: boolean; start: string; end: string }
export interface Room { id: number; code: string; type: string; capacity: number }
export interface Teacher {
  id: number;
  name: string;
  maxHours: number;
  unavailable: { day: number; period: number }[];
  preferred: "MORNING" | "AFTERNOON" | "ANY";
}
export interface Enrollment {
  id: number;
  subjectCode: string;
  subjectName: string;
  teacherId: number;
  groupId: number | null; // ลงทั้งกลุ่ม
  studentId: number | null; // ลงรายบุคคล
  homeGroupId: number; // กลุ่มของนักเรียน (หรือ = groupId)
  label: string; // ชื่อกลุ่ม/นักเรียน สำหรับแสดงผล
  hours: number; // คาบต่อสัปดาห์ (ทฤษฎี + ปฏิบัติ)
  roomType: string | null;
  size: number;
  allowedDays: number[]; // วันที่กลุ่มมาเรียน (คู่ขนาน/ทวิภาคี)
  allowSplit: boolean;
}
export interface EngineInput { slots: Slot[]; rooms: Room[]; teachers: Teacher[]; enrollments: Enrollment[] }

/** ช่วงคาบที่จัดแล้ว (ใช้ทั้งผลลัพธ์และโหลดจากฐานข้อมูล) */
export interface Run { enrollmentId: number; day: number; start: number; length: number; roomId: number }
