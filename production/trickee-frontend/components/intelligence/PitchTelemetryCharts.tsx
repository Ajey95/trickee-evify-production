"use client";

import React from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, BatteryCharging, Gauge, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

const teal = "#00b4d8";
const red = "#f85149";
const amber = "#e3b341";
const green = "#3fb950";
const grey = "#8b949e";

function rangeData() {
  return Array.from({ length: 13 }, (_, index) => {
    const hour = 8.5 + index * 0.85;
    const pct = index / 12;
    const actual = Math.max(1, 61 - pct * 60 + Math.sin(index) * 0.8);
    const ai = Math.max(1, actual + Math.cos(index * 1.4) * 0.9);
    const bms = Math.max(4, 85 - pct * 74 + Math.sin(index * 0.8) * 1.8);
    return { hour: hour.toFixed(1), bms: Number(bms.toFixed(1)), ai: Number(ai.toFixed(1)), actual: Number(actual.toFixed(1)) };
  });
}

function speedEnergyData() {
  return Array.from({ length: 24 }, (_, index) => {
    const speed = 8 + index * 2.4;
    const sweetSpotPenalty = Math.pow((speed - 28) / 28, 2);
    const stopGoPenalty = speed < 18 ? (18 - speed) * 0.004 : 0;
    const energy = 0.035 + sweetSpotPenalty * 0.09 + stopGoPenalty;
    return { speed: Number(speed.toFixed(1)), energy: Number(energy.toFixed(3)) };
  });
}

function socTrajectoryData() {
  return Array.from({ length: 13 }, (_, index) => {
    const hour = 8.5 + index * 0.85;
    const base = Math.max(4, 94 - index * 7.6);
    const boost = (hour > 12.25 ? 14 : 0) + (hour > 15.75 ? 10 : 0);
    return {
      hour: hour.toFixed(1),
      withoutTrickee: Number(base.toFixed(1)),
      withTrickee: Number(Math.min(100, base + boost).toFixed(1)),
    };
  });
}

const chargers = [
  { name: "Depot", distance: 0, gain: 18 },
  { name: "Smart Hub", distance: 170, gain: 14 },
  { name: "Varachha", distance: 420, gain: 12 },
  { name: "Katargam", distance: 650, gain: 11 },
];

type PitchTelemetryChartsProps = {
  compact?: boolean;
};

export function PitchTelemetryCharts({ compact = false }: PitchTelemetryChartsProps) {
  return (
    <div className={`grid grid-cols-1 ${compact ? "xl:grid-cols-2" : "xl:grid-cols-4"} gap-6`}>
      <Card className={compact ? "" : "xl:col-span-2"}>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Gauge className="w-4 h-4 text-accent-teal" />
            Range Accuracy
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rangeData()}>
              <CartesianGrid stroke="#30363d" strokeDasharray="3 3" />
              <XAxis dataKey="hour" stroke={grey} tick={{ fontSize: 11 }} />
              <YAxis stroke={grey} tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 8 }} />
              <Legend />
              <Line type="monotone" dataKey="bms" name="BMS" stroke={red} strokeDasharray="5 5" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="actual" name="Actual" stroke={grey} dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="ai" name="Trickee AI" stroke={teal} dot={false} strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className={compact ? "" : "xl:col-span-2"}>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-4 h-4 text-accent-teal" />
            SOC Trajectory
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={socTrajectoryData()}>
              <CartesianGrid stroke="#30363d" strokeDasharray="3 3" />
              <XAxis dataKey="hour" stroke={grey} tick={{ fontSize: 11 }} />
              <YAxis stroke={grey} tick={{ fontSize: 11 }} domain={[0, 100]} />
              <Tooltip contentStyle={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 8 }} />
              <Legend />
              <Line type="monotone" dataKey="withoutTrickee" name="Without Trickee" stroke={red} strokeDasharray="5 5" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="withTrickee" name="With Trickee" stroke={teal} dot={false} strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className={compact ? "" : "xl:col-span-2"}>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-accent-teal" />
            Speed vs Energy
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart>
              <CartesianGrid stroke="#30363d" strokeDasharray="3 3" />
              <XAxis dataKey="speed" type="number" name="Speed" unit=" km/h" stroke={grey} tick={{ fontSize: 11 }} />
              <YAxis dataKey="energy" type="number" name="Energy" unit=" kWh/km" stroke={grey} tick={{ fontSize: 11 }} />
              <Tooltip cursor={{ strokeDasharray: "3 3" }} contentStyle={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 8 }} />
              <Scatter name="Energy drain" data={speedEnergyData()} fill={teal}>
                {speedEnergyData().map((entry) => (
                  <Cell key={entry.speed} fill={entry.speed >= 22 && entry.speed <= 32 ? green : entry.speed > 45 ? red : amber} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className={compact ? "" : "xl:col-span-2"}>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BatteryCharging className="w-4 h-4 text-accent-teal" />
            Charger Decision View
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chargers}>
              <CartesianGrid stroke="#30363d" strokeDasharray="3 3" />
              <XAxis dataKey="name" stroke={grey} tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left" stroke={amber} tick={{ fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" stroke={teal} tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 8 }} />
              <Legend />
              <Bar yAxisId="left" dataKey="distance" name="Distance m" fill={amber} radius={[4, 4, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="gain" name="Range gain / 15 min" stroke={teal} strokeWidth={3} />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
