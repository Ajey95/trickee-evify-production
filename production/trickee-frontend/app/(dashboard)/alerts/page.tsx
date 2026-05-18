"use client";

import React, { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { 
  Bell, 
  Battery, 
  BatteryWarning,
  MapPin, 
  Navigation, 
  CheckCircle2, 
  Car,
  Zap
} from "lucide-react";
import { Alert } from "@/types";
import { api } from "@/lib/api";
import { RoleGuard } from "@/components/layout/RoleGuard";

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadAlerts() {
      const result = await api.alerts.list();
      if (result.success) {
        setAlerts(result.data.map((alert: any) => ({
          ...alert,
          vehicle_code: alert.vehicle_code || alert.vehicle_id || "Vehicle",
          driver_name: alert.driver_name || alert.driver_id || "Unassigned",
        })));
        setError("");
      } else {
        setError(result.error || "Unable to load alerts");
      }
    }
    loadAlerts();
  }, []);

  const resolveAlert = async (id: string) => {
    const result = await api.alerts.resolve(id);
    if (result.success) {
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, is_resolved: true } : a));
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case "charging_opportunity": return Zap;
      case "driver_risk": return BatteryWarning;
      case "low_soc_parked": return Battery;
      case "reroute": return Navigation;
      default: return Bell;
    }
  };

  const getAlertColor = (type: string) => {
    switch (type) {
      case "charging_opportunity": return "text-accent-teal border-accent-teal/30 bg-accent-teal/10";
      case "driver_risk": return "text-accent-red border-accent-red/30 bg-accent-red/10";
      case "low_soc_parked": return "text-accent-red border-accent-red/30 bg-accent-red/10";
      case "reroute": return "text-accent-amber border-accent-amber/30 bg-accent-amber/10";
      default: return "text-text-dim border-bg-border bg-bg-border/30";
    }
  };

  return (
    <RoleGuard allowedRoles={["trickee_admin", "fleet_operator", "driver"]}>
    <div className="space-y-8 pb-12">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="page-title mb-1">Real-time Alerts</h1>
          <p className="text-text-dim">Actionable intelligence to optimize fleet range and uptime.</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-bg-card border border-bg-border rounded-xl">
           <span className="text-xs font-bold text-text-primary">{alerts.filter(a => !a.is_resolved).length} Unresolved</span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto space-y-4">
        {error && (
          <Card className="border-accent-red/30 bg-accent-red/5">
            <p className="text-sm text-accent-red">{error}</p>
          </Card>
        )}

        {alerts.map((alert) => {
          const Icon = getAlertIcon(alert.alert_type);
          const colorClass = getAlertColor(alert.alert_type);

          return (
            <Card 
              key={alert.id} 
              className={`transition-all duration-300 ${alert.is_resolved ? 'opacity-40 grayscale pointer-events-none' : 'hover:border-accent-teal/40'}`}
            >
              <div className="flex gap-6">
                <div className={`p-4 rounded-2xl border h-fit shrink-0 ${colorClass}`}>
                  <Icon className="w-6 h-6" />
                </div>
                
                <div className="flex-1 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={alert.alert_type === "low_soc_parked" || alert.alert_type === "driver_risk" ? "error" : alert.alert_type === "reroute" ? "warning" : "info"}>
                          {alert.alert_type.replace(/_/g, " ")}
                        </Badge>
                        <span className="text-[10px] text-text-dim uppercase font-bold tracking-widest">{new Date(alert.created_at).toLocaleTimeString()}</span>
                      </div>
                      <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                        <Car className="w-4 h-4 text-text-dim" />
                        {alert.vehicle_code}
                        <span className="text-text-dim font-normal text-sm">/ {alert.driver_name}</span>
                      </h3>
                    </div>
                    {alert.is_resolved && (
                      <div className="flex items-center gap-1.5 text-accent-green text-xs font-bold uppercase tracking-widest">
                        <CheckCircle2 className="w-4 h-4" />
                        Resolved
                      </div>
                    )}
                  </div>

                  <p className="text-sm text-text-primary leading-relaxed bg-bg-primary/50 p-4 rounded-xl border border-bg-border/30">
                    {alert.message}
                  </p>

                  <div className="flex flex-wrap gap-6 pt-2">
                    <div className="flex items-center gap-2">
                      <Battery className="w-4 h-4 text-text-dim" />
                      <div>
                        <p className="text-[10px] text-text-dim uppercase font-bold tracking-tighter">SOC at Alert</p>
                        <p className="text-sm font-mono font-bold text-text-primary">{alert.soc_at_alert}%</p>
                      </div>
                    </div>
                    {alert.nearest_charger && (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-text-dim" />
                        <div>
                          <p className="text-[10px] text-text-dim uppercase font-bold tracking-tighter">Nearest Charger</p>
                          <p className="text-sm font-medium text-text-primary">{alert.nearest_charger} ({alert.charger_distance_m}m)</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {!alert.is_resolved && (
                    <div className="flex justify-end pt-2">
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        className="gap-2"
                        onClick={() => resolveAlert(alert.id)}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Mark as Resolved
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          );
        })}

        {alerts.length === 0 && (
          <div className="text-center py-24 glass-card border-dashed">
            <Bell className="w-12 h-12 text-bg-border mx-auto mb-4" />
            <p className="text-text-dim">No active alerts. All systems nominal.</p>
          </div>
        )}
      </div>
    </div>
    </RoleGuard>
  );
}
