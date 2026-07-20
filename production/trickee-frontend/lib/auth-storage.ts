import type { User } from "@/types";

const PROFILE_CACHE_KEY = "trickee:user-profile";
const ACCESS_TOKEN_KEY = "trickee:access-token";
const REFRESH_TOKEN_KEY = "trickee:refresh-token";
const ACCESS_TOKEN_EXPIRES_AT_KEY = "trickee:access-token-expires-at";

export function readCachedProfile() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(PROFILE_CACHE_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export function writeCachedProfile(user: User | null) {
  if (typeof window === "undefined") return;
  if (!user) {
    window.sessionStorage.removeItem(PROFILE_CACHE_KEY);
    return;
  }
  window.sessionStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(user));
}

export function readAccessToken() {
  if (typeof window === "undefined") return undefined;
  const token = window.localStorage.getItem(ACCESS_TOKEN_KEY) || undefined;
  const expiresAt = Number(
    window.localStorage.getItem(ACCESS_TOKEN_EXPIRES_AT_KEY) || "0",
  );
  if (token && (!expiresAt || Date.now() < expiresAt)) return token;
  return undefined;
}

export function readRefreshToken() {
  if (typeof window === "undefined") return undefined;
  return window.localStorage.getItem(REFRESH_TOKEN_KEY) || undefined;
}

export function writeAuthSession(data?: {
  access_token?: string;
  refresh_token?: string;
  expires_in_seconds?: number;
  user?: User;
}) {
  if (typeof window === "undefined") return;
  if (!data?.access_token) {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
    window.localStorage.removeItem(ACCESS_TOKEN_EXPIRES_AT_KEY);
    writeCachedProfile(null);
    return;
  }
  window.localStorage.setItem(ACCESS_TOKEN_KEY, data.access_token);
  if (data.refresh_token)
    window.localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
  if (data.expires_in_seconds) {
    window.localStorage.setItem(
      ACCESS_TOKEN_EXPIRES_AT_KEY,
      String(Date.now() + data.expires_in_seconds * 1000),
    );
  }
  if (data.user) writeCachedProfile(data.user);
}
