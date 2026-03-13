import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const lessons = await prisma.lesson.findMany({
    where: { accountId: auth.accountId },
    orderBy: { position: "asc" },
    include: { _count: { select: { deliveries: true } } },
  });

  return NextResponse.json(lessons);
}

export async function POST(req: NextRequest) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { title, body, audioUrl, audioFileName, imageUrl, status } = await req.json();

  if (!title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const maxPosition = await prisma.lesson.aggregate({
    where: { accountId: auth.accountId },
    _max: { position: true },
  });
  const nextPosition = (maxPosition._max.position ?? 0) + 1;

  const lesson = await prisma.lesson.create({
    data: {
      accountId: auth.accountId,
      title: title.trim(),
      body: body || null,
      audioUrl: audioUrl || null,
      audioFileName: audioFileName || null,
      imageUrl: imageUrl || null,
      status: status || "draft",
      position: nextPosition,
    },
  });

  return NextResponse.json(lesson, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, title, body, audioUrl, audioFileName, imageUrl, status } = await req.json();

  if (!id) {
    return NextResponse.json({ error: "ID is required" }, { status: 400 });
  }

  // Verify lesson belongs to this account
  const existing = await prisma.lesson.findFirst({
    where: { id, accountId: auth.accountId },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (title !== undefined) data.title = title.trim();
  if (body !== undefined) data.body = body || null;
  if (audioUrl !== undefined) data.audioUrl = audioUrl || null;
  if (audioFileName !== undefined) data.audioFileName = audioFileName || null;
  if (imageUrl !== undefined) data.imageUrl = imageUrl || null;
  if (status !== undefined) data.status = status;

  const lesson = await prisma.lesson.update({
    where: { id },
    data,
  });

  return NextResponse.json(lesson);
}
