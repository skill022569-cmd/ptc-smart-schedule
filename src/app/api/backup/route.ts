import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth";
import { SEMESTER, prisma } from "@/lib/db";

interface Snapshot {
  version: 1;
  schedules: { semester: string; enrollmentId: number; roomId: number | null; slotId: number | null; status: "VALID" | "CONFLICT"; conflictReason: string | null }[];
  allowSplit: number[]; // enrollment ที่อนุญาตแบ่งคาบ
}

export async function GET(req: Request) {
  const u = await apiUser(["ADMIN"]);
  if (u instanceof NextResponse) return u;
  const id = new URL(req.url).searchParams.get("id");
  if (id) {
    const b = await prisma.systemBackup.findUnique({ where: { id: Number(id) } });
    if (!b) return NextResponse.json({ error: "ไม่พบ" }, { status: 404 });
    return new NextResponse(JSON.stringify(b.snapshotData), {
      headers: { "content-type": "application/json", "content-disposition": `attachment; filename="backup-${b.id}.json"` } });
  }
  const list = await prisma.systemBackup.findMany({ select: { id: true, backupName: true, createdAt: true, createdBy: { select: { fullName: true } } }, orderBy: { createdAt: "desc" } });
  return NextResponse.json(list);
}

export async function POST(req: Request) {
  const u = await apiUser(["ADMIN"]);
  if (u instanceof NextResponse) return u;
  const { action, name, id } = await req.json().catch(() => ({}));
  if (action === "create") {
    const [schedules, split] = await Promise.all([
      prisma.schedule.findMany({ select: { semester: true, enrollmentId: true, roomId: true, slotId: true, status: true, conflictReason: true } }),
      prisma.enrollment.findMany({ where: { allowSplit: true }, select: { id: true } }),
    ]);
    const snap: Snapshot = { version: 1, schedules, allowSplit: split.map((e) => e.id) };
    const b = await prisma.systemBackup.create({
      data: { backupName: String(name || `Snapshot ${new Date().toLocaleString("th-TH")}`).slice(0, 190), snapshotData: snap as object, createdById: u.id },
      select: { id: true, backupName: true },
    });
    return NextResponse.json(b);
  }
  if (action === "restore") {
    const b = await prisma.systemBackup.findUnique({ where: { id: Number(id) } });
    if (!b) return NextResponse.json({ error: "ไม่พบจุดสำรอง" }, { status: 404 });
    const snap = b.snapshotData as unknown as Snapshot;
    // ข้ามแถวที่อ้างถึง enrollment/ห้อง/คาบ ที่ถูกลบไปแล้ว เพื่อไม่ให้ restore ล้มทั้งชุด
    const [en, rooms, slots] = await Promise.all([
      prisma.enrollment.findMany({ select: { id: true } }), prisma.room.findMany({ select: { id: true } }), prisma.timeslot.findMany({ select: { id: true } })]);
    const E = new Set(en.map((x) => x.id)), R = new Set(rooms.map((x) => x.id)), S = new Set(slots.map((x) => x.id));
    const rows = snap.schedules.filter((r) => E.has(r.enrollmentId) && (r.roomId == null || R.has(r.roomId)) && (r.slotId == null || S.has(r.slotId)));
    await prisma.$transaction([
      prisma.schedule.deleteMany({}),
      prisma.schedule.createMany({ data: rows }),
      prisma.enrollment.updateMany({ data: { allowSplit: false } }),
      prisma.enrollment.updateMany({ where: { id: { in: snap.allowSplit.filter((x) => E.has(x)) } }, data: { allowSplit: true } }),
    ]);
    return NextResponse.json({ ok: true, restored: rows.length, skipped: snap.schedules.length - rows.length, semester: SEMESTER });
  }
  return NextResponse.json({ error: "action ไม่ถูกต้อง" }, { status: 400 });
}
