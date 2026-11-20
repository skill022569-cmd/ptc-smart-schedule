"use client";
import type { Cell, SlotRow } from "@/lib/schedule-query";

const DAYS = ["", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์", "อาทิตย์"];
export type Highlight = "both" | "teacher" | "group";
const HL: Record<Highlight, string> = { both: "bg-emerald-200", teacher: "bg-green-100", group: "bg-yellow-100" };

/** ตารางแบบราชการ: แถว = วัน, คอลัมน์ = คาบ; คาบต่อเนื่องวิชาเดียวกันรวมเป็นช่องเดียว */
export default function ScheduleGrid({ slots, cells, highlight, onCellClick, show = ["teacher", "group", "room"] }: {
  slots: SlotRow[]; cells: Cell[]; highlight?: Record<string, Highlight>;
  onCellClick?: (day: number, period: number) => void; show?: ("teacher" | "group" | "room")[];
}) {
  // ซ่อนคาบเย็น (เริ่ม 17:00 ขึ้นไป) ถ้าไม่มีวิชาหรือช่องไฮไลต์ใช้ — ตารางแคบลงโดยเฉพาะบนมือถือ
  const used = new Set([...cells.map((c) => c.period), ...Object.keys(highlight ?? {}).map((k) => Number(k.split("-")[1]))]);
  const periods = [...new Map(slots.map((s) => [s.period, s])).values()].sort((a, b) => a.period - b.period)
    .filter((p) => p.start < "17:00" || used.has(p.period));
  const days = [...new Set(slots.map((s) => s.day))].sort();
  const at = new Map(cells.map((c) => [`${c.day}-${c.period}`, c]));
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th scope="col" className="sticky left-0 z-10 border bg-brand-50 p-1">วัน/คาบ</th>
            {periods.map((p) => <th key={p.period} scope="col" className="border bg-brand-50 p-1">{p.period}<div className="font-normal text-slate-500">{p.start}-{p.end}</div></th>)}
          </tr>
        </thead>
        <tbody>
          {days.map((d) => {
            const tds: React.ReactNode[] = [];
            for (let i = 0; i < periods.length; i++) {
              const p = periods[i].period;
              const lunch = slots.find((s) => s.day === d && s.period === p)?.lunch;
              const c = at.get(`${d}-${p}`);
              let span = 1;
              while (c && i + span < periods.length && at.get(`${d}-${periods[i + span].period}`)?.enrollmentId === c.enrollmentId) span++;
              const hl = highlight?.[`${d}-${p}`];
              tds.push(
                <td key={p} colSpan={span}
                  className={`h-16 min-w-24 border p-1 text-center align-middle ${lunch ? "bg-stone-200 text-stone-500" : c ? "bg-brand-50" : hl ? HL[hl] : ""} ${onCellClick && !lunch ? "cursor-pointer hover:ring-2 hover:ring-brand-400" : ""}`}
                  onClick={onCellClick && !lunch ? () => onCellClick(d, p) : undefined}>
                  {lunch ? "พักกลางวัน" : c && (
                    <>
                      <div className="font-semibold">{c.subject}</div>
                      {show.includes("teacher") && <div>{c.teacher}</div>}
                      {show.includes("group") && <div className="text-slate-600">{c.group}</div>}
                      {show.includes("room") && <div className="text-slate-500">ห้อง {c.room}</div>}
                    </>
                  )}
                </td>,
              );
              i += span - 1;
            }
            return <tr key={d}><th scope="row" className="sticky left-0 z-10 border bg-brand-50 p-1 shadow-[2px_0_0_rgba(0,0,0,0.06)]">{DAYS[d]}</th>{tds}</tr>;
          })}
        </tbody>
      </table>
    </div>
  );
}
