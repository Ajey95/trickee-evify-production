"use client";

import React, { useEffect, useMemo, useState } from "react";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { AdminMetricCarousel } from "@/components/admin/AdminMetricCarousel";
import { Activity, CheckCircle2, Cpu, Database, Layers, Settings, ShieldCheck, UserPlus, Users, XCircle, Zap } from "lucide-react";
import { api } from "@/lib/api";
import { AccessRequest, Driver, Fleet, ModelMetrics, User as TrickeeUser, UserRole } from "@/types";

type Draft = {
  role: UserRole;
  fleet_id?: string;
  driver_id?: string;
};

const roleOptions: { value: UserRole; label: string }[] = [
  { value: "fleet_operator", label: "Fleet manager" },
  { value: "driver", label: "Driver" },
  { value: "trickee_admin", label: "Admin" },
];

function roleLabel(role: string) {
  return roleOptions.find((option) => option.value === role)?.label || role.replace("_", " ");
}

function statusVariant(status: string): "success" | "error" | "warning" {
  if (status === "approved") return "success";
  if (status === "rejected") return "error";
  return "warning";
}

function driverOptionLabel(driver: Driver) {
  const code = driver.driver_code ? ` (${driver.driver_code})` : "";
  const vehicle = driver.current_vehicle ? ` - ${driver.current_vehicle}` : "";
  return `${driver.full_name}${code}${vehicle}`;
}

export default function AdminPage() {
  const [modelMetrics, setModelMetrics] = useState<ModelMetrics | null>(null);
  const [users, setUsers] = useState<TrickeeUser[]>([]);
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [fleets, setFleets] = useState<Fleet[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [newRequest, setNewRequest] = useState({ email: "", full_name: "", company: "", requested_role: "fleet_operator" as UserRole });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState("");

  async function loadAdminData() {
    setIsLoading(true);
    const [metricsResult, usersResult, accessResult, fleetsResult, driversResult] = await Promise.all([
      api.admin.metrics(),
      api.admin.users(),
      api.admin.accessRequests(),
      api.admin.fleets(),
      api.admin.drivers(),
    ]);
    if (metricsResult.success) setModelMetrics(metricsResult.data);
    if (usersResult.success) setUsers(usersResult.data);
    if (accessResult.success) setAccessRequests(accessResult.data);
    if (fleetsResult.success) setFleets(fleetsResult.data);
    if (driversResult.success) setDrivers(driversResult.data);
    if (!metricsResult.success || !usersResult.success || !accessResult.success || !fleetsResult.success || !driversResult.success) {
      setError(metricsResult.error || usersResult.error || accessResult.error || fleetsResult.error || driversResult.error || "Unable to load admin data.");
    } else {
      setError("");
    }
    setIsLoading(false);
  }

  useEffect(() => {
    loadAdminData();
  }, []);

  const counts = modelMetrics?.counts || {};
  const model = modelMetrics?.model;
  const modelName = model?.name || "Unavailable";
  const featureCount = model?.feature_count || 0;
  const servedPredictions = counts.predictions || 0;
  const v5a = modelMetrics?.v5a_candidate;
  const pendingRequests = accessRequests.filter((row) => row.status === "pending");
  const reviewedRequests = accessRequests.filter((row) => row.status !== "pending");
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
      label: "Requests",
      value: pendingRequests.length.toLocaleString(),
      helper: "Pending access",
      icon: ShieldCheck,
      accentClass: pendingRequests.length ? "text-accent-amber" : "text-accent-green",
    },
    {
      label: "Features",
      value: featureCount.toLocaleString(),
      helper: "Signal count",
      icon: Layers,
      accentClass: "text-text-primary",
    },
  ];

  const driversByFleet = useMemo(() => {
    return drivers.reduce<Record<string, Driver[]>>((acc, driver) => {
      const fleetId = driver.fleet_id || "none";
      acc[fleetId] = [...(acc[fleetId] || []), driver];
      return acc;
    }, {});
  }, [drivers]);

  function draftFor(row: AccessRequest): Draft {
    const role = row.requested_role || "driver";
    return drafts[row.id] || { role, fleet_id: role === "trickee_admin" ? undefined : fleets[0]?.id, driver_id: undefined };
  }

  function updateDraft(id: string, patch: Partial<Draft>) {
    setDrafts((current) => {
      const existing = current[id] || { role: "fleet_operator" as UserRole };
      return { ...current, [id]: { ...existing, ...patch } };
    });
  }

  async function approve(row: AccessRequest) {
    const draft = draftFor(row);
    setBusyId(row.id);
    setNotice("");
    const result = await api.admin.approveAccessRequest(row.id, {
      role: draft.role,
      fleet_id: draft.role === "trickee_admin" ? undefined : draft.fleet_id,
      driver_id: draft.role === "driver" ? draft.driver_id : undefined,
      full_name: row.full_name,
    });
    setBusyId("");
    if (!result.success) {
      setError(result.error || "Could not approve access.");
      return;
    }
    setNotice("Access approved.");
    await loadAdminData();
  }

  async function reject(row: AccessRequest) {
    setBusyId(row.id);
    setNotice("");
    const result = await api.admin.rejectAccessRequest(row.id, { review_note: "Rejected from admin workspace" });
    setBusyId("");
    if (!result.success) {
      setError(result.error || "Could not reject access.");
      return;
    }
    setNotice("Request rejected.");
    await loadAdminData();
  }

  async function createRequest(event: React.FormEvent) {
    event.preventDefault();
    setNotice("");
    setError("");
    const result = await api.admin.createAccessRequest({
      email: newRequest.email.trim(),
      full_name: newRequest.full_name.trim(),
      company: newRequest.company.trim() || undefined,
      requested_role: newRequest.requested_role,
    });
    if (!result.success) {
      setError(result.error || "Could not add request.");
      return;
    }
    setNotice("Request added.");
    setNewRequest({ email: "", full_name: "", company: "", requested_role: "fleet_operator" });
    await loadAdminData();
  }

  return (
    <RoleGuard allowedRoles={["trickee_admin"]}>
      <div className="space-y-8 pb-12">
        <div>
          <h1 className="page-title mb-1">Admin Console</h1>
          <p className="text-text-dim">Model health, fleet data, and workspace access.</p>
        </div>

        {error && (
          <Card className="border-accent-red/30 bg-accent-red/5">
            <p className="text-sm text-accent-red">{error}</p>
          </Card>
        )}
        {notice && (
          <Card className="border-accent-green/30 bg-accent-green/5">
            <p className="text-sm text-accent-green">{notice}</p>
          </Card>
        )}

        <AdminMetricCarousel metrics={adminMetrics} />

        <div className="grid grid-cols-1 gap-8 xl:grid-cols-[1fr_0.58fr]">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>Workspace Requests</CardTitle>
                <CardDescription>Review and approve team access</CardDescription>
              </div>
              <ShieldCheck className="h-5 w-5 text-text-dim" />
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Person</TableHead>
                    <TableHead>Requested</TableHead>
                    <TableHead>Access</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Map to driver profile</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingRequests.map((row) => {
                    const draft = draftFor(row);
                    const fleetDrivers = draft.role === "driver" && draft.fleet_id ? driversByFleet[draft.fleet_id] || [] : [];
                    return (
                      <TableRow key={row.id}>
                        <TableCell>
                          <p className="font-medium text-text-primary">{row.full_name}</p>
                          <p className="text-xs text-text-dim">{row.email}</p>
                          {row.company && <p className="mt-1 text-[11px] text-text-dim">{row.company}</p>}
                          {row.requested_role === "driver" && (
                            <p className="mt-1 max-w-[210px] text-[10px] leading-4 text-accent-amber">
                              Confirm this Gmail belongs to the rider before mapping it to telemetry.
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="warning">{roleLabel(row.requested_role)}</Badge>
                          {row.requested_role === "fleet_operator" && (
                            <p className="mt-1 text-[10px] leading-4 text-text-dim">User requested fleet access. Change below if this should be a driver account.</p>
                          )}
                        </TableCell>
                        <TableCell>
                          <select
                            value={draft.role}
                            onChange={(event) =>
                              updateDraft(row.id, {
                                role: event.target.value as UserRole,
                                driver_id: undefined,
                              })
                            }
                            className="h-9 w-full min-w-[135px] rounded-lg border border-bg-border bg-bg-primary px-2 text-xs text-text-primary outline-none"
                          >
                            {roleOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </TableCell>
                        <TableCell>
                          <select
                            value={draft.fleet_id || ""}
                            disabled={draft.role === "trickee_admin"}
                            onChange={(event) => updateDraft(row.id, { fleet_id: event.target.value, driver_id: undefined })}
                            className="h-9 w-full min-w-[150px] rounded-lg border border-bg-border bg-bg-primary px-2 text-xs text-text-primary outline-none disabled:opacity-45"
                          >
                            <option value="">Select team</option>
                            {fleets.map((fleet) => (
                              <option key={fleet.id} value={fleet.id}>
                                {fleet.name}
                              </option>
                            ))}
                          </select>
                        </TableCell>
                        <TableCell>
                          {draft.role === "driver" ? (
                            <>
                              <select
                                value={draft.driver_id || ""}
                                onChange={(event) => updateDraft(row.id, { driver_id: event.target.value })}
                                className="h-9 w-full min-w-[145px] rounded-lg border border-bg-border bg-bg-primary px-2 text-xs text-text-primary outline-none"
                              >
                                <option value="">Select driver</option>
                                {fleetDrivers.map((driver) => (
                                  <option key={driver.id} value={driver.id}>
                                    {driverOptionLabel(driver)}
                                  </option>
                                ))}
                              </select>
                              <p className="mt-1 max-w-[190px] text-[10px] leading-4 text-text-dim">
                                Link this login to the existing telemetry driver record.
                              </p>
                              {!fleetDrivers.length && <p className="mt-1 text-[10px] text-accent-amber">No drivers in selected team.</p>}
                            </>
                          ) : (
                            <p className="min-w-[145px] text-xs text-text-dim">Only required for Driver accounts.</p>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              onClick={() => approve(row)}
                              disabled={busyId === row.id || (draft.role !== "trickee_admin" && !draft.fleet_id) || (draft.role === "driver" && !draft.driver_id)}
                              isLoading={busyId === row.id}
                              className="h-9 gap-1"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Approve
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => reject(row)} disabled={busyId === row.id} className="h-9 gap-1 text-accent-red">
                              <XCircle className="h-3.5 w-3.5" />
                              Reject
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {!pendingRequests.length && (
                <div className="p-7 text-sm text-text-dim">{isLoading ? "Loading requests..." : "No pending requests."}</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Add Request</CardTitle>
              <CardDescription>Prepare access for an invited team member</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={createRequest} className="space-y-4">
                <input
                  type="email"
                  value={newRequest.email}
                  onChange={(event) => setNewRequest((current) => ({ ...current, email: event.target.value }))}
                  placeholder="name@company.com"
                  className="h-10 w-full rounded-lg border border-bg-border bg-bg-primary px-3 text-sm text-text-primary outline-none"
                  required
                />
                <input
                  value={newRequest.full_name}
                  onChange={(event) => setNewRequest((current) => ({ ...current, full_name: event.target.value }))}
                  placeholder="Full name"
                  className="h-10 w-full rounded-lg border border-bg-border bg-bg-primary px-3 text-sm text-text-primary outline-none"
                  required
                />
                <input
                  value={newRequest.company}
                  onChange={(event) => setNewRequest((current) => ({ ...current, company: event.target.value }))}
                  placeholder="Company or fleet"
                  className="h-10 w-full rounded-lg border border-bg-border bg-bg-primary px-3 text-sm text-text-primary outline-none"
                />
                <select
                  value={newRequest.requested_role}
                  onChange={(event) => setNewRequest((current) => ({ ...current, requested_role: event.target.value as UserRole }))}
                  className="h-10 w-full rounded-lg border border-bg-border bg-bg-primary px-3 text-sm text-text-primary outline-none"
                >
                  {roleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <Button type="submit" className="h-10 w-full gap-2">
                  <UserPlus className="h-4 w-4" />
                  Add request
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Data Profile</CardTitle>
              <CardDescription>Current fleet and prediction coverage</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(counts).map(([key, value]) => (
                  <div key={key} className="rounded-lg border border-bg-border/30 bg-bg-primary/50 p-3">
                    <p className="kpi-label">{key.replaceAll("_", " ")}</p>
                    <p className="font-mono text-xl font-bold text-text-primary">{Number(value).toLocaleString()}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-8 border-t border-bg-border pt-6">
                <div>
                  <p className="kpi-label mb-2">Telemetry Rows</p>
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-text-dim" />
                    <span className="text-sm font-bold text-text-primary">{Number(counts.telemetry || 0).toLocaleString()}</span>
                  </div>
                </div>
                <div>
                  <p className="kpi-label mb-2">Target</p>
                  <div className="flex items-center gap-2">
                    <Settings className="h-4 w-4 text-text-dim" />
                    <span className="text-sm font-bold text-text-primary">{model?.target || "Unavailable"}</span>
                  </div>
                </div>
              </div>
              {v5a && (
                <div className="rounded-lg border border-bg-border bg-bg-primary/40 p-4">
                  <p className="kpi-label mb-2">Sequence Coverage</p>
                  <p className="text-sm text-text-primary">
                    Sequences: {v5a.sequences ?? "N/A"} | Raw rows: {v5a.raw_rows ?? "N/A"}
                  </p>
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
              <Users className="h-5 w-5 text-text-dim" />
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
                        <Badge variant={user.role === "trickee_admin" ? "info" : "default"}>
                          {roleLabel(user.role)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs uppercase text-text-dim">{user.fleet_id || "Global"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-accent-green">
                          <div className="h-1.5 w-1.5 rounded-full bg-accent-green" />
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

        {!!reviewedRequests.length && (
          <Card>
            <CardHeader>
              <CardTitle>Recent Reviews</CardTitle>
              <CardDescription>Completed access decisions</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {reviewedRequests.slice(0, 9).map((row) => (
                <div key={row.id} className="rounded-lg border border-bg-border bg-bg-primary/45 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-semibold text-text-primary">{row.full_name}</p>
                    <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                  </div>
                  <p className="truncate text-xs text-text-dim">{row.email}</p>
                  <p className="mt-2 text-xs text-text-dim">{roleLabel(row.requested_role)}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </RoleGuard>
  );
}
