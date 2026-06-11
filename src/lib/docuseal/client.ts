// DocuSeal API client — communicates via internal Docker network
// Base URL: http://docuseal:3000 (resolved within mkataba_internal network)

const DOCUSEAL_API_URL = process.env.DOCUSEAL_API_URL!;
const DOCUSEAL_API_TOKEN = process.env.DOCUSEAL_API_TOKEN!;

interface DocuSealSignatory {
  email: string;
  name: string;
  role?: string;
}

interface CreateSubmissionParams {
  templateId?: number;
  htmlBody?: string;       // HTML document if not using a DocuSeal template
  title: string;
  submitters: DocuSealSignatory[];
  webhookUrl: string;
  message?: string;
  externalId?: string;     // Mkataba contract ID for correlation
}

interface DocuSealSubmission {
  id: number;
  status: string;
  signingUrl?: string;
  submitters: Array<{ id: number; email: string; status: string; signingUrl: string }>;
}

async function docusealFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${DOCUSEAL_API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Auth-Token": DOCUSEAL_API_TOKEN,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`DocuSeal API error ${response.status}: ${body}`);
  }

  return response.json() as Promise<T>;
}

export async function createSubmission(params: CreateSubmissionParams): Promise<DocuSealSubmission> {
  return docusealFetch<DocuSealSubmission>("/api/submissions", {
    method: "POST",
    body: JSON.stringify({
      template: params.templateId ? { id: params.templateId } : undefined,
      document: params.htmlBody
        ? { name: params.title, html: params.htmlBody }
        : undefined,
      submitters: params.submitters.map((s) => ({
        email: s.email,
        name: s.name,
        role: s.role ?? "Signer",
      })),
      send_email: true,
      message: params.message,
      external_id: params.externalId,
      webhook_url: params.webhookUrl,
    }),
  });
}

export async function getSubmission(submissionId: number): Promise<DocuSealSubmission> {
  return docusealFetch<DocuSealSubmission>(`/api/submissions/${submissionId}`);
}

export async function downloadSignedDocument(submissionId: number): Promise<Buffer> {
  const response = await fetch(
    `${DOCUSEAL_API_URL}/api/submissions/${submissionId}/download`,
    { headers: { "X-Auth-Token": DOCUSEAL_API_TOKEN } }
  );

  if (!response.ok) {
    throw new Error(`Failed to download signed document: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export function verifyWebhookSignature(payload: string, signature: string): boolean {
  const crypto = require("crypto") as typeof import("crypto");
  const expected = crypto
    .createHmac("sha256", process.env.DOCUSEAL_WEBHOOK_SECRET!)
    .update(payload)
    .digest("hex");
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
