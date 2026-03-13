import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ALLOWED_KEYS = [
  "sync_provider",
  "ghost_api_url",
  "ghost_admin_api_key",
  "stripe_api_key",
  "stripe_product_id",
  "whatsapp_phone_number_id",
  "whatsapp_access_token",
  "greeting_message",
  "greeting_enabled",
  "lesson_delivery_time",
  "lesson_delivery_timezone",
  "last_synced_at",
];

const STRIPE_KEYS = ["stripe_api_key", "stripe_product_id"];

export async function GET() {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const settings = await prisma.setting.findMany({
    where: { accountId: auth.accountId },
  });
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
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const entries = Object.entries(body) as [string, string][];

  for (const [key, value] of entries) {
    if (!ALLOWED_KEYS.includes(key)) continue;

    // Only account_admin+ can edit Stripe keys
    if (STRIPE_KEYS.includes(key) && !auth.canEditStripe) continue;

    // Skip masked values (haven't been changed)
    if (typeof value === "string" && value.startsWith("••••••")) continue;

    if (value === "" || value === null) {
      await prisma.setting.deleteMany({ where: { accountId: auth.accountId, key } });
    } else {
      await prisma.setting.upsert({
        where: { accountId_key: { accountId: auth.accountId, key } },
        create: { accountId: auth.accountId, key, value },
        update: { value },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
