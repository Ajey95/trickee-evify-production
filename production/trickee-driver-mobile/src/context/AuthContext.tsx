import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import {Features} from '../config';
import {api, ApiError} from '../services/api';
import type {LoginResponse, User} from '../services/types';

const TOKEN_KEY = 'trickee.accessToken';
const REFRESH_TOKEN_KEY = 'trickee.refreshToken';
const AUTH_KEYCHAIN_SERVICE = 'com.trickeeandroid.auth';

type StoredSession = {
  accessToken: string;
  refreshToken?: string;
};

async function saveStoredSession(session: StoredSession) {
  await Keychain.setGenericPassword(
    'trickee-session',
    JSON.stringify(session),
    {
      service: AUTH_KEYCHAIN_SERVICE,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    },
  );
}

async function clearStoredSession() {
  await Keychain.resetGenericPassword({service: AUTH_KEYCHAIN_SERVICE});
  await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_TOKEN_KEY]);
}

async function readStoredSession(): Promise<StoredSession | null> {
  const credentials = await Keychain.getGenericPassword({
    service: AUTH_KEYCHAIN_SERVICE,
  });
  if (credentials) {
    try {
      return JSON.parse(credentials.password) as StoredSession;
    } catch {
      await clearStoredSession();
      return null;
    }
  }

  // Move sessions created by older app versions out of plain AsyncStorage.
  const [[, accessToken], [, refreshToken]] = await AsyncStorage.multiGet([
    TOKEN_KEY,
    REFRESH_TOKEN_KEY,
  ]);
  if (!accessToken) return null;
  const migrated = {accessToken, refreshToken: refreshToken || undefined};
  await saveStoredSession(migrated);
  await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_TOKEN_KEY]);
  return migrated;
}

type AuthContextValue = {
  token: string | null;
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  googleLogin: (idToken: string) => Promise<void>;
  logout: () => Promise<void>;
  restore: () => Promise<boolean>;
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
  const restoringRef = useRef(false);

  const persistSession = useCallback(async (data: LoginResponse) => {
    const stored = await readStoredSession();
    await saveStoredSession({
      accessToken: data.access_token,
      refreshToken: data.refresh_token || stored?.refreshToken,
    });
    setToken(data.access_token);
    setUserState(data.user);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.login(email, password);
        await persistSession(data);
      } catch (err) {
        if (
          Features.mockBackendFallback &&
          err instanceof ApiError &&
          err.isNetwork
        ) {
          console.warn('Backend unreachable. Using mock session for demo.');
          const mockToken = 'mock-session-token';
          const mockUser: User = {
            id: 'mock-user-id',
            email,
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
    },
    [persistSession],
  );

  const googleLogin = useCallback(
    async (idToken: string) => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.googleLogin(idToken);
        await persistSession(data);
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message
            : 'Unable to sign in with Google. Please try again.';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [persistSession],
  );

  const logout = useCallback(async () => {
    const current = token;
    const savedRefreshToken = (await readStoredSession())?.refreshToken;
    setToken(null);
    setUserState(null);
    setError(null);
    await clearStoredSession();
    if (current) {
      api.logout(current, savedRefreshToken).catch(() => undefined);
    }
  }, [token]);

  const restore = useCallback(async () => {
    if (restoringRef.current) {
      return token != null;
    }
    restoringRef.current = true;
    try {
      const stored = await readStoredSession();
      const saved = stored?.accessToken;
      const savedRefreshToken = stored?.refreshToken;
      if (!saved && !savedRefreshToken) {
        return false;
      }
      if (saved) {
        try {
          const me = await api.me(saved);
          setToken(saved);
          setUserState(me);
          return true;
        } catch (err) {
          if (!(err instanceof ApiError && err.isAuth)) {
            return false;
          }
        }
      }
      if (!savedRefreshToken) {
        return false;
      }
      const refreshed = await api.refresh(savedRefreshToken);
      await persistSession(refreshed);
      return true;
    } catch (err) {
      if (err instanceof ApiError && err.isAuth) {
        await clearStoredSession();
      }
      return false;
    } finally {
      restoringRef.current = false;
    }
  }, [persistSession, token]);

  const setUser = useCallback((next: User) => setUserState(next), []);

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      error,
      login,
      googleLogin,
      logout,
      restore,
      setUser,
    }),
    [token, user, loading, error, login, googleLogin, logout, restore, setUser],
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
