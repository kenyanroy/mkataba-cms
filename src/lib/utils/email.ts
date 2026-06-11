import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM = process.env.SMTP_FROM ?? "Mkataba <noreply@mkataba.app>";
const APP_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

interface ApprovalEmailParams {
  to: string;
  assigneeName: string;
  contractTitle: string;
  contractId: string;
  stepId: string;
  approvalToken: string;
  expiresAt: Date;
}

export async function sendApprovalRequestEmail(params: ApprovalEmailParams): Promise<void> {
  const approveUrl = `${APP_URL}/api/approvals/${params.stepId}/quick-approve?token=${params.approvalToken}`;
  const rejectUrl = `${APP_URL}/api/approvals/${params.stepId}/quick-reject?token=${params.approvalToken}`;
  const viewUrl = `${APP_URL}/contracts/${params.contractId}`;

  await transporter.sendMail({
    from: FROM,
    to: params.to,
    subject: `Action Required: Approve "${params.contractTitle}"`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a2e;">Contract Approval Request</h2>
        <p>Hi ${params.assigneeName},</p>
        <p>You have been assigned to review and approve the following contract:</p>
        <p style="font-size: 18px; font-weight: bold; color: #16213e;">${params.contractTitle}</p>
        <p>These quick-action links expire on <strong>${params.expiresAt.toDateString()}</strong>.</p>
        <div style="margin: 24px 0; display: flex; gap: 12px;">
          <a href="${approveUrl}"
             style="background: #22c55e; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block; margin-right: 12px;">
            ✓ Approve
          </a>
          <a href="${rejectUrl}"
             style="background: #ef4444; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">
            ✗ Reject
          </a>
        </div>
        <p><a href="${viewUrl}">View full contract →</a></p>
        <hr style="border: 1px solid #eee; margin: 24px 0;" />
        <p style="font-size: 12px; color: #666;">
          This email was sent by Mkataba Contract Management System.
          These links are single-use and expire in 72 hours.
        </p>
      </div>
    `,
  });
}

export async function sendApprovalOutcomeEmail(params: {
  to: string;
  creatorName: string;
  contractTitle: string;
  contractId: string;
  outcome: "APPROVED" | "REJECTED";
  note?: string;
}): Promise<void> {
  const viewUrl = `${APP_URL}/contracts/${params.contractId}`;
  const isApproved = params.outcome === "APPROVED";

  await transporter.sendMail({
    from: FROM,
    to: params.to,
    subject: `Contract ${isApproved ? "Approved" : "Rejected"}: "${params.contractTitle}"`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: ${isApproved ? "#22c55e" : "#ef4444"};">
          Contract ${isApproved ? "Approved ✓" : "Rejected ✗"}
        </h2>
        <p>Hi ${params.creatorName},</p>
        <p>Your contract <strong>${params.contractTitle}</strong> has been
           ${isApproved ? "approved and is ready for signing." : "rejected."}</p>
        ${params.note ? `<p><strong>Note:</strong> ${params.note}</p>` : ""}
        <a href="${viewUrl}" style="background: #1a1a2e; color: white; padding: 12px 24px;
           border-radius: 6px; text-decoration: none; display: inline-block; margin-top: 16px;">
          View Contract →
        </a>
      </div>
    `,
  });
}
