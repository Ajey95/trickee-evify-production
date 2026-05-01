"use client";

import React, { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Prediction } from "@/types";
import { ChevronDown, ChevronUp, ZapOff, Thermometer, Gauge } from "lucide-react";

interface RangePenaltyBreakdownProps {
  prediction: Prediction;
}

export const RangePenaltyBreakdown = ({ prediction }: RangePenaltyBreakdownProps) => {
  const [isOpen, setIsOpen] = useState(true);

  const dynamicRange = Number(prediction.dynamic_range_km ?? 0);
  const penalties = [
    { label: "Battery Health (SOH)", value: `${(Number(prediction.soh_factor ?? 0) * 100).toFixed(1)}%`, icon: ZapOff, status: "Backend" },
    { label: "Thermal Penalty", value: `${((1 - Number(prediction.thermal_factor ?? 1)) * 100).toFixed(1)}%`, icon: Thermometer, status: "Backend" },
    { label: "Aggression Penalty", value: `${((1 - Number(prediction.aggression_factor ?? 1)) * 100).toFixed(1)}%`, icon: Gauge, status: "Backend" },
  ];

  return (
    <Card className="border-bg-border/60">
      <div 
        className="flex justify-between items-center cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3">
          <h4 className="section-title mb-0">Range Penalty Breakdown</h4>
          <span className="text-[10px] bg-accent-amber/10 text-accent-amber px-2 py-0.5 rounded border border-accent-amber/20 font-bold uppercase tracking-widest">
            Backend Factors
          </span>
        </div>
        {isOpen ? <ChevronUp className="w-5 h-5 text-text-dim" /> : <ChevronDown className="w-5 h-5 text-text-dim" />}
      </div>

      {isOpen && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-top-2 duration-300">
          {penalties.map((p) => (
            <div key={p.label} className="bg-bg-primary/40 rounded-xl p-4 border border-bg-border/30">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] text-text-dim font-bold uppercase tracking-wider">{p.label}</p>
                <p className="text-[10px] text-accent-teal font-mono">{p.status}</p>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-2xl font-bold font-mono text-text-primary">{p.value}</p>
                <div className="flex-1 h-1.5 bg-bg-border rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-accent-teal transition-all duration-1000" 
                    style={{ width: p.value }}
                  />
                </div>
              </div>
            </div>
          ))}
          
          <div className="md:col-span-3 bg-accent-amber/5 border border-accent-amber/20 rounded-xl p-4 flex items-center gap-4">
            <div className="p-2 bg-accent-amber/10 rounded-lg">
              <ZapOff className="w-5 h-5 text-accent-amber" />
            </div>
            <p className="text-sm text-text-primary">
              Backend physics model estimates {dynamicRange.toFixed(1)} km from the latest telemetry window.
              <span className="font-bold text-accent-amber"> Factors shown here come from the saved prediction response. </span>
            </p>
          </div>
        </div>
      )}
    </Card>
  );
};
