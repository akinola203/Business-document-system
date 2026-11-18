import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const DEFAULT_PROD_API_URL = 'https://aoa77-backend.onrender.com/api/v1';

const rawEnvUrl = (
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  DEFAULT_PROD_API_URL
)?.trim();

export const API_BASE_URL = rawEnvUrl
  ? (rawEnvUrl.endsWith('/api/v1') ? rawEnvUrl : `${rawEnvUrl.replace(/\/+$/, '')}/api/v1`)
  : DEFAULT_PROD_API_URL;

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Purges all stale auth tokens and user records from storage
 */
export const clearAuthState = () => {
  localStorage.removeItem('aoa_access_token');
  localStorage.removeItem('aoa_refresh_token');
  localStorage.removeItem('aoa_user');
  sessionStorage.removeItem('aoa_access_token');
  sessionStorage.removeItem('aoa_refresh_token');
  sessionStorage.removeItem('aoa_user');
};

const recentIdempotencyFingerprints = new Map<string, { key: string; expiresAt: number }>();

function generateUuidV4(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function resolveIdempotencyKeyForPost(url: string, data: unknown): string {
  const now = Date.now();
  for (const [k, v] of recentIdempotencyFingerprints.entries()) {
    if (now >= v.expiresAt) {
      recentIdempotencyFingerprints.delete(k);
    }
  }
  let bodySig = '';
  try {
    bodySig = typeof data === 'string' ? data : JSON.stringify(data ?? {});
  } catch {
    bodySig = String(now);
  }
  const fingerprint = `${url}::${bodySig}`;
  const existing = recentIdempotencyFingerprints.get(fingerprint);
  if (existing && now < existing.expiresAt) {
    return existing.key;
  }
  const key = generateUuidV4();
  // Deduplicate rapid double-clicks within a 3-second window
  recentIdempotencyFingerprints.set(fingerprint, { key, expiresAt: now + 3000 });
  return key;
}

// Request interceptor: Attach access token & automatic Idempotency-Key for financial/document POSTs
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('aoa_access_token') || sessionStorage.getItem('aoa_access_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    const method = (config.method || 'get').toLowerCase();
    const url = config.url || '';
    const isMutating =
      method === 'post' || method === 'put' || method === 'patch' || method === 'delete';
    if (
      isMutating &&
      config.headers &&
      !config.headers['Idempotency-Key'] &&
      !config.headers['idempotency-key'] &&
      !url.includes('/auth/')
    ) {
      config.headers['Idempotency-Key'] =
        method === 'post'
          ? resolveIdempotencyKeyForPost(url, config.data)
          : generateUuidV4();
    }

    return config;
  },
  (error) => Promise.reject(error),
);

// Shared single-flight refresh promise to prevent concurrent refreshes
let refreshPromise: Promise<string> | null = null;

// Response interceptor: Handle 401 with single-flight token rotation & 502/503/504 exponential backoff
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as (InternalAxiosRequestConfig & {
      _retry?: boolean;
      _backoffCount?: number;
    }) | undefined;

    if (!originalRequest) {
      return Promise.reject(error);
    }

    const status = error.response?.status;
    const isTransientServerError =
      status === 502 ||
      status === 503 ||
      status === 504 ||
      status === 408 ||
      error.code === 'ECONNABORTED';

    if (isTransientServerError) {
      const attempt = originalRequest._backoffCount || 0;
      if (attempt < 2) {
        originalRequest._backoffCount = attempt + 1;
        const jitter = Math.floor(Math.random() * 250);
        const delayMs = 400 * Math.pow(2, attempt) + jitter;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        return apiClient(originalRequest);
      }
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      const url = originalRequest.url || '';
      // Skip refresh for login and refresh endpoints to prevent infinite loops
      if (url.includes('/auth/login') || url.includes('/auth/refresh')) {
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      if (!refreshPromise) {
        refreshPromise = axios
          .post(
            `${API_BASE_URL}/auth/refresh`,
            {},
            { withCredentials: true }
          )
          .then((res) => {
            const payload = res.data?.data || res.data;
            const newAccessToken = payload?.accessToken;
            if (!newAccessToken) {
              throw new Error('No access token returned from refresh endpoint');
            }
            const isRemembered = localStorage.getItem('aoa_remember_me') !== 'false';
            if (isRemembered) {
              localStorage.setItem('aoa_access_token', newAccessToken);
            } else {
              sessionStorage.setItem('aoa_access_token', newAccessToken);
            }
            apiClient.defaults.headers.common.Authorization = `Bearer ${newAccessToken}`;
            return newAccessToken;
          })
          .catch((refreshErr) => {
            clearAuthState();
            if (typeof window !== 'undefined') {
              if (window.location.protocol === 'file:') {
                if (!window.location.hash.startsWith('#/login')) {
                  window.location.hash = '#/login';
                }
              } else if (window.location.pathname !== '/login') {
                window.location.href = '/login';
              }
            }
            throw refreshErr;
          })
          .finally(() => {
            refreshPromise = null;
          });
      }

      try {
        const token = await refreshPromise;
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${token}`;
        }
        return apiClient(originalRequest);
      } catch (err) {
        return Promise.reject(err);
      }
    }

    return Promise.reject(error);
  },
);
