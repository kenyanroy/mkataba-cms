import { Metadata } from "next";
import { requirePermission } from "@/lib/auth/rbac";
import { AnalyticsDashboard } from "@/components/dashboard/AnalyticsDashboard";
import { prisma } from "@/lib/db/client";
import { ContractStatus } from "@prisma/client";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const session = await requirePermission("analytics:view");
  const orgId = session.user.organizationId!;
  const now = new Date();

  const [statusCounts, tcvResult, expiring30, expiring90, overdueApprovals, signingData] =
    await Promise.all([
      prisma.contract.groupBy({
        by: ["status"],
        where: { organizationId: orgId, deletedAt: null },
        _count: { id: true },
      }),
      prisma.contract.aggregate({
        where: { organizationId: orgId, status: ContractStatus.EXECUTED, deletedAt: null },
        _sum: { value: true },
      }),
      prisma.contract.count({
        where: {
          organizationId: orgId,
          deletedAt: null,
          expirationDate: {
            gte: now,
            lte: new Date(now.getTime() + 30 * 86400000),
          },
          status: { in: [ContractStatus.EXECUTED, ContractStatus.ARCHIVED] },
        },
      }),
      prisma.contract.count({
        where: {
          organizationId: orgId,
          deletedAt: null,
          expirationDate: {
            gte: now,
            lte: new Date(now.getTime() + 90 * 86400000),
          },
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
          status: { in: [ContractStatus.PENDING_SIGNATURE, ContractStatus.EXECUTED] },
        },
        _count: { id: true },
      }),
    ]);

  const executedCount =
    signingData.find((s) => s.status === ContractStatus.EXECUTED)?._count.id ?? 0;
  const pendingSigCount =
    signingData.find((s) => s.status === ContractStatus.PENDING_SIGNATURE)?._count.id ?? 0;
  const signingCompletionRate =
    executedCount + pendingSigCount > 0
      ? Math.round((executedCount / (executedCount + pendingSigCount)) * 100)
      : 0;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {session.user.organizationName} — Contract overview
        </p>
      </div>
      <AnalyticsDashboard
        data={{
          totalContractValue: Number(tcvResult._sum.value ?? 0),
          statusDistribution: statusCounts.map((s) => ({
            status: s.status,
            count: s._count.id,
          })),
          expiringIn30Days: expiring30,
          expiringIn90Days: expiring90,
          overdueApprovals,
          signingCompletionRate,
        }}
      />
    </div>
  );
}
