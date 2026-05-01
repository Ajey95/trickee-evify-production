"use client";

import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import { Spinner } from "@/components/ui/Spinner";

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export const RoleGuard = ({ children, allowedRoles }: RoleGuardProps) => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "unauthenticated" && pathname !== "/login") {
      router.push("/login");
    } else if (status === "authenticated") {
      const userRole = (session?.user as any)?.role;
      
      // If we are on login and already authenticated, redirect to home
      if (pathname === "/login") {
        const redirectPath = userRole === 'driver' ? '/driver' : '/fleet';
        router.push(redirectPath);
      }

      // Check allowed roles for the specific page if provided
      if (allowedRoles && !allowedRoles.includes(userRole)) {
        const redirectPath = userRole === 'driver' ? '/driver' : '/fleet';
        router.push(redirectPath);
      }
    }
  }, [status, session, router, allowedRoles, pathname]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-primary">
        <Spinner size="lg" />
      </div>
    );
  }

  // If unauthenticated and on protected route, show nothing while redirecting
  if (status === "unauthenticated" && pathname !== "/login") return null;
  
  // If authenticated and role not allowed, show nothing while redirecting
  if (status === "authenticated" && allowedRoles) {
    const userRole = (session?.user as any)?.role;
    if (!allowedRoles.includes(userRole)) return null;
  }

  return <>{children}</>;
};
