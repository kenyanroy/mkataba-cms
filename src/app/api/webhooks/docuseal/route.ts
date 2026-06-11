// POST /api/webhooks/docuseal
// Receives signing completion events from DocuSeal.
// Verifies HMAC signature, updates contract status to EXECUTED,
// and triggers the Paperless-ngx archival pipeline.

import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/docuseal/client";
import { prisma } from "@/lib/db/client";
import { writeAuditLog } from "@/lib/utils/audit";
import { archiveExecutedContract } from "@/lib/paperless/archival-pipeline";
import { AuditAction, ContractStatus } from "@prisma/client";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const rawBody = await request.text();
  const signature = request.headers.get("x-docuseal-signature") ?? "";

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: {
    event_type: string;
    data: { submission: { id: number; status: string; external_id?: string } };
  };

  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { event_type, data } = event;

  if (event_type !== "form.completed") {
    return NextResponse.json({ received: true });
  }

  const submissionId = String(data.submission.id);
  const contractId = data.submission.external_id;

  if (!contractId) {
    return NextResponse.json({ error: "No external_id on submission" }, { status: 400 });
  }

  const contract = await prisma.contract.findFirst({
    where: { id: contractId, docusealSubmissionId: submissionId },
  });

  if (!contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  await prisma.contract.update({
    where: { id: contract.id },
    data: {
      status: ContractStatus.EXECUTED,
      docusealStatus: "completed",
      executedAt: new Date(),
      signedAt: new Date(),
    },
  });

  await writeAuditLog({
    contractId: contract.id,
    userId: contract.creatorId,
    action: AuditAction.EXECUTED,
    metadata: { submissionId, source: "docuseal_webhook" },
    ipAddress: "webhook",
    userAgent: "DocuSeal",
  });

  // Kick off archival asynchronously — don't block the webhook response
  archiveExecutedContract(contract.id, contract.creatorId).catch((err) =>
    console.error(`[Paperless] Archival failed for contract ${contract.id}:`, err)
  );

  return NextResponse.json({ received: true });
}
