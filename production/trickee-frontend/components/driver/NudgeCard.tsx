import React from "react";
import { Card } from "@/components/ui/Card";
import { Bell, Clock, Navigation, Zap } from "lucide-react";

interface NudgeCardProps {
  nudge?: {
    recommended_departure?: string;
    buffer_applied_min?: number;
    message?: string;
    route_name?: string;
    soc_start?: number;
    soc_end?: number;
    range_remaining_km?: number;
    destination_charge_plan?: {
      needed: boolean;
      current_soc_pct: number;
      destination_soc_required_pct: number;
      buffer_pct: number;
      target_soc_pct: number;
      top_up_soc_pct: number;
      charge_minutes: number;
      charger_name?: string;
      message: string;
    };
  } | null;
}

export const NudgeCard = ({ nudge }: NudgeCardProps) => {
  if (!nudge) {
    return (
      <Card className="border-bg-border/60">
        <div className="flex items-center gap-3">
          <Bell className="w-5 h-5 text-text-dim" />
          <p className="text-sm text-text-dim">No active recommendation is available.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="bg-accent-teal/5 border-accent-teal/30 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-8 opacity-5">
        <Bell className="w-32 h-32 text-accent-teal" />
      </div>

      <div className="flex items-start gap-4 mb-6">
        <div className="p-3 bg-accent-teal/20 rounded-xl">
          <Bell className="w-6 h-6 text-accent-teal" />
        </div>
        <div>
          <h3 className="section-title mb-1 text-accent-teal">Departure Recommendation</h3>
          <p className="text-sm text-text-dim">Recommended timing for the next trip.</p>
        </div>
      </div>

      {nudge.destination_charge_plan?.needed && (
        <div className="mb-8 p-4 rounded-xl bg-accent-amber/10 border border-accent-amber/30">
          <div className="flex items-center gap-2 mb-3 text-accent-amber uppercase text-[10px] font-bold tracking-widest">
            <Zap className="w-3 h-3" />
            Charge To Complete Destination
          </div>
          <p className="text-sm text-text-primary leading-relaxed">{nudge.destination_charge_plan.message}</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            <div>
              <p className="text-[10px] text-text-dim uppercase font-bold tracking-widest">Destination Needs</p>
              <p className="text-sm font-bold font-mono text-text-primary">
                {nudge.destination_charge_plan.destination_soc_required_pct.toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-[10px] text-text-dim uppercase font-bold tracking-widest">Current SOC</p>
              <p className="text-sm font-bold font-mono text-text-primary">
                {nudge.destination_charge_plan.current_soc_pct.toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-[10px] text-text-dim uppercase font-bold tracking-widest">Top-Up</p>
              <p className="text-sm font-bold font-mono text-text-primary">
                {nudge.destination_charge_plan.top_up_soc_pct.toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-[10px] text-text-dim uppercase font-bold tracking-widest">Charge Time</p>
              <p className="text-sm font-bold font-mono text-accent-amber">
                {nudge.destination_charge_plan.charge_minutes} min
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="p-4 rounded-xl bg-bg-primary/50 border border-bg-border/40">
          <div className="flex items-center gap-2 mb-2 text-text-dim uppercase text-[10px] font-bold tracking-widest">
            <Navigation className="w-3 h-3" />
            Recommended Route
          </div>
          <p className="text-lg font-bold text-text-primary">{nudge.route_name || "Route pending"}</p>
        </div>

        <div className="p-4 rounded-xl bg-bg-primary/50 border border-bg-border/40">
          <div className="flex items-center gap-2 mb-2 text-text-dim uppercase text-[10px] font-bold tracking-widest">
            <Clock className="w-3 h-3" />
            Departure Window
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold text-accent-teal">{nudge.recommended_departure || "--:--"}</p>
            {typeof nudge.buffer_applied_min === "number" && (
              <span className="text-xs text-text-dim">+{nudge.buffer_applied_min} min buffer</span>
            )}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-bg-primary/50 border border-bg-border/40">
          <div className="flex items-center gap-2 mb-2 text-text-dim uppercase text-[10px] font-bold tracking-widest">
            <Zap className="w-3 h-3" />
            Battery Forecast
          </div>
          {typeof nudge.soc_start === "number" && typeof nudge.soc_end === "number" ? (
            <>
              <p className="text-lg font-bold text-text-primary">
                {nudge.soc_start.toFixed(1)}% &rarr; {nudge.soc_end.toFixed(1)}%
              </p>
              {typeof nudge.range_remaining_km === "number" && (
                <p className="text-[11px] text-text-dim mt-1 font-medium">
                  {nudge.range_remaining_km.toFixed(1)} km range remaining
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-text-dim">Run route scoring to populate forecast.</p>
          )}
        </div>
      </div>

      {nudge.message && (
        <div className="bg-bg-primary/60 border border-bg-border/50 rounded-xl p-4 text-sm text-text-primary/90 leading-relaxed">
          {nudge.message}
        </div>
      )}
    </Card>
  );
};
