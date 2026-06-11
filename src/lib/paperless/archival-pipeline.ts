// Paperless-ngx archival pipeline
// Triggered when a contract transitions to EXECUTED status

import { prisma } from "@/lib/db/client";
import { downloadSignedDocument } from "@/lib/docuseal/client";
import {
  uploadDocument,
  waitForDocument,
  addCustomFieldToDocument,
} from "./client";
import { writeAuditLog } from "@/lib/utils/audit";
import { AuditAction } from "@prisma/client";

export async function archiveExecutedContract(
  contractId: string,
  triggeredByUserId: string
): Promise<void> {
  const contract = await prisma.contract.findUniqueOrThrow({
    where: { id: contractId },
    include: { creator: true, organization: true },
  });

  if (!contract.docusealSubmissionId) {
    throw new Error(`Contract ${contractId} has no DocuSeal submission ID`);
  }

  const pdfBuffer = await downloadSignedDocument(
    Number(contract.docusealSubmissionId)
  );

  const filename = `mkataba-${contract.id}-executed.pdf`;

  const tags = [
    contract.type.toLowerCase().replace(/_/g, "-"),
    "executed",
    contract.organization.slug,
  ].filter(Boolean);

  const taskId = await uploadDocument({
    pdfBuffer,
    filename,
    title: contract.title,
    correspondent: contract.counterpartyName ?? undefined,
    tags,
    createdDate: contract.executedAt ?? new Date(),
  });

  await prisma.contract.update({
    where: { id: contractId },
    data: { paperlessTaskId: taskId },
  });

  const documentId = await waitForDocument(taskId);

  // Write Mkataba-specific custom fields
  await Promise.all([
    addCustomFieldToDocument(documentId, "mkataba_id", contractId),
    contract.expirationDate &&
      addCustomFieldToDocument(
        documentId,
        "expiration_date",
        contract.expirationDate.toISOString().split("T")[0]
      ),
    contract.value &&
      addCustomFieldToDocument(documentId, "contract_value", contract.value.toString()),
  ]);

  await prisma.contract.update({
    where: { id: contractId },
    data: {
      paperlessDocumentId: documentId,
      status: "ARCHIVED",
      archivedAt: new Date(),
    },
  });

  await writeAuditLog({
    contractId,
    userId: triggeredByUserId,
    action: AuditAction.ARCHIVED,
    metadata: { paperlessDocumentId: documentId, taskId },
  });
}
