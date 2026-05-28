"use client";

import React from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { FloatingSocBadge } from "@/components/layout/FloatingSocBadge";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RoleGuard>
      <div className="dashboard-shell min-h-screen bg-bg-primary text-text-primary">
        <Sidebar />
        <div className="pl-0 md:pl-[224px]">
          <Topbar />
          <main className="flex min-h-screen flex-col pb-[calc(6rem+env(safe-area-inset-bottom))] pt-16 md:pb-0">
            <FloatingSocBadge />
            <div className="w-full max-w-[1640px] flex-1 px-4 py-5 sm:px-6 md:px-8 md:py-8 2xl:pr-[280px]">
              {children}
            </div>
          </main>
        </div>
      </div>
    </RoleGuard>
  );
}
