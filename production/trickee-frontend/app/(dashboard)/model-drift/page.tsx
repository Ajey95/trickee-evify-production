"use client";

import React, { useEffect, useMemo, useState } from "react";
import { BrainCircuit, Gauge, LineChart, Sigma, TrendingDown, TrendingUp } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart as ReLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { api } from "@/lib/api";
import { Vehicle } from "@/types";

function absAvg(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + Math.abs(value), 0) / values.length : 0;
}

export default function ModelDriftPage() {
  const [metrics, setMetrics] = useState<any | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [predictionRows, setPredictionRows] = useState<any[]>([]);
  const [behaviorRows, setBehaviorRows] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      const [metricsResult, vehiclesResult, behaviorResult] = await Promise.all([
        api.admin.metrics(),
        api.vehicles.list(),
        api.intelligence.driverBehaviorHistory(100),
      ]);
      if (metricsResult.success) setMetrics(metricsResult.data);
      if (vehiclesResult.success) {
        setVehicles(vehiclesResult.data);
        const first = vehiclesResult.data[0];
        if (first) {
          const predictions = await api.predictions.history(first.id);
          if (predictions.success) setPredictionRows(predictions.data);
        }
      }
      if (behaviorResult.success) setBehaviorRows(behaviorResult.data);
    }
    load();
  }, []);

  const chartRows = useMemo(() => {
    return predictionRows.slice(0, 30).reverse().map((row, index) => ({
      index: index + 1,
      error: Number(row.ai_error || 0),
      predicted: Number(row.predicted_next_soc || 0),
      actual: Number(row.true_next_soc || row.actual_soc || 0),
    }));
  }, [predictionRows]);

  const errors = chartRows.map((row) => row.error);
  const mae = metrics?.mae_soc_units ?? absAvg(errors);
  const recent = absAvg(errors.slice(-10));
  const baseline = absAvg(errors.slice(0, 10));
  const driftStatus = recent > Math.max(1.5, baseline * 1.35) ? "watch" : "stable";
  const archetypeChanges = new Set(behaviorRows.map((row) => row.archetype_label).filter(Boolean)).size;
  const kpis = [
    { label: "Drift Status", value: driftStatus, icon: BrainCircuit, variant: driftStatus === "stable" ? "success" : "warning" },
    { label: "MAE", value: Number(mae || 0).toFixed(2), icon: Sigma, variant: Number(mae || 0) <= 3 ? "success" : "warning" },
    { label: "Within 3 pct", value: `${Math.round(Number(metrics?.accuracy_within_3pct || 0) * 100)}%`, icon: Gauge, variant: "info" },
    { label: "Prediction Rows", value: predictionRows.length, icon: LineChart, variant: "info" },
    { label: "Archetypes Seen", value: archetypeChanges, icon: TrendingUp, variant: "info" },
  ];

  return (
    <RoleGuard allowedRoles={["trickee_admin"]}>
      <div className="space-y-8 pb-12">
        <div>
          <h1 className="page-title mb-1">Model Drift Dashboard</h1>
          <p className="text-text-dim">Prediction error, behavior distribution, archetype stability, and V6 training-readiness signals.</p>
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
          {kpis.map(({ label, value, icon: Icon, variant }) => (
            <Card key={label} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-text-dim mb-2">{label}</p>
                  <p className="text-xl font-bold text-text-primary capitalize">{String(value).replaceAll("_", " ")}</p>
                </div>
                <Icon className="w-5 h-5 text-accent-teal" />
              </div>
              <Badge className="mt-3" variant={variant as any}>{String(variant)}</Badge>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Prediction Error Trend</CardTitle>
            </CardHeader>
            <CardContent className="h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <ReLineChart data={chartRows}>
                  <CartesianGrid stroke="#30363d" strokeDasharray="3 3" />
                  <XAxis dataKey="index" stroke="#8b949e" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#8b949e" tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 8 }} />
                  <Line type="monotone" dataKey="error" name="AI error" stroke="#f85149" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="predicted" name="Predicted SOC" stroke="#00b4d8" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="actual" name="Actual SOC" stroke="#3fb950" strokeWidth={2} dot={false} />
                </ReLineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Behavior Drift Signals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {behaviorRows.slice(0, 8).map((row) => (
                <div key={row.id} className="rounded-lg border border-bg-border bg-bg-primary/40 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-text-primary capitalize">
                      {(row.archetype_label || row.style_label || "unknown").replaceAll("_", " ")}
                    </p>
                    <Badge variant={Number(row.archetype_confidence || 0) >= 0.7 ? "success" : "warning"}>
                      {Math.round(Number(row.archetype_confidence || 0) * 100)}%
                    </Badge>
                  </div>
                  <p className="text-xs text-text-dim mt-1">
                    {row.computed_at ? new Date(row.computed_at).toLocaleString() : "-"} | {row.sample_count || 0} samples
                  </p>
                </div>
              ))}
              {!behaviorRows.length && <p className="text-sm text-text-dim">No behavior snapshots with archetype confidence yet.</p>}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              {driftStatus === "stable" ? <TrendingDown className="w-4 h-4 text-accent-green" /> : <TrendingUp className="w-4 h-4 text-accent-amber" />}
              V6 Readiness
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              ["Vehicles monitored", vehicles.length],
              ["Behavior snapshots", behaviorRows.length],
              ["Prediction history", predictionRows.length],
              ["Model version", metrics?.model_version || metrics?.model?.name || "fallback"],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-lg border border-bg-border bg-bg-primary/40 p-4">
                <p className="text-[10px] uppercase tracking-wider text-text-dim mb-2">{String(label)}</p>
                <p className="text-lg font-bold text-text-primary">{String(value)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </RoleGuard>
  );
}
