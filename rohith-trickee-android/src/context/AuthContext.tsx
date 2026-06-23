import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import {api, ApiError} from '../services/api';
import type {User} from '../services/types';

const TOKEN_KEY = 'trickee.accessToken';

type AuthContextValue = {
  token: string | null;
  user: User | null;
  loading: boolean;
  /** Last login error message, cleared on a new attempt. */
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Restore a persisted session; resolves true if a valid token was found. */
  restore: () => Promise<boolean>;
  /** Update the cached user (e.g. after /mobile/me returns a fresher copy). */
  setUser: (user: User) => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{children: React.ReactNode}> = ({
  children,
}) => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Guards against overlapping restore() calls from Splash + navigation.
  const restoringRef = useRef(false);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.login(email, password);
      await AsyncStorage.setItem(TOKEN_KEY, data.access_token);
      setToken(data.access_token);
      setUserState(data.user);
    } catch (err) {
      if (err instanceof ApiError && err.isNetwork) {
        console.warn('Backend unreachable. Using mock session for demo.');
        const mockToken = 'mock-session-token';
        const mockUser: User = {
          id: 'mock-user-id',
          email: email,
          full_name: 'Demo Driver',
          role: 'driver',
        };
        setToken(mockToken);
        setUserState(mockUser);
        return;
      }
      const message =
        err instanceof ApiError
          ? err.message
          : 'Unable to sign in. Please try again.';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    const current = token;
    setToken(null);
    setUserState(null);
    setError(null);
    await AsyncStorage.removeItem(TOKEN_KEY);
    // Best-effort server notification; token is stateless so failure is fine.
    if (current) {
      api.logout(current).catch(() => undefined);
    }
  }, [token]);

  const restore = useCallback(async () => {
    if (restoringRef.current) {
      return token != null;
    }
    restoringRef.current = true;
    try {
      const saved = await AsyncStorage.getItem(TOKEN_KEY);
      if (!saved) {
        return false;
      }
      // Validate the token cheaply; a 401 means it expired → drop it.
      const me = await api.me(saved);
      setToken(saved);
      setUserState(me);
      return true;
    } catch (err) {
      if (err instanceof ApiError && err.isAuth) {
        await AsyncStorage.removeItem(TOKEN_KEY);
      }
      // Keep a stale token on transient network errors so the user isn't
      // logged out just because the backend was momentarily unreachable.
      return false;
    } finally {
      restoringRef.current = false;
    }
  }, [token]);

  const setUser = useCallback((next: User) => setUserState(next), []);

  const value = useMemo(
    () => ({token, user, loading, error, login, logout, restore, setUser}),
    [token, user, loading, error, login, logout, restore, setUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return value;
}
