import { buildCtx } from "./model";
import { optimize, type GaOptions } from "./genetic-opt";
import { analyze } from "./conflict-analyzer";
import { precheck, softPenalty, validate } from "./validator";
import type { EngineInput, Run } from "./types";

export * from "./types";
export { buildCtx, analyze, validate, precheck, softPenalty };

/**
 * pipeline เต็ม: pre-check → CSP → GA → validate → วิเคราะห์รายการที่จัดไม่ได้
 * keep = คาบที่จัดไว้แล้วให้คงตำแหน่งเดิม (ระบบจัดเฉพาะที่เหลือ); คาบเดิมที่ผิดเงื่อนไขแล้วจะถูกปล่อยให้จัดใหม่
 */
export function runEngine(input: EngineInput, opts: GaOptions & { autoSplit?: boolean } = {}, keep: Run[] = []): ReturnType<typeof runOnce> & { splitIds: number[] } {
  const first = runOnce(input, opts, keep);
  const ids = first.conflicts.map((c) => c.enrollmentId).filter((id) => !first.ctx.enrollments.get(id)!.allowSplit);
  if (!opts.autoSplit || !ids.length) return { ...first, splitIds: [] };
  // รอบสอง: คงทุกคาบที่จัดได้แล้ว และอนุญาตแบ่งคาบเฉพาะวิชาที่ยังวางเป็นก้อนเดียวไม่ได้
  const set = new Set(ids);
  const second = runOnce({ ...input, enrollments: input.enrollments.map((e) => (set.has(e.id) ? { ...e, allowSplit: true } : e)) },
    { ...opts, timeLimitMs: Math.min(opts.timeLimitMs ?? 15000, 5000) }, toRuns(first.ctx, first.state.place));
  return { ...second, splitIds: ids };
}

function runOnce(input: EngineInput, opts: GaOptions, keep: Run[]) {
  const { ctx, state } = buildCtx(input, keep, true);
  for (const i of validate(ctx, state.place).keys()) { state.remove(ctx, ctx.sessions[i]); ctx.locked.delete(i); }
  const warnings = precheck(ctx);
  const res = optimize(ctx, { ...opts, base: state });
  const violations = validate(ctx, res.state.place);
  if (violations.size) throw new Error(`engine bug: ${violations.size} hard violations`); // ไม่ควรเกิด: ทุก move ผ่าน canPlace
  return {
    ctx, state: res.state, warnings,
    conflicts: analyze(ctx, res.state),
    stats: { sessions: ctx.sessions.length, placed: res.state.place.filter(Boolean).length,
      penalty: softPenalty(ctx, res.state.place), generations: res.generations, ms: res.ms },
  };
}

export function toRuns(ctx: ReturnType<typeof buildCtx>["ctx"], place: ReturnType<typeof buildCtx>["state"]["place"]): Run[] {
  return ctx.sessions.flatMap((s, i) => { const p = place[i]; return p ? [{ enrollmentId: s.enrollmentId, length: s.length, ...p }] : []; });
}
