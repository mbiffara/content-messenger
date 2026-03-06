import GhostContentAPI from "@tryghost/content-api";

let _ghost: ReturnType<typeof GhostContentAPI> | null = null;

export function getGhostClient() {
  if (!_ghost) {
    _ghost = new GhostContentAPI({
      url: process.env.GHOST_URL!,
      key: process.env.GHOST_CONTENT_API_KEY!,
      version: "v5.0",
    });
  }
  return _ghost;
}

export interface GhostMember {
  id: string;
  email: string;
  name: string | null;
}

export async function getGhostMembers(): Promise<GhostMember[]> {
  // Ghost Content API doesn't expose members directly.
  // Use the Admin API endpoint instead.
  const url = `${process.env.GHOST_URL}/ghost/api/admin/members/?limit=all`;

  // Ghost Admin API key is split into id:secret
  const [id, secret] = (process.env.GHOST_ADMIN_API_KEY || "").split(":");

  // Create JWT token for Ghost Admin API
  const crypto = await import("crypto");
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT", kid: id })).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({ iat: now, exp: now + 300, aud: "/admin/" })
  ).toString("base64url");

  const hmac = crypto.createHmac("sha256", Buffer.from(secret, "hex"));
  hmac.update(`${header}.${payload}`);
  const signature = hmac.digest("base64url");
  const token = `${header}.${payload}.${signature}`;

  const res = await fetch(url, {
    headers: { Authorization: `Ghost ${token}` },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    throw new Error(`Ghost Admin API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  return (data.members || []).map((m: { id: string; email: string; name: string | null }) => ({
    id: m.id,
    email: m.email,
    name: m.name,
  }));
}
