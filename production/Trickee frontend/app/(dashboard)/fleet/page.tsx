"use client";

import React, { useEffect, useState } from "react";
import { FleetKpiBar } from "@/components/fleet/FleetKpiBar";
import { VehicleCard } from "@/components/fleet/VehicleCard";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { Vehicle } from "@/types";
import { api } from "@/lib/api";

export default function FleetPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastSync, setLastSync] = useState<Date | null>(null);

  useEffect(() => {
    let active = true;
    async function loadVehicles() {
      setIsLoading(true);
      const result = await api.vehicles.list();
      if (!active) return;
      if (result.success) {
        setVehicles(result.data.map((vehicle) => ({ ...vehicle, latest_telemetry: vehicle.latest_telemetry || vehicle.latest })));
        setLastSync(new Date());
        setError("");
      } else {
        setError(result.error || "Unable to load vehicles");
      }
      setIsLoading(false);
    }
    loadVehicles();
    const interval = setInterval(loadVehicles, 30000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <RoleGuard allowedRoles={["trickee_admin", "fleet_operator"]}>
      <div className="space-y-8">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="page-title mb-1">Fleet Overview</h1>
            <p className="text-text-dim">Real-time status of all vehicles in Evify Surat Fleet.</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-text-dim uppercase tracking-widest mb-1">Last Sync</p>
            <p className="text-sm font-mono text-accent-teal">{lastSync ? lastSync.toLocaleTimeString() : "Loading"}</p>
          </div>
        </div>

        <FleetKpiBar vehicles={vehicles} />

        {isLoading && (
          <div className="py-24 flex justify-center">
            <Spinner size="lg" />
          </div>
        )}

        {!isLoading && error && (
          <Card className="border-accent-red/30 bg-accent-red/5">
            <p className="text-sm text-accent-red">{error}</p>
          </Card>
        )}

        {!isLoading && !error && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {vehicles.map((vehicle) => (
              <VehicleCard key={vehicle.id} vehicle={vehicle} />
            ))}
          </div>
        )}
      </div>
    </RoleGuard>
  );
}
