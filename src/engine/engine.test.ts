import { test } from "node:test";
import assert from "node:assert/strict";
import { makeDataset, toEngineInput } from "../../prisma/data";
import { buildCtx, runEngine, validate, type EngineInput } from "./index";
import { analyze } from "./conflict-analyzer";

test("demo dataset: ไม่มี hard violation และกรณีครูสมศรีถูกวิเคราะห์พร้อมทางแก้แบ่งคาบ", () => {
  const input = toEngineInput(makeDataset("demo"));
  const res = runEngine(input, { timeLimitMs: 3000 });
  assert.equal(validate(res.ctx, res.state.place).size, 0);
  const somsri = res.conflicts.find((c) => c.teacher === "ครูสมศรี ใจดี");
  assert.ok(somsri, "ควรจัดวิชาครูสมศรีไม่ได้");
  assert.match(somsri.reasons.join(" "), /คาบ 3-4/);
  assert.match(somsri.reasons.join(" "), /คาบ 6 กลุ่มเรียน .* มีเรียนวิชา 30204-2102/);
  assert.ok(somsri.split, "ควรเสนอแบ่ง 2+1");
  assert.deepEqual(somsri.split.map((r) => r.length).sort(), [1, 2]);
});

test("ตรวจจับคาบชน: ครู/ห้อง/กลุ่ม/นักเรียนคู่ขนานรายบุคคล", () => {
  const input: EngineInput = {
    slots: [1, 2, 3, 4].map((p) => ({ id: p, day: 1, period: p, isLunch: false, start: "", end: "" })),
    rooms: [{ id: 1, code: "R1", type: "LECTURE", capacity: 40 }, { id: 2, code: "R2", type: "LECTURE", capacity: 40 }],
    teachers: [1, 2, 3].map((id) => ({ id, name: `T${id}`, maxHours: 20, unavailable: [], preferred: "ANY" as const })),
    enrollments: [
      { id: 1, subjectCode: "A", subjectName: "A", teacherId: 1, groupId: 1, studentId: null, homeGroupId: 1, label: "G1", hours: 1, roomType: null, size: 30, allowedDays: [1], allowSplit: false },
      { id: 2, subjectCode: "B", subjectName: "B", teacherId: 2, groupId: null, studentId: 9, homeGroupId: 1, label: "S9", hours: 1, roomType: null, size: 1, allowedDays: [1], allowSplit: false },
      { id: 3, subjectCode: "C", subjectName: "C", teacherId: 3, groupId: null, studentId: 8, homeGroupId: 1, label: "S8", hours: 1, roomType: null, size: 1, allowedDays: [1], allowSplit: false },
    ],
  };
  // นักเรียนรายบุคคลชนกับวิชาทั้งกลุ่มของกลุ่มตัวเอง
  let { ctx } = buildCtx(input);
  assert.equal(validate(ctx, [{ day: 1, start: 1, roomId: 1 }, { day: 1, start: 1, roomId: 2 }, null]).size, 1);
  // นักเรียนรายบุคคล 2 คนกลุ่มเดียวกันเรียนพร้อมกันได้ (คนละครู คนละห้อง)
  assert.equal(validate(ctx, [null, { day: 1, start: 2, roomId: 1 }, { day: 1, start: 2, roomId: 2 }]).size, 0);
  // ห้องเดียวกันพร้อมกัน = ชน
  assert.equal(validate(ctx, [null, { day: 1, start: 2, roomId: 1 }, { day: 1, start: 2, roomId: 1 }]).size, 1);
  ({ ctx } = buildCtx({ ...input, enrollments: input.enrollments.map((e) => ({ ...e, teacherId: 1 })) }));
  assert.equal(validate(ctx, [null, { day: 1, start: 3, roomId: 1 }, { day: 1, start: 3, roomId: 2 }]).size, 1); // ครูคนเดียวสอน 2 ที่
  const r = runEngine(input, { timeLimitMs: 200 });
  assert.equal(r.conflicts.length, 0);
});

test("ไม่วางทับพักเที่ยงและเวลาที่ครูไม่สะดวก; swap แนะนำย้ายผู้ขวาง", () => {
  const input: EngineInput = {
    slots: [1, 2, 3, 4, 5, 6].map((p) => ({ id: p, day: 1, period: p, isLunch: p === 3, start: "", end: "" })),
    rooms: [{ id: 1, code: "R1", type: "LECTURE", capacity: 40 }],
    teachers: [{ id: 1, name: "A", maxHours: 9, unavailable: [{ day: 1, period: 4 }, { day: 1, period: 5 }, { day: 1, period: 6 }], preferred: "ANY" }, { id: 2, name: "B", maxHours: 9, unavailable: [], preferred: "ANY" }],
    enrollments: [
      { id: 1, subjectCode: "LONG", subjectName: "L", teacherId: 1, groupId: 1, studentId: null, homeGroupId: 1, label: "G1", hours: 2, roomType: null, size: 10, allowedDays: [1], allowSplit: false },
      { id: 2, subjectCode: "ONE", subjectName: "O", teacherId: 2, groupId: 1, studentId: null, homeGroupId: 1, label: "G1", hours: 1, roomType: null, size: 10, allowedDays: [1], allowSplit: false },
    ],
  };
  const { ctx, state } = buildCtx(input, [{ enrollmentId: 2, day: 1, start: 1, length: 1, roomId: 1 }]);
  const [rep] = analyze(ctx, state);
  assert.equal(rep.subjectCode, "LONG");
  assert.ok(rep.swap);
  assert.deepEqual([rep.swap.place.start, rep.swap.moves[0].to.start >= 4], [1, true]);
  assert.ok(rep.grid.find((g) => g.period === 3)!.lunch);
});
