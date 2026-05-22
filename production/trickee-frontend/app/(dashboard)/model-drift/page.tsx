"use client";

import React, { useEffect, useMemo, useState } from "react";
import { BrainCircuit, CircleCheck, Gauge, LineChart, Sigma, TrendingDown, TrendingUp } from "lucide-react";
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

function hasNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
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
      error: row.ai_error == null ? null : Number(row.ai_error),
      predicted: row.predicted_next_soc == null ? null : Number(row.predicted_next_soc),
      actual: row.true_next_soc == null ? null : Number(row.true_next_soc),
    }));
  }, [predictionRows]);

  const errors = chartRows.map((row) => row.error).filter(hasNumber);
  const mae = metrics?.mae_soc_units ?? (errors.length ? absAvg(errors) : null);
  const recent = absAvg(errors.slice(-10));
  const baseline = absAvg(errors.slice(0, 10));
  const hasGroundTruth = errors.length > 0;
  const modelReady = Boolean(metrics?.model?.ready);
  const driftStatus = !hasGroundTruth ? "pending_truth" : recent > Math.max(1.5, baseline * 1.35) ? "watch" : "stable";
  const kpis = [
    { label: "Model Status", value: modelReady ? "Loaded" : "Offline", icon: BrainCircuit, variant: modelReady ? "success" : "warning" },
    { label: "Accuracy Status", value: hasGroundTruth ? driftStatus : "Awaiting actuals", icon: CircleCheck, variant: hasGroundTruth && driftStatus === "stable" ? "success" : "info" },
    { label: "MAE", value: mae == null ? "Needs actual SOC" : Number(mae).toFixed(2), icon: Sigma, variant: mae == null ? "info" : Number(mae) <= 3 ? "success" : "warning" },
    { label: "Within 3 pct", value: metrics?.accuracy_within_3pct == null ? "Needs actual SOC" : `${Math.round(Number(metrics.accuracy_within_3pct) * 100)}%`, icon: Gauge, variant: "info" },
    { label: "Sampled Predictions", value: predictionRows.length, icon: LineChart, variant: "info" },
  ];

  return (
    <RoleGuard allowedRoles={["trickee_admin"]}>
      <div className="space-y-8 pb-12">
        <div>
          <h1 className="page-title mb-1">Model Health</h1>
          <p className="text-text-dim">Model availability, prediction coverage, and accuracy once observed next-SOC is available.</p>
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
              <CardTitle className="text-base">{hasGroundTruth ? "Prediction Error Trend" : "Prediction Coverage Trend"}</CardTitle>
            </CardHeader>
            <CardContent className="h-[360px]">
              {chartRows.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ReLineChart data={chartRows}>
                    <CartesianGrid stroke="#30363d" strokeDasharray="3 3" />
                    <XAxis dataKey="index" stroke="#8b949e" tick={{ fontSize: 11 }} />
                    <YAxis stroke="#8b949e" tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 8 }} />
                    {hasGroundTruth && <Line type="monotone" dataKey="error" name="Error" stroke="#f85149" strokeWidth={2} dot={false} />}
                    <Line type="monotone" dataKey="predicted" name="Predicted SOC" stroke="#00b4d8" strokeWidth={2} dot={false} />
                    {hasGroundTruth && <Line type="monotone" dataKey="actual" name="Observed Next SOC" stroke="#3fb950" strokeWidth={2} dot={false} />}
                  </ReLineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-bg-border text-sm text-text-dim">
                  Run predictions to populate model coverage.
                </div>
              )}
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
              Coverage Readiness
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {[
              ["Vehicles monitored", vehicles.length],
              ["Behavior snapshots", behaviorRows.length],
              ["Sampled prediction rows", predictionRows.length],
              ["Rows with observed truth", errors.length],
              ["Model version", metrics?.model_version || metrics?.model?.name || "Limited"],
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
