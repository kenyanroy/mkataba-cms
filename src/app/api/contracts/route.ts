import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { prisma } from "@/lib/db/client";
import { z } from "zod";
import { writeAuditLog } from "@/lib/utils/audit";
import { AuditAction, ContractStatus, ContractType } from "@prisma/client";

const createSchema = z.object({
  title: z.string().min(3).max(255),
  type: z.nativeEnum(ContractType).default("OTHER"),
  description: z.string().optional(),
  counterpartyName: z.string().optional(),
  counterpartyEmail: z.string().email().optional(),
  counterpartyCompany: z.string().optional(),
  value: z.number().positive().optional(),
  currency: z.string().default("KES"),
  effectiveDate: z.string().datetime().optional(),
  expirationDate: z.string().datetime().optional(),
  templateId: z.string().uuid().optional(),
  body: z.string().default(""),
  tags: z.array(z.string()).default([]),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? 20)));
  const status = searchParams.get("status") as ContractStatus | null;
  const search = searchParams.get("q");

  const where = {
    organizationId: session.user.organizationId,
    deletedAt: null,
    ...(status && { status }),
    ...(search && {
      OR: [
        { title: { contains: search, mode: "insensitive" as const } },
        { counterpartyName: { contains: search, mode: "insensitive" as const } },
        { counterpartyCompany: { contains: search, mode: "insensitive" as const } },
      ],
    }),
  };

  const [contracts, total] = await Promise.all([
    prisma.contract.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        creator: { select: { id: true, name: true, avatarUrl: true } },
        currentVersion: { select: { id: true, versionNumber: true } },
        _count: { select: { approvalWorkflows: true, attachments: true } },
      },
    }),
    prisma.contract.count({ where }),
  ]);

  return NextResponse.json({
    data: contracts,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await request.json();
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { body, ...data } = parsed.data;

  const contract = await prisma.$transaction(async (tx) => {
    const newContract = await tx.contract.create({
      data: {
        ...data,
        organizationId: session.user.organizationId!,
        creatorId: session.user.id!,
        status: ContractStatus.DRAFT,
        effectiveDate: data.effectiveDate ? new Date(data.effectiveDate) : undefined,
        expirationDate: data.expirationDate ? new Date(data.expirationDate) : undefined,
      },
    });

    const version = await tx.contractVersion.create({
      data: {
        contractId: newContract.id,
        versionNumber: 1,
        body,
        bodyPlainText: body.replace(/<[^>]*>/g, ""),
        editorId: session.user.id!,
        changeNote: "Initial draft",
      },
    });

    return tx.contract.update({
      where: { id: newContract.id },
      data: { currentVersionId: version.id },
    });
  });

  await writeAuditLog({
    contractId: contract.id,
    userId: session.user.id!,
    action: AuditAction.CREATED,
    metadata: { title: contract.title, type: contract.type },
  });

  return NextResponse.json(contract, { status: 201 });
}
