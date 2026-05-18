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
    <aside className="fixed inset-y-0 left-0 z-50 flex w-[224px] flex-col border-r border-bg-border/70 bg-[#080b10]/95 backdrop-blur-xl">
      <div className="h-16 flex items-center px-6 border-b border-bg-border/70">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-accent-teal rounded-lg flex items-center justify-center shadow-lg shadow-accent-teal/20">
            <span className="text-bg-primary font-bold text-lg">T</span>
          </div>
          <span className="font-bold text-text-primary tracking-tight">Trickee</span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
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
                  "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150",
                  isActive 
                    ? "bg-white/[0.06] text-text-primary ring-1 ring-white/10"
                    : "text-text-dim hover:bg-white/[0.04] hover:text-text-primary"
                )}
              >
                <Icon className={cn("w-4 h-4", isActive ? "text-accent-teal" : "text-text-dim group-hover:text-text-primary")} />
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
            Connected fleet workspace.
          </p>
        </div>
      </div>
    </aside>
  );
};
