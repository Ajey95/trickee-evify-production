"use client";

import React, { useEffect, useState } from "react";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
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
        setError(metricsResult.error || usersResult.error || "Unable to load admin data from backend.");
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

  return (
    <RoleGuard allowedRoles={["trickee_admin"]}>
      <div className="space-y-8 pb-12">
        <div>
          <h1 className="page-title mb-1">Model Metrics & Admin</h1>
          <p className="text-text-dim">Backend model readiness, data counts, and access control.</p>
        </div>

        {error && <Card className="border-accent-red/30 bg-accent-red/5"><p className="text-sm text-accent-red">{error}</p></Card>}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border-accent-teal/30 bg-accent-teal/[0.02]">
            <div className="flex justify-between items-start mb-4">
              <p className="kpi-label">Model</p>
              <Activity className="w-4 h-4 text-accent-teal" />
            </div>
            <p className="text-xl font-bold font-mono text-accent-teal">{modelName}</p>
            <p className="text-[10px] text-text-dim mt-2 uppercase font-bold tracking-widest">Backend Serving Model</p>
          </Card>

          <Card>
            <div className="flex justify-between items-start mb-4">
              <p className="kpi-label">Model Status</p>
              <Cpu className="w-4 h-4 text-accent-magenta" />
            </div>
            <p className="text-3xl font-bold font-mono text-text-primary">{model?.ready ? "Ready" : "Not Ready"}</p>
            <p className="text-[10px] text-text-dim mt-2 uppercase font-bold tracking-widest">Runtime State</p>
          </Card>

          <Card>
            <div className="flex justify-between items-start mb-4">
              <p className="kpi-label">Served Predictions</p>
              <Zap className="w-4 h-4 text-accent-green" />
            </div>
            <p className="text-3xl font-bold font-mono text-text-primary">{servedPredictions.toLocaleString()}</p>
            <p className="text-[10px] text-text-dim mt-2 uppercase font-bold tracking-widest">Prediction Table Count</p>
          </Card>

          <Card>
            <div className="flex justify-between items-start mb-4">
              <p className="kpi-label">Features</p>
              <Layers className="w-4 h-4 text-text-dim" />
            </div>
            <p className="text-3xl font-bold font-mono text-text-primary">{featureCount}</p>
            <p className="text-[10px] text-text-dim mt-2 uppercase font-bold tracking-widest">Input Columns</p>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <CardTitle>Backend Data Profile</CardTitle>
              <CardDescription>Live counts from the production API database</CardDescription>
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
                  <p className="kpi-label mb-2">V5-A Candidate</p>
                  <p className="text-sm text-text-primary">Sequences: {v5a.sequences ?? "N/A"} | Raw rows: {v5a.raw_rows ?? "N/A"}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>User Management</CardTitle>
                <CardDescription>Users returned by backend RBAC service</CardDescription>
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
              {!users.length && <div className="p-6 text-sm text-text-dim">No backend users returned.</div>}
            </CardContent>
          </Card>
        </div>
      </div>
    </RoleGuard>
  );
}
