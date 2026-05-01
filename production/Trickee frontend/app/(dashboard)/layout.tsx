"use client";

import React from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { RoleGuard } from "@/components/layout/RoleGuard";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RoleGuard>
      <div className="min-h-screen bg-bg-primary text-text-primary">
        <Sidebar />
        <div className="pl-[220px]">
          <Topbar />
          <main className="pt-16 min-h-screen flex flex-col">
            <div className="p-8 max-w-[1600px] mx-auto flex-1 w-full">
              {children}
            </div>
          </main>
        </div>
      </div>
    </RoleGuard>
  );
}
