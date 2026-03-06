import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const lessons = await prisma.lesson.findMany({
    orderBy: { position: "asc" },
    include: { _count: { select: { deliveries: true } } },
  });

  return NextResponse.json(lessons);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { title, body, status } = await req.json();

  if (!title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const maxPosition = await prisma.lesson.aggregate({ _max: { position: true } });
  const nextPosition = (maxPosition._max.position ?? 0) + 1;

  const lesson = await prisma.lesson.create({
    data: {
      title: title.trim(),
      body: body || null,
      status: status || "draft",
      position: nextPosition,
    },
  });

  return NextResponse.json(lesson, { status: 201 });
}
