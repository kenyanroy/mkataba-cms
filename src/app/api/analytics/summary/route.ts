import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { hasPermission } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/client";
import { ContractStatus, UserRole } from "@prisma/client";

export async function GET(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!hasPermission(session.user.role as UserRole, "analytics:view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const orgId = session.user.organizationId!;
  const now = new Date();
  const thirtyDaysOut = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysOut = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  const [
    statusCounts,
    tcvResult,
    expiringIn30,
    expiringIn90,
    overdueApprovals,
    signingRateData,
  ] = await Promise.all([
    prisma.contract.groupBy({
      by: ["status"],
      where: { organizationId: orgId, deletedAt: null },
      _count: { id: true },
    }),
    prisma.contract.aggregate({
      where: {
        organizationId: orgId,
        status: ContractStatus.EXECUTED,
        deletedAt: null,
      },
      _sum: { value: true },
    }),
    prisma.contract.count({
      where: {
        organizationId: orgId,
        deletedAt: null,
        expirationDate: { gte: now, lte: thirtyDaysOut },
        status: { in: [ContractStatus.EXECUTED, ContractStatus.ARCHIVED] },
      },
    }),
    prisma.contract.count({
      where: {
        organizationId: orgId,
        deletedAt: null,
        expirationDate: { gte: now, lte: ninetyDaysOut },
        status: { in: [ContractStatus.EXECUTED, ContractStatus.ARCHIVED] },
      },
    }),
    prisma.approvalStep.count({
      where: {
        status: "PENDING",
        tokenExpiresAt: { lt: now },
        workflow: { contract: { organizationId: orgId } },
      },
    }),
    prisma.contract.groupBy({
      by: ["status"],
      where: {
        organizationId: orgId,
        deletedAt: null,
        status: { in: [ContractStatus.PENDING_SIGNATURE, ContractStatus.EXECUTED] },
      },
      _count: { id: true },
    }),
  ]);

  const pending = signingRateData.find((s) => s.status === ContractStatus.PENDING_SIGNATURE)?._count.id ?? 0;
  const executed = signingRateData.find((s) => s.status === ContractStatus.EXECUTED)?._count.id ?? 0;
  const signingCompletionRate = pending + executed > 0
    ? Math.round((executed / (pending + executed)) * 100)
    : 0;

  return NextResponse.json({
    totalContractValue: Number(tcvResult._sum.value ?? 0),
    statusDistribution: statusCounts.map((s) => ({
      status: s.status,
      count: s._count.id,
    })),
    expiringIn30Days: expiringIn30,
    expiringIn90Days: expiringIn90,
    overdueApprovals,
    signingCompletionRate,
  });
}
