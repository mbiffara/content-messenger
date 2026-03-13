import { config } from "dotenv";
config(); // Load .env file

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import bcrypt from "bcryptjs";
import path from "path";

// Resolve to absolute file: URL for libsql
const raw = process.env.DATABASE_URL || "file:./dev.db";
const dbPath = raw.replace(/^file:/, "");
const absPath = path.isAbsolute(dbPath) ? dbPath : path.resolve(process.cwd(), dbPath);
const url = `file:${absPath}`;
const adapter = new PrismaLibSql({ url });
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.env.ADMIN_EMAIL || "admin@example.com";
  const password = process.env.ADMIN_PASSWORD || "change-this-password";
  const passwordHash = await bcrypt.hash(password, 10);

  // Create default account
  const account = await prisma.account.upsert({
    where: { slug: "default" },
    update: {},
    create: {
      name: "Default Account",
      slug: "default",
      whatsappSessionId: "default",
    },
  });

  // Create super admin user
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: "Admin",
      passwordHash,
      role: "super_admin",
    },
  });

  // Link user to account
  await prisma.accountMember.upsert({
    where: { userId_accountId: { userId: user.id, accountId: account.id } },
    update: {},
    create: {
      userId: user.id,
      accountId: account.id,
    },
  });

  console.log(`Seeded: super admin ${email}, account "${account.name}" (${account.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
