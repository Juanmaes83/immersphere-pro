import { create } from 'zustand';
import { AUTH_STORAGE_KEYS, api, getApiErrorMessage, unwrapApiResponse } from '@/services/api';

export interface AuthTenant {
  id: string;
  name: string;
  slug: string;
  logoText: string;
  logoUrl: string;
  primaryColor: string;
  webhookUrl: string;
  plan: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  tenant: AuthTenant;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface AuthResponse {
  user: AuthUser;
  tokens: AuthTokens;
}

interface LoginPayload {
  email: string;
  password: string;
}

interface RegisterPayload {
  tenantName: string;
  name: string;
  email: string;
  password: string;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  hydrateFromStorage: () => void;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  refreshSession: () => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

function readStoredUser(): AuthUser | null {
  const rawUser = window.localStorage.getItem(AUTH_STORAGE_KEYS.user);

  if (!rawUser) {
    return null;
  }

  try {
    return JSON.parse(rawUser) as AuthUser;
  } catch {
    return null;
  }
}

function persistAuth(auth: AuthResponse): void {
  window.localStorage.setItem(AUTH_STORAGE_KEYS.accessToken, auth.tokens.accessToken);
  window.localStorage.setItem(AUTH_STORAGE_KEYS.refreshToken, auth.tokens.refreshToken);
  window.localStorage.setItem(AUTH_STORAGE_KEYS.user, JSON.stringify(auth.user));
}

function clearAuthStorage(): void {
  window.localStorage.removeItem(AUTH_STORAGE_KEYS.accessToken);
  window.localStorage.removeItem(AUTH_STORAGE_KEYS.refreshToken);
  window.localStorage.removeItem(AUTH_STORAGE_KEYS.user);
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  hydrateFromStorage: () => {
    const accessToken = window.localStorage.getItem(AUTH_STORAGE_KEYS.accessToken);
    const refreshToken = window.localStorage.getItem(AUTH_STORAGE_KEYS.refreshToken);
    const user = readStoredUser();

    set({
      user,
      accessToken,
      refreshToken,
      isAuthenticated: Boolean(accessToken && user)
    });
  },

  login: async (payload) => {
    set({ isLoading: true, error: null });

    try {
      const auth = await unwrapApiResponse<AuthResponse>(api.post('/auth/login', payload));
      persistAuth(auth);
      set({
        user: auth.user,
        accessToken: auth.tokens.accessToken,
        refreshToken: auth.tokens.refreshToken,
        isAuthenticated: true,
        isLoading: false,
        error: null
      });
    } catch (error) {
      set({ isLoading: false, error: getApiErrorMessage(error) });
      throw error;
    }
  },

  register: async (payload) => {
    set({ isLoading: true, error: null });

    try {
      const auth = await unwrapApiResponse<AuthResponse>(api.post('/auth/register', payload));
      persistAuth(auth);
      set({
        user: auth.user,
        accessToken: auth.tokens.accessToken,
        refreshToken: auth.tokens.refreshToken,
        isAuthenticated: true,
        isLoading: false,
        error: null
      });
    } catch (error) {
      set({ isLoading: false, error: getApiErrorMessage(error) });
      throw error;
    }
  },

  refreshSession: async () => {
    const refreshToken = get().refreshToken ?? window.localStorage.getItem(AUTH_STORAGE_KEYS.refreshToken);

    if (!refreshToken) {
      get().logout();
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const auth = await unwrapApiResponse<AuthResponse>(api.post('/auth/refresh', { refreshToken }));
      persistAuth(auth);
      set({
        user: auth.user,
        accessToken: auth.tokens.accessToken,
        refreshToken: auth.tokens.refreshToken,
        isAuthenticated: true,
        isLoading: false,
        error: null
      });
    } catch (error) {
      clearAuthStorage();
      set({
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,
        error: getApiErrorMessage(error)
      });
    }
  },

  logout: () => {
    clearAuthStorage();
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null
    });
  },

  clearError: () => {
    set({ error: null });
  }
}));
