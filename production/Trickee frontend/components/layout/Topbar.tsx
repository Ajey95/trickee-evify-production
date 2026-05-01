"use client";

import React from "react";
import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { BellRing, LogOut, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";
import { isFirebaseEnabled, requestFcmToken, signOutFirebase } from "@/lib/firebase";

export const Topbar = () => {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [pushState, setPushState] = React.useState<"idle" | "saving" | "enabled" | "blocked">("idle");

  // Get page title from pathname
  const getPageTitle = (path: string) => {
    if (path === "/fleet") return "Fleet Overview";
    if (path.startsWith("/vehicle")) return "AI Predictive Analysis";
    if (path === "/driver") return "Driver Profile";
    if (path === "/routes") return "Route Intelligence";
    if (path === "/scorecards") return "Performance Scorecards";
    if (path === "/alerts") return "Real-time Alerts";
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
    await signOut({ callbackUrl: "/login" });
  };

  return (
    <header className="h-16 fixed top-0 right-0 left-[220px] bg-bg-primary/80 backdrop-blur-md border-b border-bg-border flex items-center justify-between px-8 z-40">
      <h2 className="text-lg font-semibold text-text-primary">{getPageTitle(pathname)}</h2>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end">
            <span className="text-sm font-medium text-text-primary">{session?.user?.name || "User"}</span>
            <span className="text-[10px] font-medium text-accent-teal uppercase tracking-widest">
              {(session?.user as any)?.role?.replace("_", " ") || "Guest"}
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
