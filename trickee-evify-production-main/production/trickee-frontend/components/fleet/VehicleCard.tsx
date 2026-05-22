import React from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Battery, MapPin, User, ArrowRight } from "lucide-react";
import { Vehicle } from "@/types";

interface VehicleCardProps {
  vehicle: Vehicle;
}

export const VehicleCard = ({ vehicle }: VehicleCardProps) => {
  const latest = vehicle.latest_telemetry || vehicle.latest;
  const soc = latest?.soc || 0;
  const status = latest?.charge_plug ? "Charging" : latest?.ignition_on && latest?.speed && latest.speed > 3 ? "Driving" : latest?.regen_status ? "Regen" : "Idle";
  const dynamicRange = vehicle.latest_prediction?.dynamic_range_km ?? vehicle.latest_dynamic_range_km ?? 0;
  const driverName = vehicle.latest_driver?.full_name || "Unassigned";
  const location = latest?.lat && latest?.lng ? `${latest.lat.toFixed(4)}, ${latest.lng.toFixed(4)}` : "GPS unavailable";
  
  const getSocColor = (val: number) => {
    if (val > 50) return "text-accent-green";
    if (val > 20) return "text-accent-amber";
    return "text-accent-red";
  };

  return (
    <Link href={`/vehicle/${vehicle.id}`}>
      <Card hover className="group h-full flex flex-col">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h4 className="text-lg font-bold text-text-primary group-hover:text-accent-teal transition-colors">
              {vehicle.vehicle_code}
            </h4>
            <p className="text-xs text-text-dim uppercase tracking-wider mt-1">{vehicle.make} {vehicle.model}</p>
          </div>
          <Badge 
            variant={status === "Driving" ? "info" : status === "Charging" ? "success" : "default"}
            className="capitalize"
          >
            {status === "Charging" && "🔌 "}
            {status}
          </Badge>
        </div>

        <div className="flex items-end justify-between mb-6">
          <div className="space-y-1">
            <p className="kpi-label">Current SOC</p>
            <div className="flex items-baseline gap-1">
              <span className={`text-3xl font-bold font-mono ${getSocColor(soc)}`}>{Number(soc).toFixed(1).replace(/\.0$/, "")}%</span>
              <Battery className={`w-4 h-4 ${getSocColor(soc)} opacity-70`} />
            </div>
          </div>
          <div className="text-right">
            <p className="kpi-label">Dynamic Range</p>
            <p className="text-xl font-bold font-mono text-accent-teal">
              {dynamicRange.toFixed(1)} km
            </p>
          </div>
        </div>

        <div className="mt-auto space-y-3 pt-4 border-t border-bg-border/50">
          <div className="flex items-center gap-2 text-xs text-text-dim">
            <User className="w-3.5 h-3.5" />
            <span>Driver: <span className="text-text-primary">{driverName}</span></span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[10px] text-text-dim uppercase tracking-tighter">
              <MapPin className="w-3.5 h-3.5 text-accent-red opacity-50" />
              <span>{location}</span>
            </div>
            <ArrowRight className="w-4 h-4 text-accent-teal opacity-0 group-hover:opacity-100 transition-all translate-x-[-10px] group-hover:translate-x-0" />
          </div>
        </div>
      </Card>
    </Link>
  );
};
