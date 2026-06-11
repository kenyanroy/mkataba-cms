import { AuditAction } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { headers } from "next/headers";

interface AuditLogParams {
  contractId?: string;
  userId: string;
  action: AuditAction;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export async function writeAuditLog(params: AuditLogParams): Promise<void> {
  let ipAddress = params.ipAddress;
  let userAgent = params.userAgent;

  if (!ipAddress || !userAgent) {
    try {
      const headersList = await headers();
      ipAddress ??=
        headersList.get("x-forwarded-for")?.split(",")[0].trim() ??
        headersList.get("x-real-ip") ??
        "unknown";
      userAgent ??= headersList.get("user-agent") ?? "unknown";
    } catch {
      // Called outside request context (e.g., background job)
      ipAddress ??= "system";
      userAgent ??= "system";
    }
  }

  await prisma.auditLog.create({
    data: {
      contractId: params.contractId,
      userId: params.userId,
      action: params.action,
      metadata: params.metadata ?? {},
      ipAddress,
      userAgent,
    },
  });
}
