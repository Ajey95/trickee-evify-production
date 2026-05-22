import React from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Map, TriangleAlert } from "lucide-react";
import { Route as RouteType } from "@/types";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface RouteCompareCardsProps {
  routes: RouteType[];
}

export const RouteCompareCards = ({ routes }: RouteCompareCardsProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {routes.map((route) => {
        const feasible = route.is_feasible !== false;
        return (
          <Card
            key={route.route_id}
            className={cn(
              "relative group overflow-hidden border-bg-border/60",
              route.rank === 1 && feasible && "border-accent-teal/50 bg-accent-teal/[0.02]",
              !feasible && "border-accent-red/30 bg-accent-red/[0.02]"
            )}
          >
            {route.rank === 1 && feasible && (
              <div className="absolute top-0 right-0">
                <div className="bg-accent-teal text-bg-primary text-[10px] font-bold px-3 py-1 rounded-bl-lg uppercase tracking-widest">
                  Recommended
                </div>
              </div>
            )}
            {!feasible && (
              <div className="absolute top-0 right-0">
                <div className="bg-accent-red text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg uppercase tracking-widest">
                  Charge First
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 mb-6">
              <div
                className={cn(
                  "p-2 rounded-lg border",
                  route.rank === 1 && feasible
                    ? "bg-accent-teal/20 border-accent-teal/30 text-accent-teal"
                    : "bg-bg-primary border-bg-border text-text-dim"
                )}
              >
                {feasible ? <Map className="w-5 h-5" /> : <TriangleAlert className="w-5 h-5 text-accent-red" />}
              </div>
              <div>
                <h4 className="font-bold text-text-primary">{route.route_name}</h4>
                <p className="text-[11px] text-text-dim">{route.distance_km} km | Rank #{route.rank}</p>
                {!feasible && (
                  <Badge variant="error" className="mt-2">
                    {route.feasibility_reason || "Insufficient SOC"}
                  </Badge>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <div>
                  <p className="kpi-label">Personalized ETA</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-bold font-mono text-text-primary">
                      {route.personalized_eta_min.toFixed(1)}
                    </span>
                    <span className="text-xs text-text-dim">min</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="kpi-label">Energy Usage</p>
                  <div className="flex items-baseline gap-1 justify-end">
                    <span className={cn("text-xl font-bold font-mono", route.is_ev_optimal ? "text-accent-green" : "text-text-primary")}>
                      {route.ev_kwh_used.toFixed(2)}
                    </span>
                    <span className="text-xs text-text-dim">kWh</span>
                  </div>
                </div>
              </div>

              <div className="h-1.5 bg-bg-border rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full transition-all duration-1000",
                    route.rank === 1 && feasible ? "bg-accent-teal" : !feasible ? "bg-accent-red" : "bg-bg-border"
                  )}
                  style={{ width: `${Math.min(100, Math.max(5, (1 / Math.max(route.composite_score, 0.1)) * 50))}%` }}
                />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-bg-border/40">
                <div>
                  <p className="kpi-label">SOC End</p>
                  <p className={cn("text-sm font-bold font-mono", route.soc_end_pct < 10 ? "text-accent-red" : "text-text-primary")}>
                    {route.soc_end_pct.toFixed(1)}%
                  </p>
                  {typeof route.soc_required_pct === "number" && (
                    <p className="text-[10px] text-text-dim mt-1">Needs {route.soc_required_pct.toFixed(1)}%</p>
                  )}
                  {route.destination_charge_plan?.needed && (
                    <p className="text-[10px] text-accent-amber mt-1">
                      Charge {route.destination_charge_plan.charge_minutes} min
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="kpi-label">Stop-Go Index</p>
                  <p className="text-sm font-bold font-mono text-text-primary">{(route.stop_and_go_index * 100).toFixed(0)}</p>
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
};
