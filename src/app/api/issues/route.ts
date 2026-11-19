import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth";
import { ISSUE_CATEGORIES as CATEGORIES, prisma } from "@/lib/db";


export async function POST(req: Request) {
  const u = await apiUser();
  if (u instanceof NextResponse) return u;
  const { category, description } = await req.json().catch(() => ({}));
  if (!CATEGORIES.includes(category) || typeof description !== "string" || !description.trim() || description.length > 5000)
    return NextResponse.json({ error: "กรุณาเลือกหมวดหมู่และกรอกรายละเอียด (ไม่เกิน 5000 ตัวอักษร)" }, { status: 400 });
  const issue = await prisma.issueReport.create({ data: { reporterId: u.id, category, description: description.trim() } });
  return NextResponse.json(issue);
}

export async function PATCH(req: Request) {
  const u = await apiUser(["ADMIN"]);
  if (u instanceof NextResponse) return u;
  const { id, status, adminReply } = await req.json().catch(() => ({}));
  if (!["PENDING", "IN_PROGRESS", "DONE"].includes(status)) return NextResponse.json({ error: "สถานะไม่ถูกต้อง" }, { status: 400 });
  const issue = await prisma.issueReport.update({ where: { id: Number(id) }, data: { status, adminReply: typeof adminReply === "string" ? adminReply : undefined } });
  return NextResponse.json(issue);
}
