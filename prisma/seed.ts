// Seed: creates a demo organization + admin user for local development
// Run: npm run db:seed

import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  const org = await prisma.organization.upsert({
    where: { slug: "demo-org" },
    update: {},
    create: {
      name: "Demo Organization",
      slug: "demo-org",
      country: "KE",
      currency: "KES",
      industry: "Technology",
    },
  });

  const adminHash = await bcrypt.hash("Admin@123456", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@demo.mkataba.app" },
    update: {},
    create: {
      organizationId: org.id,
      email: "admin@demo.mkataba.app",
      passwordHash: adminHash,
      name: "System Admin",
      role: UserRole.ADMIN,
      emailVerified: new Date(),
    },
  });

  const legalHash = await bcrypt.hash("Legal@123456", 12);
  await prisma.user.upsert({
    where: { email: "legal@demo.mkataba.app" },
    update: {},
    create: {
      organizationId: org.id,
      email: "legal@demo.mkataba.app",
      passwordHash: legalHash,
      name: "Legal Reviewer",
      role: UserRole.LEGAL_REVIEWER,
      emailVerified: new Date(),
    },
  });

  const approverHash = await bcrypt.hash("Approver@123456", 12);
  await prisma.user.upsert({
    where: { email: "approver@demo.mkataba.app" },
    update: {},
    create: {
      organizationId: org.id,
      email: "approver@demo.mkataba.app",
      passwordHash: approverHash,
      name: "Contract Approver",
      role: UserRole.APPROVER,
      emailVerified: new Date(),
    },
  });

  // Sample draft contract
  await prisma.contract.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      organizationId: org.id,
      creatorId: admin.id,
      title: "Software Development Services Agreement",
      type: "SERVICE_AGREEMENT",
      counterpartyName: "Jane Wanjiku",
      counterpartyEmail: "jane@techpartner.co.ke",
      counterpartyCompany: "TechPartner Ltd",
      value: 2500000,
      currency: "KES",
      effectiveDate: new Date("2026-07-01"),
      expirationDate: new Date("2027-06-30"),
      tags: ["technology", "development"],
    },
  });

  console.log("Seed complete.");
  console.log("  Admin:    admin@demo.mkataba.app  / Admin@123456");
  console.log("  Legal:    legal@demo.mkataba.app  / Legal@123456");
  console.log("  Approver: approver@demo.mkataba.app / Approver@123456");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
