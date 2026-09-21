"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Radio, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/components/AuthProvider";
import { ThemeToggle } from "@/components/ThemeToggle";

export const Topbar = () => {
  const { user, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  // Get page title from pathname
  const getPageTitle = (path: string) => {
    if (path === "/fleet") return "Fleet Overview";
    if (path === "/map") return "Live Fleet Map";
    if (path === "/ai") return "Assistant";
    if (path.startsWith("/vehicle")) return "Vehicle Forecasts";
    if (path === "/driver") return "Driver Profile";
    if (path === "/routes") return "Route Intelligence";
    if (path === "/schedule") return "7-Day Schedule";
    if (path === "/impact") return "Daily Impact";
    if (path === "/reports") return "Reports";
    if (path === "/scorecards") return "Performance Scorecards";
    if (path === "/alerts") return "Alerts";
    if (path === "/observability") return "Operations Health";
    if (path === "/data-quality") return "Data Quality";
    if (path === "/model-drift") return "Model Health";
    if (path === "/admin") return "Model Performance Metrics";
    return "Dashboard";
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace("/login");
  };

  return (
    <header className="fixed left-0 right-0 top-0 z-40 flex h-[68px] items-center justify-between border-b border-white/10 bg-[#050b10]/82 px-4 backdrop-blur-2xl md:left-[240px] md:px-7">
      <div className="min-w-0">
        <div className="mb-1 hidden items-center gap-2 text-[8px] font-bold uppercase tracking-[0.18em] text-[#ffe000] sm:flex"><Radio className="h-3 w-3" /> Operations live</div>
        <h2 className="truncate text-[15px] font-semibold tracking-tight text-text-primary">{getPageTitle(pathname)}</h2>
      </div>

      <div className="flex items-center gap-2 sm:gap-4 md:gap-6">
        <ThemeToggle />
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden flex-col items-end sm:flex">
            <span className="text-sm font-medium text-text-primary">
              {user?.full_name || "User"}
            </span>
            <span className="text-[10px] font-medium text-accent-teal uppercase tracking-widest">
              {user?.role?.replace("_", " ") || "Guest"}
            </span>
          </div>
          <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-[#48dff4]/25 bg-[#48dff4]/10 sm:h-10 sm:w-10">
            <UserIcon className="w-5 h-5 text-text-dim" />
          </div>
        </div>

        <div className="hidden h-6 w-[1px] bg-bg-border sm:block"></div>

        <Button
          variant="ghost"
          size="sm"
          className="h-10 w-10 gap-2 sm:w-auto"
          onClick={handleSignOut}
          aria-label="Sign out"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Sign Out</span>
        </Button>
      </div>
    </header>
  );
};
