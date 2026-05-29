import type { UserRole } from "@/types";

export type RoleRoute = {
  label: string;
  href: string;
  roles: UserRole[];
  activePrefix?: string;
};

export const ROLE_HOME: Record<UserRole, string> = {
  trickee_admin: "/fleet",
  fleet_operator: "/fleet",
  driver: "/driver",
};

export const ROLE_ROUTES: RoleRoute[] = [
  { label: "Fleet Overview", href: "/fleet", roles: ["trickee_admin", "fleet_operator"] },
  { label: "Vehicle Forecasts", href: "/vehicle", activePrefix: "/vehicle", roles: ["trickee_admin", "fleet_operator"] },
  { label: "My Profile", href: "/driver", roles: ["driver"] },
  { label: "Past Trips", href: "/trips", roles: ["driver", "trickee_admin", "fleet_operator"] },
  { label: "Live Map", href: "/map", roles: ["driver", "trickee_admin", "fleet_operator"] },
  { label: "Assistant", href: "/ai", roles: ["driver", "trickee_admin", "fleet_operator"] },
  { label: "Decisions", href: "/decisions", roles: ["trickee_admin", "fleet_operator"] },
  { label: "Route Intel", href: "/routes", roles: ["trickee_admin", "fleet_operator", "driver"] },
  { label: "7-Day Schedule", href: "/schedule", roles: ["trickee_admin", "fleet_operator", "driver"] },
  { label: "Daily Impact", href: "/impact", roles: ["trickee_admin", "fleet_operator", "driver"] },
  { label: "Scorecards", href: "/scorecards", roles: ["trickee_admin", "fleet_operator"] },
  { label: "Reports", href: "/reports", roles: ["trickee_admin", "fleet_operator"] },
  { label: "Alerts", href: "/alerts", roles: ["trickee_admin", "fleet_operator", "driver"] },
  { label: "Operations Health", href: "/observability", roles: ["trickee_admin"] },
  { label: "Data Quality", href: "/data-quality", roles: ["trickee_admin", "fleet_operator"] },
  { label: "Model Health", href: "/model-drift", roles: ["trickee_admin"] },
  { label: "Model Metrics", href: "/admin", roles: ["trickee_admin"] },
];

export function homeForRole(role?: string | null) {
  if (role === "driver") return ROLE_HOME.driver;
  if (role === "fleet_operator") return ROLE_HOME.fleet_operator;
  return ROLE_HOME.trickee_admin;
}

export function canAccess(role: string | undefined | null, allowedRoles?: string[]) {
  if (!allowedRoles?.length) return Boolean(role);
  return Boolean(role && allowedRoles.includes(role));
}

export function routesForRole(role?: string | null) {
  return ROLE_ROUTES.filter((item) => role && item.roles.includes(role as UserRole));
}
