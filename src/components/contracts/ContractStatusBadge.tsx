import { ContractStatus } from "@prisma/client";
import { cn } from "@/lib/utils/cn";

const STATUS_CONFIG: Record<ContractStatus, { label: string; className: string }> = {
  DRAFT: { label: "Draft", className: "status-draft" },
  UNDER_REVIEW: { label: "Under Review", className: "status-under-review" },
  PENDING_APPROVAL: { label: "Pending Approval", className: "status-pending-approval" },
  APPROVED: { label: "Approved", className: "status-approved" },
  PENDING_SIGNATURE: { label: "Pending Signature", className: "status-pending-sig" },
  EXECUTED: { label: "Executed", className: "status-executed" },
  ARCHIVED: { label: "Archived", className: "status-archived" },
  REJECTED: { label: "Rejected", className: "status-rejected" },
  VOID: { label: "Void", className: "status-void" },
  EXPIRED: { label: "Expired", className: "status-void" },
};

export function ContractStatusBadge({
  status,
  className,
}: {
  status: ContractStatus;
  className?: string;
}) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
