"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { ScoreGauge } from "@/components/scorecards/ScoreGauge";
import { DriverRadarChart } from "@/components/charts/DriverRadarChart";
import { User, X, UsersRound } from "lucide-react";
import { api } from "@/lib/api";
import { Driver } from "@/types";

const ARCHETYPE_THEMES: Record<string, { label: string; color: string; bg: string; text: string }> = {
  range_saver: { label: "Range Saver", color: "var(--accent-teal)", bg: "rgba(0, 180, 216, 0.1)", text: "text-accent-teal" },
  late_charger: { label: "Late Charger", color: "var(--accent-red)", bg: "rgba(248, 81, 73, 0.1)", text: "text-accent-red" },
  aggressive: { label: "Aggressive Style", color: "var(--accent-magenta)", bg: "rgba(255, 0, 255, 0.1)", text: "text-accent-magenta" },
  moderate_driver: { label: "Balanced Cruiser", color: "var(--accent-green)", bg: "rgba(63, 185, 80, 0.1)", text: "text-accent-green" },
  data_poor: { label: "New Profile", color: "var(--text-dim)", bg: "rgba(139, 148, 158, 0.1)", text: "text-text-dim" },
};

function getArchetypeTheme(rawLabel: string) {
  const normalized = (rawLabel || "").toLowerCase().replace(/[^a-z0-9]/g, "_");
  if (normalized.includes("range_saver")) return ARCHETYPE_THEMES.range_saver;
  if (normalized.includes("late_charger")) return ARCHETYPE_THEMES.late_charger;
  if (normalized.includes("aggressive")) return ARCHETYPE_THEMES.aggressive;
  if (normalized.includes("moderate") || normalized.includes("balanced")) return ARCHETYPE_THEMES.moderate_driver;
  if (normalized.includes("poor") || normalized.includes("new")) return ARCHETYPE_THEMES.data_poor;
  
  return {
    label: rawLabel.replaceAll("_", " "),
    color: "var(--accent-teal)",
    bg: "rgba(0, 180, 216, 0.05)",
    text: "text-accent-teal"
  };
}

function scoreDriver(driver: Driver) {
  const regen = Math.max(0, Math.min(100, Number(driver.avg_regen_ratio || 0) * 100));
  const throttle = Math.max(0, Math.min(100, 100 - Number(driver.avg_throttle_variance || 0) * 100));
  const current = Math.max(0, Math.min(100, 100 - Math.abs(Number(driver.avg_current_30m || 0)) * 4));
  const speed = Math.max(0, Math.min(100, 100 - Math.abs(Number(driver.avg_speed_30m || 0) - 25)));
  return Math.round((regen + throttle + current + speed) / 4);
}

function radarData(driver: Driver) {
  return [
    { subject: "Current Control", A: Math.max(0, Math.min(100, 100 - Math.abs(Number(driver.avg_current_30m || 0)) * 4)), fullMark: 100 },
    { subject: "Regen Usage", A: Math.max(0, Math.min(100, Number(driver.avg_regen_ratio || 0) * 100)), fullMark: 100 },
    { subject: "Throttle Smoothness", A: Math.max(0, Math.min(100, 100 - Number(driver.avg_throttle_variance || 0) * 100)), fullMark: 100 },
    { subject: "Speed Stability", A: Math.max(0, Math.min(100, 100 - Math.abs(Number(driver.avg_speed_30m || 0) - 25))), fullMark: 100 },
  ];
}

export default function ScorecardsPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [fleetLive, setFleetLive] = useState<any | null>(null);
  const [error, setError] = useState("");

  const [coachingNote, setCoachingNote] = useState("");
  const [isSubmittingCoaching, setIsSubmittingCoaching] = useState(false);
  const [coachingError, setCoachingError] = useState("");
  const [coachingSuccess, setCoachingSuccess] = useState("");
  const [savedNotes, setSavedNotes] = useState<Record<string, string[]>>({});

  useEffect(() => {
    setCoachingNote("");
    setCoachingError("");
    setCoachingSuccess("");
  }, [selectedDriver]);

  const currentSavedNotes = useMemo(() => {
    return selectedDriver ? (savedNotes[selectedDriver.id] || []) : [];
  }, [selectedDriver, savedNotes]);

  const handleSaveCoachingNote = async () => {
    if (!selectedDriver || !coachingNote.trim()) return;
    setIsSubmittingCoaching(true);
    setCoachingError("");
    setCoachingSuccess("");
    try {
      const response = await api.drivers.coaching(selectedDriver.id, {
        driver_id: selectedDriver.id,
        mode: "shift",
        custom_message: coachingNote.trim(),
      });
      if (response.success) {
        setCoachingSuccess("Coaching note saved successfully.");
        setSavedNotes((prev) => ({
          ...prev,
          [selectedDriver.id]: [...(prev[selectedDriver.id] || []), coachingNote.trim()],
        }));
        setCoachingNote("");
      } else {
        setCoachingError(response.error || "Failed to save coaching note.");
      }
    } catch {
      setCoachingError("An error occurred while saving the coaching note.");
    } finally {
      setIsSubmittingCoaching(false);
    }
  };

  useEffect(() => {
    async function loadDrivers() {
      const [driverResult, fleetResult] = await Promise.all([
        api.drivers.list(),
        api.intelligence.fleetLive()
      ]);
      
      if (driverResult.success) {
        setDrivers(driverResult.data);
        setSelectedDriver(driverResult.data[0] || null);
        setError("");
      } else {
        setError(driverResult.error || "Unable to load drivers.");
      }
      
      if (fleetResult.success) {
        setFleetLive(fleetResult.data);
      }
    }
    loadDrivers();
  }, []);

  const rankedDrivers = useMemo(
    () => [...drivers].sort((a, b) => scoreDriver(b) - scoreDriver(a)),
    [drivers]
  );

  const driverArchetypeMap = useMemo(() => {
    const map = new Map<string, any>();
    if (fleetLive?.drivers) {
      for (const d of fleetLive.drivers) {
        if (d.driver_id) {
          map.set(d.driver_id, d.archetype);
        }
      }
    }
    return map;
  }, [fleetLive]);

  const distribution = useMemo(() => {
    const driversList = fleetLive?.drivers || [];
    const totalCount = driversList.length;
    if (!totalCount) return [];
    
    return Object.entries(
      driversList.reduce((acc: Record<string, number>, row: any) => {
        const label = row.archetype?.display_name || row.archetype?.label || "Unknown";
        acc[label] = (acc[label] || 0) + 1;
        return acc;
      }, {})
    ).map(([label, count]) => {
      const numericCount = Number(count);
      const pct = (numericCount / totalCount) * 100;
      const theme = getArchetypeTheme(label);
      return { label, count: numericCount, pct, theme };
    }).sort((a, b) => b.count - a.count);
  }, [fleetLive]);

  return (
    <RoleGuard allowedRoles={["trickee_admin", "fleet_operator"]}>
      <div className="space-y-8 pb-12">
        <div>
          <h1 className="page-title mb-1">Driver Scorecards</h1>
          <p className="text-text-dim">Fleet-wide rankings from driver behavior and efficiency signals.</p>
        </div>

        {error && <Card className="border-accent-red/30 bg-accent-red/5"><p className="text-sm text-accent-red">{error}</p></Card>}

        {distribution.length > 0 && (
          <Card className="border-accent-teal/10">
            <CardHeader className="py-3.5">
              <CardTitle className="text-sm flex items-center gap-2 text-text-dim font-medium">
                <UsersRound className="w-4 h-4 text-accent-teal" />
                Fleet Archetype Distribution Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 pb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
                {distribution.map(({ label, count, pct, theme }) => (
                  <div key={label} className="p-3 rounded-lg border border-bg-border bg-bg-primary/30 flex flex-col justify-between">
                    <div className="flex justify-between items-center text-[10px] uppercase tracking-wider text-text-dim mb-1">
                      <span>{theme.label}</span>
                      <span className="font-mono">{count}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 bg-bg-border rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: theme.color }} />
                      </div>
                      <span className="text-xs font-mono text-text-primary font-bold">{Math.round(pct)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-col lg:flex-row gap-8">
          <div className="flex-1 space-y-6">
            <Card className="p-0 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Driver</TableHead>
                    <TableHead>Style</TableHead>
                    <TableHead>AI Archetype</TableHead>
                    <TableHead>Avg Current</TableHead>
                    <TableHead>Avg Speed</TableHead>
                    <TableHead>Regen</TableHead>
                    <TableHead>Throttle Var</TableHead>
                    <TableHead>Efficiency Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rankedDrivers.map((driver, i) => (
                    <TableRow key={driver.id} className="cursor-pointer group" onClick={() => setSelectedDriver(driver)}>
                      <TableCell className="text-text-dim font-mono">{i + 1}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-bg-border flex items-center justify-center text-[10px] font-bold">
                            {driver.full_name.split(" ").map((name) => name[0]).join("")}
                          </div>
                          <div>
                            <p className="font-bold text-text-primary group-hover:text-accent-teal transition-colors">{driver.full_name}</p>
                            <p className="text-[10px] text-text-dim">{driver.driver_code}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={driver.style_label === "Efficient" ? "success" : driver.style_label === "Aggressive" ? "error" : "info"}>
                          {driver.style_label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const arch = driverArchetypeMap.get(driver.id);
                          if (!arch) return <span className="text-text-dim font-mono text-xs">-</span>;
                          const theme = getArchetypeTheme(arch.display_name || arch.label);
                          return (
                            <Badge variant="outline" style={{ color: theme.color, borderColor: `${theme.color}40` }}>
                              {theme.label}
                            </Badge>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="font-mono">{Number(driver.avg_current_30m || 0).toFixed(2)} A</TableCell>
                      <TableCell className="font-mono">{Number(driver.avg_speed_30m || 0).toFixed(2)} km/h</TableCell>
                      <TableCell className="font-mono">{(Number(driver.avg_regen_ratio || 0) * 100).toFixed(0)}%</TableCell>
                      <TableCell className="font-mono">{Number(driver.avg_throttle_variance || 0).toFixed(3)}</TableCell>
                      <TableCell><ScoreGauge score={scoreDriver(driver)} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {!rankedDrivers.length && <div className="p-6 text-sm text-text-dim">No drivers available.</div>}
            </Card>
          </div>

          {selectedDriver && (
            <div className="lg:w-[400px] animate-in slide-in-from-right-8 duration-500">
              <Card className="sticky top-24 border-accent-teal/30 bg-accent-teal/[0.02]">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-bg-primary border border-bg-border flex items-center justify-center">
                      <User className="w-6 h-6 text-accent-teal" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-text-primary">{selectedDriver.full_name}</h3>
                      <p className="text-xs text-text-dim">{selectedDriver.driver_code} | {selectedDriver.style_label} Style</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedDriver(null)} className="p-1.5 hover:bg-bg-border/50 rounded-full transition-colors">
                    <X className="w-5 h-5 text-text-dim" />
                  </button>
                </div>

                <div className="space-y-8">
                  <div className="h-[250px] w-full">
                    <DriverRadarChart data={radarData(selectedDriver)} />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {(() => {
                      const arch = driverArchetypeMap.get(selectedDriver.id);
                      if (!arch) return null;
                      const theme = getArchetypeTheme(arch.display_name || arch.label);
                      return (
                        <div className="col-span-2 p-3.5 rounded-xl border border-accent-teal/20 bg-bg-primary/50 flex items-center justify-between">
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-text-dim">AI Archetype</p>
                            <p className="font-bold text-text-primary mt-0.5" style={{ color: theme.color }}>{theme.label}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] uppercase tracking-wider text-text-dim">Confidence</p>
                            <p className="font-mono font-bold text-text-primary mt-0.5">{Math.round((arch.confidence || 0) * 100)}%</p>
                          </div>
                        </div>
                      );
                    })()}

                    <div className="p-3 rounded-xl bg-bg-primary/50 border border-bg-border/30">
                      <p className="kpi-label">Personal Factor</p>
                      <p className="font-mono font-bold">{Number(selectedDriver.personal_factor || 0).toFixed(3)}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-bg-primary/50 border border-bg-border/30">
                      <p className="kpi-label">Score</p>
                      <p className="font-mono font-bold">{scoreDriver(selectedDriver)}</p>
                    </div>

                    {/* Custom Coaching Note Panel */}
                    <div className="col-span-2 mt-2 p-4 rounded-xl border border-bg-border/40 bg-bg-primary/30 space-y-3">
                      <p className="text-xs font-bold text-text-primary">
                        Custom Coaching Note
                      </p>
                      
                      <textarea
                        value={coachingNote}
                        onChange={(e) => setCoachingNote(e.target.value)}
                        placeholder="Type premium guidance or feedback for this driver..."
                        disabled={isSubmittingCoaching}
                        className="w-full h-20 rounded-lg border border-bg-border bg-bg-card p-2.5 text-xs text-text-primary outline-none focus:border-accent-teal resize-none placeholder:text-text-dim/60 disabled:opacity-50"
                      />

                      {coachingError && (
                        <p className="text-[11px] text-accent-red bg-accent-red/5 px-2.5 py-1.5 rounded border border-accent-red/20">{coachingError}</p>
                      )}
                      
                      {coachingSuccess && (
                        <p className="text-[11px] text-accent-green bg-accent-green/5 px-2.5 py-1.5 rounded border border-accent-green/20">{coachingSuccess}</p>
                      )}

                      <button
                        onClick={handleSaveCoachingNote}
                        disabled={isSubmittingCoaching || !coachingNote.trim()}
                        className="w-full h-8 flex items-center justify-center text-xs font-bold text-bg-primary bg-accent-teal hover:bg-accent-teal/90 disabled:bg-bg-border disabled:text-text-dim rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed"
                      >
                        {isSubmittingCoaching ? "Saving..." : "Save Coaching Note"}
                      </button>

                      {currentSavedNotes.length > 0 && (
                        <div className="pt-2 border-t border-bg-border/30 space-y-2">
                          <p className="text-[10px] uppercase tracking-wider text-text-dim">Saved Custom Notes</p>
                          <div className="max-h-24 overflow-y-auto space-y-1.5 pr-1">
                            {currentSavedNotes.map((note, index) => (
                              <div key={index} className="p-2 rounded bg-bg-primary/60 border border-bg-border/20 text-[11px] text-text-primary break-words">
                                {note}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    </RoleGuard>
  );
}
