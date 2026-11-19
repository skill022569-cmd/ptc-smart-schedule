import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth";
import { SEMESTER } from "@/lib/db";
import { loadInput, saveState } from "@/lib/engine-io";
import { runEngine } from "@/engine";

export const maxDuration = 60;

// shortcut: engine รันบน thread ของ request (บล็อก ~3-20 วินาที); ถ้ามีผู้ใช้พร้อมกันมาก ให้ย้ายไป worker_threads หรือคิวงานแยก
export async function POST(req: Request) {
  const u = await apiUser(["ADMIN"]);
  if (u instanceof NextResponse) return u;
  const body = await req.json().catch(() => ({}));
  const timeLimitMs = Math.min(Math.max(Number(body.timeLimitMs) || 15000, 1000), 45000);
  const input = await loadInput();
  const res = runEngine(input, { timeLimitMs, seed: Number(body.seed) || Date.now() % 100000 });
  const conflicts = await saveState(SEMESTER, res.ctx, res.state);
  return NextResponse.json({ stats: res.stats, warnings: res.warnings, conflicts: conflicts.length });
}
