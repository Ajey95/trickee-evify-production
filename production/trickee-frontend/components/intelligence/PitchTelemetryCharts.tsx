"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, BatteryCharging, Gauge, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { api } from "@/lib/api";
import { useVisibilityPolling } from "@/hooks/useVisibilityPolling";

const teal = "#4f9fb3";
const amber = "#c69b55";
const green = "#7aa889";
const grey = "#8b949e";
const grid = "#323945";

type PitchTelemetryChartsProps = {
  compact?: boolean;
  days?: number;
};

function ChartEmpty({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-[220px] items-center justify-center rounded-lg border border-dashed border-bg-border bg-bg-primary/30">
      <p className="text-sm text-text-dim">{label}</p>
    </div>
  );
}

function ChartLoading() {
  return <div className="h-full min-h-[220px] animate-pulse rounded-lg border border-bg-border bg-bg-primary/40" />;
}

export function PitchTelemetryCharts({ compact = false, days = 7 }: PitchTelemetryChartsProps) {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const result = await api.intelligence.reportCharts(days);
    if (result.success) setData(result.data);
    setLoading(false);
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  useVisibilityPolling(load, { intervalMs: 30_000 });

  const telemetrySeries = data?.telemetry_series || [];
  const rangeAccuracy = data?.range_accuracy || [];
  const chargingDecisions = data?.charging_decisions || [];
  const waitCounts = data?.wait_type_counts || [];

  return (
    <div className={`grid grid-cols-1 ${compact ? "xl:grid-cols-2" : "xl:grid-cols-4"} gap-6`}>
      <Card className={compact ? "" : "xl:col-span-2"}>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Gauge className="w-4 h-4 text-accent-teal" />
            SOC Trend
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[260px]">
          {loading ? <ChartLoading /> : telemetrySeries.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={telemetrySeries}>
                <CartesianGrid stroke={grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="time" stroke={grey} tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" stroke={grey} tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" stroke={amber} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "#0f131a", border: "1px solid #252b35", borderRadius: 10 }} />
                <Legend />
                <Area yAxisId="left" type="monotone" dataKey="avg_soc" name="Average SOC %" stroke={teal} fill={teal} fillOpacity={0.16} strokeWidth={2.5} />
                <Line yAxisId="right" type="monotone" dataKey="energy_kw" name="Energy kW" stroke={amber} dot={false} strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : <ChartEmpty label="No telemetry records in this window." />}
        </CardContent>
      </Card>

      <Card className={compact ? "" : "xl:col-span-2"}>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-4 h-4 text-accent-teal" />
            Prediction Tracking
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[260px]">
          {loading ? <ChartLoading /> : rangeAccuracy.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={rangeAccuracy}>
                <CartesianGrid stroke={grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="time" stroke={grey} tick={{ fontSize: 11 }} minTickGap={24} />
                <YAxis stroke={grey} tick={{ fontSize: 11 }} domain={[0, 100]} />
                <Tooltip contentStyle={{ background: "#0f131a", border: "1px solid #252b35", borderRadius: 10 }} />
                <Legend />
                <Area type="monotone" dataKey="actual_soc" name="Current SOC" stroke={grey} fill={grey} fillOpacity={0.08} strokeWidth={2} />
                <Area type="monotone" dataKey="predicted_soc" name="Predicted SOC" stroke={teal} fill={teal} fillOpacity={0.15} strokeWidth={2.5} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <ChartEmpty label="No prediction records in this window." />}
        </CardContent>
      </Card>

      <Card className={compact ? "" : "xl:col-span-2"}>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-accent-teal" />
            Wait Events
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[260px]">
          {loading ? <ChartLoading /> : waitCounts.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={waitCounts}>
                <CartesianGrid stroke={grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" stroke={grey} tick={{ fontSize: 11 }} />
                <YAxis stroke={grey} tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "#0f131a", border: "1px solid #252b35", borderRadius: 10 }} />
                <Bar dataKey="value" name="Events" fill={teal} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <ChartEmpty label="No wait events in this window." />}
        </CardContent>
      </Card>

      <Card className={compact ? "" : "xl:col-span-2"}>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BatteryCharging className="w-4 h-4 text-accent-teal" />
            Charging Decisions
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[260px]">
          {loading ? <ChartLoading /> : chargingDecisions.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chargingDecisions}>
                <CartesianGrid stroke={grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" stroke={grey} tick={{ fontSize: 11 }} />
                <YAxis stroke={grey} tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "#0f131a", border: "1px solid #252b35", borderRadius: 10 }} />
                <Bar dataKey="value" name="Decisions" fill={green} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <ChartEmpty label="No charging decisions in this window." />}
        </CardContent>
      </Card>
    </div>
  );
}
