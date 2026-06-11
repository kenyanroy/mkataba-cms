import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { AppShell } from "@/components/layout/AppShell";
import { getRoleLabel } from "@/lib/auth/rbac";
import { UserRole } from "@prisma/client";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  return (
    <AppShell
      user={{
        name: session.user.name ?? "User",
        email: session.user.email ?? "",
        role: getRoleLabel((session.user.role as UserRole) ?? "STANDARD_USER"),
        avatarUrl: session.user.image ?? undefined,
      }}
    >
      {children}
    </AppShell>
  );
}
