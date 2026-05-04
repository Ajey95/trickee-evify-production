"use client";

import React, { useMemo, useState } from "react";
import Image from "next/image";
import { BarChart3, BatteryCharging, Gauge, LineChart, MapPin, TrendingUp } from "lucide-react";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

const chartSets = {
  evify: {
    label: "Evify",
    city: "Surat",
    vehicle: "GJ05PZ1903",
    driver: "Ravi Shah",
    accent: "text-accent-teal",
    summary: {
      trueRange: "61.4 km",
      actualRange: "60.5 km",
      aiAccuracy: "98.5%",
      dailyUpside: "Rs 375",
      monthlyFleetUpside: "Rs 75,000",
    },
    charts: [
      {
        title: "BMS vs Trickee Range Accuracy",
        src: "/report-charts/evify_range_accuracy.png",
        width: 1635,
        height: 733,
        icon: Gauge,
        note: "BMS overpromises range while Trickee stays close to actual range.",
      },
      {
        title: "Harsh Acceleration & Braking Events",
        src: "/report-charts/evify_harsh_events.png",
        width: 1785,
        height: 916,
        icon: BarChart3,
        note: "Driver coaching view for acceleration, braking, and battery-cost events.",
      },
      {
        title: "Speed vs Energy Drain",
        src: "/report-charts/evify_speed_energy.png",
        width: 1388,
        height: 733,
        icon: TrendingUp,
        note: "Shows the efficient speed band for Surat delivery conditions.",
      },
      {
        title: "SOC Trajectory With Smart Charging",
        src: "/report-charts/evify_soc_trajectory.png",
        width: 1935,
        height: 733,
        icon: LineChart,
        note: "Compares forced charging break versus opportunistic wait-time charging.",
      },
      {
        title: "Nearest Charger Proximity",
        src: "/report-charts/evify_charger_map.png",
        width: 1486,
        height: 732,
        icon: MapPin,
        note: "Static charger-distance view from the pitch report.",
      },
    ],
  },
  abzo: {
    label: "ABZO",
    city: "Ahmedabad",
    vehicle: "GJ01JX4821",
    driver: "Aryan Patel",
    accent: "text-accent-green",
    summary: {
      trueRange: "78.2 km",
      actualRange: "77.5 km",
      aiAccuracy: "99.1%",
      dailyUpside: "Rs 405",
      monthlyFleetUpside: "Rs 1,01,250",
    },
    charts: [
      {
        title: "BMS vs Trickee Range Accuracy",
        src: "/report-charts/abzo_range_accuracy.png",
        width: 1635,
        height: 733,
        icon: Gauge,
        note: "ABZO range overestimate correction in hot Ahmedabad operations.",
      },
      {
        title: "Harsh Acceleration & Braking Events",
        src: "/report-charts/abzo_harsh_events.png",
        width: 1785,
        height: 916,
        icon: BarChart3,
        note: "Timeline of coaching moments and regen behavior.",
      },
      {
        title: "Speed vs Energy Drain",
        src: "/report-charts/abzo_speed_energy.png",
        width: 1388,
        height: 733,
        icon: TrendingUp,
        note: "Efficient speed band for ABZO Sigilo city routes.",
      },
      {
        title: "SOC Trajectory With Smart Charging",
        src: "/report-charts/abzo_soc_trajectory.png",
        width: 1935,
        height: 733,
        icon: LineChart,
        note: "Shows how wait-time charging avoids evening forced stops.",
      },
      {
        title: "Nearest Charger Proximity",
        src: "/report-charts/abzo_charger_map.png",
        width: 1486,
        height: 732,
        icon: MapPin,
        note: "Dealer/charger network view from the pitch report.",
      },
    ],
  },
};

type ChartSetKey = keyof typeof chartSets;

export default function ReportsPage() {
  const [activeSet, setActiveSet] = useState<ChartSetKey>("evify");
  const current = chartSets[activeSet];
  const visibleCharts = useMemo(() => current.charts, [current]);

  return (
    <RoleGuard allowedRoles={["trickee_admin", "fleet_operator"]}>
      <div className="space-y-8 pb-12">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="page-title mb-1">Visual Report Charts</h1>
            <p className="text-text-dim">
              Pitch-grade chart visuals from the Evify and ABZO report folders, ready to reuse in weekly reports and pilot decks.
            </p>
          </div>
          <div className="flex gap-2">
            {(Object.keys(chartSets) as ChartSetKey[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveSet(key)}
                className={`h-10 px-4 rounded-lg border text-xs font-bold uppercase tracking-wider transition-colors ${
                  activeSet === key
                    ? "border-accent-teal/40 bg-accent-teal/10 text-accent-teal"
                    : "border-bg-border bg-bg-card text-text-dim"
                }`}
              >
                {chartSets[key].label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            ["City", current.city],
            ["Vehicle", current.vehicle],
            ["Driver", current.driver],
            ["AI Accuracy", current.summary.aiAccuracy],
            ["Monthly Upside", current.summary.monthlyFleetUpside],
          ].map(([label, value]) => (
            <Card key={label} className="p-4">
              <p className="text-[10px] uppercase tracking-wider text-text-dim mb-2">{label}</p>
              <p className={`text-lg font-bold ${current.accent}`}>{value}</p>
            </Card>
          ))}
        </div>

        <Card className="border-accent-teal/20">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BatteryCharging className="w-4 h-4 text-accent-teal" />
              Report Impact Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[
                ["Trickee Range", current.summary.trueRange],
                ["Actual Range", current.summary.actualRange],
                ["Daily Driver Upside", current.summary.dailyUpside],
                ["Fleet Monthly Upside", current.summary.monthlyFleetUpside],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-bg-border bg-bg-primary/40 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-text-dim mb-2">{label}</p>
                  <p className="text-xl font-bold text-text-primary">{value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {visibleCharts.map((chart) => (
            <Card key={chart.src} className="overflow-hidden p-0">
              <div className="p-5 border-b border-bg-border flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <chart.icon className="w-4 h-4 text-accent-teal" />
                    <h2 className="text-base font-semibold text-text-primary">{chart.title}</h2>
                  </div>
                  <p className="text-sm text-text-dim">{chart.note}</p>
                </div>
                <Badge variant="info">{current.label}</Badge>
              </div>
              <div className="relative bg-bg-primary/50">
                <Image
                  src={chart.src}
                  alt={`${current.label} ${chart.title}`}
                  width={chart.width}
                  height={chart.height}
                  className="w-full h-auto"
                  priority={chart.src.includes("range_accuracy")}
                />
              </div>
            </Card>
          ))}
        </div>
      </div>
    </RoleGuard>
  );
}
