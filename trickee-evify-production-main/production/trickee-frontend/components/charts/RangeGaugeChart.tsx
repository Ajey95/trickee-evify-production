import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

interface RangeGaugeChartProps {
  current: number;
  total: number;
  color: string;
}

export const RangeGaugeChart = ({ current, total, color }: RangeGaugeChartProps) => {
  const data = [
    { value: current },
    { value: Math.max(0, total - current) },
  ];

  return (
    <div className="w-full h-full relative">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="100%"
            startAngle={180}
            endAngle={0}
            innerRadius="75%"
            outerRadius="100%"
            paddingAngle={0}
            dataKey="value"
            stroke="none"
          >
            <Cell fill={color} />
            <Cell fill="#161b22" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
        <span className="text-2xl font-bold font-mono text-text-primary">{current.toFixed(1)}</span>
        <span className="text-[10px] text-text-dim uppercase font-bold tracking-widest">km Left</span>
      </div>
    </div>
  );
};
