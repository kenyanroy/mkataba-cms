import { Metadata } from "next";
import { SignInForm } from "@/components/auth/SignInForm";
import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Sign In" };

export default async function SignInPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-background p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-xl mx-auto mb-3">
            M
          </div>
          <h1 className="text-2xl font-bold text-primary">Mkataba</h1>
          <p className="text-muted-foreground text-sm mt-1">Contract Management System</p>
        </div>

        <div className="rounded-xl border bg-card shadow-sm p-6 md:p-8">
          <h2 className="text-xl font-semibold mb-6">Sign in to your account</h2>
          <SignInForm />
        </div>
      </div>
    </div>
  );
}
