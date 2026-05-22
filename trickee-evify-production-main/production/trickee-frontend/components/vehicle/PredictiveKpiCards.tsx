import React from "react";
import { Card } from "@/components/ui/Card";
import { Prediction } from "@/types";
import { TrendingDown, TrendingUp, ShieldCheck, Activity } from "lucide-react";

interface PredictiveKpiCardsProps {
  prediction: Prediction;
}

export const PredictiveKpiCards = ({ prediction }: PredictiveKpiCardsProps) => {
  const dynamicRange = Number(prediction.dynamic_range_km ?? 0);
  const predictedDelta = Number(prediction.predicted_delta_soc ?? 0);
  const actualSoc = Number(prediction.actual_soc ?? 0);
  const predictedNextSoc = Number(prediction.predicted_next_soc ?? actualSoc);
  const predictedRange = Number(prediction.predicted_range_km ?? dynamicRange);
  const trueNextSoc = Number(prediction.true_next_soc ?? predictedNextSoc);
  const aiError = Number(prediction.ai_error ?? 0);

  const kpis = [
    {
      label: "Dynamic Range (Now)",
      value: `${dynamicRange.toFixed(1)} km`,
      sub: "Current operating estimate",
      color: "text-accent-teal",
      icon: Activity,
    },
    {
      label: "Expected SOC Shift",
      value: `${predictedDelta > 0 ? "+" : ""}${predictedDelta.toFixed(2)}%`,
      sub: `SOC: ${actualSoc.toFixed(2)}% -> ${predictedNextSoc.toFixed(2)}%`,
      color: "text-accent-magenta",
      icon: predictedDelta >= 0 ? TrendingUp : TrendingDown,
    },
    {
      label: "Predicted Range (After 5m)",
      value: `${predictedRange.toFixed(1)} km`,
      sub: "Near-term range",
      color: "text-accent-magenta",
      icon: ShieldCheck,
    },
    {
      label: "Verified SOC",
      value: `${trueNextSoc.toFixed(2)}%`,
      sub: `Error: ${aiError.toFixed(3)}%`,
      color: "text-accent-green",
      icon: Activity,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {kpis.map((kpi) => (
        <Card key={kpi.label} className="border-bg-border/40 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <kpi.icon className={`w-12 h-12 ${kpi.color}`} />
          </div>
          <p className="kpi-label">{kpi.label}</p>
          <p className={`kpi-value my-2 ${kpi.color}`}>{kpi.value}</p>
          <p className="text-[11px] text-text-dim font-medium">{kpi.sub}</p>
        </Card>
      ))}
    </div>
  );
};
