import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ALLOWED_KEYS = [
  "sync_provider",
  "ghost_api_url",
  "ghost_admin_api_key",
  "stripe_api_key",
  "stripe_product_id",
  "whatsapp_phone_number_id",
  "whatsapp_access_token",
];

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const settings = await prisma.setting.findMany();
  const map: Record<string, string> = {};
  for (const s of settings) {
    // Mask sensitive values
    if (s.key.includes("key") || s.key.includes("token")) {
      map[s.key] = s.value.length > 6 ? "••••••" + s.value.slice(-6) : "••••••";
    } else {
      map[s.key] = s.value;
    }
  }

  return NextResponse.json(map);
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const entries = Object.entries(body) as [string, string][];

  for (const [key, value] of entries) {
    if (!ALLOWED_KEYS.includes(key)) continue;

    // Skip masked values (haven't been changed)
    if (typeof value === "string" && value.startsWith("••••••")) continue;

    if (value === "" || value === null) {
      await prisma.setting.deleteMany({ where: { key } });
    } else {
      await prisma.setting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
