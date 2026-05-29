"use client";

import React, { useEffect, useMemo, useState } from "react";
import { History, Route as RouteIcon } from "lucide-react";
import { TripHistoryTable } from "@/components/driver/TripHistoryTable";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { Card, CardContent } from "@/components/ui/Card";
import { api } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { Driver } from "@/types";

export default function PastTripsPage() {
  const { user } = useAuth();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [trips, setTrips] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDrivers() {
      setIsLoading(true);
      const result =
        user?.role === "driver"
          ? await api.drivers.me().then((response) => ({
              ...response,
              data: response.success ? [response.data] : [],
            }))
          : await api.drivers.list();

      if (result.success) {
        setDrivers(result.data);
        setSelectedDriverId(result.data[0]?.id || "");
        setError("");
      } else {
        setError(result.error || "Unable to load driver list.");
      }
      setIsLoading(false);
    }

    if (user) loadDrivers();
  }, [user]);

  useEffect(() => {
    async function loadTrips() {
      if (!selectedDriverId) {
        setTrips([]);
        return;
      }
      setIsLoading(true);
      const result = await api.drivers.trips(selectedDriverId, 50);
      if (result.success) {
        setTrips(result.data);
        setError("");
      } else {
        setTrips([]);
        setError(result.error || "Unable to load trips.");
      }
      setIsLoading(false);
    }

    loadTrips();
  }, [selectedDriverId]);

  const selectedDriver = useMemo(
    () => drivers.find((driver) => driver.id === selectedDriverId),
    [drivers, selectedDriverId]
  );

  return (
    <RoleGuard allowedRoles={["trickee_admin", "fleet_operator", "driver"]}>
      <div className="space-y-5 pb-12 sm:space-y-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="page-title mb-1">Past Trips</h1>
            <p className="text-text-dim">Trip route replay, SOC movement, energy, cost, savings, and nudge outcome.</p>
          </div>
          {user?.role !== "driver" && (
            <select
              value={selectedDriverId}
              onChange={(event) => setSelectedDriverId(event.target.value)}
              className="h-10 w-full rounded-lg border border-bg-border bg-bg-card px-3 text-sm text-text-primary outline-none focus:border-accent-teal sm:min-w-[260px] lg:w-auto"
            >
              {drivers.map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {driver.driver_code} - {driver.full_name}
                </option>
              ))}
            </select>
          )}
        </div>

        {error && (
          <Card className="border-accent-red/30 bg-accent-red/5">
            <p className="text-sm text-accent-red">{error}</p>
          </Card>
        )}

        <Card>
          <CardContent className="grid grid-cols-1 gap-3 p-4 md:grid-cols-4">
            {[
              ["Driver", selectedDriver?.full_name || "No driver selected"],
              ["Driver code", selectedDriver?.driver_code || "-"],
              ["Trips loaded", String(trips.length)],
              ["Detail", "Click any trip"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-bg-border bg-bg-primary/40 p-3">
                <p className="text-[10px] uppercase tracking-wider text-text-dim">{label}</p>
                <p className="mt-1 text-sm font-semibold text-text-primary">{value}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <section>
          <div className="mb-4 flex items-center gap-3">
            <History className="h-5 w-5 text-accent-teal" />
            <h2 className="section-title mb-0">Trip History</h2>
          </div>
          {isLoading ? (
            <Card>
              <div className="flex items-center gap-3 text-sm text-text-dim">
                <RouteIcon className="h-4 w-4 animate-pulse text-accent-teal" />
                Loading trips...
              </div>
            </Card>
          ) : (
            <TripHistoryTable trips={trips} />
          )}
        </section>
      </div>
    </RoleGuard>
  );
}
