"use client";

import React, { useEffect, useState } from "react";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { AdminMetricCarousel } from "@/components/admin/AdminMetricCarousel";
import { Activity, Cpu, Database, Layers, Zap, Users, Settings } from "lucide-react";
import { api } from "@/lib/api";
import { ModelMetrics, User as TrickeeUser } from "@/types";

export default function AdminPage() {
  const [modelMetrics, setModelMetrics] = useState<ModelMetrics | null>(null);
  const [users, setUsers] = useState<TrickeeUser[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadAdminData() {
      const [metricsResult, usersResult] = await Promise.all([api.admin.metrics(), api.admin.users()]);
      if (metricsResult.success) setModelMetrics(metricsResult.data);
      if (usersResult.success) setUsers(usersResult.data);
      if (!metricsResult.success || !usersResult.success) {
        setError(metricsResult.error || usersResult.error || "Unable to load admin data.");
      }
    }
    loadAdminData();
  }, []);

  const counts = modelMetrics?.counts || {};
  const model = modelMetrics?.model;
  const modelName = model?.name || "Unavailable";
  const featureCount = model?.feature_count || 0;
  const servedPredictions = counts.predictions || 0;
  const v5a = modelMetrics?.v5a_candidate;
  const adminMetrics = [
    {
      label: "Model",
      value: modelName,
      helper: "Active model",
      icon: Activity,
      accentClass: "text-accent-teal",
    },
    {
      label: "Model Status",
      value: model?.ready ? "Ready" : "Not Ready",
      helper: "Runtime state",
      icon: Cpu,
      accentClass: model?.ready ? "text-accent-green" : "text-accent-amber",
    },
    {
      label: "Served Predictions",
      value: servedPredictions.toLocaleString(),
      helper: "Prediction volume",
      icon: Zap,
      accentClass: "text-accent-green",
    },
    {
      label: "Features",
      value: featureCount.toLocaleString(),
      helper: "Signal count",
      icon: Layers,
      accentClass: "text-text-primary",
    },
  ];

  return (
    <RoleGuard allowedRoles={["trickee_admin"]}>
      <div className="space-y-8 pb-12">
        <div>
          <h1 className="page-title mb-1">Model Metrics</h1>
          <p className="text-text-dim">Model health, fleet data, and workspace access.</p>
        </div>

        {error && <Card className="border-accent-red/30 bg-accent-red/5"><p className="text-sm text-accent-red">{error}</p></Card>}

        <AdminMetricCarousel metrics={adminMetrics} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <CardTitle>Data Profile</CardTitle>
              <CardDescription>Current fleet and prediction coverage</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(counts).map(([key, value]) => (
                  <div key={key} className="p-3 rounded-lg bg-bg-primary/50 border border-bg-border/30">
                    <p className="kpi-label">{key.replaceAll("_", " ")}</p>
                    <p className="text-xl font-bold font-mono text-text-primary">{Number(value).toLocaleString()}</p>
                  </div>
                ))}
              </div>
              <div className="pt-6 border-t border-bg-border grid grid-cols-2 gap-8">
                <div>
                  <p className="kpi-label mb-2">Telemetry Rows</p>
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-text-dim" />
                    <span className="text-sm font-bold text-text-primary">{Number(counts.telemetry || 0).toLocaleString()}</span>
                  </div>
                </div>
                <div>
                  <p className="kpi-label mb-2">Target</p>
                  <div className="flex items-center gap-2">
                    <Settings className="w-4 h-4 text-text-dim" />
                    <span className="text-sm font-bold text-text-primary">{model?.target || "Unavailable"}</span>
                  </div>
                </div>
              </div>
              {v5a && (
                <div className="p-4 rounded-xl border border-bg-border bg-bg-primary/40">
                  <p className="kpi-label mb-2">Sequence Coverage</p>
                  <p className="text-sm text-text-primary">Sequences: {v5a.sequences ?? "N/A"} | Raw rows: {v5a.raw_rows ?? "N/A"}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>User Management</CardTitle>
                <CardDescription>Approved workspace users</CardDescription>
              </div>
              <Users className="w-5 h-5 text-text-dim" />
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Fleet</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium text-text-primary">{user.full_name}</TableCell>
                      <TableCell>
                        <Badge variant={user.role === "trickee_admin" ? "info" : "default"} className="capitalize">
                          {user.role.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-text-dim text-xs uppercase">{user.fleet_id || "Global"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-accent-green font-bold text-[10px] uppercase tracking-widest">
                          <div className="w-1.5 h-1.5 rounded-full bg-accent-green" />
                          {user.is_active === false ? "Inactive" : "Active"}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {!users.length && <div className="p-6 text-sm text-text-dim">No users available.</div>}
            </CardContent>
          </Card>
        </div>
      </div>
    </RoleGuard>
  );
}
