import { UserRole } from "@/types";

const PENDING_ACCESS_KEY = "trickee.pending_access_request";

export type PendingAccessRequest = {
  full_name?: string;
  company?: string;
  requested_role?: Exclude<UserRole, "trickee_admin">;
};

export function writePendingAccessRequest(data: PendingAccessRequest) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PENDING_ACCESS_KEY, JSON.stringify(data));
}

export function readPendingAccessRequest(): PendingAccessRequest | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(PENDING_ACCESS_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingAccessRequest;
  } catch {
    return null;
  }
}

export function clearPendingAccessRequest() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PENDING_ACCESS_KEY);
}
