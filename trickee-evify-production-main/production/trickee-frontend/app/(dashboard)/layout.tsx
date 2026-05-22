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
        <div className="pl-[224px]">
          <Topbar />
          <main className="pt-16 min-h-screen flex flex-col">
            <FloatingSocBadge />
            <div className="w-full max-w-[1640px] flex-1 px-8 py-8 pr-8 2xl:pr-[280px]">
              {children}
            </div>
          </main>
        </div>
      </div>
    </RoleGuard>
  );
}
