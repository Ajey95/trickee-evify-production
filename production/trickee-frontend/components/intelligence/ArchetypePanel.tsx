"use client";

import React from "react";
import { BatteryCharging, Gauge, Route, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

type Archetype = {
  label?: string;
  display_name?: string;
  confidence?: number;
  source?: string;
  reasons?: string[];
  policy?: {
    soc_warning_adjust_pct?: number;
    route_buffer_multiplier?: number;
    order_assignment_hint?: string;
    nudge_style?: string;
  };
};

type ArchetypePanelProps = {
  archetype?: Archetype | null;
  title?: string;
  compact?: boolean;
  history?: Array<{ computed_at?: string; archetype_label?: string; archetype_confidence?: number; sample_count?: number }>;
};

const fallback: Archetype = {
  label: "data_poor",
  display_name: "Data Poor / Unknown",
  confidence: 0.2,
  source: "fallback",
  reasons: ["waiting for enough live telemetry"],
  policy: {
    soc_warning_adjust_pct: 5,
    route_buffer_multiplier: 1.15,
    order_assignment_hint: "conservative_until_more_data",
    nudge_style: "conservative",
  },
};

function pct(value: number | undefined) {
  return `${Math.round((value || 0) * 100)}%`;
}

function labelText(value?: string) {
  return (value || "unknown").replaceAll("_", " ");
}

export function ArchetypePanel({ archetype, title = "Driver Archetype", compact = false, history = [] }: ArchetypePanelProps) {
  const current = archetype?.label ? archetype : fallback;
  const confidence = Math.max(0, Math.min(1, Number(current.confidence || 0)));
  const bars = history.slice(0, 10).reverse();

  return (
    <Card className="border-accent-teal/20">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-accent-teal" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xl font-bold text-text-primary">{current.display_name || labelText(current.label)}</p>
            <p className="text-xs text-text-dim capitalize">{labelText(current.source)}</p>
          </div>
          <Badge variant={confidence >= 0.75 ? "success" : confidence >= 0.5 ? "warning" : "info"}>
            {pct(confidence)}
          </Badge>
        </div>

        <div className="h-2 rounded-full bg-bg-border overflow-hidden">
          <div className="h-full bg-accent-teal" style={{ width: `${confidence * 100}%` }} />
        </div>

        {!compact && (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-bg-border bg-bg-primary/40 p-3">
              <div className="flex items-center gap-2 mb-1">
                <BatteryCharging className="w-3.5 h-3.5 text-accent-teal" />
                <p className="text-[10px] uppercase tracking-wider text-text-dim">SOC bias</p>
              </div>
              <p className="text-sm font-semibold text-text-primary">
                {Number(current.policy?.soc_warning_adjust_pct || 0) > 0 ? "+" : ""}
                {current.policy?.soc_warning_adjust_pct || 0}%
              </p>
            </div>
            <div className="rounded-lg border border-bg-border bg-bg-primary/40 p-3">
              <div className="flex items-center gap-2 mb-1">
                <Route className="w-3.5 h-3.5 text-accent-teal" />
                <p className="text-[10px] uppercase tracking-wider text-text-dim">Route buffer</p>
              </div>
              <p className="text-sm font-semibold text-text-primary">
                {Number(current.policy?.route_buffer_multiplier || 1).toFixed(2)}x
              </p>
            </div>
            <div className="rounded-lg border border-bg-border bg-bg-primary/40 p-3">
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="w-3.5 h-3.5 text-accent-teal" />
                <p className="text-[10px] uppercase tracking-wider text-text-dim">Assignment</p>
              </div>
              <p className="text-xs text-text-primary capitalize">{labelText(current.policy?.order_assignment_hint)}</p>
            </div>
            <div className="rounded-lg border border-bg-border bg-bg-primary/40 p-3">
              <div className="flex items-center gap-2 mb-1">
                <Gauge className="w-3.5 h-3.5 text-accent-teal" />
                <p className="text-[10px] uppercase tracking-wider text-text-dim">Nudge style</p>
              </div>
              <p className="text-xs text-text-primary capitalize">{labelText(current.policy?.nudge_style)}</p>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {(current.reasons || []).slice(0, compact ? 2 : 4).map((reason) => (
            <div key={reason} className="flex items-start gap-2 text-xs text-text-dim">
              <TrendingUp className="w-3.5 h-3.5 text-accent-teal mt-0.5" />
              <span>{reason}</span>
            </div>
          ))}
        </div>

        {!!bars.length && (
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-text-dim">Confidence History</p>
            <div className="flex items-end gap-1 h-16">
              {bars.map((row, index) => (
                <div
                  key={`${row.computed_at || index}-${index}`}
                  className="flex-1 rounded-t bg-accent-teal/70"
                  style={{ height: `${Math.max(8, Math.min(100, Number(row.archetype_confidence || 0) * 100))}%` }}
                  title={`${labelText(row.archetype_label)} ${pct(row.archetype_confidence)}`}
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
