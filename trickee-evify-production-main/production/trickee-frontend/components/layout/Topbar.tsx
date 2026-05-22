"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { BellRing, LogOut, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { isFirebaseEnabled, requestFcmToken, signOutFirebase, setupForegroundNotifications } from "@/lib/firebase";

export const Topbar = () => {
  const { user, signOut } = useAuth();
  const pathname = usePathname();
  const [pushState, setPushState] = React.useState<"idle" | "saving" | "enabled" | "blocked">("idle");

  React.useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") {
        setPushState("enabled");
        setupForegroundNotifications();
      } else if (Notification.permission === "denied") {
        setPushState("blocked");
      }
    }
  }, []);

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

  const enablePush = async () => {
    setPushState("saving");
    try {
      const token = await requestFcmToken();
      if (!token) {
        setPushState("blocked");
        return;
      }
      const result = await api.auth.registerFcmToken(token, "dashboard-browser");
      setPushState(result.success ? "enabled" : "blocked");
    } catch {
      setPushState("blocked");
    }
  };

  const handleSignOut = async () => {
    await signOutFirebase();
    await signOut();
    window.location.href = "/login";
  };

  return (
    <header className="fixed top-0 right-0 left-[224px] z-40 flex h-16 items-center justify-between border-b border-bg-border/70 bg-[#05070b]/78 px-8 backdrop-blur-xl">
      <h2 className="text-[15px] font-semibold tracking-tight text-text-primary">{getPageTitle(pathname)}</h2>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end">
            <span className="text-sm font-medium text-text-primary">{user?.full_name || "User"}</span>
            <span className="text-[10px] font-medium text-accent-teal uppercase tracking-widest">
              {user?.role?.replace("_", " ") || "Guest"}
            </span>
          </div>
          <div className="w-10 h-10 rounded-full bg-bg-border flex items-center justify-center border border-bg-border overflow-hidden">
            <UserIcon className="w-5 h-5 text-text-dim" />
          </div>
        </div>

        <div className="h-6 w-[1px] bg-bg-border"></div>

        {isFirebaseEnabled() && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
            onClick={enablePush}
            disabled={pushState === "saving" || pushState === "enabled"}
            title="Enable browser push alerts"
          >
            <BellRing className="w-4 h-4" />
            <span>{pushState === "enabled" ? "Alerts On" : "Push Alerts"}</span>
          </Button>
        )}

        <Button 
          variant="ghost" 
          size="sm" 
          className="gap-2"
          onClick={handleSignOut}
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </Button>
      </div>
    </header>
  );
};
