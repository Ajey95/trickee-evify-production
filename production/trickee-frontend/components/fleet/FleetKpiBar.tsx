import React from "react";
import { Card } from "@/components/ui/Card";
import { Zap, Battery, AlertTriangle, Power } from "lucide-react";
import { Vehicle } from "@/types";

interface FleetKpiBarProps {
  vehicles?: Vehicle[];
}

export const FleetKpiBar = ({ vehicles = [] }: FleetKpiBarProps) => {
  const telemetry = vehicles.map((vehicle) => vehicle.latest_telemetry || vehicle.latest).filter(Boolean);
  const avgSoc = telemetry.length
    ? telemetry.reduce((sum, row: any) => sum + Number(row.soc || 0), 0) / telemetry.length
    : 0;
  const lowSoc = telemetry.filter((row: any) => Number(row.soc || 0) < 25).length;
  const charging = telemetry.filter((row: any) => Boolean(row.charge_plug)).length;
  const stats = [
    { label: "Total Vehicles", value: String(vehicles.length).padStart(2, "0"), icon: Zap, color: "text-accent-teal" },
    { label: "Avg Fleet SOC", value: `${avgSoc.toFixed(1)}%`, icon: Battery, color: "text-accent-green" },
    { label: "Low SOC Warning", value: String(lowSoc).padStart(2, "0"), icon: AlertTriangle, color: "text-accent-amber" },
    { label: "Active Charging", value: String(charging).padStart(2, "0"), icon: Power, color: "text-accent-magenta" },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {stats.map((stat) => (
        <Card key={stat.label} className="flex items-center gap-4 py-4 px-6 border-bg-border/40">
          <div className={`p-3 rounded-xl bg-bg-primary border border-bg-border`}>
            <stat.icon className={`w-6 h-6 ${stat.color}`} />
          </div>
          <div>
            <p className="kpi-label">{stat.label}</p>
            <p className="kpi-value text-2xl">{stat.value}</p>
          </div>
        </Card>
      ))}
    </div>
  );
};
