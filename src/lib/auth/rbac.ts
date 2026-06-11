import { UserRole } from "@prisma/client";
import { auth } from "./config";
import { redirect } from "next/navigation";

export type Permission =
  | "contract:create"
  | "contract:edit:any"
  | "contract:edit:own"
  | "contract:delete"
  | "contract:submit"
  | "contract:approve"
  | "contract:sign"
  | "contract:view:audit"
  | "template:create"
  | "template:edit"
  | "analytics:view"
  | "user:manage"
  | "workflow:manage";

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  ADMIN: [
    "contract:create", "contract:edit:any", "contract:edit:own",
    "contract:delete", "contract:submit", "contract:approve",
    "contract:sign", "contract:view:audit", "template:create",
    "template:edit", "analytics:view", "user:manage", "workflow:manage",
  ],
  LEGAL_REVIEWER: [
    "contract:create", "contract:edit:any", "contract:edit:own",
    "contract:submit", "contract:view:audit", "template:create",
    "template:edit", "analytics:view",
  ],
  APPROVER: [
    "contract:create", "contract:edit:own", "contract:submit",
    "contract:approve", "contract:sign",
  ],
  STANDARD_USER: [
    "contract:create", "contract:edit:own", "contract:submit",
  ],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export async function requireAuth() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  return session;
}

export async function requirePermission(permission: Permission) {
  const session = await requireAuth();
  const role = session.user.role as UserRole;
  if (!hasPermission(role, permission)) {
    throw new Error(`Unauthorized: missing permission ${permission}`);
  }
  return session;
}

export function getRoleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    ADMIN: "Administrator",
    LEGAL_REVIEWER: "Legal Reviewer",
    APPROVER: "Approver",
    STANDARD_USER: "Standard User",
  };
  return labels[role];
}
