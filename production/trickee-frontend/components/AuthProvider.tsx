"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { User } from "@/types";
import {
  readAccessToken,
  readCachedProfile,
  readRefreshToken,
  writeAuthSession,
  writeCachedProfile,
} from "@/lib/auth-storage";

type AuthState = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  status: AuthState;
  user: User | null;
  authError: string | null;
  refreshUser: () => Promise<User | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
type CurrentUserResult = { user: User | null; error: string | null };

async function fetchCurrentUser(): Promise<CurrentUserResult> {
  const { api } = await import("@/lib/api");
  const result = await api.auth.me();
  if (!result.success) {
    return { user: null, error: result.error || "Unable to access workspace." };
  }
  writeCachedProfile(result.data);
  return { user: result.data, error: null };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => readCachedProfile());
  const [status, setStatus] = useState<AuthState>(() =>
    readCachedProfile() ? "authenticated" : "loading",
  );
  const [authError, setAuthError] = useState<string | null>(null);

  const refreshUser = useCallback(async () => {
    const { user: nextUser, error } = await fetchCurrentUser();
    setUser(nextUser);
    setAuthError(error);
    setStatus(nextUser ? "authenticated" : "unauthenticated");
    return nextUser;
  }, []);

  useEffect(() => {
    let active = true;
    if (!readAccessToken() && !readRefreshToken()) {
      setUser(null);
      setAuthError(null);
      writeCachedProfile(null);
      setStatus("unauthenticated");
      return;
    }

    fetchCurrentUser().then(({ user: nextUser, error }) => {
      if (!active) return;
      setUser(nextUser);
      setAuthError(error);
      setStatus(nextUser ? "authenticated" : "unauthenticated");
    });

    return () => {
      active = false;
    };
  }, []);

  const signOut = useCallback(async () => {
    const { api, resetApiClientState } = await import("@/lib/api");
    const refreshToken = readRefreshToken();
    if (refreshToken) await api.auth.logout(refreshToken);
    writeAuthSession(undefined);
    writeCachedProfile(null);
    setUser(null);
    setAuthError(null);
    setStatus("unauthenticated");
    resetApiClientState();
  }, []);

  const value = useMemo(
    () => ({ status, user, authError, refreshUser, signOut }),
    [status, user, authError, refreshUser, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
