// สร้างข้อมูลจำลอง (ใช้ทั้ง seed ลงฐานข้อมูล และ stress test ของ engine แบบไม่ต้องมีฐานข้อมูล)
import type { EngineInput } from "../src/engine/types";

export const SLOT_TIMES = [
  ["08:00", "09:00"], ["09:00", "10:00"], ["10:00", "11:00"], ["11:00", "12:00"],
  ["12:00", "13:00"], // คาบ 5 พักกลางวัน
  ["13:00", "14:00"], ["14:00", "15:00"], ["15:00", "16:00"], ["16:00", "17:00"], ["17:00", "18:00"],
];
export const LUNCH = 5;

const DEPTS = [
  { name: "คอมพิวเตอร์ธุรกิจ", room: "COMPUTER" },
  { name: "การบัญชี", room: "COMPUTER" },
  { name: "ช่างยนต์", room: "WORKSHOP_AUTO" },
  { name: "ช่างไฟฟ้ากำลัง", room: "WORKSHOP_ELEC" },
  { name: "ช่างอิเล็กทรอนิกส์", room: "WORKSHOP_ELEC" },
  { name: "ช่างเชื่อมโลหะ", room: "WORKSHOP_WELD" },
  { name: "การตลาด", room: "LECTURE" },
  { name: "เทคโนโลยีสารสนเทศ", room: "COMPUTER" },
];
const LEVELS = [
  { level: "ปวช.", year: 1 }, { level: "ปวช.", year: 2 }, { level: "ปวช.", year: 3 },
  { level: "ปวส.", year: 1 }, { level: "ปวส.", year: 2 },
];
const FIRST = ["สมชาย", "สมหญิง", "วิชัย", "มานะ", "ปิยะ", "อรุณ", "สุดา", "กมล", "จันทร์เพ็ญ", "ธนา", "นภา", "พรทิพย์", "ศักดิ์ชัย", "อำไพ", "บุญมี", "ประยุทธ", "รัตนา", "สุริยา", "อนงค์", "เกียรติ"];
const LAST = ["ใจดี", "ศรีสุข", "บุญมา", "แก้วกาญจนา", "ทองดี", "พรหมมา", "สายสุข", "จันทร์แก้ว", "พิมพ์ทอง", "อินทร์แก้ว", "ศรีภูมิ", "โพธิ์ทอง"];

// โครงสร้างผู้บริหารวิทยาลัยการอาชีพตามมาตรฐาน สอศ. — ชื่อจริงให้ผู้ดูแลระบบแก้ในหน้าประวัติ
export const EXECUTIVES = [
  { code: "EXEC-01", position: "ผู้อำนวยการวิทยาลัยการอาชีพโพนทอง", duties: "บริหารงานวิทยาลัยทั้งหมด กำหนดนโยบาย ทิศทาง และกำกับดูแลการดำเนินงานของทุกฝ่ายให้เป็นไปตามระเบียบของสำนักงานคณะกรรมการการอาชีวศึกษา" },
  { code: "EXEC-02", position: "รองผู้อำนวยการฝ่ายบริหารทรัพยากร", duties: "กำกับงานบริหารทั่วไป งานบุคลากร งานการเงิน งานบัญชี งานพัสดุ งานอาคารสถานที่ งานทะเบียน และงานประชาสัมพันธ์" },
  { code: "EXEC-03", position: "รองผู้อำนวยการฝ่ายแผนงานและความร่วมมือ", duties: "กำกับงานวางแผนและงบประมาณ งานศูนย์ข้อมูลสารสนเทศ งานความร่วมมือ งานวิจัยพัฒนานวัตกรรม และงานประกันคุณภาพการศึกษา" },
  { code: "EXEC-04", position: "รองผู้อำนวยการฝ่ายพัฒนากิจการนักเรียนนักศึกษา", duties: "กำกับงานกิจกรรมนักเรียนนักศึกษา งานครูที่ปรึกษา งานปกครอง งานแนะแนวอาชีพและการจัดหางาน และงานสวัสดิการนักเรียนนักศึกษา" },
  { code: "EXEC-05", position: "รองผู้อำนวยการฝ่ายวิชาการ", duties: "กำกับงานพัฒนาหลักสูตร การจัดการเรียนการสอน การจัดตารางเรียน-ตารางสอน งานวัดผลและประเมินผล งานวิทยบริการและห้องสมุด และงานทวิภาคี" },
];

/** หน้าที่ของครูจากตำแหน่ง/แผนก (ข้อมูลตัวอย่าง) */
export const teacherDuties = (position: string, dept: string) =>
  position === "หัวหน้าแผนกวิชา" ? `หัวหน้าแผนกวิชา${dept}: วางแผนการสอนของแผนก จัดครูผู้สอน ดูแลห้องปฏิบัติการ/โรงฝึกงาน และสอนวิชาชีพ`
  : dept === "สามัญสัมพันธ์" ? "สอนวิชาสามัญและวิชาพื้นฐานให้นักเรียนทุกแผนก"
  : `สอนวิชาชีพแผนกวิชา${dept} และเป็นครูที่ปรึกษานักเรียน`;

export interface Dataset {
  admins: { code: string; name: string; position: string }[];
  executives: { code: string; position: string; duties: string }[];
  teachers: { code: string; name: string; department: string; position: string; maxHours: number; unavailable: { day: number; period: number }[]; preferred: "MORNING" | "AFTERNOON" | "ANY" }[];
  groups: { code: string; name: string; level: string; department: string; isDual: boolean; studyDays: number[] }[];
  students: { code: string; name: string; groupCode: string; isDual: boolean }[];
  subjects: { code: string; name: string; theory: number; practice: number; roomType: string | null }[];
  rooms: { code: string; name: string; capacity: number; type: string; building: string }[];
  enrollments: { subjectCode: string; teacherCode: string; groupCode?: string; studentCode?: string }[];
}

function rnd(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
}

export function makeDataset(scale: "demo" | "stress", seed = 1): Dataset {
  const r = rnd(seed);
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  const name = () => `${pick(FIRST)} ${pick(LAST)}`;
  const depts = scale === "demo" ? DEPTS.slice(0, 2) : DEPTS;
  const levels = scale === "demo" ? LEVELS.filter((l) => l.year === 1) : LEVELS;
  const perLevel = 2; // จำนวนห้องต่อระดับชั้น
  const perGroup = scale === "demo" ? 20 : 25;
  const ds: Dataset = {
    admins: [{ code: "admin", name: "ฝ่ายวิชาการ (ผู้ดูแลระบบ)", position: "รองผู้อำนวยการฝ่ายวิชาการ" }],
    executives: EXECUTIVES,
    teachers: [], groups: [], students: [], subjects: [], rooms: [], enrollments: [],
  };
  const load = new Map<string, number>();
  const teacherFor = (dept: string, hours: number) => {
    const pool = ds.teachers.filter((t) => t.department === dept && !t.code.startsWith("T-FIX"));
    const t = pool.reduce((a, b) => ((load.get(a.code) ?? 0) <= (load.get(b.code) ?? 0) ? a : b));
    load.set(t.code, (load.get(t.code) ?? 0) + hours);
    return t.code;
  };
  const addTeacher = (dept: string, n: number) => {
    for (let i = 0; i < n; i++) {
      const unavailable = Array.from({ length: Math.floor(r() * 3) }, () => ({ day: 1 + Math.floor(r() * 5), period: pick([1, 2, 3, 4, 6, 7, 8, 9]) }));
      ds.teachers.push({ code: `T${String(ds.teachers.length + 1).padStart(4, "0")}`, name: `ครู${name()}`, department: dept,
        position: i === 0 ? "หัวหน้าแผนกวิชา" : pick(["ครู", "ครู", "ครูผู้ช่วย", "ครูพิเศษสอน"]), maxHours: 24, unavailable, preferred: pick(["ANY", "ANY", "MORNING", "AFTERNOON"]) });
    }
  };

  // วิชาสามัญ ใช้ทุกแผนก
  const general = Array.from({ length: scale === "demo" ? 4 : 24 }, (_, i) => {
    const s = { code: `2000-${String(1001 + i)}`, name: pick(["ภาษาไทย", "ภาษาอังกฤษ", "คณิตศาสตร์", "วิทยาศาสตร์", "สังคมศึกษา", "พลศึกษา"]) + ` ${i + 1}`, theory: 2, practice: 0, roomType: "LECTURE" };
    ds.subjects.push(s);
    return s;
  });
  addTeacher("สามัญสัมพันธ์", scale === "demo" ? 3 : 14);

  let groupNo = 0;
  for (const [di, d] of depts.entries()) {
    addTeacher(d.name, scale === "demo" ? 4 : 12);
    for (const [li, lv] of levels.entries()) {
      const own = Array.from({ length: 12 }, (_, i) => {
        const practice = i % 3 === 0 ? 3 : i % 3 === 1 ? 2 : 1;
        const s = { code: `${lv.level === "ปวช." ? 2 : 3}${di}${li}${String(i + 1).padStart(2, "0")}-${1000 + groupNo}`,
          name: `${d.name} ${lv.level}${lv.year} วิชาชีพ ${i + 1}`, theory: practice === 3 ? 0 : 1, practice, roomType: d.room };
        ds.subjects.push(s);
        return s;
      });
      for (let g = 1; g <= perLevel; g++) {
        groupNo++;
        const isDual = lv.level === "ปวส." && g === perLevel; // ห้องสุดท้ายของ ปวส. เป็นทวิภาคี
        const code = `G${String(groupNo).padStart(3, "0")}`;
        ds.groups.push({ code, name: `${lv.level}${lv.year}/${g} ${d.name}`, level: lv.level, department: d.name, isDual, studyDays: isDual ? [1, 2, 3] : [1, 2, 3, 4, 5] });
        for (let s = 1; s <= perGroup; s++)
          ds.students.push({ code: `67${String(di + 1).padStart(2, "0")}${li}${String(g)}${String(s).padStart(3, "0")}`, name: name(), groupCode: code, isDual });
        const subs = [...own.slice(g % 2 ? 0 : 6, (g % 2 ? 0 : 6) + (isDual ? 4 : 6)), ...(isDual ? [] : [general[(groupNo) % general.length], general[(groupNo + 1) % general.length]])];
        for (const s of subs) ds.enrollments.push({ subjectCode: s.code, teacherCode: teacherFor(s.roomType === "LECTURE" && s.code.startsWith("2000") ? "สามัญสัมพันธ์" : d.name, s.theory + s.practice), groupCode: code });
      }
    }
  }

  // กรณีศึกษา: ครูสมศรี วิชาปฏิบัติ 3 คาบรวด ว่างแค่ จ.คาบ 3-4, จ.คาบ 6 และ อ.คาบ 7; คาบ 6 วันจันทร์ถูกวิชาอื่นของกลุ่มจองไว้
  const caseGroup = ds.groups.find((g) => g.name.startsWith("ปวส.1/1 คอมพิวเตอร์ธุรกิจ")) ?? ds.groups[0];
  const all = [1, 2, 3, 4, 5].flatMap((day) => [1, 2, 3, 4, 6, 7, 8, 9, 10].map((period) => ({ day, period })));
  const only = (keep: string[]) => all.filter((s) => !keep.includes(`${s.day}-${s.period}`));
  ds.teachers.push({ code: "T-FIX-01", name: "ครูสมศรี ใจดี", department: caseGroup.department, position: "ครู", maxHours: 24, unavailable: only(["1-3", "1-4", "1-6", "2-7"]), preferred: "ANY" });
  ds.teachers.push({ code: "T-FIX-02", name: "ครูวิชัย ทองดี", department: caseGroup.department, position: "ครูพิเศษสอน", maxHours: 6, unavailable: only(["1-6"]), preferred: "ANY" });
  ds.subjects.push({ code: "30204-2101", name: "การเขียนโปรแกรมเว็บ (ปฏิบัติ)", theory: 0, practice: 3, roomType: "COMPUTER" });
  ds.subjects.push({ code: "30204-2102", name: "สัมมนาวิชาชีพ", theory: 1, practice: 0, roomType: "LECTURE" });
  // ครูวิชาอื่นของกลุ่มนี้ติดประชุมช่วงที่ครูสมศรีว่าง เพื่อให้กรณีศึกษาเกิดซ้ำได้ทุกครั้งที่ seed
  const keep = [{ day: 1, period: 3 }, { day: 1, period: 4 }, { day: 2, period: 7 }];
  for (const e of ds.enrollments.filter((x) => x.groupCode === caseGroup.code))
    ds.teachers.find((t) => t.code === e.teacherCode)!.unavailable.push(...keep);
  ds.enrollments.push({ subjectCode: "30204-2101", teacherCode: "T-FIX-01", groupCode: caseGroup.code });
  ds.enrollments.push({ subjectCode: "30204-2102", teacherCode: "T-FIX-02", groupCode: caseGroup.code });

  // นักเรียนคู่ขนาน ลงทะเบียนรายบุคคลข้ามกลุ่ม (เรียนวิชาสามัญกับกลุ่มอื่น)
  const duals = ds.students.filter((s) => s.isDual).slice(0, scale === "demo" ? 3 : 30);
  for (const s of duals) {
    const g = general[Math.floor(r() * general.length)];
    ds.enrollments.push({ subjectCode: g.code, teacherCode: teacherFor("สามัญสัมพันธ์", 2), studentCode: s.code });
  }

  // ห้อง: คำนวณจากภาระจริงของแต่ละประเภท (ใช้ห้อง ~55% ของคาบ; ก้อน 3 คาบรวดต้องการห้องว่างเผื่อ)
  const subj = new Map(ds.subjects.map((s) => [s.code, s]));
  const need = new Map<string, number>();
  for (const e of ds.enrollments) { const s = subj.get(e.subjectCode)!; const t = s.roomType ?? "LECTURE"; need.set(t, (need.get(t) ?? 0) + s.theory + s.practice); }
  for (const [type, hours] of need) {
    const n = Math.ceil(hours / (40 * 0.55)) + 1;
    for (let i = 1; i <= n; i++)
      ds.rooms.push({ code: `${type}-${String(i).padStart(2, "0")}`, name: `${type === "LECTURE" ? "ห้องเรียน" : type === "COMPUTER" ? "ห้องปฏิบัติการคอมพิวเตอร์" : "โรงฝึกงาน"} ${type} ${i}`,
        capacity: 40, type, building: `อาคาร ${1 + (i % 4)}` });
  }
  return ds;
}

/** แปลง dataset เป็น input ของ engine (id = ลำดับ + 1) สำหรับ stress test ที่ไม่ใช้ฐานข้อมูล */
export function toEngineInput(ds: Dataset): EngineInput {
  const id = <T extends { code: string }>(xs: T[]) => new Map(xs.map((x, i) => [x.code, i + 1]));
  const tId = id(ds.teachers), gId = id(ds.groups), sId = id(ds.students), rId = id(ds.rooms);
  const subj = new Map(ds.subjects.map((s) => [s.code, s]));
  const groups = new Map(ds.groups.map((g) => [g.code, g]));
  const students = new Map(ds.students.map((s) => [s.code, s]));
  const size = new Map<string, number>();
  for (const s of ds.students) size.set(s.groupCode, (size.get(s.groupCode) ?? 0) + 1);
  return {
    slots: [1, 2, 3, 4, 5].flatMap((day) => SLOT_TIMES.map(([start, end], i) => ({ id: (day - 1) * 10 + i + 1, day, period: i + 1, isLunch: i + 1 === LUNCH, start, end }))),
    rooms: ds.rooms.map((x) => ({ id: rId.get(x.code)!, code: x.code, type: x.type, capacity: x.capacity })),
    teachers: ds.teachers.map((t) => ({ id: tId.get(t.code)!, name: t.name, maxHours: t.maxHours, unavailable: t.unavailable, preferred: t.preferred })),
    enrollments: ds.enrollments.map((e, i) => {
      const s = subj.get(e.subjectCode)!;
      const st = e.studentCode ? students.get(e.studentCode)! : null;
      const g = groups.get(st ? st.groupCode : e.groupCode!)!;
      return { id: i + 1, subjectCode: s.code, subjectName: s.name, teacherId: tId.get(e.teacherCode)!,
        groupId: st ? null : gId.get(g.code)!, studentId: st ? sId.get(st.code)! : null, homeGroupId: gId.get(g.code)!,
        label: st ? st.name : g.name, hours: s.theory + s.practice, roomType: s.roomType, size: st ? 1 : size.get(g.code) ?? 0,
        allowedDays: g.studyDays, allowSplit: false };
    }),
  };
}
