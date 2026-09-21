"use client";

import React from "react";
import Image from "next/image";
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
  CircleDollarSign,
  History,
  Satellite,
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
  "Past Trips": History,
  "Live Map": Map,
  Decisions: ClipboardCheck,
  "Route Intel": Route,
  "7-Day Schedule": CalendarDays,
  "Daily Impact": CircleDollarSign,
  Scorecards: BarChart3,
  Reports: BarChart3,
  Alerts: Bell,
  "Operations Health": Radio,
  "GPS Pilot": Satellite,
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
    <aside className="fixed bottom-0 left-0 right-0 z-50 flex h-[calc(72px+env(safe-area-inset-bottom))] w-full flex-row border-t border-white/10 bg-[#050b10]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-2xl md:inset-y-0 md:right-auto md:h-auto md:w-[240px] md:flex-col md:border-r md:border-t-0 md:pb-0">
      <div className="hidden h-[68px] items-center border-b border-white/10 px-5 md:flex">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center overflow-hidden border border-[#ffe000]/25 bg-white">
            <Image src="/trickee.png" width={36} height={36} alt="Trickee logo" className="h-9 w-9 object-contain" />
          </div>
          <div>
            <span className="block text-sm font-bold tracking-[0.12em] text-text-primary">TRICKEE</span>
            <span className="mt-0.5 block text-[8px] font-semibold uppercase tracking-[0.18em] text-text-dim">Fleet intelligence</span>
          </div>
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
                  "group relative flex min-w-[82px] flex-col items-center justify-center gap-1 px-2 py-2 text-center text-[11px] font-medium transition-all duration-200 md:min-w-0 md:flex-row md:justify-start md:gap-3 md:px-3 md:py-2.5 md:text-left md:text-[13px]",
                  isActive 
                    ? "bg-[#ffe000]/[0.08] text-text-primary ring-1 ring-[#ffe000]/20 before:absolute before:bottom-0 before:left-3 before:right-3 before:h-px before:bg-[#ffe000] md:before:bottom-2 md:before:left-0 md:before:right-auto md:before:top-2 md:before:h-auto md:before:w-px"
                    : "text-text-dim hover:bg-white/[0.035] hover:text-text-primary"
                )}
              >
                <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-[#ffe000]" : "text-text-dim group-hover:text-[#48dff4]")} />
                <span className="leading-tight">{item.label}</span>
              </Link>
            );
          })}
      </nav>

      <div className="hidden border-t border-bg-border p-4 md:block">
        <div className="border border-white/10 bg-white/[0.025] p-3">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="h-4 w-4 text-[#ffe000]" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#ffe000]">System live</span>
          </div>
          <p className="text-[10px] text-text-dim leading-relaxed">
            Connected fleet workspace · secure telemetry
          </p>
        </div>
      </div>
    </aside>
  );
};
