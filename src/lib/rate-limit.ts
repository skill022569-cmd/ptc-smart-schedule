// shortcut: นับในหน่วยความจำต่อ instance ของ Vercel (หลาย instance = โควตาหลายเท่า, รีสตาร์ทแล้วนับใหม่); ถ้าโดนใช้หนักให้ย้ายไปเก็บใน DB/Redis
const hits = new Map<string, number[]>();

/** true = ยังไม่เกินโควตา (limit ครั้งต่อ windowMs) แล้วนับครั้งนี้ด้วย */
export function allow(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) { hits.set(key, recent); return false; }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 10_000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k); // กันหน่วยความจำโต
  return true;
}
