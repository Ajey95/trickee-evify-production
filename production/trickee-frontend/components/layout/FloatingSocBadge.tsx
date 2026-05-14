"use client";

import React, { useEffect, useMemo, useState } from "react";
import { BatteryCharging, Radio } from "lucide-react";
import { api } from "@/lib/api";
import { Vehicle } from "@/types";

function getVehicleSoc(vehicle: Vehicle) {
  const predicted = vehicle.latest_prediction?.predicted_next_soc;
  if (typeof predicted === "number" && Number.isFinite(predicted)) return predicted;
  const latest = vehicle.latest_telemetry || vehicle.latest;
  return typeof latest?.soc === "number" ? latest.soc : null;
}

export function FloatingSocBadge() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  useEffect(() => {
    let active = true;

    async function loadVehicles() {
      const result = await api.vehicles.list();
      if (!active || !result.success) return;
      setVehicles(result.data);
      setLastSync(new Date());
    }

    loadVehicles();
    const interval = window.setInterval(loadVehicles, 30000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  const socSummary = useMemo(() => {
    const values = vehicles.map(getVehicleSoc).filter((value): value is number => value !== null);
    if (!values.length) return { average: null, lowCount: 0, activeCount: 0 };
    const average = values.reduce((sum, value) => sum + value, 0) / values.length;
    return {
      average,
      lowCount: values.filter((value) => value < 20).length,
      activeCount: values.length,
    };
  }, [vehicles]);

  const average = socSummary.average;
  const label = average === null ? "Syncing" : average < 20 ? "Critical" : average < 45 ? "Watch" : "Stable";
  const colorClass = average === null ? "text-text-dim" : average < 20 ? "text-accent-red" : average < 45 ? "text-accent-amber" : "text-accent-teal";

  return (
    <aside className="fixed right-7 top-[88px] z-40 hidden w-[230px] rounded-2xl border border-accent-teal/45 bg-bg-primary/85 p-4 shadow-2xl shadow-accent-teal/10 backdrop-blur-xl xl:block">
      <div className="absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_20%_0%,rgba(0,180,216,0.18),transparent_42%)]" />
      <div className="relative">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-dim">Live SOC</p>
          <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-accent-green">
            <Radio className="h-3 w-3" />
            {label}
          </div>
        </div>
        <div className="flex items-end gap-2">
          <p className={`font-mono text-4xl font-black tracking-tight ${colorClass}`}>
            {average === null ? "--" : average.toFixed(1)}
          </p>
          <p className="pb-1 font-mono text-xl font-black text-text-primary">%</p>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-bg-border/70 pt-3 text-[11px] text-text-dim">
          <span className="flex items-center gap-1.5">
            <BatteryCharging className="h-3.5 w-3.5 text-accent-teal" />
            {socSummary.activeCount} vehicles
          </span>
          <span>{socSummary.lowCount} low</span>
        </div>
        <p className="mt-2 text-[10px] uppercase tracking-[0.16em] text-text-dim">
          {lastSync ? lastSync.toLocaleTimeString() : "Waiting for fleet sync"}
        </p>
      </div>
    </aside>
  );
}
