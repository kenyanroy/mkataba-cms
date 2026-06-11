import { UserRole } from "@prisma/client";
import "next-auth";

declare module "next-auth" {
  interface User {
    role?: UserRole;
    organizationId?: string;
    organizationName?: string;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      image?: string;
      role?: UserRole;
      organizationId?: string;
      organizationName?: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: UserRole;
    organizationId?: string;
    organizationName?: string;
  }
}
