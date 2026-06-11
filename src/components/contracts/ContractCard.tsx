// Mobile-first contract card — used in the card-stack view on phones.
// On desktop, contracts are shown in a sortable table instead.

import Link from "next/link";
import { format } from "date-fns";
import { Calendar, DollarSign, User } from "lucide-react";
import { ContractStatusBadge } from "./ContractStatusBadge";
import { ContractStatus } from "@prisma/client";

interface ContractCardProps {
  id: string;
  title: string;
  status: ContractStatus;
  counterpartyName?: string | null;
  counterpartyCompany?: string | null;
  value?: number | null;
  currency?: string | null;
  expirationDate?: Date | null;
  creatorName: string;
  updatedAt: Date;
}

export function ContractCard({
  id,
  title,
  status,
  counterpartyName,
  counterpartyCompany,
  value,
  currency = "KES",
  expirationDate,
  creatorName,
  updatedAt,
}: ContractCardProps) {
  return (
    <Link
      href={`/contracts/${id}`}
      className="block rounded-lg border bg-card p-4 shadow-sm transition-shadow hover:shadow-md card-swipe"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-foreground line-clamp-2 flex-1">
          {title}
        </h3>
        <ContractStatusBadge status={status} />
      </div>

      {(counterpartyName || counterpartyCompany) && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
          <User className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            {counterpartyName}
            {counterpartyCompany && ` · ${counterpartyCompany}`}
          </span>
        </div>
      )}

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        {value != null && (
          <span className="flex items-center gap-1">
            <DollarSign className="h-3.5 w-3.5" />
            {currency} {value.toLocaleString()}
          </span>
        )}
        {expirationDate && (
          <span className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            Exp. {format(expirationDate, "dd MMM yyyy")}
          </span>
        )}
      </div>

      <div className="mt-3 pt-2 border-t flex items-center justify-between text-xs text-muted-foreground">
        <span>{creatorName}</span>
        <span>{format(updatedAt, "dd MMM yyyy")}</span>
      </div>
    </Link>
  );
}
