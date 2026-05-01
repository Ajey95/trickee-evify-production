"use client";

import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceDot,
  Area,
  AreaChart,
} from "recharts";

interface SocLineChartProps {
  data: { time: string; soc: number; isPredicted?: boolean }[];
}

export const SocLineChart = ({ data }: SocLineChartProps) => {
  const latestActual = data.findLast(d => !d.isPredicted);
  const prediction = data.findLast(d => d.isPredicted);

  return (
    <div className="h-[300px] w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorSoc" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#00b4d8" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#00b4d8" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorPred" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ff00ff" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#ff00ff" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#30363d" vertical={false} />
          <XAxis 
            dataKey="time" 
            stroke="#8b949e" 
            fontSize={10} 
            tickLine={false} 
            axisLine={false}
            interval={20}
          />
          <YAxis 
            stroke="#8b949e" 
            fontSize={10} 
            tickLine={false} 
            axisLine={false}
            domain={[0, 100]}
            tickFormatter={(val) => `${val}%`}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: "#161b22", border: "1px solid #30363d", borderRadius: "8px", fontSize: "12px" }}
            itemStyle={{ color: "#e6edf3" }}
          />
          <Area
            type="monotone"
            dataKey="soc"
            stroke="#00b4d8"
            strokeWidth={3}
            fillOpacity={1}
            fill="url(#colorSoc)"
            isAnimationActive={false}
            connectNulls
          />
          {prediction && (
            <Line
              type="monotone"
              dataKey="soc"
              stroke="#ff00ff"
              strokeWidth={3}
              strokeDasharray="5 5"
              dot={false}
              isAnimationActive={false}
            />
          )}
          {latestActual && (
            <ReferenceDot
              x={latestActual.time}
              y={latestActual.soc}
              r={5}
              fill="#00b4d8"
              stroke="#0d1117"
              strokeWidth={2}
            />
          )}
          {prediction && (
            <ReferenceDot
              x={prediction.time}
              y={prediction.soc}
              r={5}
              fill="#ff00ff"
              stroke="#0d1117"
              strokeWidth={2}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
