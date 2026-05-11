import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api';

export const AUTH_STORAGE_KEYS = {
  accessToken: 'immersphere.auth.accessToken',
  refreshToken: 'immersphere.auth.refreshToken',
  user: 'immersphere.auth.user'
} as const;

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface RefreshResponse {
  user: unknown;
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

const refreshClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 20000
});

let refreshPromise: Promise<string | null> | null = null;

function getStoredAccessToken(): string | null {
  return window.localStorage.getItem(AUTH_STORAGE_KEYS.accessToken);
}

function getStoredRefreshToken(): string | null {
  return window.localStorage.getItem(AUTH_STORAGE_KEYS.refreshToken);
}

function persistTokens(tokens: RefreshResponse['tokens']): void {
  window.localStorage.setItem(AUTH_STORAGE_KEYS.accessToken, tokens.accessToken);
  window.localStorage.setItem(AUTH_STORAGE_KEYS.refreshToken, tokens.refreshToken);
}

function clearStoredAuth(): void {
  window.localStorage.removeItem(AUTH_STORAGE_KEYS.accessToken);
  window.localStorage.removeItem(AUTH_STORAGE_KEYS.refreshToken);
  window.localStorage.removeItem(AUTH_STORAGE_KEYS.user);
}

function redirectToLogin(): void {
  if (window.location.pathname !== '/login') {
    window.location.assign('/login');
  }
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getStoredRefreshToken();

  if (!refreshToken) {
    return null;
  }

  const response = await refreshClient.post<ApiEnvelope<RefreshResponse>>('/auth/refresh', {
    refreshToken
  });

  if (!response.data.success || !response.data.data?.tokens) {
    return null;
  }

  persistTokens(response.data.data.tokens);
  window.localStorage.setItem(AUTH_STORAGE_KEYS.user, JSON.stringify(response.data.data.user));

  return response.data.data.tokens.accessToken;
}

api.interceptors.request.use((config) => {
  const token = getStoredAccessToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiEnvelope<unknown>>) => {
    const originalRequest = error.config as RetryableRequestConfig | undefined;

    if (!originalRequest || error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      refreshPromise = refreshPromise ?? refreshAccessToken();
      const newAccessToken = await refreshPromise;
      refreshPromise = null;

      if (!newAccessToken) {
        clearStoredAuth();
        redirectToLogin();
        return Promise.reject(error);
      }

      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      refreshPromise = null;
      clearStoredAuth();
      redirectToLogin();
      return Promise.reject(refreshError);
    }
  }
);

export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError<ApiEnvelope<unknown>>(error)) {
    return error.response?.data?.error ?? error.message ?? 'Error de comunicación con la API.';
  }

  return error instanceof Error ? error.message : 'Error inesperado.';
}

export async function unwrapApiResponse<T>(request: Promise<{ data: ApiEnvelope<T> }>): Promise<T> {
  const response = await request;

  if (!response.data.success || typeof response.data.data === 'undefined') {
    throw new Error(response.data.error ?? 'Respuesta inválida de la API.');
  }

  return response.data.data;
}
