// Paperless-ngx API client — communicates via internal Docker network
// Base URL: http://paperless-ngx:8000

const PAPERLESS_API_URL = process.env.PAPERLESS_API_URL!;
const PAPERLESS_API_TOKEN = process.env.PAPERLESS_API_TOKEN!;

interface PaperlessUploadParams {
  pdfBuffer: Buffer;
  filename: string;
  title: string;
  correspondent?: string;   // Counterparty name
  tags?: string[];
  customFields?: Record<string, string>;
  createdDate?: Date;
}

interface PaperlessTaskResult {
  taskId: string;
  documentId?: number;
  status: "PENDING" | "STARTED" | "SUCCESS" | "FAILURE";
}

async function paperlessFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${PAPERLESS_API_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Token ${PAPERLESS_API_TOKEN}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Paperless-ngx API error ${response.status}: ${body}`);
  }

  return response.json() as Promise<T>;
}

export async function uploadDocument(params: PaperlessUploadParams): Promise<string> {
  const formData = new FormData();

  const blob = new Blob([params.pdfBuffer], { type: "application/pdf" });
  formData.append("document", blob, params.filename);
  formData.append("title", params.title);

  if (params.correspondent) {
    formData.append("correspondent", params.correspondent);
  }

  if (params.tags?.length) {
    params.tags.forEach((tag) => formData.append("tags", tag));
  }

  if (params.createdDate) {
    formData.append("created", params.createdDate.toISOString().split("T")[0]);
  }

  const response = await fetch(`${PAPERLESS_API_URL}/api/documents/post_document/`, {
    method: "POST",
    headers: { Authorization: `Token ${PAPERLESS_API_TOKEN}` },
    body: formData,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Paperless upload failed ${response.status}: ${body}`);
  }

  const taskId = await response.text();
  return taskId.replace(/"/g, "").trim();
}

export async function getTaskStatus(taskId: string): Promise<PaperlessTaskResult> {
  const data = await paperlessFetch<{
    status: string;
    result?: number;
    task_id: string;
  }>(`/api/tasks/?task_id=${taskId}`);

  return {
    taskId,
    status: data.status as PaperlessTaskResult["status"],
    documentId: data.result,
  };
}

// Poll until the document is processed (max 2 minutes)
export async function waitForDocument(taskId: string, maxWaitMs = 120_000): Promise<number> {
  const start = Date.now();
  const interval = 3000;

  while (Date.now() - start < maxWaitMs) {
    const result = await getTaskStatus(taskId);
    if (result.status === "SUCCESS" && result.documentId) {
      return result.documentId;
    }
    if (result.status === "FAILURE") {
      throw new Error(`Paperless task ${taskId} failed`);
    }
    await new Promise((r) => setTimeout(r, interval));
  }

  throw new Error(`Paperless task ${taskId} timed out after ${maxWaitMs}ms`);
}

export async function addCustomFieldToDocument(
  documentId: number,
  fieldName: string,
  value: string
): Promise<void> {
  await paperlessFetch(`/api/documents/${documentId}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ custom_fields: [{ field: fieldName, value }] }),
  });
}

export async function getDocumentUrl(documentId: number): Promise<string> {
  return `${PAPERLESS_API_URL}/documents/${documentId}/`;
}
