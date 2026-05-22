"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { canAccess, homeForRole } from "@/lib/roles";

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export const RoleGuard = ({ children, allowedRoles }: RoleGuardProps) => {
  const { user, status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "unauthenticated" && pathname !== "/login") {
      router.replace("/login");
    } else if (status === "authenticated") {
      const userRole = user?.role;
      
      if (pathname === "/login") {
        router.replace(homeForRole(userRole));
      }

      if (!canAccess(userRole, allowedRoles)) {
        router.replace(homeForRole(userRole));
      }
    }
  }, [status, user, router, allowedRoles, pathname]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-bg-primary text-text-primary">
        <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-6">
          <div className="h-10 w-44 animate-pulse rounded-lg bg-bg-border/50" />
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-32 animate-pulse rounded-xl border border-bg-border bg-bg-card/60" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated" && pathname !== "/login") return null;
  
  if (status === "authenticated" && !canAccess(user?.role, allowedRoles)) return null;

  return <>{children}</>;
};
