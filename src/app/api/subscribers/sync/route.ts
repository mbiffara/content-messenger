import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ENV_FALLBACKS: Record<string, string | undefined> = {
  sync_provider: "ghost",
  ghost_api_url: process.env.GHOST_URL,
  ghost_admin_api_key: process.env.GHOST_ADMIN_API_KEY,
  stripe_api_key: process.env.STRIPE_API_KEY,
  stripe_product_id: process.env.STRIPE_PRODUCT_ID,
};

async function getSetting(accountId: string, key: string): Promise<string | null> {
  const s = await prisma.setting.findUnique({
    where: { accountId_key: { accountId, key } },
  });
  return s?.value ?? ENV_FALLBACKS[key] ?? null;
}

async function syncGhost(accountId: string) {
  const apiUrl = await getSetting(accountId, "ghost_api_url");
  const apiKey = await getSetting(accountId, "ghost_admin_api_key");
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
    const existing = await prisma.subscriber.findFirst({
      where: { accountId, ghostId: member.id },
    });
    if (existing) {
      await prisma.subscriber.update({
        where: { id: existing.id },
        data: { email: member.email, name: member.name },
      });
      updated++;
    } else {
      const byEmail = await prisma.subscriber.findUnique({
        where: { accountId_email: { accountId, email: member.email } },
      });
      if (byEmail) {
        await prisma.subscriber.update({
          where: { id: byEmail.id },
          data: { ghostId: member.id, name: member.name },
        });
        updated++;
      } else {
        await prisma.subscriber.create({
          data: { accountId, email: member.email, name: member.name, ghostId: member.id },
        });
        created++;
      }
    }
  }

  return { synced: members.length, created, updated };
}

async function syncStripe(accountId: string, send: (step: string) => void) {
  const apiKey = await getSetting(accountId, "stripe_api_key");
  const productId = await getSetting(accountId, "stripe_product_id");
  if (!apiKey || !productId) throw new Error("Stripe not configured. Go to Settings to set it up.");

  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(apiKey);

  send("Fetching prices for product...");

  // First, get all prices for the selected product
  const prices = await stripe.prices.list({ product: productId, limit: 100 });
  const priceIds = new Set(prices.data.map((p) => p.id));

  send(`Found ${priceIds.size} price(s). Scanning subscriptions...`);

  // Fetch all subscriptions (active + past) that use any of those prices
  const customerIds = new Set<string>();
  let subCount = 0;
  for await (const sub of stripe.subscriptions.list({ limit: 100, status: "all", expand: ["data.customer"] })) {
    subCount++;
    if (subCount % 100 === 0) send(`Scanned ${subCount} subscriptions, ${customerIds.size} matched...`);
    const hasProduct = sub.items.data.some((item) => priceIds.has(item.price.id));
    if (hasProduct && typeof sub.customer !== "string" && !("deleted" in sub.customer) && sub.customer.email) {
      customerIds.add(sub.customer.id);
    }
  }

  send(`Scanned ${subCount} subscriptions, ${customerIds.size} matched. Scanning invoices...`);

  // Also check one-time payments (payment intents) via invoice line items
  let invCount = 0;
  for await (const invoice of stripe.invoices.list({ limit: 100, expand: ["data.customer"] })) {
    invCount++;
    if (invCount % 100 === 0) send(`Scanned ${invCount} invoices, ${customerIds.size} customers matched...`);
    if (!invoice.customer || typeof invoice.customer === "string") continue;
    const lines = invoice.lines.data;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hasProduct = lines.some((line: any) => line.price && priceIds.has(line.price.id));
    if (hasProduct && !("deleted" in invoice.customer) && invoice.customer.email) {
      customerIds.add(invoice.customer.id);
    }
  }

  send(`Found ${customerIds.size} customers. Fetching details...`);

  // Fetch full customer details for matched IDs
  const customers: { id: string; email: string; name: string | null }[] = [];
  let fetched = 0;
  for (const custId of Array.from(customerIds)) {
    const c = await stripe.customers.retrieve(custId);
    if (!("deleted" in c) && c.email) {
      customers.push({ id: c.id, email: c.email, name: c.name ?? null });
    }
    fetched++;
    if (fetched % 50 === 0) send(`Fetched ${fetched}/${customerIds.size} customers...`);
  }

  send(`Saving ${customers.length} subscribers...`);

  let created = 0;
  let updated = 0;

  const syncedEmails = new Set<string>();

  for (const customer of customers) {
    if (!customer.email) continue;
    syncedEmails.add(customer.email);
    const byEmail = await prisma.subscriber.findUnique({
      where: { accountId_email: { accountId, email: customer.email } },
    });
    if (byEmail) {
      await prisma.subscriber.update({
        where: { id: byEmail.id },
        data: { name: customer.name || byEmail.name },
      });
      updated++;
    } else {
      await prisma.subscriber.create({
        data: { accountId, email: customer.email, name: customer.name },
      });
      created++;
    }
    if ((created + updated) % 50 === 0) send(`Saved ${created + updated}/${customers.length}...`);
  }

  // Deactivate subscribers who are no longer customers of this product
  send("Deactivating removed subscribers...");
  const { count: deactivated } = await prisma.subscriber.updateMany({
    where: { accountId, email: { notIn: Array.from(syncedEmails) }, active: true },
    data: { active: false },
  });

  // Re-activate subscribers who are back
  await prisma.subscriber.updateMany({
    where: { accountId, email: { in: Array.from(syncedEmails) }, active: false },
    data: { active: true },
  });

  return { synced: customers.length, created, updated, deactivated };
}

export async function POST() {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const provider = await getSetting(auth.accountId, "sync_provider");

  if (provider === "stripe") {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (step: string) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ step })}\n\n`));
        };
        try {
          const result = await syncStripe(auth.accountId, send);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, ...result })}\n\n`));
        } catch (e: unknown) {
          const message = e instanceof Error ? e.message : "Sync failed";
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`));
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  // Ghost (non-streaming)
  try {
    return NextResponse.json(await syncGhost(auth.accountId));
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
