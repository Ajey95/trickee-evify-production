import type { User } from "@/types";

const PROFILE_CACHE_KEY = "trickee:user-profile";
const LEGACY_TOKEN_KEY = "trickee:legacy-token";
const legacyAuthEnabled = process.env.NEXT_PUBLIC_LEGACY_AUTH_ENABLED === "true";

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

export function readLegacyToken() {
  if (typeof window === "undefined") return undefined;
  if (!legacyAuthEnabled) return undefined;
  return window.localStorage.getItem(LEGACY_TOKEN_KEY) || undefined;
}

export function writeLegacyToken(token?: string) {
  if (typeof window === "undefined") return;
  if (!legacyAuthEnabled) {
    window.localStorage.removeItem(LEGACY_TOKEN_KEY);
    return;
  }
  if (token) window.localStorage.setItem(LEGACY_TOKEN_KEY, token);
  else window.localStorage.removeItem(LEGACY_TOKEN_KEY);
}
