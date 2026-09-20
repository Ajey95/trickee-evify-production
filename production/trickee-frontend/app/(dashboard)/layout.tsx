"use client";

import React from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { FloatingIntelligenceChat } from "@/components/intelligence/FloatingIntelligenceChat";
import { usePathname } from "next/navigation";
import { ROLE_ROUTES } from "@/lib/roles";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const route = ROLE_ROUTES.find(item => pathname === item.href || (item.activePrefix && pathname.startsWith(`${item.activePrefix}/`)));
  return (
    <RoleGuard allowedRoles={route?.roles}>
      <div className="dashboard-shell min-h-screen bg-bg-primary text-text-primary">
        <Sidebar />
        <div className="pl-0 md:pl-[240px]">
          <Topbar />
          <main className="flex min-h-screen flex-col pb-[calc(6rem+env(safe-area-inset-bottom))] pt-[68px] md:pb-0">
            <FloatingIntelligenceChat />
            <div className="w-full max-w-[1640px] flex-1 px-4 py-5 sm:px-6 md:px-8 md:py-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </RoleGuard>
  );
}
