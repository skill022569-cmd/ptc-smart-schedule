import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth";
import { SEMESTER, prisma } from "@/lib/db";
import { loadInput, loadRuns, saveState } from "@/lib/engine-io";
import { runEngine } from "@/engine";

export const maxDuration = 60;

// shortcut: engine รันบน thread ของ request (บล็อก ~3-20 วินาที); ถ้ามีผู้ใช้พร้อมกันมาก ให้ย้ายไป worker_threads หรือคิวงานแยก
export async function POST(req: Request) {
  const u = await apiUser(["ADMIN"]);
  if (u instanceof NextResponse) return u;
  const body = await req.json().catch(() => ({}));
  const timeLimitMs = Math.min(Math.max(Number(body.timeLimitMs) || 15000, 1000), 45000);
  // keepExisting = คงคาบที่จัดไว้แล้ว (รวมที่จัดเอง) แล้วจัดเฉพาะที่เหลือ
  const [input, keep] = await Promise.all([loadInput(), body.keepExisting ? loadRuns(SEMESTER) : []]);
  // autoSplit (ค่าเริ่มต้นเปิด): วิชาที่วางเป็นก้อนเดียวไม่ได้ ให้ระบบแบ่งคาบเองแล้วจำการอนุญาตไว้
  const res = runEngine(input, { timeLimitMs, seed: Number(body.seed) || Date.now() % 100000, autoSplit: body.autoSplit !== false }, keep);
  if (res.splitIds.length) await prisma.enrollment.updateMany({ where: { id: { in: res.splitIds } }, data: { allowSplit: true } });
  const conflicts = await saveState(SEMESTER, res.ctx, res.state);
  return NextResponse.json({ stats: res.stats, warnings: res.warnings, conflicts: conflicts.length, split: res.splitIds.length });
}
