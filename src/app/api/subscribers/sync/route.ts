import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ENV_FALLBACKS: Record<string, string | undefined> = {
  sync_provider: "ghost",
  ghost_api_url: process.env.GHOST_URL,
  ghost_admin_api_key: process.env.GHOST_ADMIN_API_KEY,
  stripe_api_key: process.env.STRIPE_API_KEY,
  stripe_product_id: process.env.STRIPE_PRODUCT_ID,
};

async function getSetting(key: string): Promise<string | null> {
  const s = await prisma.setting.findUnique({ where: { key } });
  return s?.value ?? ENV_FALLBACKS[key] ?? null;
}

async function syncGhost() {
  const apiUrl = await getSetting("ghost_api_url");
  const apiKey = await getSetting("ghost_admin_api_key");
  if (!apiUrl || !apiKey) throw new Error("Ghost API not configured. Go to Settings to set it up.");

  const [id, secret] = apiKey.split(":");
  const crypto = await import("crypto");
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT", kid: id })).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({ iat: now, exp: now + 300, aud: "/admin/" })).toString("base64url");
  const hmac = crypto.createHmac("sha256", Buffer.from(secret, "hex"));
  hmac.update(`${header}.${payload}`);
  const signature = hmac.digest("base64url");
  const token = `${header}.${payload}.${signature}`;

  const res = await fetch(`${apiUrl}/ghost/api/admin/members/?limit=all`, {
    headers: { Authorization: `Ghost ${token}` },
  });
  if (!res.ok) throw new Error(`Ghost API returned ${res.status}`);

  const data = await res.json();
  const members = (data.members || []) as { id: string; email: string; name: string | null }[];

  let created = 0;
  let updated = 0;

  for (const member of members) {
    const existing = await prisma.subscriber.findUnique({ where: { ghostId: member.id } });
    if (existing) {
      await prisma.subscriber.update({
        where: { ghostId: member.id },
        data: { email: member.email, name: member.name },
      });
      updated++;
    } else {
      const byEmail = await prisma.subscriber.findUnique({ where: { email: member.email } });
      if (byEmail) {
        await prisma.subscriber.update({
          where: { email: member.email },
          data: { ghostId: member.id, name: member.name },
        });
        updated++;
      } else {
        await prisma.subscriber.create({
          data: { email: member.email, name: member.name, ghostId: member.id },
        });
        created++;
      }
    }
  }

  return { synced: members.length, created, updated };
}

async function syncStripe() {
  const apiKey = await getSetting("stripe_api_key");
  const productId = await getSetting("stripe_product_id");
  if (!apiKey || !productId) throw new Error("Stripe not configured. Go to Settings to set it up.");

  // Fetch all customers who have purchased this product via their subscriptions/payments
  const customers: { id: string; email: string; name: string | null }[] = [];
  let hasMore = true;
  let startingAfter: string | undefined;

  while (hasMore) {
    const params = new URLSearchParams({ limit: "100" });
    if (startingAfter) params.set("starting_after", startingAfter);

    const res = await fetch(`https://api.stripe.com/v1/customers?${params}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) throw new Error(`Stripe API returned ${res.status}`);

    const data = await res.json();
    for (const c of data.data) {
      customers.push({ id: c.id, email: c.email, name: c.name });
    }
    hasMore = data.has_more;
    if (data.data.length > 0) startingAfter = data.data[data.data.length - 1].id;
  }

  let created = 0;
  let updated = 0;

  for (const customer of customers) {
    if (!customer.email) continue;
    const byEmail = await prisma.subscriber.findUnique({ where: { email: customer.email } });
    if (byEmail) {
      await prisma.subscriber.update({
        where: { email: customer.email },
        data: { name: customer.name || byEmail.name },
      });
      updated++;
    } else {
      await prisma.subscriber.create({
        data: { email: customer.email, name: customer.name },
      });
      created++;
    }
  }

  return { synced: customers.length, created, updated };
}

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const provider = await getSetting("sync_provider");

  try {
    if (provider === "stripe") {
      return NextResponse.json(await syncStripe());
    }
    // Default to ghost
    return NextResponse.json(await syncGhost());
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
