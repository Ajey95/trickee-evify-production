"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { Card } from "@/components/ui/Card";
import { api } from "@/lib/api";
import type { Vehicle } from "@/types";

export default function VehicleIndexPage() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api.vehicles.list().then((result) => {
      if (!active) return;
      if (result.success && result.data.length) {
        router.replace(`/vehicle/${result.data[0].id}`);
        return;
      }
      setVehicles(result.success ? result.data : []);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [router]);

  return (
    <RoleGuard allowedRoles={["trickee_admin", "fleet_operator"]}>
      <div className="space-y-6">
        <div>
          <h1 className="page-title mb-1">Vehicle Forecasts</h1>
          <p className="text-text-dim">Select a vehicle to review SOC and range outlook.</p>
        </div>
        {loading ? (
          <div className="grid gap-4 md:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-36 animate-pulse rounded-xl border border-bg-border bg-bg-card/60" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {vehicles.map((vehicle) => (
              <button
                key={vehicle.id}
                type="button"
                onClick={() => router.push(`/vehicle/${vehicle.id}`)}
                className="text-left"
              >
                <Card hover>
                  <p className="text-sm font-semibold text-text-primary">{vehicle.vehicle_code}</p>
                  <p className="mt-2 text-xs text-text-dim">{vehicle.make} {vehicle.model}</p>
                </Card>
              </button>
            ))}
            {!vehicles.length && (
              <Card className="md:col-span-3">
                <p className="text-sm text-text-dim">No vehicles are available for your current fleet scope.</p>
              </Card>
            )}
          </div>
        )}
      </div>
    </RoleGuard>
  );
}
