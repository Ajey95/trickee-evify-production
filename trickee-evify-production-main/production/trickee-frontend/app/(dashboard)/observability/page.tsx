"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Activity, Bell, Database, Radio, Server, TimerReset, Users, Car, MapPin, Zap, ShieldAlert, Cpu } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { api } from "@/lib/api";
import { useDriverLocationWS } from "@/hooks/useDriverLocationWS";
import { useVisibilityPolling } from "@/hooks/useVisibilityPolling";

export default function ObservabilityPage() {
  const [metrics, setMetrics] = useState<any | null>(null);
  const [fleetLive, setFleetLive] = useState<any | null>(null);
  const [chartsData, setChartsData] = useState<any | null>(null);
  const [history, setHistory] = useState<any>({});
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const { connected } = useDriverLocationWS();

  const load = useCallback(async () => {
    const [metricsResult, fleetResult, nudges, orders, charging, waits, chartsResult] = await Promise.all([
      api.admin.metrics(),
      api.intelligence.fleetLive(),
      api.intelligence.nudges(10),
      api.intelligence.orderAssignments(10),
      api.intelligence.chargingDecisions(10),
      api.intelligence.waits(10),
      api.intelligence.reportCharts(7),
    ]);
    if (metricsResult.success) setMetrics(metricsResult.data);
    if (fleetResult.success) setFleetLive(fleetResult.data);
    if (chartsResult.success) setChartsData(chartsResult.data);
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
    { label: "Live Stream", value: connected ? "Connected" : "Background", icon: Radio, variant: connected ? "success" : "warning" },
    { label: "Fleet Vehicles", value: counts.vehicles || 0, icon: Car, variant: "info" },
    { label: "Fleet Drivers", value: counts.drivers || 0, icon: Users, variant: "info" },
    { label: "Telemetry Logged", value: (counts.telemetry || 0).toLocaleString(), icon: Database, variant: "info" },
    { label: "Model Inferences", value: (counts.predictions || 0).toLocaleString(), icon: Cpu, variant: "info" },
  ];

  const secondaryCounts = [
    { label: "Inferred Trips", value: counts.trips || 0, icon: MapPin },
    { label: "Dispatched Nudges", value: counts.nudge_events || 0, icon: Bell },
    { label: "Order Assignments", value: counts.order_assignment_decisions || 0, icon: Zap },
    { label: "Charging Recommendations", value: counts.charging_decision_records || 0, icon: Server },
    { label: "Logged Wait Events", value: counts.wait_events || 0, icon: Activity },
    { label: "Security Incidents", value: counts.security_events || 0, icon: ShieldAlert },
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
        <div className="flex justify-between items-end">
          <div>
            <h1 className="page-title mb-1">Operations Health</h1>
            <p className="text-text-dim">System health, live activity, and recent decision events.</p>
          </div>
          <div className="text-right text-xs text-text-dim flex items-center gap-1.5 bg-bg-primary/40 border border-bg-border rounded-lg px-3 py-1.5">
            <TimerReset className="w-3.5 h-3.5" />
            Last Refreshed: {lastRefresh?.toLocaleTimeString() || "-"}
          </div>
        </div>

        {/* Primary Health KPIs */}
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

        {/* Ingestion & AI Performance Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Database className="w-4 h-4 text-accent-teal" />
                Live Log Ingestion Feed (Telemetry Ingest Rate)
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[280px]">
              {chartsData?.telemetry_series ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartsData.telemetry_series} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorSamples" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4f9fb3" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#4f9fb3" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#252a33" />
                    <XAxis dataKey="time" stroke="#8b949e" style={{ fontSize: 10 }} />
                    <YAxis stroke="#8b949e" style={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#0d1117", borderColor: "#30363d", borderRadius: 8 }}
                      labelStyle={{ color: "#8b949e", fontSize: 11 }}
                      itemStyle={{ color: "#f0f6fc", fontSize: 12 }}
                    />
                    <Area type="monotone" dataKey="samples" name="Telemetry Packets Ingested" stroke="#4f9fb3" fillOpacity={1} fill="url(#colorSamples)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center">
                  <p className="text-sm text-text-dim">Loading charts...</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="w-4 h-4 text-accent-teal" />
                Historical Model Prediction Error (AI Drift)
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[280px]">
              {chartsData?.range_accuracy ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartsData.range_accuracy} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorError" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#df6d63" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#df6d63" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#252a33" />
                    <XAxis dataKey="time" stroke="#8b949e" style={{ fontSize: 10 }} />
                    <YAxis stroke="#8b949e" style={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#0d1117", borderColor: "#30363d", borderRadius: 8 }}
                      labelStyle={{ color: "#8b949e", fontSize: 11 }}
                      itemStyle={{ color: "#f0f6fc", fontSize: 12 }}
                    />
                    <Area type="monotone" dataKey="error" name="AI Prediction Error (SOC)" stroke="#df6d63" fillOpacity={1} fill="url(#colorError)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center">
                  <p className="text-sm text-text-dim">Loading charts...</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Runtime Database Metrics Counts */}
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-dim mb-4">Database Runtime Counts</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
            {secondaryCounts.map(({ label, value, icon: Icon }) => (
              <Card key={label} className="p-4 bg-bg-primary/30 border-bg-border/60">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[10px] uppercase tracking-wider text-text-dim truncate">{label}</span>
                  <Icon className="w-4 h-4 text-accent-teal/70 shrink-0" />
                </div>
                <p className="text-lg font-bold text-text-primary font-mono">{Number(value).toLocaleString()}</p>
              </Card>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Server className="w-4 h-4 text-accent-teal" />
                Service Health
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                ["Model status", metrics?.model?.ready ? "Ready" : "Limited"],
                ["Model name", metrics?.model?.name || metrics?.model_version || "-"],
                ["Avg inference latency", `${Number(metrics?.avg_inference_latency_ms || 0).toFixed(1)} ms`],
                ["Active fleet drivers", `${fleetLive?.summary?.active_drivers || 0} drivers`],
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
