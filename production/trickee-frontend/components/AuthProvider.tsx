"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { createClient, isSupabaseConfigured } from "@/utils/supabase/client";
import type { User } from "@/types";
import { readCachedProfile, readLegacyToken, writeCachedProfile, writeLegacyToken } from "@/lib/auth-storage";
import { clearPendingAccessRequest, readPendingAccessRequest } from "@/lib/pending-access";

type AuthState = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  status: AuthState;
  session: Session | null;
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
    if (isSupabaseConfigured) {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      const account = data.user;
      if (account?.email) {
        const pending = readPendingAccessRequest();
        await api.auth.accessRequest({
          email: account.email,
          full_name: pending?.full_name || account.user_metadata?.full_name || account.user_metadata?.name || account.email.split("@")[0],
          company: pending?.company || account.user_metadata?.company,
          requested_role: pending?.requested_role || account.user_metadata?.requested_role || "driver",
          requested_vehicle_id: pending?.requested_vehicle_id || account.user_metadata?.requested_vehicle_id,
          supabase_user_id: account.id,
        });
        clearPendingAccessRequest();
      }
    }
    return { user: null, error: result.error || "Unable to access workspace." };
  }
  writeCachedProfile(result.data);
  return { user: result.data, error: null };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(() => readCachedProfile());
  const [status, setStatus] = useState<AuthState>(() => (readCachedProfile() ? "authenticated" : "loading"));
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
        const { user: nextUser, error } = await fetchCurrentUser();
        if (!active) return;
        setUser(nextUser);
        setAuthError(error);
        setStatus(nextUser ? "authenticated" : "unauthenticated");
      } else {
        setUser(null);
        setAuthError(null);
        writeCachedProfile(null);
        setStatus("unauthenticated");
      }
    }

    boot();
    const subscription = supabase?.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession && !readLegacyToken()) {
        setUser(null);
        setAuthError(null);
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
    setAuthError(null);
    setStatus("unauthenticated");
    resetApiClientState();
  }, []);

  const value = useMemo(
    () => ({ status, session, user, authError, refreshUser, signOut }),
    [status, session, user, authError, refreshUser, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
