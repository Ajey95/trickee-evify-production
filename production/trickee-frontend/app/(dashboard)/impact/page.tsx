"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BatteryCharging, CheckCircle2, ChevronRight, Clock3, IndianRupee, PackageCheck, RefreshCcw, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { api } from "@/lib/api";
import { useVisibilityPolling } from "@/hooks/useVisibilityPolling";

type DriverImpact = {
  driver_id: string;
  driver_code: string;
  driver_name: string;
  headline: string;
  confidence: "low" | "medium" | "high";
  metrics: Record<string, number>;
};

type DailyImpactReport = {
  generated_at: string;
  period: { date: string; start: string; end: string };
  headline: string;
  summary: Record<string, number | string>;
  driver_reports: DriverImpact[];
  tool_evidence: { tool: string; records: number; source: string }[];
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatInr(value: unknown) {
  const number = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return `₹${number.toLocaleString("en-IN")}`;
}

function formatNumber(value: unknown, suffix = "") {
  const number = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return `${number.toLocaleString("en-IN")}${suffix}`;
}

function ImpactSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-4">
      {[0, 1, 2, 3].map((item) => (
        <div key={item} className="h-32 animate-pulse rounded-xl border border-bg-border bg-bg-card/70" />
      ))}
    </div>
  );
}

export default function DailyImpactPage() {
  const [reportDate, setReportDate] = useState(todayIso());
  const [report, setReport] = useState<DailyImpactReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);

  const load = useCallback(async (showLoading = false) => {
    if (showLoading) setIsLoading(true);
    const result = await api.intelligence.dailyImpact(reportDate);
    if (result.success) {
      setReport(result.data);
      setLastSync(new Date());
      setError("");
    } else {
      setError(result.error || "Unable to load daily impact.");
    }
    setIsLoading(false);
  }, [reportDate]);

  useEffect(() => {
    load(true);
  }, [load]);

  useVisibilityPolling(() => load(false), { intervalMs: 30_000 });

  const summary = report?.summary || {};
  const driverReports = useMemo(() => report?.driver_reports || [], [report]);
  const coverage = report?.tool_evidence || [];
  const topDrivers = useMemo(() => driverReports, [driverReports]);
  const selectedDriver = useMemo(
    () => driverReports.find((driver) => driver.driver_id === selectedDriverId) || driverReports[0],
    [driverReports, selectedDriverId]
  );
  const maxDriverValue = useMemo(
    () => Math.max(...topDrivers.map((row) => Number(row.metrics.operating_value_inr || 0)), 1),
    [topDrivers]
  );

  const kpis = [
    {
      label: "Operating Value",
      value: formatInr(summary.operating_value_inr),
      detail: "Captured today",
      icon: IndianRupee,
    },
    {
      label: "Time Saved",
      value: formatNumber(summary.time_saved_min, " min"),
      detail: "Recovered capacity",
      icon: Clock3,
    },
    {
      label: "Orders Delivered",
      value: formatNumber(summary.delivered_orders),
      detail: "Completed work",
      icon: PackageCheck,
    },
    {
      label: "Charging Value",
      value: formatInr(summary.charge_value_captured_inr),
      detail: "Useful top-ups",
      icon: BatteryCharging,
    },
  ];

  return (
    <RoleGuard allowedRoles={["trickee_admin", "fleet_operator", "driver"]}>
      <div className="space-y-8 pb-12">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="page-title mb-1">Daily Impact</h1>
            <p className="max-w-2xl text-text-dim">Today’s savings, delivery capacity, and charging outcomes in one view.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="date"
              value={reportDate}
              onChange={(event) => setReportDate(event.target.value)}
              className="h-10 rounded-lg border border-bg-border bg-bg-card px-3 text-sm text-text-primary outline-none transition-colors focus:border-accent-teal"
            />
            <Button variant="outline" size="sm" className="gap-2" onClick={() => load(true)} disabled={isLoading}>
              <RefreshCcw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {error && (
          <Card className="border-accent-red/30 bg-accent-red/5">
            <p className="text-sm text-accent-red">{error}</p>
          </Card>
        )}

        <Card className="watermark-section border-white/10 bg-[#0b0f15]">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-accent-teal" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-dim">Today</span>
              </div>
              <h2 className="max-w-4xl text-2xl font-semibold leading-tight tracking-tight text-text-primary md:text-3xl">
                {report?.headline || "Loading today’s impact."}
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={summary.confidence === "high" ? "success" : summary.confidence === "medium" ? "warning" : "outline"}>
                {String(summary.confidence || "pending")} confidence
              </Badge>
              <Badge variant="info">Verified records</Badge>
            </div>
          </div>
        </Card>

        {isLoading && !report ? (
          <ImpactSkeleton />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {kpis.map(({ label, value, detail, icon: Icon }) => (
              <Card key={label} className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-2xl font-semibold tracking-tight text-text-primary">{value}</p>
                    <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-text-dim">{label}</p>
                    <p className="mt-4 text-sm text-text-dim">{detail}</p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2 text-accent-teal">
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle2 className="h-4 w-4 text-accent-teal" />
                Driver Impact
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topDrivers.length ? (
                <div className="space-y-3">
                  {topDrivers.map((driver) => {
                    const value = Number(driver.metrics.operating_value_inr || 0);
                    const isSelected = selectedDriver?.driver_id === driver.driver_id;
                    return (
                      <button
                        key={driver.driver_id}
                        type="button"
                        onClick={() => setSelectedDriverId(driver.driver_id)}
                        className={`w-full rounded-xl border p-4 text-left transition ${
                          isSelected
                            ? "border-accent-teal/60 bg-accent-teal/10"
                            : "border-bg-border bg-bg-primary/40 hover:border-accent-teal/40"
                        }`}
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="font-semibold text-text-primary">{driver.driver_code} · {driver.driver_name}</p>
                            <p className="mt-1 text-sm text-text-dim">{driver.headline}</p>
                          </div>
                          <div className="flex items-center gap-3 text-left md:text-right">
                            <ChevronRight className={`h-4 w-4 ${isSelected ? "text-accent-teal" : "text-text-dim"}`} />
                            <div>
                              <p className="font-mono text-lg font-semibold text-text-primary">{formatInr(value)}</p>
                              <p className="text-[11px] uppercase tracking-[0.16em] text-text-dim">Value</p>
                            </div>
                          </div>
                        </div>
                        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-bg-border">
                          <div
                            className="h-full rounded-full bg-accent-teal"
                            style={{ width: `${Math.min(100, Math.max(6, (value / maxDriverValue) * 100))}%` }}
                          />
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                          <div>
                            <p className="font-semibold text-text-primary">{formatNumber(driver.metrics.delivered_orders)}</p>
                            <p className="text-text-dim">Orders</p>
                          </div>
                          <div>
                            <p className="font-semibold text-text-primary">{formatNumber(driver.metrics.time_saved_min, " min")}</p>
                            <p className="text-text-dim">Saved</p>
                          </div>
                          <div>
                            <p className="font-semibold text-text-primary">{formatNumber(driver.metrics.optimized_charging_sessions)}</p>
                            <p className="text-text-dim">Top-ups</p>
                          </div>
                          <div>
                            <p className="font-semibold text-text-primary">{formatNumber(driver.metrics.acknowledged_nudges)}</p>
                            <p className="text-text-dim">Actions</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-bg-border p-8 text-sm text-text-dim">
                  No activity captured for this day.
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            {selectedDriver && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <TrendingUp className="h-4 w-4 text-accent-teal" />
                    Driver Detail
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div>
                    <p className="font-semibold text-text-primary">{selectedDriver.driver_code} Â· {selectedDriver.driver_name}</p>
                    <p className="mt-1 text-sm text-text-dim">{selectedDriver.headline}</p>
                  </div>
                  {[
                    ["Operating value", selectedDriver.metrics.operating_value_inr, summary.operating_value_inr, "inr"],
                    ["Time saved", selectedDriver.metrics.time_saved_min, summary.time_saved_min, "min"],
                    ["Orders", selectedDriver.metrics.delivered_orders, summary.delivered_orders, ""],
                    ["Useful top-ups", selectedDriver.metrics.optimized_charging_sessions, summary.optimized_charging_sessions, ""],
                    ["Actions", selectedDriver.metrics.acknowledged_nudges, summary.acknowledged_nudges, ""],
                  ].map(([label, rawValue, rawTotal, unit]) => {
                    const value = Number(rawValue || 0);
                    const total = Math.max(Number(rawTotal || 0), value, 1);
                    const display = unit === "inr" ? formatInr(value) : formatNumber(value, unit === "min" ? " min" : "");
                    return (
                      <div key={String(label)} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-text-dim">{String(label)}</span>
                          <span className="font-mono font-semibold text-text-primary">{display}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-bg-border">
                          <div
                            className="h-full rounded-full bg-accent-teal"
                            style={{ width: `${Math.min(100, Math.max(4, (value / total) * 100))}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-bg-border bg-bg-primary/40 p-3">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-text-dim">Telemetry</p>
                      <p className="mt-1 font-mono text-lg font-semibold text-text-primary">
                        {formatNumber(selectedDriver.metrics.telemetry_rows)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-bg-border bg-bg-primary/40 p-3">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-text-dim">Confidence</p>
                      <p className="mt-1 capitalize text-text-primary">{selectedDriver.confidence}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldCheck className="h-4 w-4 text-accent-green" />
                  Outcomes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  ["Extra orders", formatNumber(summary.extra_orders_enabled)],
                  ["Risks cleared", formatNumber(summary.low_soc_risks_avoided)],
                  ["Useful charging", formatNumber(summary.charge_minutes_captured, " min")],
                  ["Wait captured", formatNumber(summary.wait_minutes, " min")],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between border-b border-bg-border/70 pb-3 last:border-0 last:pb-0">
                    <span className="text-sm text-text-dim">{label}</span>
                    <span className="font-mono font-semibold text-text-primary">{value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Record Coverage</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {coverage.map((item) => (
                  <div key={item.tool} className="flex items-center justify-between rounded-lg border border-bg-border bg-bg-primary/40 px-3 py-2">
                    <span className="text-sm capitalize text-text-dim">{item.tool.replaceAll("_", " ")}</span>
                    <span className="font-mono text-sm font-semibold text-text-primary">{item.records}</span>
                  </div>
                ))}
                <p className="pt-2 text-xs text-text-dim">
                  {lastSync ? `Updated ${lastSync.toLocaleTimeString()}` : "Waiting for first update"}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </RoleGuard>
  );
}
