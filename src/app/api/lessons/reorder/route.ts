import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ids } = await req.json();

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids array is required" }, { status: 400 });
  }

  // Only update lessons belonging to this account
  await Promise.all(
    ids.map((id: string, index: number) =>
      prisma.lesson.updateMany({
        where: { id, accountId: auth.accountId },
        data: { position: index + 1 },
      })
    )
  );

  return NextResponse.json({ ok: true });
}
