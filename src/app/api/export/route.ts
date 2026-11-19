import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { apiUser } from "@/lib/auth";
import { COLLEGE, SEMESTER } from "@/lib/db";
import { VIEWS, isView, scheduleForAll, timeslots, type Cell, type SlotRow } from "@/lib/schedule-query";
import { dayName } from "@/engine/validator";

/** Excel: 1 sheet ต่อ ครู/ห้อง/กลุ่ม/วิชา (PDF ใช้หน้า /schedule/print + พิมพ์จากเบราว์เซอร์) */
export async function GET(req: Request) {
  const u = await apiUser(["ADMIN", "TEACHER"]);
  if (u instanceof NextResponse) return u;
  const view = new URL(req.url).searchParams.get("view");
  if (!isView(view) || view === "student") return NextResponse.json({ error: "view ต้องเป็น teacher/room/group/subject" }, { status: 400 });

  const [entities, slots] = await Promise.all([scheduleForAll(SEMESTER, view), timeslots()]);
  const wb = new ExcelJS.Workbook();
  wb.creator = COLLEGE;
  const used = new Set<string>();
  for (const ent of entities) {
    let name = ent.label.replace(/[\[\]:*?/\\]/g, " ").slice(0, 28);
    for (let i = 2; used.has(name); i++) name = `${name.slice(0, 26)}-${i}`;
    used.add(name);
    writeSheet(wb.addWorksheet(name), `ตาราง${VIEWS[view]}: ${ent.label}`, ent.cells, slots);
  }
  if (!entities.length) wb.addWorksheet("ว่าง").addRow(["ยังไม่มีตารางในภาคเรียนนี้"]);
  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(buf as ArrayBuffer, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="schedule-${view}-${SEMESTER.replace("/", "-")}.xlsx"`,
    },
  });
}

function writeSheet(ws: ExcelJS.Worksheet, title: string, cells: Cell[], slots: SlotRow[]) {
  const periods = [...new Set(slots.map((s) => s.period))].sort((a, b) => a - b);
  const days = [...new Set(slots.map((s) => s.day))].sort();
  ws.addRow([COLLEGE]);
  ws.addRow([`${title}  ภาคเรียนที่ ${SEMESTER}`]);
  ws.addRow(["วัน/คาบ", ...periods.map((p) => { const s = slots.find((x) => x.period === p)!; return `${p}\n${s.start}-${s.end}`; })]);
  const at = new Map(cells.map((c) => [`${c.day}-${c.period}`, c]));
  for (const d of days) {
    const row = ws.addRow([dayName(d), ...periods.map((p) => {
      if (slots.find((s) => s.day === d && s.period === p)?.lunch) return "พักกลางวัน";
      const c = at.get(`${d}-${p}`);
      return c ? `${c.subject}\n${c.teacher}\n${c.group} | ${c.room}` : "";
    })]);
    // รวมช่องคาบต่อเนื่องของวิชาเดียวกัน
    for (let i = 0; i < periods.length; i++) {
      const c = at.get(`${d}-${periods[i]}`);
      let j = i;
      while (c && j + 1 < periods.length && at.get(`${d}-${periods[j + 1]}`)?.enrollmentId === c.enrollmentId) j++;
      if (j > i) ws.mergeCells(row.number, i + 2, row.number, j + 2);
      i = j;
    }
    row.height = 60;
  }
  ws.mergeCells(1, 1, 1, periods.length + 1);
  ws.mergeCells(2, 1, 2, periods.length + 1);
  ws.getRow(1).font = { bold: true, size: 14 };
  ws.getColumn(1).width = 12;
  for (let i = 2; i <= periods.length + 1; i++) ws.getColumn(i).width = 18;
  ws.eachRow((r, n) => r.eachCell((c) => {
    c.alignment = { wrapText: true, vertical: "middle", horizontal: "center" };
    if (n >= 3) c.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
  }));
}
