import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const BAILEYS_URL = process.env.BAILEYS_URL || "http://localhost:3006";

// GET /api/whatsapp?action=sessions | action=status
export async function GET(req: NextRequest) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await prisma.account.findUnique({ where: { id: auth.accountId } });
  if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  const sessionId = account.whatsappSessionId;
  const action = req.nextUrl.searchParams.get("action");

  try {
    if (action === "status") {
      const res = await fetch(`${BAILEYS_URL}/sessions/${sessionId}/status`);
      if (res.status === 404) return NextResponse.json({ status: "disconnected" });
      const data = await res.json();
      return NextResponse.json(data);
    }

    // Default: list sessions
    const res = await fetch(`${BAILEYS_URL}/sessions`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Baileys service not reachable" }, { status: 502 });
  }
}

// POST /api/whatsapp { action: "connect" | "disconnect" }
export async function POST(req: NextRequest) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await prisma.account.findUnique({ where: { id: auth.accountId } });
  if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  const sessionId = account.whatsappSessionId;
  const body = await req.json();
  const { action } = body;

  try {
    if (action === "connect") {
      const res = await fetch(`${BAILEYS_URL}/sessions/${sessionId}/connect`, { method: "POST" });
      const data = await res.json();
      return NextResponse.json(data);
    }

    if (action === "disconnect") {
      const res = await fetch(`${BAILEYS_URL}/sessions/${sessionId}`, { method: "DELETE" });
      const data = await res.json();
      return NextResponse.json(data);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Baileys service not reachable" }, { status: 502 });
  }
}
