"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Activity, Bell, Database, Radio, Server, TimerReset } from "lucide-react";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { api } from "@/lib/api";
import { useDriverLocationWS } from "@/hooks/useDriverLocationWS";
import { useVisibilityPolling } from "@/hooks/useVisibilityPolling";

export default function ObservabilityPage() {
  const [metrics, setMetrics] = useState<any | null>(null);
  const [fleetLive, setFleetLive] = useState<any | null>(null);
  const [history, setHistory] = useState<any>({});
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const { connected } = useDriverLocationWS();

  const load = useCallback(async () => {
    const [metricsResult, fleetResult, nudges, orders, charging, waits] = await Promise.all([
      api.admin.metrics(),
      api.intelligence.fleetLive(),
      api.intelligence.nudges(10),
      api.intelligence.orderAssignments(10),
      api.intelligence.chargingDecisions(10),
      api.intelligence.waits(10),
    ]);
    if (metricsResult.success) setMetrics(metricsResult.data);
    if (fleetResult.success) setFleetLive(fleetResult.data);
    setHistory({
      nudges: nudges.success ? nudges.data : [],
      orders: orders.success ? orders.data : [],
      charging: charging.success ? charging.data : [],
      waits: waits.success ? waits.data : [],
    });
    setLastRefresh(new Date());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useVisibilityPolling(load, { intervalMs: 30_000 });

  const counts = metrics?.counts || {};
  const kpis = [
    { label: "WebSocket", value: connected ? "Live" : "Fallback", icon: Radio, variant: connected ? "success" : "warning" },
    { label: "Vehicles", value: counts.vehicles || 0, icon: Activity, variant: "info" },
    { label: "Telemetry", value: counts.telemetry || 0, icon: Database, variant: "info" },
    { label: "Nudges", value: counts.nudge_events || 0, icon: Bell, variant: "info" },
    { label: "Last Refresh", value: lastRefresh?.toLocaleTimeString() || "-", icon: TimerReset, variant: "outline" },
  ];
  const latestEvents = [
    ...(history.nudges || []).map((row: any) => ({ type: "nudge", title: row.nudge_type, at: row.created_at })),
    ...(history.orders || []).map((row: any) => ({ type: "order", title: row.strategy || row.assigned_driver_id, at: row.created_at })),
    ...(history.charging || []).map((row: any) => ({ type: "charging", title: row.chosen_option, at: row.created_at })),
    ...(history.waits || []).map((row: any) => ({ type: "wait", title: row.wait_type, at: row.started_at })),
  ].sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime()).slice(0, 12);

  return (
    <RoleGuard allowedRoles={["trickee_admin"]}>
      <div className="space-y-8 pb-12">
        <div>
          <h1 className="page-title mb-1">Production Observability</h1>
          <p className="text-text-dim">Runtime health, WebSocket state, event throughput, and backend table counters.</p>
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
          {kpis.map(({ label, value, icon: Icon, variant }) => (
            <Card key={label} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-text-dim mb-2">{label}</p>
                  <p className="text-xl font-bold text-text-primary">{String(value)}</p>
                </div>
                <Icon className="w-5 h-5 text-accent-teal" />
              </div>
              <Badge className="mt-3" variant={variant as any}>{label}</Badge>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Server className="w-4 h-4 text-accent-teal" />
                API Health
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                ["Model ready", metrics?.model?.ready ? "Ready" : "Fallback"],
                ["Model", metrics?.model?.name || metrics?.model_version || "-"],
                ["Avg inference", `${Number(metrics?.avg_inference_latency_ms || 0).toFixed(1)} ms`],
                ["Fleet active", `${fleetLive?.summary?.active_drivers || 0} drivers`],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between rounded-lg border border-bg-border bg-bg-primary/40 p-3">
                  <p className="text-xs text-text-dim">{label}</p>
                  <p className="text-sm font-semibold text-text-primary">{value}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Recent Decision Events</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {latestEvents.map((event, index) => (
                <div key={`${event.type}-${event.at}-${index}`} className="rounded-lg border border-bg-border bg-bg-primary/40 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-text-primary capitalize">{String(event.title || event.type).replaceAll("_", " ")}</p>
                    <Badge variant="outline">{event.type}</Badge>
                  </div>
                  <p className="text-xs text-text-dim mt-1">{event.at ? new Date(event.at).toLocaleString() : "-"}</p>
                </div>
              ))}
              {!latestEvents.length && <p className="text-sm text-text-dim">No decision events have been logged yet.</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </RoleGuard>
  );
}
