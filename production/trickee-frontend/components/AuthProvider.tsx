"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { createClient, isSupabaseConfigured } from "@/utils/supabase/client";
import type { User } from "@/types";
import { readCachedProfile, readLegacyToken, writeCachedProfile, writeLegacyToken } from "@/lib/auth-storage";

type AuthState = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  status: AuthState;
  session: Session | null;
  user: User | null;
  refreshUser: () => Promise<User | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
async function fetchCurrentUser(): Promise<User | null> {
  const { api } = await import("@/lib/api");
  const result = await api.auth.me();
  if (!result.success) return null;
  writeCachedProfile(result.data);
  return result.data;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(() => readCachedProfile());
  const [status, setStatus] = useState<AuthState>(() => (readCachedProfile() ? "authenticated" : "loading"));

  const refreshUser = useCallback(async () => {
    const nextUser = await fetchCurrentUser();
    setUser(nextUser);
    setStatus(nextUser ? "authenticated" : "unauthenticated");
    return nextUser;
  }, []);

  useEffect(() => {
    let active = true;
    if (!isSupabaseConfigured && !readLegacyToken()) {
      setStatus("unauthenticated");
      return;
    }

    const supabase = isSupabaseConfigured ? createClient() : null;

    async function boot() {
      const nextSession = supabase ? (await supabase.auth.getSession()).data.session : null;
      if (!active) return;
      setSession(nextSession);
      if (nextSession || readLegacyToken()) {
        const nextUser = await fetchCurrentUser();
        if (!active) return;
        setUser(nextUser);
        setStatus(nextUser ? "authenticated" : "unauthenticated");
      } else {
        setUser(null);
        writeCachedProfile(null);
        setStatus("unauthenticated");
      }
    }

    boot();
    const subscription = supabase?.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession && !readLegacyToken()) {
        setUser(null);
        writeCachedProfile(null);
        setStatus("unauthenticated");
      } else {
        refreshUser();
      }
    });

    return () => {
      active = false;
      subscription?.data.subscription.unsubscribe();
    };
  }, [refreshUser]);

  const signOut = useCallback(async () => {
    const { resetApiClientState } = await import("@/lib/api");
    writeLegacyToken(undefined);
    writeCachedProfile(null);
    if (isSupabaseConfigured) {
      await createClient().auth.signOut();
    }
    setSession(null);
    setUser(null);
    setStatus("unauthenticated");
    resetApiClientState();
  }, []);

  const value = useMemo(
    () => ({ status, session, user, refreshUser, signOut }),
    [status, session, user, refreshUser, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
