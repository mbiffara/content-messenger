import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

async function getSetting(accountId: string, key: string): Promise<string | null> {
  const s = await prisma.setting.findUnique({
    where: { accountId_key: { accountId, key } },
  });
  return s?.value ?? null;
}

async function syncStripeForAccount(accountId: string, accountName: string) {
  const apiKey = await getSetting(accountId, "stripe_api_key");
  const productId = await getSetting(accountId, "stripe_product_id");
  if (!apiKey || !productId) return null; // Not configured, skip

  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(apiKey);

  // Get all prices for the product
  const prices = await stripe.prices.list({ product: productId, limit: 100 });
  const priceIds = new Set(prices.data.map((p) => p.id));

  // Fetch all subscriptions that use those prices
  const customerIds = new Set<string>();
  for await (const sub of stripe.subscriptions.list({ limit: 100, status: "all", expand: ["data.customer"] })) {
    const hasProduct = sub.items.data.some((item) => priceIds.has(item.price.id));
    if (hasProduct && typeof sub.customer !== "string" && !("deleted" in sub.customer) && sub.customer.email) {
      customerIds.add(sub.customer.id);
    }
  }

  // Check one-time payments via invoices
  for await (const invoice of stripe.invoices.list({ limit: 100, expand: ["data.customer"] })) {
    if (!invoice.customer || typeof invoice.customer === "string") continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hasProduct = invoice.lines.data.some((line: any) => line.price && priceIds.has(line.price.id));
    if (hasProduct && !("deleted" in invoice.customer) && invoice.customer.email) {
      customerIds.add(invoice.customer.id);
    }
  }

  // Fetch customer details
  const customers: { id: string; email: string; name: string | null }[] = [];
  for (const custId of Array.from(customerIds)) {
    const c = await stripe.customers.retrieve(custId);
    if (!("deleted" in c) && c.email) {
      customers.push({ id: c.id, email: c.email, name: c.name ?? null });
    }
  }

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
  }

  // Deactivate removed subscribers
  const { count: deactivated } = await prisma.subscriber.updateMany({
    where: { accountId, email: { notIn: Array.from(syncedEmails) }, active: true },
    data: { active: false },
  });

  // Re-activate returning subscribers
  await prisma.subscriber.updateMany({
    where: { accountId, email: { in: Array.from(syncedEmails) }, active: false },
    data: { active: true },
  });

  console.log(`[sync] Account "${accountName}": ${customers.length} customers, ${created} created, ${updated} updated, ${deactivated} deactivated`);
  return { synced: customers.length, created, updated, deactivated };
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.NEXTAUTH_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accounts = await prisma.account.findMany();
  const results: Record<string, unknown> = {};

  for (const account of accounts) {
    try {
      const result = await syncStripeForAccount(account.id, account.name);
      if (result) {
        results[account.name] = result;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[sync] Failed for account "${account.name}":`, msg);
      results[account.name] = { error: msg };
    }
  }

  return NextResponse.json({ accounts: results });
}
