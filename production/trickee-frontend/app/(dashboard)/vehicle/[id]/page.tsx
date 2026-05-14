"use client";

import React, { useState, useEffect, useCallback } from "react";
import { PredictiveKpiCards } from "@/components/vehicle/PredictiveKpiCards";
import { RangePenaltyBreakdown } from "@/components/vehicle/RangePenaltyBreakdown";
import { SocLineChart } from "@/components/charts/SocLineChart";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Thermometer, Zap, Activity, Shield, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { Prediction, Vehicle } from "@/types";
import { api } from "@/lib/api";
import { useVisibilityPolling } from "@/hooks/useVisibilityPolling";

export default function VehiclePage({ params }: { params: { id: string } }) {
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [latestTelemetry, setLatestTelemetry] = useState<any | null>(null);
  const [chartData, setChartData] = useState<{ time: string; soc: number; isPredicted?: boolean }[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRoadmapOpen, setIsRoadmapOpen] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [error, setError] = useState("");
  const [vehicleLabel, setVehicleLabel] = useState(params.id);

  const loadData = useCallback(async () => {
    setIsRefreshing(true);
    let vehicleId = params.id;
    let predictionResult = await api.predictions.infer(vehicleId);

    if (!predictionResult.success && predictionResult.error?.toLowerCase().includes("vehicle not found")) {
      const vehiclesResult = await api.vehicles.list();
      const matchedVehicle = vehiclesResult.success
        ? vehiclesResult.data.find((vehicle: Vehicle) => vehicle.vehicle_code === params.id)
        : null;
      if (matchedVehicle) {
        vehicleId = matchedVehicle.id;
        setVehicleLabel(matchedVehicle.vehicle_code);
        predictionResult = await api.predictions.infer(vehicleId);
      }
    }

    const telemetryResult = await api.vehicles.telemetry(vehicleId, 20);

    if (!predictionResult.success) {
      setError(predictionResult.error || "Unable to run prediction. Make sure this vehicle has at least 20 telemetry rows.");
      setIsRefreshing(false);
      return;
    }
    const predictionData = (predictionResult.data as any).prediction || predictionResult.data;
    const rows = telemetryResult.success ? telemetryResult.data : [];
    const data: { time: string; soc: number; isPredicted?: boolean }[] = [...rows].reverse().map((row) => ({
      time: new Date(row.recorded_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      soc: Number(row.soc || 0),
    }));
    const predTime = new Date(Date.now() + 5 * 60000);
    data.push({
      time: predTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      soc: predictionData.predicted_next_soc,
      isPredicted: true
    });
    setPrediction(predictionData);
    setLatestTelemetry(rows[0] || null);
    setLastRefreshed(new Date());
    setChartData(data);
    setError("");
    setIsRefreshing(false);
  }, [params.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useVisibilityPolling(loadData, { intervalMs: 30_000 });

  if (!prediction && !error) return null;

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="page-title mb-0">{vehicleLabel}</h1>
        <Card className="border-accent-red/30 bg-accent-red/5">
          <p className="text-sm text-accent-red">{error}</p>
        </Card>
      </div>
    );
  }

  if (!prediction) return null;

  return (
    <div className="space-y-8 pb-12">
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-accent-teal/10 rounded-2xl border border-accent-teal/20">
            <Shield className="w-8 h-8 text-accent-teal" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="page-title mb-0">{vehicleLabel}</h1>
              <Badge variant="success">Active AI Monitoring</Badge>
            </div>
            <p className="text-text-dim mt-1">LSTM Sequence Inference Engine V4.1</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2 px-3 py-1 bg-bg-card border border-bg-border rounded-full text-[10px] font-bold text-text-dim uppercase tracking-wider">
            {isRefreshing ? (
              <>
                <RefreshCw className="w-2 h-2 text-accent-magenta animate-spin" />
                <span className="text-accent-magenta">Inferencing...</span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 rounded-full bg-accent-green animate-pulse"></div>
                <span>Live Monitoring</span>
              </>
            )}
          </div>
          <p className="text-xs text-text-dim font-mono">Last predicted: {lastRefreshed.toLocaleTimeString()}</p>
        </div>
      </div>

      <PredictiveKpiCards prediction={prediction} />

      <RangePenaltyBreakdown prediction={prediction} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>100-Minute Prediction Context</CardTitle>
              <CardDescription>Historical SOC flow vs AI predictive point</CardDescription>
            </div>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-accent-teal"></div>
                <span className="text-[10px] text-text-dim uppercase font-bold">Historical</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-accent-magenta"></div>
                <span className="text-[10px] text-text-dim uppercase font-bold">Predicted (5m)</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <SocLineChart data={chartData} />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Context Features</CardTitle>
              <CardDescription>Physics inputs to LSTM</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {[
                { label: "Thermal Momentum", value: `${latestTelemetry?.temp_rise_rate?.toFixed?.(3) || "0.000"} C/min`, icon: Thermometer, color: "text-accent-amber" },
                { label: "Motor Load Stress", value: `${latestTelemetry?.power_density?.toFixed?.(3) || "0.000"} kW/kWh`, icon: Activity, color: "text-accent-teal" },
                { label: "Pack Resistance", value: `${latestTelemetry?.r_internal_mohm?.toFixed?.(1) || "0.0"} mOhm`, icon: Zap, color: "text-accent-magenta" },
              ].map((f) => (
                <div key={f.label} className="flex items-center justify-between p-3 rounded-lg bg-bg-primary/50 border border-bg-border/30">
                  <div className="flex items-center gap-3">
                    <f.icon className={`w-4 h-4 ${f.color}`} />
                    <span className="text-sm font-medium">{f.label}</span>
                  </div>
                  <span className="text-sm font-mono font-bold text-text-primary">{f.value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-bg-border/20 border-dashed opacity-80 group">
             <CardHeader 
              className="flex-row items-center justify-between cursor-pointer"
              onClick={() => setIsRoadmapOpen(!isRoadmapOpen)}
            >
              <CardTitle className="text-sm">Model Feature Contract</CardTitle>
              {isRoadmapOpen ? <ChevronUp className="w-4 h-4 text-text-dim" /> : <ChevronDown className="w-4 h-4 text-text-dim" />}
            </CardHeader>
            {isRoadmapOpen && (
              <CardContent className="p-0 animate-in slide-in-from-top-2 duration-300">
                 <p className="p-4 text-xs text-text-dim">
                  Prediction values on this page are returned by the backend inference endpoint from the latest telemetry window.
                 </p>
              </CardContent>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
