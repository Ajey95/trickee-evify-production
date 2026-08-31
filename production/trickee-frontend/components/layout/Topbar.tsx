"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { LogOut, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/components/AuthProvider";

export const Topbar = () => {
  const { user, signOut } = useAuth();
  const pathname = usePathname();
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
    if (path === "/gps-pilot") return "GPS Pilot Monitoring";
    if (path === "/data-quality") return "Data Quality";
    if (path === "/model-drift") return "Model Health";
    if (path === "/admin") return "Model Performance Metrics";
    return "Dashboard";
  };

  const handleSignOut = async () => {
    await signOut();
    window.location.href = "/login";
  };

  return (
    <header className="fixed left-0 right-0 top-0 z-40 flex h-16 items-center justify-between border-b border-bg-border/70 bg-[#05070b]/78 px-4 backdrop-blur-xl md:left-[224px] md:px-8">
      <h2 className="min-w-0 truncate text-[15px] font-semibold tracking-tight text-text-primary">
        {getPageTitle(pathname)}
      </h2>

      <div className="flex items-center gap-2 sm:gap-4 md:gap-6">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden flex-col items-end sm:flex">
            <span className="text-sm font-medium text-text-primary">
              {user?.full_name || "User"}
            </span>
            <span className="text-[10px] font-medium text-accent-teal uppercase tracking-widest">
              {user?.role?.replace("_", " ") || "Guest"}
            </span>
          </div>
          <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-bg-border bg-bg-border sm:h-10 sm:w-10">
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
