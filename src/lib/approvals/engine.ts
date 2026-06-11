// Approval Workflow Engine
// Drives sequential and parallel approval chains

import { prisma } from "@/lib/db/client";
import { ApprovalStepStatus, ContractStatus, WorkflowType } from "@prisma/client";
import { writeAuditLog } from "@/lib/utils/audit";
import { AuditAction } from "@prisma/client";
import crypto from "crypto";
import { sendApprovalRequestEmail, sendApprovalOutcomeEmail } from "@/lib/utils/email";

export async function initiateWorkflow(
  contractId: string,
  workflowId: string
): Promise<void> {
  const workflow = await prisma.approvalWorkflow.findUniqueOrThrow({
    where: { id: workflowId },
    include: {
      steps: { orderBy: { order: "asc" }, include: { assignee: true } },
      contract: true,
    },
  });

  await prisma.contract.update({
    where: { id: contractId },
    data: { status: ContractStatus.PENDING_APPROVAL },
  });

  if (workflow.type === WorkflowType.SEQUENTIAL) {
    const firstStep = workflow.steps[0];
    if (firstStep) await notifyAndActivateStep(firstStep.id);
  } else {
    // Parallel: notify all assignees at once
    await Promise.all(workflow.steps.map((s) => notifyAndActivateStep(s.id)));
  }
}

async function notifyAndActivateStep(stepId: string): Promise<void> {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHmac("sha256", process.env.APPROVAL_TOKEN_SECRET!).update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 hours

  const step = await prisma.approvalStep.update({
    where: { id: stepId },
    data: {
      status: ApprovalStepStatus.PENDING,
      approvalToken: tokenHash,
      tokenExpiresAt: expiresAt,
      notifiedAt: new Date(),
    },
    include: {
      assignee: true,
      workflow: { include: { contract: true } },
    },
  });

  await sendApprovalRequestEmail({
    to: step.assignee.email,
    assigneeName: step.assignee.name,
    contractTitle: step.workflow.contract.title,
    contractId: step.workflow.contractId,
    stepId: step.id,
    approvalToken: token,
    expiresAt,
  });
}

export async function processApproval(
  stepId: string,
  decision: "APPROVED" | "REJECTED",
  userId: string,
  note?: string
): Promise<void> {
  const step = await prisma.approvalStep.findUniqueOrThrow({
    where: { id: stepId },
    include: {
      workflow: {
        include: {
          steps: { orderBy: { order: "asc" } },
          contract: true,
        },
      },
    },
  });

  if (step.workflow.steps.find((s) => s.id === stepId)?.status !== ApprovalStepStatus.PENDING) {
    throw new Error("Step is not in PENDING state");
  }

  await prisma.approvalStep.update({
    where: { id: stepId },
    data: {
      status: decision === "APPROVED" ? ApprovalStepStatus.APPROVED : ApprovalStepStatus.REJECTED,
      note,
      respondedAt: new Date(),
      tokenUsedAt: new Date(),
    },
  });

  await writeAuditLog({
    contractId: step.workflow.contractId,
    userId,
    action: decision === "APPROVED" ? AuditAction.APPROVED : AuditAction.REJECTED,
    metadata: { stepId, note },
  });

  if (decision === "REJECTED") {
    await handleRejection(step.workflow.id, step.workflow.contractId, note);
    return;
  }

  if (step.workflow.type === WorkflowType.SEQUENTIAL) {
    await advanceSequentialWorkflow(step.workflow.id);
  } else {
    await checkParallelWorkflowCompletion(step.workflow.id);
  }
}

async function advanceSequentialWorkflow(workflowId: string): Promise<void> {
  const workflow = await prisma.approvalWorkflow.findUniqueOrThrow({
    where: { id: workflowId },
    include: { steps: { orderBy: { order: "asc" } } },
  });

  const pendingStep = workflow.steps.find((s) => s.status === ApprovalStepStatus.PENDING);

  if (pendingStep) {
    await notifyAndActivateStep(pendingStep.id);
  } else {
    await completeWorkflow(workflowId);
  }
}

async function checkParallelWorkflowCompletion(workflowId: string): Promise<void> {
  const workflow = await prisma.approvalWorkflow.findUniqueOrThrow({
    where: { id: workflowId },
    include: { steps: true },
  });

  const allApproved = workflow.steps.every((s) => s.status === ApprovalStepStatus.APPROVED);
  if (allApproved) await completeWorkflow(workflowId);
}

async function completeWorkflow(workflowId: string): Promise<void> {
  const workflow = await prisma.approvalWorkflow.update({
    where: { id: workflowId },
    data: { isCompleted: true, completedAt: new Date() },
  });

  await prisma.contract.update({
    where: { id: workflow.contractId },
    data: { status: ContractStatus.APPROVED },
  });
}

async function handleRejection(
  workflowId: string,
  contractId: string,
  reason?: string
): Promise<void> {
  await prisma.approvalWorkflow.update({
    where: { id: workflowId },
    data: { isRejected: true, rejectedAt: new Date() },
  });

  // Cancel all remaining pending steps in parallel workflows
  await prisma.approvalStep.updateMany({
    where: { workflowId, status: ApprovalStepStatus.PENDING },
    data: { status: ApprovalStepStatus.SKIPPED },
  });

  await prisma.contract.update({
    where: { id: contractId },
    data: {
      status: ContractStatus.REJECTED,
      rejectedAt: new Date(),
      rejectionReason: reason,
    },
  });
}

export function generateOneTimeApprovalToken(stepId: string): string {
  const raw = `${stepId}:${Date.now()}:${crypto.randomBytes(16).toString("hex")}`;
  return crypto
    .createHmac("sha256", process.env.APPROVAL_TOKEN_SECRET!)
    .update(raw)
    .digest("hex");
}
