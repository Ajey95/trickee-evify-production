"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, BarChart3, BatteryCharging, Clock3, Gauge, RefreshCcw, TrendingUp } from "lucide-react";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";
import { useVisibilityPolling } from "@/hooks/useVisibilityPolling";

const timeWindows = [
  { label: "24 hours", days: 1 },
  { label: "7 days", days: 7 },
  { label: "10 days", days: 10 },
  { label: "14 days", days: 14 },
  { label: "30 days", days: 30 },
];

const chartStroke = "#323945";
const muted = "#8b949e";
const teal = "#4f9fb3";
const green = "#7aa889";
const amber = "#c69b55";
const red = "#df6d63";

function formatNumber(value: unknown, fallback = "0") {
  return typeof value === "number" && Number.isFinite(value) ? value.toLocaleString() : fallback;
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-[260px] items-center justify-center rounded-xl border border-dashed border-bg-border bg-bg-primary/30">
      <p className="text-sm text-text-dim">{label}</p>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="h-[280px] animate-pulse rounded-xl border border-bg-border bg-bg-primary/40">
      <div className="h-full bg-[linear-gradient(115deg,transparent,rgba(255,255,255,0.04),transparent)]" />
    </div>
  );
}

export default function ReportsPage() {
  const [days, setDays] = useState(7);
  const [reportData, setReportData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const load = useCallback(async (showLoading = false) => {
    if (showLoading) setIsLoading(true);
    const result = await api.intelligence.reportCharts(days);
    if (result.success) {
      setReportData(result.data);
      setLastSync(new Date());
      setError("");
    } else {
      setError(result.error || "Unable to load report charts");
    }
    setIsLoading(false);
  }, [days]);

  useEffect(() => {
    load(true);
  }, [load]);

  useVisibilityPolling(() => load(false), { intervalMs: 30_000 });

  const summary = reportData?.summary || {};
  const telemetrySeries = reportData?.telemetry_series || [];
  const rangeAccuracy = reportData?.range_accuracy || [];
  const speedEnergy = reportData?.speed_energy || [];
  const waitCounts = reportData?.wait_type_counts || [];
  const chargingDecisions = reportData?.charging_decisions || [];

  const hasAnyData = useMemo(
    () => telemetrySeries.length || rangeAccuracy.length || speedEnergy.length || waitCounts.length || chargingDecisions.length,
    [telemetrySeries.length, rangeAccuracy.length, speedEnergy.length, waitCounts.length, chargingDecisions.length]
  );

  return (
    <RoleGuard allowedRoles={["trickee_admin", "fleet_operator"]}>
      <div className="space-y-8 pb-12">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="page-title mb-1">Live Report Charts</h1>
            <p className="max-w-3xl text-text-dim">
              Database-backed fleet charts generated from telemetry, prediction, wait, and charging decision records.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={days}
              onChange={(event) => setDays(Number(event.target.value))}
              className="h-10 min-w-[160px] rounded-lg border border-bg-border bg-bg-card px-3 text-sm text-text-primary outline-none transition-colors focus:border-accent-teal"
            >
              {timeWindows.map((window) => (
                <option key={window.days} value={window.days}>
                  Last {window.label}
                </option>
              ))}
            </select>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => load(true)} disabled={isLoading}>
              <RefreshCcw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {error && (
          <Card className="border-accent-red/30 bg-accent-red/5">
            <p className="text-sm text-accent-red">{error}</p>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          {[
            ["Telemetry Rows", formatNumber(summary.telemetry_rows), Activity],
            ["Prediction Rows", formatNumber(summary.prediction_rows), TrendingUp],
            ["Average SOC", summary.avg_soc === undefined ? "--" : `${summary.avg_soc}%`, Gauge],
            ["Average Speed", summary.avg_speed === undefined ? "--" : `${summary.avg_speed} km/h`, BarChart3],
            ["Low SOC Events", formatNumber(summary.low_soc_events), BatteryCharging],
          ].map(([label, value, Icon]) => (
            <Card key={String(label)} className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xl font-semibold text-text-primary">{String(value)}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-wider text-text-dim">{String(label)}</p>
                </div>
                <Icon className="h-5 w-5 text-accent-teal" />
              </div>
            </Card>
          ))}
        </div>

        {!hasAnyData && !isLoading && (
          <Card className="border-dashed">
            <p className="text-sm text-text-dim">
              No chartable records were found for this time window. Select a wider range or ingest fresh telemetry.
            </p>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Gauge className="h-4 w-4 text-accent-teal" />
                SOC And Energy Trend
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              {isLoading ? <ChartSkeleton /> : telemetrySeries.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={telemetrySeries}>
                    <CartesianGrid stroke={chartStroke} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="time" stroke={muted} tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="left" stroke={muted} tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="right" orientation="right" stroke={teal} tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: "#0f131a", border: "1px solid #252b35", borderRadius: 10 }} />
                    <Legend />
                    <Area yAxisId="left" type="monotone" dataKey="avg_soc" name="Average SOC %" stroke={teal} fill={teal} fillOpacity={0.16} strokeWidth={2.5} />
                    <Line yAxisId="right" type="monotone" dataKey="energy_kw" name="Energy kW" stroke={amber} dot={false} strokeWidth={2} />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : <EmptyChart label="No telemetry series for this window." />}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-4 w-4 text-accent-teal" />
                Prediction Accuracy
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              {isLoading ? <ChartSkeleton /> : rangeAccuracy.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={rangeAccuracy}>
                    <CartesianGrid stroke={chartStroke} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="time" stroke={muted} tick={{ fontSize: 11 }} minTickGap={24} />
                    <YAxis stroke={muted} tick={{ fontSize: 11 }} domain={[0, 100]} />
                    <Tooltip contentStyle={{ background: "#0f131a", border: "1px solid #252b35", borderRadius: 10 }} />
                    <Legend />
                    <Area type="monotone" dataKey="actual_soc" name="Current SOC" stroke={muted} fill={muted} fillOpacity={0.08} strokeWidth={2} />
                    <Area type="monotone" dataKey="predicted_soc" name="Predicted SOC" stroke={teal} fill={teal} fillOpacity={0.15} strokeWidth={2.5} />
                    <Line type="monotone" dataKey="true_next_soc" name="Observed Next SOC" stroke={green} dot={false} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : <EmptyChart label="No prediction records for this window." />}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4 text-accent-teal" />
                Speed Versus Energy
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              {isLoading ? <ChartSkeleton /> : speedEnergy.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart>
                    <CartesianGrid stroke={chartStroke} strokeDasharray="3 3" />
                    <XAxis dataKey="speed" type="number" name="Speed" unit=" km/h" stroke={muted} tick={{ fontSize: 11 }} />
                    <YAxis dataKey="energy_kw" type="number" name="Energy" unit=" kW" stroke={muted} tick={{ fontSize: 11 }} />
                    <Tooltip cursor={{ strokeDasharray: "3 3" }} contentStyle={{ background: "#0f131a", border: "1px solid #252b35", borderRadius: 10 }} />
                    <Scatter name="Telemetry sample" data={speedEnergy} fill={teal}>
                      {speedEnergy.map((entry: any, index: number) => (
                        <Cell key={`${entry.speed}-${index}`} fill={entry.soc < 20 ? red : entry.speed > 45 ? amber : teal} />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              ) : <EmptyChart label="No speed-energy records for this window." />}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock3 className="h-4 w-4 text-accent-teal" />
                Wait And Charging Outcomes
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              {isLoading ? <ChartSkeleton /> : waitCounts.length || chargingDecisions.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[...waitCounts, ...chargingDecisions.map((row: any) => ({ ...row, name: `Charge: ${row.name}` }))]}>
                    <CartesianGrid stroke={chartStroke} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" stroke={muted} tick={{ fontSize: 10 }} interval={0} angle={-14} textAnchor="end" height={72} />
                    <YAxis stroke={muted} tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: "#0f131a", border: "1px solid #252b35", borderRadius: 10 }} />
                    <Bar dataKey="value" name="Count" radius={[6, 6, 0, 0]}>
                      {[...waitCounts, ...chargingDecisions].map((_entry: any, index: number) => (
                        <Cell key={index} fill={index < waitCounts.length ? teal : green} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyChart label="No wait or charging outcomes for this window." />}
            </CardContent>
          </Card>
        </div>

        <p className="text-xs text-text-dim">
          {lastSync ? `Last refreshed ${lastSync.toLocaleTimeString()}` : "Waiting for first refresh"}
        </p>
      </div>
    </RoleGuard>
  );
}
