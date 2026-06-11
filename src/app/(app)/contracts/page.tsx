import { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { requireAuth } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/client";
import { ContractCard } from "@/components/contracts/ContractCard";
import { ContractStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Contracts" };

interface PageProps {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}

export default async function ContractsPage({ searchParams }: PageProps) {
  const session = await requireAuth();
  const { status, q, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam ?? 1));
  const limit = 20;

  const where = {
    organizationId: session.user.organizationId!,
    deletedAt: null as null,
    ...(status && { status: status as ContractStatus }),
    ...(q && {
      OR: [
        { title: { contains: q, mode: "insensitive" as const } },
        { counterpartyName: { contains: q, mode: "insensitive" as const } },
      ],
    }),
  };

  const [contracts, total] = await Promise.all([
    prisma.contract.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        creator: { select: { name: true } },
      },
    }),
    prisma.contract.count({ where }),
  ]);

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Contracts</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{total} total</p>
        </div>
        <Button asChild size="sm">
          <Link href="/contracts/new">
            <Plus className="h-4 w-4 mr-1.5" />
            New Contract
          </Link>
        </Button>
      </div>

      {/* Desktop table / Mobile card stack */}
      {contracts.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg font-medium">No contracts found</p>
          <p className="text-sm mt-1">Create your first contract to get started.</p>
          <Button asChild className="mt-4">
            <Link href="/contracts/new">
              <Plus className="h-4 w-4 mr-1.5" />
              New Contract
            </Link>
          </Button>
        </div>
      ) : (
        <>
          {/* Mobile: card stack */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {contracts.map((c) => (
              <ContractCard
                key={c.id}
                id={c.id}
                title={c.title}
                status={c.status}
                counterpartyName={c.counterpartyName}
                counterpartyCompany={c.counterpartyCompany}
                value={c.value ? Number(c.value) : null}
                currency={c.currency}
                expirationDate={c.expirationDate}
                creatorName={c.creator.name}
                updatedAt={c.updatedAt}
              />
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Title</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Counterparty</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Value</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Expires</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {contracts.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/contracts/${c.id}`} className="font-medium hover:underline">
                        {c.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {c.counterpartyName ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium`}>
                        {c.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {c.value ? `${c.currency} ${Number(c.value).toLocaleString()}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {c.expirationDate
                        ? new Date(c.expirationDate).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(c.updatedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
