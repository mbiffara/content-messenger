import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Stripe from "stripe";

export async function POST(req: NextRequest) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  let apiKey = body.apiKey as string | undefined;

  // If no key provided (or masked), read from DB
  if (!apiKey || apiKey.startsWith("••••••")) {
    const setting = await prisma.setting.findUnique({
      where: { accountId_key: { accountId: auth.accountId, key: "stripe_api_key" } },
    });
    if (!setting) return NextResponse.json({ error: "No Stripe API key configured" }, { status: 400 });
    apiKey = setting.value;
  }

  try {
    const stripe = new Stripe(apiKey);
    const products = await stripe.products.list({ active: true, limit: 100 });

    return NextResponse.json(
      products.data.map((p) => ({ id: p.id, name: p.name }))
    );
  } catch (err) {
    const message = err instanceof Stripe.errors.StripeAuthenticationError
      ? "Invalid API key"
      : String(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
