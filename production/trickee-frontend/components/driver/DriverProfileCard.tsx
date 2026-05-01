import React from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Driver, Vehicle } from "@/types";
import { User, Award } from "lucide-react";

interface DriverProfileCardProps {
  driver: Driver;
  currentVehicle?: Vehicle | null;
}

export const DriverProfileCard = ({ driver, currentVehicle }: DriverProfileCardProps) => {
  return (
    <Card className="flex flex-col md:flex-row gap-8 items-center md:items-start border-bg-border/60">
      <div className="relative">
        <div className="w-24 h-24 rounded-2xl bg-bg-border flex items-center justify-center overflow-hidden border-2 border-accent-teal shadow-xl shadow-accent-teal/10">
          <User className="w-12 h-12 text-text-dim" />
        </div>
        <div className="absolute -bottom-2 -right-2 bg-accent-teal text-bg-primary p-1.5 rounded-lg shadow-lg">
          <Award className="w-4 h-4" />
        </div>
      </div>

      <div className="flex-1 text-center md:text-left">
        <div className="flex flex-col md:flex-row md:items-center gap-3 mb-2">
          <h2 className="text-2xl font-bold text-text-primary">{driver.full_name}</h2>
          <div className="flex items-center gap-2 justify-center md:justify-start">
            <Badge variant={driver.style_label === "Efficient" ? "success" : driver.style_label === "Aggressive" ? "error" : "info"}>
              {driver.style_label} Style
            </Badge>
            <Badge variant="outline">{driver.driver_code}</Badge>
          </div>
        </div>
        <p className="text-text-dim text-sm mb-6 max-w-lg">
          {currentVehicle
            ? `Currently linked to ${currentVehicle.vehicle_code} from backend telemetry.`
            : "No active vehicle assignment found in backend telemetry."}
        </p>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <p className="kpi-label">Personal Factor</p>
            <p className="text-xl font-bold font-mono text-accent-magenta">
              {((driver.personal_factor - 1) * 100).toFixed(1)}% Extra
            </p>
            <p className="text-[10px] text-text-dim mt-0.5">vs Google ETA</p>
          </div>
          <div>
            <p className="kpi-label">Avg Regen Ratio</p>
            <p className="text-xl font-bold font-mono text-accent-green">
              {(driver.avg_regen_ratio * 100).toFixed(0)}%
            </p>
            <p className="text-[10px] text-text-dim mt-0.5">Optimization</p>
          </div>
          <div>
            <p className="kpi-label">Efficiency Rank</p>
            <p className="text-xl font-bold font-mono text-accent-teal">
              {driver.efficiency_rank ? `#${driver.efficiency_rank}` : "N/A"}
            </p>
            <p className="text-[10px] text-text-dim mt-0.5">Backend ranking</p>
          </div>
          <div>
            <p className="kpi-label">Weekly Efficiency</p>
            <p className="text-xl font-bold font-mono text-accent-red">
              {typeof driver.efficiency_vs_fleet_pct === "number" ? `${driver.efficiency_vs_fleet_pct.toFixed(1)}%` : "N/A"}
            </p>
            <p className="text-[10px] text-text-dim mt-0.5">vs Fleet Avg</p>
          </div>
        </div>
      </div>
    </Card>
  );
};
