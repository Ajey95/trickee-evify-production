"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { 
  LayoutDashboard, 
  BatteryCharging, 
  User, 
  Map,
  Route, 
  BarChart3, 
  Bell, 
  Settings2,
  ShieldCheck
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { api } from "@/lib/api";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const sidebarItems = [
  { icon: LayoutDashboard, label: "Fleet Overview", href: "/fleet", roles: ["trickee_admin", "fleet_operator"] },
  { icon: BatteryCharging, label: "AI Predictions", href: "/fleet", activePrefix: "/vehicle", roles: ["trickee_admin", "fleet_operator"] },
  { icon: User, label: "My Profile", href: "/driver", roles: ["driver", "trickee_admin"] },
  { icon: Map, label: "Live Map", href: "/map", roles: ["driver", "trickee_admin", "fleet_operator"] },
  { icon: Route, label: "Route Intel", href: "/routes", roles: ["trickee_admin", "fleet_operator", "driver"] },
  { icon: BarChart3, label: "Scorecards", href: "/scorecards", roles: ["trickee_admin", "fleet_operator"] },
  { icon: BarChart3, label: "Report Charts", href: "/reports", roles: ["trickee_admin", "fleet_operator"] },
  { icon: Bell, label: "Alerts", href: "/alerts", roles: ["trickee_admin", "fleet_operator", "driver"] },
  { icon: Settings2, label: "Model Metrics", href: "/admin", roles: ["trickee_admin"] },
];

export const Sidebar = () => {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const [predictionHref, setPredictionHref] = React.useState("/fleet");

  React.useEffect(() => {
    let isMounted = true;
    if (role !== "trickee_admin" && role !== "fleet_operator") return;

    api.vehicles.list().then((result) => {
      if (!isMounted || !result.success || !result.data?.length) return;
      setPredictionHref(`/vehicle/${result.data[0].id}`);
    });

    return () => {
      isMounted = false;
    };
  }, [role]);

  return (
    <aside className="w-[220px] fixed inset-y-0 left-0 bg-bg-card border-r border-bg-border flex flex-col z-50">
      <div className="h-16 flex items-center px-6 border-b border-bg-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-accent-teal rounded-lg flex items-center justify-center shadow-lg shadow-accent-teal/20">
            <span className="text-bg-primary font-bold text-lg">T</span>
          </div>
          <span className="font-bold text-text-primary tracking-tight">Trickee AI</span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
        {sidebarItems
          .filter((item) => !item.roles || item.roles.includes(role))
          .map((item) => {
            const href = item.label === "AI Predictions" ? predictionHref : item.href;
            const isActive =
              pathname === href ||
              pathname.startsWith(href + "/") ||
              Boolean(item.activePrefix && pathname.startsWith(item.activePrefix));
            return (
              <Link
                key={item.label}
                href={href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 group",
                  isActive 
                    ? "bg-accent-teal/10 text-accent-teal shadow-inner" 
                    : "text-text-dim hover:text-text-primary hover:bg-bg-border/30"
                )}
              >
                <item.icon className={cn("w-4 h-4", isActive ? "text-accent-teal" : "text-text-dim group-hover:text-text-primary")} />
                {item.label}
              </Link>
            );
          })}
      </nav>

      <div className="p-4 border-t border-bg-border">
        <div className="bg-bg-primary/50 rounded-xl p-3 border border-bg-border/50">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="w-4 h-4 text-accent-green" />
            <span className="text-[10px] font-bold text-accent-green uppercase tracking-wider">Enterprise</span>
          </div>
          <p className="text-[10px] text-text-dim leading-relaxed">
            Connected to Evify Surat Fleet telemetry stream.
          </p>
        </div>
      </div>
    </aside>
  );
};
