import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { provider } = await req.json();

  if (provider === "ghost") {
    const apiUrl = (await prisma.setting.findUnique({ where: { key: "ghost_api_url" } }))?.value;
    const apiKey = (await prisma.setting.findUnique({ where: { key: "ghost_admin_api_key" } }))?.value;

    if (!apiUrl || !apiKey) {
      return NextResponse.json({ ok: false, error: "Missing Ghost API URL or Admin API Key" });
    }

    try {
      const [id, secret] = apiKey.split(":");
      const crypto = await import("crypto");
      const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT", kid: id })).toString("base64url");
      const now = Math.floor(Date.now() / 1000);
      const payload = Buffer.from(JSON.stringify({ iat: now, exp: now + 300, aud: "/admin/" })).toString("base64url");
      const hmac = crypto.createHmac("sha256", Buffer.from(secret, "hex"));
      hmac.update(`${header}.${payload}`);
      const signature = hmac.digest("base64url");
      const token = `${header}.${payload}.${signature}`;

      const res = await fetch(`${apiUrl}/ghost/api/admin/members/?limit=1`, {
        headers: { Authorization: `Ghost ${token}` },
      });

      if (!res.ok) {
        return NextResponse.json({ ok: false, error: `Ghost API returned ${res.status}` });
      }

      const data = await res.json();
      const total = data.meta?.pagination?.total ?? 0;
      return NextResponse.json({ ok: true, message: `Connected. ${total} members found.` });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      return NextResponse.json({ ok: false, error: message });
    }
  }

  if (provider === "stripe") {
    const apiKey = (await prisma.setting.findUnique({ where: { key: "stripe_api_key" } }))?.value;
    const productId = (await prisma.setting.findUnique({ where: { key: "stripe_product_id" } }))?.value;

    if (!apiKey || !productId) {
      return NextResponse.json({ ok: false, error: "Missing Stripe API Key or Product ID" });
    }

    try {
      const res = await fetch(`https://api.stripe.com/v1/products/${productId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      if (!res.ok) {
        return NextResponse.json({ ok: false, error: `Stripe API returned ${res.status}` });
      }

      const product = await res.json();
      return NextResponse.json({ ok: true, message: `Connected. Product: ${product.name}` });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      return NextResponse.json({ ok: false, error: message });
    }
  }

  return NextResponse.json({ ok: false, error: "Unknown provider" });
}
