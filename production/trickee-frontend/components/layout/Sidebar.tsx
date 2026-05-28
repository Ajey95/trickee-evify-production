"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  BatteryCharging, 
  User, 
  Map,
  Route, 
  BarChart3, 
  Bell, 
  Settings2,
  ShieldCheck,
  CalendarDays,
  ClipboardCheck,
  DatabaseZap,
  Radio,
  BrainCircuit,
  CircleDollarSign
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { useAuth } from "@/components/AuthProvider";
import { routesForRole } from "@/lib/roles";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const iconByLabel = {
  "Fleet Overview": LayoutDashboard,
  "Vehicle Forecasts": BatteryCharging,
  "My Profile": User,
  "Live Map": Map,
  Decisions: ClipboardCheck,
  "Route Intel": Route,
  "7-Day Schedule": CalendarDays,
  "Daily Impact": CircleDollarSign,
  Scorecards: BarChart3,
  Reports: BarChart3,
  Alerts: Bell,
  "Operations Health": Radio,
  "Data Quality": DatabaseZap,
  "Model Health": BrainCircuit,
  "Model Metrics": Settings2,
};

export const Sidebar = () => {
  const pathname = usePathname();
  const { user } = useAuth();
  const role = user?.role;
  const sidebarItems = React.useMemo(() => routesForRole(role), [role]);

  return (
    <aside className="fixed bottom-0 left-0 right-0 z-50 flex h-[calc(72px+env(safe-area-inset-bottom))] w-full flex-row border-t border-bg-border/70 bg-[#080b10]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:inset-y-0 md:right-auto md:h-auto md:w-[224px] md:flex-col md:border-r md:border-t-0 md:pb-0">
      <div className="hidden h-16 items-center border-b border-bg-border/70 px-6 md:flex">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-accent-teal rounded-lg flex items-center justify-center shadow-lg shadow-accent-teal/20">
            <span className="text-bg-primary font-bold text-lg">T</span>
          </div>
          <span className="font-bold text-text-primary tracking-tight">Trickee</span>
        </div>
      </div>

      <nav className="flex flex-1 flex-row gap-1 overflow-x-auto px-3 py-2 md:flex-col md:space-y-1 md:overflow-x-hidden md:overflow-y-auto md:px-3 md:py-6">
        {sidebarItems.map((item) => {
            const href = item.href;
            const Icon = iconByLabel[item.label as keyof typeof iconByLabel] || LayoutDashboard;
            const isActive =
              pathname === href ||
              pathname.startsWith(href + "/") ||
              Boolean(item.activePrefix && pathname.startsWith(item.activePrefix));
            return (
              <Link
                key={item.label}
                href={href}
                className={cn(
                  "group flex min-w-[82px] flex-col items-center justify-center gap-1 rounded-lg px-2 py-2 text-center text-[11px] font-medium transition-colors duration-150 md:min-w-0 md:flex-row md:justify-start md:gap-3 md:px-3 md:py-2.5 md:text-left md:text-sm",
                  isActive 
                    ? "bg-white/[0.06] text-text-primary ring-1 ring-white/10"
                    : "text-text-dim hover:bg-white/[0.04] hover:text-text-primary"
                )}
              >
                <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-accent-teal" : "text-text-dim group-hover:text-text-primary")} />
                <span className="leading-tight">{item.label}</span>
              </Link>
            );
          })}
      </nav>

      <div className="hidden border-t border-bg-border p-4 md:block">
        <div className="bg-bg-primary/50 rounded-xl p-3 border border-bg-border/50">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="w-4 h-4 text-accent-green" />
            <span className="text-[10px] font-bold text-accent-green uppercase tracking-wider">Enterprise</span>
          </div>
          <p className="text-[10px] text-text-dim leading-relaxed">
            Connected fleet workspace.
          </p>
        </div>
      </div>
    </aside>
  );
};
