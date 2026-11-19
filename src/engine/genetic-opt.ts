import { type Ctx, State, rng } from "./model";
import { placeOrRepair, placeRandom, solve } from "./csp-solver";
import { softPenalty } from "./validator";

export interface GaOptions { population?: number; generations?: number; timeLimitMs?: number; seed?: number; base?: State }

export const fitness = (ctx: Ctx, st: State) =>
  st.place.reduce((n, p, i) => n + (p ? 0 : ctx.sessions[i].length), 0) * 1000 + softPenalty(ctx, st.place);

/**
 * Genetic Algorithm แบบ (μ+λ): ประชากรเริ่มจาก CSP หลาย seed → คัดครึ่งที่ดีที่สุด → กลายพันธุ์
 * การกลายพันธุ์ = ย้าย session สุ่มไปตำแหน่งที่ยังผ่าน hard constraints เสมอ (ทุกตัวในประชากรไม่มีตารางชน)
 * ไม่ใช้ crossover เพราะการผสมตารางสองชุดมักทำให้ hard constraint แตก
 */
export function optimize(ctx: Ctx, opts: GaOptions = {}) {
  const { population = 10, generations = 300, timeLimitMs = 15000, seed = 42, base } = opts;
  const rand = rng(seed);
  const t0 = Date.now();
  let pop = Array.from({ length: population }, () => {
    const st = solve(ctx, rand, base);
    return { st, f: fitness(ctx, st) };
  });
  const n = ctx.sessions.length;
  let gen = 0;
  for (; gen < generations && Date.now() - t0 < timeLimitMs && n > 0; gen++) {
    pop.sort((a, b) => a.f - b.f);
    const elite = pop.slice(0, Math.ceil(population / 2));
    const kids = elite.map(({ st }) => {
      const c = st.clone();
      const k = 1 + Math.floor(rand() * 5);
      for (let m = 0; m < k; m++) {
        const i = Math.floor(rand() * n);
        if (ctx.locked.has(i)) continue;
        const s = ctx.sessions[i];
        const old = c.place[i];
        if (!old) { placeOrRepair(ctx, c, i, rand); continue; }
        c.remove(ctx, s);
        if (!placeRandom(ctx, c, i, rand)) c.apply(ctx, s, old);
      }
      return { st: c, f: fitness(ctx, c) };
    });
    pop = [...elite, ...kids];
  }
  pop.sort((a, b) => a.f - b.f);
  return { state: pop[0].st, fitness: pop[0].f, generations: gen, ms: Date.now() - t0 };
}
