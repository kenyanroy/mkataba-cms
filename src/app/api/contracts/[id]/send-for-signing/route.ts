import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { prisma } from "@/lib/db/client";
import { hasPermission } from "@/lib/auth/rbac";
import { createSubmission } from "@/lib/docuseal/client";
import { writeAuditLog } from "@/lib/utils/audit";
import { AuditAction, ContractStatus, UserRole } from "@prisma/client";
import { z } from "zod";

const schema = z.object({
  signatories: z.array(
    z.object({
      email: z.string().email(),
      name: z.string().min(1),
      role: z.string().default("Signer"),
    })
  ).min(1),
  message: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!hasPermission(session.user.role as UserRole, "contract:sign")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const json = await request.json();
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const contract = await prisma.contract.findFirst({
    where: {
      id,
      organizationId: session.user.organizationId,
      status: ContractStatus.APPROVED,
      deletedAt: null,
    },
    include: { currentVersion: true },
  });

  if (!contract) {
    return NextResponse.json({ error: "Contract not found or not in APPROVED state" }, { status: 404 });
  }

  const webhookUrl = `${process.env.NEXTAUTH_URL}/api/webhooks/docuseal`;

  const submission = await createSubmission({
    htmlBody: contract.currentVersion?.body,
    title: contract.title,
    submitters: parsed.data.signatories,
    webhookUrl,
    message: parsed.data.message,
    externalId: contract.id,
  });

  const updated = await prisma.contract.update({
    where: { id: contract.id },
    data: {
      status: ContractStatus.PENDING_SIGNATURE,
      docusealSubmissionId: String(submission.id),
      docusealStatus: "pending",
      docusealSigningUrl: submission.submitters?.[0]?.signingUrl,
      signingRequestedAt: new Date(),
    },
  });

  await writeAuditLog({
    contractId: contract.id,
    userId: session.user.id!,
    action: AuditAction.SENT_FOR_SIGNING,
    metadata: {
      submissionId: submission.id,
      signatories: parsed.data.signatories.map((s) => s.email),
    },
  });

  return NextResponse.json({
    submissionId: submission.id,
    signingUrl: submission.submitters?.[0]?.signingUrl,
    status: updated.status,
  });
}
