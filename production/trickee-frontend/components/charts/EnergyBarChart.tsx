import React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface EnergyBarChartProps {
  data: { route_id: string; ev_kwh_used: number; rank: number }[];
}

export const EnergyBarChart = ({ data }: EnergyBarChartProps) => {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ left: 20, right: 30, top: 20, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#30363d" horizontal={false} />
        <XAxis type="number" hide />
        <YAxis dataKey="route_id" type="category" stroke="#8b949e" fontSize={12} tickLine={false} axisLine={false} />
        <Tooltip 
          cursor={{ fill: '#30363d', opacity: 0.4 }}
          contentStyle={{ backgroundColor: "#161b22", border: "1px solid #30363d", borderRadius: "8px", fontSize: "12px" }}
        />
        <Bar dataKey="ev_kwh_used" radius={[0, 4, 4, 0]} barSize={24}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.rank === 1 ? "#00b4d8" : "#30363d"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};
