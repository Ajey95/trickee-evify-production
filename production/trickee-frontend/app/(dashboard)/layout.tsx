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
        <div className="pl-[220px]">
          <Topbar />
          <main className="pt-16 min-h-screen flex flex-col">
            <FloatingSocBadge />
            <div className="p-8 pr-8 2xl:pr-[280px] max-w-[1600px] mx-auto flex-1 w-full">
              {children}
            </div>
          </main>
        </div>
      </div>
    </RoleGuard>
  );
}
