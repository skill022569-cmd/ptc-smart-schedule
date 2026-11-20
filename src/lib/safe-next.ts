/** ค่า ?next= ที่ปลอดภัย: ต้องเป็น path ภายในเว็บนี้เท่านั้น (กัน open redirect เช่น //evil.com หรือ /\evil.com) */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\") || next.startsWith("/login")) return "/";
  return next;
}
